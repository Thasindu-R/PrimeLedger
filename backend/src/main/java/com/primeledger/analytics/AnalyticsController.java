package com.primeledger.analytics;

import com.primeledger.analytics.dto.SummaryResponse;
import com.primeledger.transaction.dto.TransactionFilter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
@Tag(name = "Analytics", description = "Aggregates over the ledger")
public class AnalyticsController {

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    @Operation(
            summary = "Totals, category breakdown and monthly series",
            description =
                    "Takes the same filter as GET /transactions and applies it identically, so "
                            + "the summary always describes exactly the rows that endpoint would "
                            + "return. Unfiltered, it describes the whole ledger.")
    public SummaryResponse summary(@Valid @ModelAttribute TransactionFilter filter) {
        return service.summary(filter);
    }
}
