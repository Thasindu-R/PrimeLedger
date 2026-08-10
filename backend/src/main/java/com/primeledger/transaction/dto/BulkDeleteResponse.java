package com.primeledger.transaction.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Reports what a bulk delete actually did.
 *
 * <p>{@code requested} and {@code deleted} differ when some ids were already
 * deleted or belong to someone else. The caller is told the count rather than
 * which ids, because naming them would confirm they exist.
 */
@Schema(name = "BulkDeleteResponse")
public record BulkDeleteResponse(int requested, int deleted) {}
