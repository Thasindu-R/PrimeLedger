package com.primeledger.category.dto;

import com.primeledger.category.CategoryKind;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Create and update payload for a user-defined category.
 *
 * <p>Every constraint here has a matching check constraint in V1 — Bean
 * Validation is for the error message, the database is for the guarantee.
 */
@Schema(name = "CategoryRequest")
public record CategoryRequest(
        @NotBlank @Size(min = 1, max = 60) @Schema(example = "Groceries") String name,
        @NotNull CategoryKind kind,
        @Size(max = 60) String icon,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "must be a hex colour such as #4F46E5")
                @Schema(example = "#4F46E5")
                String colour,
        @PositiveOrZero Integer sortOrder) {

    /** Absent ordering sorts last-ish rather than failing validation. */
    public int sortOrderOrDefault() {
        return sortOrder == null ? 0 : sortOrder;
    }
}
