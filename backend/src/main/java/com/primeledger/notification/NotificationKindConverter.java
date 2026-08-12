package com.primeledger.notification;

import com.primeledger.common.LowerCaseEnumConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class NotificationKindConverter extends LowerCaseEnumConverter<NotificationKind> {

    public NotificationKindConverter() {
        super(NotificationKind.class);
    }
}
