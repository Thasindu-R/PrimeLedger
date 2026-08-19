package com.primeledger.analytics.insight;

import com.primeledger.budget.Budget;
import com.primeledger.budget.BudgetPeriod;
import com.primeledger.budget.BudgetService;
import com.primeledger.budget.BudgetStatus;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Budget positions built from literals, for the rules that read them.
 *
 * <p>Only the three fields {@code MonthEndProjectionRule} actually looks at are
 * populated. Filling in a plausible category, user and period window would make
 * the fixture longer and the test no stronger — and would suggest the rule
 * depends on them, which is the sort of hint a reader is entitled to trust.
 */
final class TestBudgets {

    private TestBudgets() {}

    static BudgetService.Position monthly(String limit, String currency) {
        Budget budget = new Budget();
        budget.setPeriod(BudgetPeriod.MONTHLY);
        budget.setLimitAmount(new BigDecimal(limit));
        budget.setCurrency(currency);

        return new BudgetService.Position(
                budget,
                BigDecimal.ZERO,
                LocalDate.now(),
                LocalDate.now(),
                0,
                BudgetStatus.OK,
                0);
    }
}
