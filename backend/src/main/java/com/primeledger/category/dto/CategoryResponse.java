package com.primeledger.category.dto;

import com.primeledger.category.CategoryKind;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(name = "Category")
public record CategoryResponse(
        UUID id,
        @Schema(example = "Groceries") String name,
        CategoryKind kind,
        @Schema(example = "shopping-cart") String icon,
        @Schema(example = "#4F46E5") String colour,
        @Schema(description = "System categories are shared and cannot be edited or deleted")
                boolean system,
        int sortOrder,
        Instant createdAt,
        Instant updatedAt) {}
