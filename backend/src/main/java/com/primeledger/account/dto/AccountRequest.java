package com.primeledger.account.dto;

import com.primeledger.account.AccountType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Create and update payload for an account (F-01).
 *
 * <p>{@code openingBalance} may be negative — a credit card starts in debt, and
 * refusing that would make the one account type most people carry unusable.
 */
@Schema(name = "AccountRequest")
public record AccountRequest(
        @NotBlank @Size(max = 100) @Schema(example = "Everyday") String name,
        @NotNull AccountType type,
        @NotNull
                @Pattern(regexp = "^[A-Z]{3}$", message = "must be a three-letter ISO 4217 code")
                @Schema(example = "USD")
                String currency,
        @NotNull
                @Digits(integer = 13, fraction = 2)
                @DecimalMin(value = "-9999999999999.99")
                @DecimalMax(value = "9999999999999.99")
                @Schema(
                        type = "string",
                        example = "0.00",
                        description = "Exact decimal, sent as a string. May be negative.")
                BigDecimal openingBalance,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "must be a hex colour like #4F46E5")
                @Schema(example = "#4F46E5")
                String colour) {}
