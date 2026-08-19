package com.primeledger.recurring;

import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Materialises one rule, in one database transaction (F-03).
 *
 * <p>A separate bean from {@link RecurringMaterialiser} for a reason Spring
 * makes unavoidable and that is worth stating: {@code @Transactional} on a
 * method called from inside the same object does nothing at all — the call
 * never leaves the instance, so the proxy that would start the transaction is
 * never involved. The per-rule boundary is the whole idempotency design, so it
 * cannot be left to a self-invocation that silently is not one.
 *
 * <p>{@code REQUIRES_NEW} rather than the default: the sweep reads its work
 * list in a transaction of its own, and one rule that fails — a category deleted
 * between the read and the write, say — must not take the other fourteen down
 * with it.
 */
@Component
public class RecurringRuleWriter {

    private static final Logger log = LoggerFactory.getLogger(RecurringRuleWriter.class);

    /**
     * The most occurrences one rule may produce in one run.
     *
     * <p>A bound, not a schedule. Creation already refuses a start date more
     * than two years back, so the honest worst case is a daily rule after a long
     * outage; this caps the damage if a bug, a clock jump or a restored backup
     * ever presents the job with a rule whose {@code nextRunOn} is far older
     * than that. Whatever is left over is materialised on the next run, so the
     * cap delays catch-up rather than losing it.
     */
    static final int MAX_OCCURRENCES_PER_RUN = 400;

    private final RecurringRuleRepository rules;
    private final TransactionRepository transactions;

    public RecurringRuleWriter(RecurringRuleRepository rules, TransactionRepository transactions) {
        this.rules = rules;
        this.transactions = transactions;
    }

    /**
     * Creates every transaction this rule owes up to and including {@code on},
     * and advances the rule to match.
     *
     * <p>Both halves commit together or neither does, which is what makes an
     * interrupted run safe: the cursor never claims to have generated something
     * that was rolled back.
     *
     * @return how many transactions were created
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int materialise(UUID userId, UUID ruleId, LocalDate on) {
        // Re-read inside this transaction rather than taking the entity the
        // caller loaded: that one belongs to another persistence context and
        // another transaction, and writing through it would be writing through a
        // detached copy of a row that may since have changed.
        RecurringRule rule = rules.findByIdAndUserId(ruleId, userId).orElse(null);
        if (rule == null) {
            // Deleted between the sweep's read and now. Nothing to do, and
            // nothing wrong.
            return 0;
        }

        // Every occurrence this rule has already produced, in one query. The
        // check has to happen before the insert rather than by catching the
        // unique violation afterwards: a constraint violation puts the Hibernate
        // session into a state where nothing further can be done with it, so
        // "insert and recover" would abandon the rest of the catch-up.
        Set<LocalDate> existing =
                Set.copyOf(transactions.occurrenceDatesFor(userId, ruleId));

        int created = 0;

        while (rule.isDueOn(on) && created < MAX_OCCURRENCES_PER_RUN) {
            LocalDate occurrence = rule.getNextRunOn();

            if (!existing.contains(occurrence)) {
                write(rule, occurrence);
                created++;
            } else {
                // A previous run created this occurrence but did not commit the
                // advanced cursor. Skipping and advancing is the correct
                // outcome: the ledger already holds what this run was about to
                // write, and leaving the cursor here would retry it forever.
                log.debug("Occurrence {} of rule {} already exists; skipping", occurrence, ruleId);
            }

            rule.setLastRunOn(occurrence);
            rule.setNextRunOn(
                    rule.getFrequency().next(rule.getStartsOn(), rule.getInterval(), occurrence));
        }

        rules.saveAndFlush(rule);

        if (created == MAX_OCCURRENCES_PER_RUN && rule.isDueOn(on)) {
            log.warn(
                    "Recurring rule {} hit the per-run cap of {} occurrences; the rest will be "
                            + "materialised on the next run",
                    ruleId,
                    MAX_OCCURRENCES_PER_RUN);
        }

        return created;
    }

    private void write(RecurringRule rule, LocalDate occurrence) {
        Transaction transaction = new Transaction();
        transaction.setUserId(rule.getUserId());
        transaction.setAccountId(rule.getAccountId());
        transaction.setCategory(rule.getCategory());
        transaction.setRecurringRuleId(rule.getId());
        transaction.setType(rule.getType());
        transaction.setAmount(rule.getAmount());
        transaction.setCurrency(rule.getCurrency());
        transaction.setOccurredOn(occurrence);
        // The rule's name is the sensible fallback: a row in the ledger reading
        // "Rent" is more use than a blank one, and the user can edit it.
        transaction.setDescription(
                rule.getDescription() == null ? rule.getName() : rule.getDescription());

        // If idx_txn_rule_occurrence rejects this after the check above, two
        // runs are materialising the same rule at once. This transaction rolls
        // back whole — cursor included — and the next run does the work.
        transactions.saveAndFlush(transaction);
    }
}
