package com.primeledger.profile.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * The caller's profile (§6.3).
 *
 * @param baseCurrency the currency reporting totals are expressed in. Accounts
 *     keep their own; this is what they are compared in (F-05).
 */
@Schema(name = "Profile")
public record ProfileResponse(
        UUID id,
        @Schema(example = "Thasindu") String displayName,
        String avatarUrl,
        @Schema(example = "LKR") String baseCurrency,
        @Schema(example = "en-US") String locale,
        @Schema(example = "system") String theme,
        @Schema(example = "yyyy-MM-dd") String dateFormat) {}
