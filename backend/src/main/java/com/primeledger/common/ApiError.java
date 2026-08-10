package com.primeledger.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * The error envelope. Identical shape on every non-2xx response (proposal §8.2)
 * so the client has exactly one error branch to write.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ApiError", description = "Error envelope returned by every non-2xx response")
public record ApiError(
        @Schema(example = "2026-08-09T10:14:22Z") Instant timestamp,
        @Schema(example = "400") int status,
        @Schema(example = "VALIDATION_FAILED") String error,
        @Schema(example = "Request contains invalid fields") String message,
        @Schema(example = "/api/v1/transactions") String path,
        @Schema(example = "a3f9c1e2-6d20-4f0e-9a1a-2f3c4d5e6f70") String requestId,
        List<FieldError> fieldErrors) {

    /** One rejected field. Absent entirely when nothing field-level failed. */
    @Schema(name = "FieldError")
    public record FieldError(
            @Schema(example = "amount") String field,
            @Schema(example = "must be greater than 0") String message) {}

    public static ApiError of(ErrorCode code, String message, String path, String requestId) {
        return new ApiError(
                Instant.now(), code.status().value(), code.name(), message, path, requestId, null);
    }

    public static ApiError of(
            ErrorCode code,
            String message,
            String path,
            String requestId,
            List<FieldError> fieldErrors) {
        return new ApiError(
                Instant.now(),
                code.status().value(),
                code.name(),
                message,
                path,
                requestId,
                fieldErrors == null || fieldErrors.isEmpty() ? null : fieldErrors);
    }
}
