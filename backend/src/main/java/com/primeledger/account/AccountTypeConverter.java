package com.primeledger.account;

import com.primeledger.common.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class AccountTypeConverter extends LowerCaseEnumConverter<AccountType> {

    public AccountTypeConverter() {
        super(AccountType.class);
    }
}
