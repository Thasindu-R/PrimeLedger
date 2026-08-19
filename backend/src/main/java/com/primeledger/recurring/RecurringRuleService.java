package com.primeledger.recurring;

import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryService;
import com.primeledger.common.ApiException;
import com.primeledger.recurring.dto.RecurringRuleRequest;
import com.primeledger.recurring.dto.RecurringRuleResponse;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.CategoryKindRule;
import com.primeledger.transaction.TransactionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recurring rules: the standing instructions, not the transactions they produce
 * (F-03). Producing those is {@link RecurringMaterialiser}'s job.
 */
@Service
public class RecurringRuleService {

    /**
     * How far back a rule may be dated at creation.
     *
     * <p>Backdating is a real use — "my rent has gone out on the 1st since
     * March" — and the first sweep materialising those occurrences is the point.
     * Unbounded backdating is not: a daily rule dated five years ago would
     * generate eighteen hundred transactions from one form submission, and the
     * user who typed 2021 instead of 2026 would have no idea what had happened
     * to their ledger. Two years is comfortably more than the honest case needs.
     */
    private static final int MAX_BACKDATE_MONTHS = 24;

    private final RecurringRuleRepository rules;
    private final TransactionRepository transactions;
    private final AccountRepository accounts;
    private final CategoryService categories;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public RecurringRuleService(
            RecurringRuleRepository rules,
            TransactionRepository transactions,
            AccountRepository accounts,
            CategoryService categories,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.rules = rules;
        this.transactions = transactions;
        this.accounts = accounts;
        this.categories = categories;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RecurringRuleResponse> list() {
        UUID userId = currentUser.currentUserId();
        List<RecurringRule> owned = rules.findAllOwned(userId);
        if (owned.isEmpty()) return List.of();

        Map<UUID, String> accountNames = accountNames(userId);
        return owned.stream()
                .map(rule -> toResponse(rule, accountNames, generatedCount(rule)))
                .toList();
    }

    @Transactional(readOnly = true)
    public RecurringRuleResponse get(UUID id) {
        RecurringRule rule = ownedOrThrow(id);
        return toResponse(rule, accountNames(rule.getUserId()), generatedCount(rule));
    }

    @Transactional
    public RecurringRuleResponse create(RecurringRuleRequest request) {
        UUID userId = currentUser.currentUserId();

        if (rules.existsByUserIdAndNameIgnoreCase(userId, request.name().trim())) {
            throw ApiException.conflict(
                    "A recurring rule called '%s' already exists".formatted(request.name().trim()));
        }

        RecurringRule rule = new RecurringRule();
        rule.setUserId(userId);
        apply(request, rule, userId, true);

        try {
            rules.saveAndFlush(rule);
        } catch (DataIntegrityViolationException race) {
            throw ApiException.conflict(
                    "A recurring rule called '%s' already exists".formatted(rule.getName()));
        }

        return toResponse(rule, accountNames(userId), 0L);
    }

    @Transactional
    public RecurringRuleResponse update(UUID id, RecurringRuleRequest request) {
        RecurringRule rule = ownedOrThrow(id);
        UUID userId = rule.getUserId();

        if (rules.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, request.name().trim(), id)) {
            throw ApiException.conflict(
                    "A recurring rule called '%s' already exists".formatted(request.name().trim()));
        }

        apply(request, rule, userId, false);
        rules.saveAndFlush(rule);

        return toResponse(rule, accountNames(userId), generatedCount(rule));
    }

    /**
     * Deletes the instruction and keeps everything it did.
     *
     * <p>"Delete rule; generated transactions are retained" (§8.1). They are
     * severed first so the rows Hibernate is holding agree with the database —
     * see {@link TransactionRepository#severFromRule}.
     */
    @Transactional
    public void delete(UUID id) {
        RecurringRule rule = ownedOrThrow(id);
        transactions.severFromRule(rule.getUserId(), rule.getId());
        rules.delete(rule);
    }

    // ---------------------------------------------------------------- internals

