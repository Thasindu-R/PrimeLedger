package com.primeledger.analytics;

import com.primeledger.analytics.dto.SummaryResponse;
import com.primeledger.analytics.insight.Insight;
import com.primeledger.analytics.insight.InsightsService;
import com.primeledger.transaction.dto.TransactionFilter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
@Tag(name = "Analytics", description = "Aggregates over the ledger")
public class AnalyticsController {

    private final AnalyticsService service;
    private final InsightsService insights;

    public AnalyticsController(AnalyticsService service, InsightsService insights) {
        this.service = service;
        this.insights = insights;
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

    @GetMapping("/insights")
    @Operation(
            summary = "Rule-based observations about this month's spending",
            description =
                    "Warnings first. Takes no filter: an insight is a statement about the "
                            + "user's month, and one computed over an arbitrary slice of it "
                            + "would be a statement about nothing in particular. An empty list "
                            + "is a normal answer — a quiet month has nothing worth saying "
                            + "about it, and inventing something would train the user to ignore "
                            + "the panel.")
    public List<Insight> insights() {
        return insights.forCurrentUser();
    }
}
