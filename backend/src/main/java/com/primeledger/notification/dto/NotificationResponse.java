package com.primeledger.notification.dto;

import com.primeledger.notification.NotificationKind;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Schema(name = "Notification")
public record NotificationResponse(
        UUID id,
        NotificationKind kind,
        @Schema(example = "Groceries is over budget") String title,
        @Schema(example = "You have spent 1,050.00 of your 1,000.00 limit for August.")
                String body,
        UUID budgetId,
        @Schema(example = "2026-08-01") LocalDate periodStart,
        @Schema(example = "100") Short threshold,
        @Schema(name = "isRead") boolean read,
        Instant createdAt) {}
