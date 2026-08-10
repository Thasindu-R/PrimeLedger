package com.primeledger.common;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestCorrelationFilterTest {

    private final RequestCorrelationFilter filter = new RequestCorrelationFilter();

    @Test
    @DisplayName("generates an id and echoes it on the response")
    void generatesId() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        String header = response.getHeader(RequestCorrelationFilter.HEADER);
        assertThat(header).isNotNull();
        assertThat(UUID.fromString(header)).isNotNull();
    }

    @Test
    @DisplayName("reuses a well-formed inbound id so a trace spans services")
    void reusesInboundId() throws Exception {
        String inbound = UUID.randomUUID().toString();
        var request = new MockHttpServletRequest();
        request.addHeader(RequestCorrelationFilter.HEADER, inbound);
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        assertThat(response.getHeader(RequestCorrelationFilter.HEADER)).isEqualTo(inbound);
    }

    @Test
    @DisplayName("replaces a malformed inbound id rather than logging caller-controlled text")
    void rejectsMalformedInboundId() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestCorrelationFilter.HEADER, "not-a-uuid\nInjected: line");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {});

        String header = response.getHeader(RequestCorrelationFilter.HEADER);
        assertThat(header).doesNotContain("Injected");
        assertThat(UUID.fromString(header)).isNotNull();
    }

    @Test
    @DisplayName("exposes the id to the request and clears it afterwards")
    void clearsMdcAfterwards() throws Exception {
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        var seen = new String[1];

        FilterChain chain = (req, res) -> seen[0] = RequestCorrelationFilter.currentRequestId();
        filter.doFilter(request, response, chain);

        assertThat(seen[0]).isEqualTo(response.getHeader(RequestCorrelationFilter.HEADER));
        // A pooled thread must not carry the previous request's id into the next.
        assertThat(MDC.get(RequestCorrelationFilter.MDC_KEY)).isNull();
    }
}
