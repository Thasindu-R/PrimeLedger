package com.primeledger.common;

import java.util.UUID;
import lombok.Getter;

/**
 * Base for every error the application raises deliberately. Carrying the
 * {@link ErrorCode} on the exception is what lets
 * {@link GlobalExceptionHandler} stay a single, short class instead of a
 * growing switch over exception types.
 */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    protected ApiException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Absent, or owned by somebody else — the caller cannot tell which, and that
     * is the point (proposal §8.2).
     */
    public static ApiException notFound(String resource, UUID id) {
        return new ApiException(ErrorCode.NOT_FOUND, "%s %s was not found".formatted(resource, id));
    }

    /** A request the framework accepted but the application will not. */
    public static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }

    /** Structurally valid, domain-invalid. */
    public static ApiException businessRule(String message) {
        return new ApiException(ErrorCode.BUSINESS_RULE, message);
    }

    /** Uniqueness violation, or an update against a stale row. */
    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message);
    }
}
