package com.primeledger.transaction;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.primeledger.common.ApiException;
import com.primeledger.common.PageResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The wire contract: status codes and the error envelope of §8.2. The service
 * is mocked — what is under test here is the HTTP surface, not the domain.
 */
@WebMvcTest(TransactionController.class)
class TransactionControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private TransactionService service;

    @Test
    @DisplayName("a rejected body comes back as VALIDATION_FAILED listing every bad field")
    void reportsFieldErrors() throws Exception {
        String body =
                """
                {
                  "accountId": "%s",
                  "categoryId": "%s",
                  "type": "EXPENSE",
                  "amount": "-5.00",
                  "currency": "usd",
                  "occurredOn": "2026-08-09"
                }
                """
                        .formatted(UUID.randomUUID(), UUID.randomUUID());

        mockMvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_FAILED")))
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.path", is("/api/v1/transactions")))
                .andExpect(jsonPath("$.timestamp", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors", hasSize(2)))
                .andExpect(
                        jsonPath("$.fieldErrors[*].field", containsInAnyOrder("amount", "currency")));
    }

    @Test
    @DisplayName("a missing required field is reported rather than defaulted")
    void reportsMissingField() throws Exception {
        String body = """
                {"type": "EXPENSE"}
                """;

        mockMvc.perform(post("/api/v1/transactions").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_FAILED")));
    }

    @Test
    @DisplayName("malformed JSON does not reach the service")
    void rejectsMalformedJson() throws Exception {
        mockMvc.perform(
                        post("/api/v1/transactions")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_FAILED")));
    }

    @Test
    @DisplayName("a non-UUID path variable is a 400, not a 500")
    void rejectsMalformedId() throws Exception {
        mockMvc.perform(get("/api/v1/transactions/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_FAILED")));
    }

    @Test
    @DisplayName("a missing transaction is a 404 carrying the same envelope")
    void reportsNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.get(id)).thenThrow(ApiException.notFound("Transaction", id));

        mockMvc.perform(get("/api/v1/transactions/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("NOT_FOUND")))
                .andExpect(jsonPath("$.requestId", notNullValue()));
    }

    @Test
    @DisplayName("an unexpected failure is a 500 that leaks neither class name nor stack trace")
    void hidesInternalFailure() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.get(id)).thenThrow(new IllegalStateException("connection pool exhausted"));

        mockMvc.perform(get("/api/v1/transactions/{id}", id))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error", is("INTERNAL_ERROR")))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("connection pool"))));
    }

    @Test
    @DisplayName("an unfiltered list binds with no query parameters at all")
    void listsWithoutAnyParameters() throws Exception {
        when(service.list(any(), any()))
                .thenReturn(new PageResponse<>(List.of(), 0, 50, 0, 0, true, true));

        mockMvc.perform(get("/api/v1/transactions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(0)))
                .andExpect(jsonPath("$.page", is(0)));
    }

    @Test
    @DisplayName("an unsortable field is rejected by the controller before the service is reached")
    void rejectsUnknownSort() throws Exception {
        mockMvc.perform(get("/api/v1/transactions").param("sort", "userId"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_FAILED")))
                .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("userId")));

        verifyNoInteractions(service);
    }
}
