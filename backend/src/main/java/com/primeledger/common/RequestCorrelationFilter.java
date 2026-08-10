package com.primeledger.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives every request an ID, puts it in the logging context, and echoes it back
 * on the response (proposal §12, Phase 2: "JSON logging with request
 * correlation").
 *
 * <p>The same value appears in the structured log line and in the error
 * envelope, so a user reporting a failure hands over one string that finds the
 * exact request in the logs.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    /** The current request's ID, or {@code null} outside a request. */
    public static String currentRequestId() {
        return MDC.get(MDC_KEY);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String requestId = resolve(request.getHeader(HEADER));
        MDC.put(MDC_KEY, requestId);
        response.setHeader(HEADER, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            // Thread-pooled containers reuse threads; a stale ID here would
            // mislabel the next request's logs.
            MDC.remove(MDC_KEY);
        }
    }

    /**
     * An inbound ID is trusted only if it is a well-formed UUID. Anything else
     * is caller-controlled text heading for the log file.
     */
    private static String resolve(String inbound) {
        if (inbound == null || inbound.isBlank()) {
            return UUID.randomUUID().toString();
        }
        try {
            return UUID.fromString(inbound.trim()).toString();
        } catch (IllegalArgumentException e) {
            return UUID.randomUUID().toString();
        }
    }
}
