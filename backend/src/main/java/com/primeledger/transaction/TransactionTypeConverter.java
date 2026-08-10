package com.primeledger.transaction;

import com.primeledger.common.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TransactionTypeConverter extends LowerCaseEnumConverter<TransactionType> {

    public TransactionTypeConverter() {
        super(TransactionType.class);
    }
}
