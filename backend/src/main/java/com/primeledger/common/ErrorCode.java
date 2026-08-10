package com.primeledger.common;

import org.springframework.http.HttpStatus;

/**
 * The closed set of error codes the API is allowed to return (proposal §8.2).
 *
 * <p>The code, not the message, is the contract: clients switch on it and the
 * message is free to change wording.
 */
public enum ErrorCode {

    /** Bean Validation rejected one or more fields. */
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),

    /** Token missing, malformed or expired. */
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED),

    /** Authenticated but not permitted. */
    FORBIDDEN(HttpStatus.FORBIDDEN),

    /**
     * Resource absent, or owned by another user. The two are deliberately
     * indistinguishable — telling them apart leaks the existence of other
     * users' rows.
     */
    NOT_FOUND(HttpStatus.NOT_FOUND),

    /** Stale updated_at, or a uniqueness violation. */
    CONFLICT(HttpStatus.CONFLICT),

    /** Structurally valid but domain-invalid. */
    BUSINESS_RULE(HttpStatus.UNPROCESSABLE_ENTITY),

    /** Bucket exhausted; the response carries Retry-After. */
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),

    /** Unhandled — logged with the request ID, never leaks a stack trace. */
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
