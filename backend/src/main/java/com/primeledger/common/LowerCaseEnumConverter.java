package com.primeledger.common;

/**
 * Base for the enum ↔ column converters.
 *
 * <p>The V1 check constraints spell these values in lower snake case
 * ({@code 'credit_card'}, {@code 'income'}); Java spells them
 * {@code CREDIT_CARD}. {@code @Enumerated(STRING)} would write the Java
 * spelling and be rejected by the constraint, so the translation is explicit
 * and lives in one place.
 *
 * @param <E> the enum being converted
 */
public abstract class LowerCaseEnumConverter<E extends Enum<E>>
        implements jakarta.persistence.AttributeConverter<E, String> {

    private final Class<E> type;

    protected LowerCaseEnumConverter(Class<E> type) {
        this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(E attribute) {
        return attribute == null ? null : attribute.name().toLowerCase();
    }

    @Override
    public E convertToEntityAttribute(String dbValue) {
        return dbValue == null ? null : Enum.valueOf(type, dbValue.toUpperCase());
    }
}
