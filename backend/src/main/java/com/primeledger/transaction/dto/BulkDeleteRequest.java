package com.primeledger.transaction.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** Body for {@code POST /transactions/bulk-delete} (proposal §8.1). */
@Schema(name = "BulkDeleteRequest")
public record BulkDeleteRequest(
        @NotEmpty
                @Size(max = 500, message = "cannot delete more than 500 transactions at once")
                List<UUID> ids) {}
