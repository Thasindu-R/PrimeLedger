package com.primeledger.budget;

import com.primeledger.budget.dto.BudgetRequest;
import com.primeledger.budget.dto.BudgetResponse;
import com.primeledger.common.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/budgets")
@Tag(name = "Budgets", description = "Category spending limits and their position (F-02)")
public class BudgetController {

    private final BudgetService service;
    private final BudgetEvaluator evaluator;

    public BudgetController(BudgetService service, BudgetEvaluator evaluator) {
        this.service = service;
        this.evaluator = evaluator;
    }

    @GetMapping
    @Operation(
            summary = "Budgets in force, with spend for the current period",
            description =
                    "One entry per category and period length: the most recent limit that had "
                            + "already started. Superseded limits stay in the table so past "
                            + "periods keep reporting against the limit that actually applied.")
    public List<BudgetResponse> current() {
        return service.current();
    }

    @PostMapping
    @Operation(summary = "Set a limit for a category")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(
            responseCode = "409",
            description = "A budget for this category and period already starts on that date",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<BudgetResponse> create(@Valid @RequestBody BudgetRequest request) {
        BudgetResponse created = service.create(request);
        // A budget set against spending that has already happened is over budget
        // the moment it exists, and the user should hear about it now rather
        // than after their next unrelated purchase.
        //
        // Here and not inside the service, deliberately: the notification is
        // written in a REQUIRES_NEW transaction and carries a foreign key to the
        // budget, so it cannot be emitted until the budget row has committed.
        // Calling this from inside service.create() would fail on that key.
        evaluator.evaluateQuietly();
        return ResponseEntity.created(URI.create("/api/v1/budgets/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Change a limit",
            description =
                    "Only for a period that has not yet ended — editing a finished period would "
                            + "rewrite what was reported at the time (422).")
    public BudgetResponse update(@PathVariable UUID id, @Valid @RequestBody BudgetRequest request) {
        BudgetResponse updated = service.update(id, request);
        // Lowering a limit can put an untouched budget over it.
        evaluator.evaluateQuietly();
        return updated;
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Remove a budget")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