    private void apply(
            RecurringRuleRequest request, RecurringRule rule, UUID userId, boolean creating) {

        Account account =
                accounts.findByIdAndUserId(request.accountId(), userId)
                        .orElseThrow(() -> ApiException.notFound("Account", request.accountId()));

        if (account.isArchived()) {
            throw ApiException.businessRule(
                    "'%s' is archived and cannot take new transactions"
                            .formatted(account.getName()));
        }

        Category category = categories.requireUsable(request.categoryId(), userId);
        CategoryKindRule.requireMatches(category, request.type(), "recurring rule");

        if (creating) {
            requireSaneStart(request.startsOn());
        }
        if (request.endsOn() != null && request.endsOn().isBefore(request.startsOn())) {
            throw ApiException.validation("endsOn must not be before startsOn");
        }

        rule.setName(request.name().trim());
        rule.setAccountId(account.getId());
        rule.setCategory(category);
        rule.setType(request.type());
        rule.setAmount(request.amount());
        // The account's currency, never the client's: a rule that generated
        // rupee transactions into a dollar account would be uninterpretable
        // downstream, and nothing would catch it until a total looked wrong.
        rule.setCurrency(account.getCurrency());
        rule.setDescription(
                request.description() == null || request.description().isBlank()
                        ? null
                        : request.description().trim());
        rule.setFrequency(request.frequency());
        rule.setInterval(request.intervalOrDefault());
        rule.setStartsOn(request.startsOn());
        rule.setEndsOn(request.endsOn());
        rule.setPaused(Boolean.TRUE.equals(request.paused()));

        rule.setNextRunOn(resumePoint(rule));
    }

    /**
     * Where the schedule should sit after a write.
     *
     * <p>Derived rather than stored-and-edited, so a change to the frequency or
     * the start date cannot leave {@code nextRunOn} on a date the new schedule
     * never visits. A rule that has already generated something resumes from the
     * occurrence after its last one; a rule that has not starts at the
     * beginning.
     */
    private static LocalDate resumePoint(RecurringRule rule) {
        return rule.getLastRunOn() == null
                ? rule.getStartsOn()
                : rule.getFrequency()
                        .next(rule.getStartsOn(), rule.getInterval(), rule.getLastRunOn());
    }

    private void requireSaneStart(LocalDate startsOn) {
        LocalDate earliest = LocalDate.now(clock).minusMonths(MAX_BACKDATE_MONTHS);
        if (startsOn.isBefore(earliest)) {
            throw ApiException.businessRule(
                    ("startsOn cannot be earlier than %s. A rule dated further back would "
                                    + "generate years of transactions the moment it is saved.")
                            .formatted(earliest));
        }
    }

    private RecurringRule ownedOrThrow(UUID id) {
        return rules.findByIdAndUserId(id, currentUser.currentUserId())
                .orElseThrow(() -> ApiException.notFound("Recurring rule", id));
    }

    private long generatedCount(RecurringRule rule) {
        return transactions.countByUserIdAndRecurringRuleIdAndDeletedAtIsNull(
                rule.getUserId(), rule.getId());
    }

    private Map<UUID, String> accountNames(UUID userId) {
        return accounts.findByUserIdOrderByNameAsc(userId).stream()
                .collect(
                        Collectors.toMap(
                                Account::getId, Account::getName, (a, b) -> a, HashMap::new));
    }

    static RecurringRuleResponse toResponse(
            RecurringRule rule, Map<UUID, String> accountNames, long generatedCount) {
        return new RecurringRuleResponse(
                rule.getId(),
                rule.getName(),
                rule.getAccountId(),
                accountNames.get(rule.getAccountId()),
                rule.getCategory().getId(),
                rule.getCategory().getName(),
                rule.getCategory().getColour(),
                rule.getType(),
                money(rule.getAmount()),
                rule.getCurrency(),
                rule.getDescription(),
                rule.getFrequency(),
                rule.getInterval(),
                rule.getStartsOn(),
                rule.isFinished() ? null : rule.getNextRunOn(),
                rule.getEndsOn(),
                rule.isPaused(),
                rule.isFinished(),
                rule.getLastRunOn(),
                generatedCount);
    }

    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
