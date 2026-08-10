package com.primeledger.category;

import com.primeledger.common.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class CategoryKindConverter extends LowerCaseEnumConverter<CategoryKind> {

    public CategoryKindConverter() {
        super(CategoryKind.class);
    }
}
