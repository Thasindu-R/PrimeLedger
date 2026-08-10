package com.primeledger.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Turns every failure into the one error envelope (proposal §8.2).
 *
 * <p>No handler here returns a stack trace or an exception class name. A 500
 * says only that something failed and gives the request ID that finds the
 * detail in the logs.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Everything the application throws on purpose. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex, HttpServletRequest request) {
        return respond(ex.getCode(), ex.getMessage(), request, null);
    }

    /** @Valid on a request body. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleInvalidBody(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        List<ApiError.FieldError> fields =
                ex.getBindingResult().getFieldErrors().stream()
                        .map(f -> new ApiError.FieldError(f.getField(), f.getDefaultMessage()))
                        .sorted(Comparator.comparing(ApiError.FieldError::field))
                        .toList();

        return respond(
                ErrorCode.VALIDATION_FAILED, "Request contains invalid fields", request, fields);
    }

    /** Constraints on query parameters and path variables. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleInvalidParams(
            ConstraintViolationException ex, HttpServletRequest request) {

        List<ApiError.FieldError> fields =
                ex.getConstraintViolations().stream()
                        .map(v -> new ApiError.FieldError(
                                lastNode(v.getPropertyPath().toString()), v.getMessage()))
                        .sorted(Comparator.comparing(ApiError.FieldError::field))
                        .toList();

        return respond(
                ErrorCode.VALIDATION_FAILED, "Request contains invalid fields", request, fields);
    }

    /** Malformed JSON, or a body that will not bind at all. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(
            HttpMessageNotReadableException ex, HttpServletRequest request) {
        return respond(
                ErrorCode.VALIDATION_FAILED, "Request body could not be parsed", request, null);
    }

    /** {@code ?page=abc} against an int, or a malformed UUID in the path. */
    @ExceptionHandler({
        MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class
    })
    public ResponseEntity<ApiError> handleBadParameter(Exception ex, HttpServletRequest request) {
        String field =
                ex instanceof MethodArgumentTypeMismatchException mismatch
                        ? mismatch.getName()
                        : ((MissingServletRequestParameterException) ex).getParameterName();
        return respond(
                ErrorCode.VALIDATION_FAILED,
                "Request contains invalid fields",
                request,
                List.of(new ApiError.FieldError(field, "is missing or of the wrong type")));
    }

    /**
     * A database constraint the service did not check first. The check
     * constraints in V1 are the last line of defence, so reaching one is a real
     * possibility rather than a theoretical one.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleIntegrityViolation(
            DataIntegrityViolationException ex, HttpServletRequest request) {
        log.warn("Database constraint rejected the request", ex);
        return respond(
                ErrorCode.CONFLICT, "The request conflicts with existing data", request, null);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiError> handleNoHandler(
            NoHandlerFoundException ex, HttpServletRequest request) {
        return respond(ErrorCode.NOT_FOUND, "No endpoint at this path", request, null);
    }

    /** The catch-all. Logged in full, reported in the vaguest terms possible. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception serving {} {}", request.getMethod(), request.getRequestURI(), ex);
        return respond(
                ErrorCode.INTERNAL_ERROR,
                "The request could not be completed. Quote the request ID when reporting this.",
                request,
                null);
    }

    private static ResponseEntity<ApiError> respond(
            ErrorCode code,
            String message,
            HttpServletRequest request,
            List<ApiError.FieldError> fieldErrors) {

        HttpStatus status = code.status();
        ApiError body =
                ApiError.of(
                        code,
                        message,
                        request.getRequestURI(),
                        RequestCorrelationFilter.currentRequestId(),
                        fieldErrors);
        return ResponseEntity.status(status).body(body);
    }

    /** {@code createTransaction.request.amount} reads better as {@code amount}. */
    private static String lastNode(String propertyPath) {
        int lastDot = propertyPath.lastIndexOf('.');
        return lastDot < 0 ? propertyPath : propertyPath.substring(lastDot + 1);
    }
}
