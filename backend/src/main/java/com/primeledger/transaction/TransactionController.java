package com.primeledger.transaction;

import com.primeledger.common.ApiError;
import com.primeledger.common.PageResponse;
import com.primeledger.common.Pagination;
import com.primeledger.transaction.dto.BulkDeleteRequest;
import com.primeledger.transaction.dto.BulkDeleteResponse;
import com.primeledger.transaction.dto.TransactionFilter;
import com.primeledger.transaction.dto.TransactionRequest;
import com.primeledger.transaction.dto.TransactionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transactions")
@Tag(name = "Transactions", description = "The ledger itself")
public class TransactionController {

    /**
     * The orderings the UI offers; anything else is rejected, not ignored.
     *
     * <p>{@code type} and {@code category.name} are here because the transactions
     * table lets the user sort by those columns. Before Phase 4 that sort ran in
     * the browser over the whole array; now that the list is paginated, sorting
     * the page the server chose would reorder ten rows out of a thousand and look
     * like data loss.
     */
    private static final Set<String> SORTABLE =
            Set.of("occurredOn", "amount", "createdAt", "description", "type", "category.name");

    private static final Sort DEFAULT_SORT =
            Sort.by(Sort.Order.desc("occurredOn"), Sort.Order.desc("createdAt"));

    private final TransactionService service;

    public TransactionController(TransactionService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "Paginated, filtered, sorted list",
            description =
                    "The server-side equivalent of the frontend's applyFilters and applySorting. "
                            + "Sortable by occurredOn, amount, createdAt or description; "
                            + "defaults to newest first.")
    public PageResponse<TransactionResponse> list(
            @Valid @ModelAttribute TransactionFilter filter,
            @PageableDefault(size = Pagination.DEFAULT_PAGE_SIZE) Pageable pageable) {
        return service.list(filter, Pagination.sanitise(pageable, SORTABLE, DEFAULT_SORT));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Single transaction")
    @ApiResponse(
            responseCode = "404",
            description = "Absent, or owned by another user",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public TransactionResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @Operation(summary = "Create")
    @ApiResponse(responseCode = "201", description = "Created")
    public ResponseEntity<TransactionResponse> create(
            @Valid @RequestBody TransactionRequest request) {
        TransactionResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/transactions/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update")
    public TransactionResponse update(
            @PathVariable UUID id, @Valid @RequestBody TransactionRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Soft delete",
            description = "The row is retained and can be restored; reads stop returning it.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    @Operation(summary = "Undo a soft delete")
    public TransactionResponse restore(@PathVariable UUID id) {
        return service.restore(id);
    }

    @PostMapping("/bulk-delete")
    @Operation(
            summary = "Soft delete many by ID",
            description =
                    "Returns how many rows were actually deleted; ids that were already deleted "
                            + "or belong to someone else are counted out of the total.")
    public BulkDeleteResponse bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return service.bulkDelete(request);
    }
}
