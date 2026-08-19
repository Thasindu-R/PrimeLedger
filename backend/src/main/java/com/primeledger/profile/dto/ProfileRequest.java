package com.primeledger.profile.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Update payload for the caller's profile (§6.3).
 *
 * <p>A full replacement rather than a patch, which is why every settable field
 * is present and most are optional-with-a-default rather than optional-meaning-
 * unchanged. A PATCH-shaped payload over a record needs a way to distinguish
 * "absent" from "null", and the profile is small enough that sending all of it
 * is cheaper than that distinction.
 */
@Schema(name = "ProfileRequest")
public record ProfileRequest(
        @NotBlank @Size(max = 100) @Schema(example = "Thasindu") String displayName,
        @Size(max = 500) String avatarUrl,
        @NotBlank
                @Pattern(
                        regexp = "^[A-Z]{3}$",
                        message = "must be a three-letter ISO 4217 code, upper case")
                @Schema(example = "LKR")
                String baseCurrency,
        @Size(max = 35) String locale,
        @Pattern(regexp = "^(light|dark|system)$", message = "must be light, dark or system")
                @Schema(example = "system")
                String theme,
        @Size(max = 20) String dateFormat) {}
