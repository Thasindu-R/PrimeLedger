package com.primeledger.goal;

import com.primeledger.common.ApiError;
import com.primeledger.goal.dto.GoalRequest;
import com.primeledger.goal.dto.GoalResponse;
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
@RequestMapping("/api/v1/goals")
@Tag(name = "Goals", description = "Savings targets, progress and projection (F-04)")
public class GoalController {

    private final SavingsGoalService service;

    public GoalController(SavingsGoalService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "Savings goals with progress and projection",
            description =
                    "Dated goals first, soonest deadline at the top; undated ones after them. "
                            + "Progress is the linked account's balance, and the projection is "
                            + "built on the contribution rate actually observed over the trailing "
                            + "three months rather than on the required one.")
    public List<GoalResponse> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "One goal")
    public GoalResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @Operation(summary = "Create a goal")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(
            responseCode = "409",
            description = "A goal with that name already exists",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<GoalResponse> create(@Valid @RequestBody GoalRequest request) {
        GoalResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/goals/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a goal")
    public GoalResponse update(@PathVariable UUID id, @Valid @RequestBody GoalRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete a goal",
            description =
                    "Removes the target only. The account and its transactions are untouched — "
                            + "a goal is a way of reading an account, not a container of money.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
