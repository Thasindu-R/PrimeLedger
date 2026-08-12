package com.primeledger.budget;

import com.primeledger.budget.dto.BudgetRequest;
import com.primeledger.budget.dto.BudgetResponse;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryService;
import com.primeledger.common.ApiException;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Category budgets and where they stand (F-02). */
@Service
public class BudgetService {

    private final BudgetRepository budgets;
    private final TransactionRepository transactions;
    private final CategoryService categories;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public BudgetService(
            BudgetRepository budgets,
            TransactionRepository transactions,
            CategoryService categories,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.budgets = budgets;
        this.transactions = transactions;
        this.categories = categories;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    /** Every budget currently in force, with its position for this period. */
    @Transactional(readOnly = true)
    public List<BudgetResponse> current() {
        UUID userId = currentUser.currentUserId();
        return positionsOn(userId, LocalDate.now(clock)).stream()
                .map(BudgetService::toResponse)
                .toList();
    }

    @Transactional
    public BudgetResponse create(BudgetRequest request) {
        UUID userId = currentUser.currentUserId();
        Category category = spendableCategory(request.categoryId(), userId);

        LocalDate startsOn = resolveStart(request);

        if (budgets.existsByUserIdAndCategoryIdAndPeriodAndStartsOn(
                userId, category.getId(), request.period(), startsOn)) {
            throw ApiException.conflict(
                    "A %s budget for '%s' already starts on %s"
                            .formatted(
                                    request.period().name().toLowerCase(),
                                    category.getName(),
                                    startsOn));
        }

        Budget budget = new Budget();
        budget.setUserId(userId);
        budget.setCategory(category);
        budget.setPeriod(request.period());
        budget.setLimitAmount(request.limitAmount());
        budget.setStartsOn(startsOn);

        try {
            budgets.saveAndFlush(budget);
        } catch (DataIntegrityViolationException race) {
            throw ApiException.conflict(
                    "A budget for '%s' already starts on %s"
                            .formatted(category.getName(), startsOn));
        }

        return positionOf(budget, userId);
    }

    @Transactional
    public BudgetResponse update(UUID id, BudgetRequest request) {
        UUID userId = currentUser.currentUserId();
        Budget budget =
                budgets.findByIdAndUserId(id, userId)
                        .orElseThrow(() -> ApiException.notFound("Budget", id));

        // Editing a budget whose period has already ended would rewrite what was
        // reported at the time — the "period-scoped rather than absolute"
        // requirement in F-02. Setting a new limit going forward is a new row.
        LocalDate today = LocalDate.now(clock);
        if (budget.getPeriod().endOfPeriodContaining(budget.getStartsOn()).isBefore(today)) {
            throw ApiException.businessRule(
                    "That budget period has ended and cannot be changed. Create a budget for "
                            + "the current period instead.");
        }

        if (!budget.getCategory().getId().equals(request.categoryId())) {
            throw ApiException.businessRule(
                    "A budget cannot be moved to a different category. Delete it and create "
                            + "one for the other category.");
        }

        budget.setLimitAmount(request.limitAmount());
        budgets.saveAndFlush(budget);

        return positionOf(budget, userId);
    }

    @Transactional
    public void delete(UUID id) {
        Budget budget =
                budgets.findByIdAndUserId(id, currentUser.currentUserId())
                        .orElseThrow(() -> ApiException.notFound("Budget", id));
        budgets.delete(budget);
    }

    // ------------------------------------------------------------- positions

    /**
     * Where every in-force budget stands on {@code on}.
     *
     * <p>Shared with {@link BudgetEvaluator}, which needs exactly this and must
     * not compute it a second, subtly different way.
     */
    @Transactional(readOnly = true)
    public List<Position> positionsOn(UUID userId, LocalDate on) {
        List<Budget> effective = budgets.findEffectiveOn(userId, on);
        if (effective.isEmpty()) return List.of();

        // One spend query per distinct period length, not one per budget: at most
        // three, however many budgets the user has.
        Map<BudgetPeriod, Map<UUID, BigDecimal>> spendByPeriod =
                new EnumMap<>(BudgetPeriod.class);

        for (Budget budget : effective) {
            spendByPeriod.computeIfAbsent(
                    budget.getPeriod(), period -> spendFor(userId, period, on));
        }

        List<Position> positions = new ArrayList<>(effective.size());
        for (Budget budget : effective) {
            BigDecimal spent =
                    spendByPeriod
                            .get(budget.getPeriod())
                            .getOrDefault(budget.getCategory().getId(), BigDecimal.ZERO);
            positions.add(position(budget, spent, on));
        }
        return positions;
    }

    private Map<UUID, BigDecimal> spendFor(UUID userId, BudgetPeriod period, LocalDate on) {
        Map<UUID, BigDecimal> byCategory = new HashMap<>();
        transactions
                .spendByCategory(
                        userId,
                        TransactionType.EXPENSE,
                        period.startOfPeriodContaining(on),
                        period.endOfPeriodContaining(on))
                .forEach(row -> byCategory.put(row.getCategoryId(), row.getSpent()));
        return byCategory;
    }

    private BudgetResponse positionOf(Budget budget, UUID userId) {
        LocalDate today = LocalDate.now(clock);
        BigDecimal spent =
                spendFor(userId, budget.getPeriod(), today)
                        .getOrDefault(budget.getCategory().getId(), BigDecimal.ZERO);
        return toResponse(position(budget, spent, today));
    }

    private static Position position(Budget budget, BigDecimal spent, LocalDate on) {
        double percent = BudgetStatus.percentUsed(spent, budget.getLimitAmount());
        return new Position(
                budget,
                spent,
                budget.getPeriod().startOfPeriodContaining(on),
                budget.getPeriod().endOfPeriodContaining(on),
                percent,
                BudgetStatus.of(percent));
    }

    private LocalDate resolveStart(BudgetRequest request) {
        LocalDate requested =
                request.startsOn() == null
                        ? request.period().startOfPeriodContaining(LocalDate.now(clock))
                        : request.startsOn();

        if (!request.period().isPeriodStart(requested)) {
            throw ApiException.validation(
                    "startsOn must be the first day of a %s period; %s is not"
                            .formatted(request.period().name().toLowerCase(), requested));
        }
        return requested;
    }

    /**
     * Budgets limit spending, so an income category cannot have one — there is
     * nothing to be under or over.
     */
    private Category spendableCategory(UUID categoryId, UUID userId) {
        Category category = categories.requireUsable(categoryId, userId);
        if (category.getKind() != CategoryKind.EXPENSE) {
            throw ApiException.businessRule(
                    "'%s' is an income category and cannot be budgeted"
                            .formatted(category.getName()));
        }
        return category;
    }

    private static BudgetResponse toResponse(Position position) {
        Budget budget = position.budget();
        return new BudgetResponse(
                budget.getId(),
                budget.getCategory().getId(),
                budget.getCategory().getName(),
                budget.getCategory().getColour(),
                budget.getPeriod(),
                money(budget.getLimitAmount()),
                budget.getStartsOn(),
                position.periodStart(),
                position.periodEnd(),
                money(position.spent()),
                money(budget.getLimitAmount().subtract(position.spent())),
                Math.round(position.percentUsed() * 10) / 10.0,
                position.status());
    }

    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    /** A budget plus where it stands in one period. */
    public record Position(
            Budget budget,
            BigDecimal spent,
            LocalDate periodStart,
            LocalDate periodEnd,
            double percentUsed,
            BudgetStatus status) {}
}
