package com.primeledger.goal;

import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.common.ApiException;
import com.primeledger.goal.dto.GoalRequest;
import com.primeledger.goal.dto.GoalResponse;
import com.primeledger.security.CurrentUserProvider;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Savings goals and their projections (F-04). */
@Service
public class SavingsGoalService {

    /**
     * The trailing window the contribution rate is measured over.
     *
     * <p>Three months, as F-04 specifies, and the length is a judgement rather
     * than an arbitrary number: one month is a single salary cycle and swings
     * wildly on one unusual expense, while a year is slow to notice that
     * somebody has stopped saving. Three is long enough to average out a bad
     * month and short enough to reflect a change of habit.
     */
    private static final int TRAILING_MONTHS = 3;

    private final SavingsGoalRepository goals;
    private final AccountRepository accounts;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public SavingsGoalService(
            SavingsGoalRepository goals,
            AccountRepository accounts,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.goals = goals;
        this.accounts = accounts;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<GoalResponse> list() {
        UUID userId = currentUser.currentUserId();
        List<SavingsGoal> owned = goals.findByUserIdOrderByTargetDateAscNameAsc(userId);
        if (owned.isEmpty()) return List.of();

        Context context = contextFor(userId);
        return owned.stream().map(goal -> toResponse(goal, context)).toList();
    }

    @Transactional(readOnly = true)
    public GoalResponse get(UUID id) {
        SavingsGoal goal = ownedOrThrow(id);
        return toResponse(goal, contextFor(goal.getUserId()));
    }

    @Transactional
    public GoalResponse create(GoalRequest request) {
        UUID userId = currentUser.currentUserId();

        if (goals.existsByUserIdAndNameIgnoreCase(userId, request.name().trim())) {
            throw ApiException.conflict(
                    "A goal called '%s' already exists".formatted(request.name().trim()));
        }

        SavingsGoal goal = new SavingsGoal();
        goal.setUserId(userId);
        apply(request, goal, userId, true);

        try {
            goals.saveAndFlush(goal);
        } catch (DataIntegrityViolationException race) {
            throw ApiException.conflict(
                    "A goal called '%s' already exists".formatted(goal.getName()));
        }

        return toResponse(goal, contextFor(userId));
    }

    @Transactional
    public GoalResponse update(UUID id, GoalRequest request) {
        SavingsGoal goal = ownedOrThrow(id);
        UUID userId = goal.getUserId();

        if (goals.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, request.name().trim(), id)) {
            throw ApiException.conflict(
                    "A goal called '%s' already exists".formatted(request.name().trim()));
        }

        apply(request, goal, userId, false);
        goals.saveAndFlush(goal);

        return toResponse(goal, contextFor(userId));
    }

    @Transactional
    public void delete(UUID id) {
        goals.delete(ownedOrThrow(id));
    }

    // ---------------------------------------------------------------- internals

    private void apply(GoalRequest request, SavingsGoal goal, UUID userId, boolean creating) {
        Account account =
                accounts.findByIdAndUserId(request.accountId(), userId)
                        .orElseThrow(() -> ApiException.notFound("Account", request.accountId()));

        // A target date in the past is not a goal, it is a post-mortem — and
        // only on creation: an existing goal whose date has come and gone is a
        // normal state the card is expected to report on, and refusing to let
        // the user edit its name would be perverse.
        if (creating
                && request.targetDate() != null
                && request.targetDate().isBefore(LocalDate.now(clock))) {
            throw ApiException.validation("targetDate must not be in the past");
        }

        goal.setName(request.name().trim());
        goal.setAccountId(account.getId());
        goal.setTargetAmount(request.targetAmount());
        goal.setTargetDate(request.targetDate());
    }

    private SavingsGoal ownedOrThrow(UUID id) {
        return goals.findByIdAndUserId(id, currentUser.currentUserId())
                .orElseThrow(() -> ApiException.notFound("Goal", id));
    }

    /**
     * Everything every goal on the page needs, in three queries rather than
     * three per goal.
     */
    private Context contextFor(UUID userId) {
        LocalDate today = LocalDate.now(clock);
        LocalDate windowFrom = today.minusMonths(TRAILING_MONTHS);

        Map<UUID, Account> accountsById = new HashMap<>();
        accounts.findByUserIdOrderByNameAsc(userId)
                .forEach(account -> accountsById.put(account.getId(), account));

        Map<UUID, BigDecimal> allTime = new HashMap<>();
        accounts.movementsFor(userId)
                .forEach(row -> allTime.put(row.getAccountId(), row.getMovement()));

        Map<UUID, BigDecimal> window = new HashMap<>();
        accounts.movementsBetween(userId, windowFrom, today)
                .forEach(row -> window.put(row.getAccountId(), row.getMovement()));

        return new Context(today, windowFrom, accountsById, allTime, window);
    }

    private static GoalResponse toResponse(SavingsGoal goal, Context context) {
        Account account = context.accounts().get(goal.getAccountId());

        // The account is gone from under the goal. ON DELETE RESTRICT means this
        // cannot happen through the API, but a response that NPEs is a worse
        // answer than one that says the progress is unknown.
        BigDecimal opening = account == null ? BigDecimal.ZERO : account.getOpeningBalance();

        BigDecimal current =
                opening.add(
                        context.allTimeMovement()
                                .getOrDefault(goal.getAccountId(), BigDecimal.ZERO));

        // Net movement over the window, spread evenly. Net rather than
        // deposits-only on purpose: a user who paid in 20,000 and took 15,000
        // back out has saved 5,000, and a rate that counted only the paying-in
        // would project a date they have no chance of hitting.
        BigDecimal monthlyRate =
                context.windowMovement()
                        .getOrDefault(goal.getAccountId(), BigDecimal.ZERO)
                        .divide(BigDecimal.valueOf(TRAILING_MONTHS), 2, RoundingMode.HALF_UP);

        GoalProjection projection =
                GoalProjection.of(
                        current,
                        goal.getTargetAmount(),
                        goal.getTargetDate(),
                        monthlyRate,
                        context.today());

        return new GoalResponse(
                goal.getId(),
                goal.getName(),
                goal.getAccountId(),
                account == null ? null : account.getName(),
                account == null ? null : account.getColour(),
                account == null ? null : account.getCurrency(),
                money(goal.getTargetAmount()),
                goal.getTargetDate(),
                money(current),
                money(projection.remaining()),
                projection.progressPercent(),
                projection.achieved(),
                money(projection.requiredMonthly()),
                money(projection.monthlyRate()),
                projection.projectedCompletion(),
                projection.onTrack(),
                context.windowFrom(),
                context.today());
    }

    private static String money(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    /** The per-request lookups shared by every goal in one response. */
    private record Context(
            LocalDate today,
            LocalDate windowFrom,
            Map<UUID, Account> accounts,
            Map<UUID, BigDecimal> allTimeMovement,
            Map<UUID, BigDecimal> windowMovement) {}
}
