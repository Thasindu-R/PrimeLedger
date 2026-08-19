package com.primeledger.recurring;

import com.primeledger.common.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class FrequencyConverter extends LowerCaseEnumConverter<Frequency> {

    public FrequencyConverter() {
        super(Frequency.class);
    }
}
