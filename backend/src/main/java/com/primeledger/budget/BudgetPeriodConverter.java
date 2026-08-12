package com.primeledger.budget;

import com.primeledger.common.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class BudgetPeriodConverter extends LowerCaseEnumConverter<BudgetPeriod> {

    public BudgetPeriodConverter() {
        super(BudgetPeriod.class);
    }
}
