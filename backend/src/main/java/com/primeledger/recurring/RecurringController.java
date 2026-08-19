package com.primeledger.recurring;

import com.primeledger.common.ApiError;
import com.primeledger.recurring.dto.RecurringRuleRequest;
import com.primeledger.recurring.dto.RecurringRuleResponse;
import com.primeledger.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
@RequestMapping("/api/v1/recurring")
@Tag(name = "Recurring", description = "Standing instructions and the job that materialises them (F-03)")
public class RecurringController {

    private final RecurringRuleService service;
    private final RecurringMaterialiser materialiser;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public RecurringController(
            RecurringRuleService service,
            RecurringMaterialiser materialiser,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.service = service;
        this.materialiser = materialiser;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @GetMapping
    @Operation(
            summary = "Every recurring rule, soonest first",
            description =
                    "Ordered by the next occurrence, so what is about to happen is at the top. "
                            + "Paused and finished rules are included and flagged rather than "
                            + "hidden — a rule that has quietly stopped firing is the thing a "
                            + "user most needs to be able to see.")
    public List<RecurringRuleResponse> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "One rule")
    public RecurringRuleResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @Operation(
            summary = "Create a rule",
            description =
                    "The rule takes its currency from the account it pays into. `startsOn` may be "
                            + "in the past, up to two years, which is how a standing order that "
                            + "began months ago is recorded; the next run materialises every "
                            + "occurrence since.")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(
            responseCode = "409",
            description = "A rule with that name already exists",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<RecurringRuleResponse> create(
            @Valid @RequestBody RecurringRuleRequest request) {
        RecurringRuleResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/recurring/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update or pause a rule",
            description =
                    "Pausing is `paused: true` rather than a separate endpoint, because it is a "
                            + "property of the rule and not an event. Transactions the rule has "
                            + "already generated are never touched by an edit — changing the "
                            + "amount changes what happens next month, not what happened last.")
    public RecurringRuleResponse update(
            @PathVariable UUID id, @Valid @RequestBody RecurringRuleRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete a rule",
            description =
                    "The transactions it generated are retained and severed from it (§8.1). "
                            + "Deleting the instruction is not deleting the history of what it did.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/run")
    @Operation(
            summary = "Materialise this user's due rules now",
            description =
                    "What the nightly job does, for the caller only and on demand. It exists so "
                            + "the scheduled behaviour can be seen working rather than taken on "
                            + "trust — the deliverable for this phase is scheduled work that is "
                            + "*visibly* correct. Safe to call repeatedly: it is the same "
                            + "idempotent path, so a second call creates nothing.")
    public Map<String, Integer> runNow() {
        int created =
                materialiser.materialiseFor(currentUser.currentUserId(), LocalDate.now(clock));
        return Map.of("created", created);
    }
}
