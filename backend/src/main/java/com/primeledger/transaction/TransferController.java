package com.primeledger.transaction;

import com.primeledger.common.ApiError;
import com.primeledger.transaction.dto.TransferRequest;
import com.primeledger.transaction.dto.TransferResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transfers")
@Tag(name = "Transfers", description = "Moving money between your own accounts (F-01)")
public class TransferController {

    private final TransferService service;

    public TransferController(TransferService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(
            summary = "Transfer between two accounts",
            description =
                    "Writes a linked pair — an expense on the source and an income on the "
                            + "destination — atomically. Both legs are flagged as transfers and "
                            + "are excluded from income and expense totals, while still moving "
                            + "the balance of both accounts.")
    @ApiResponse(responseCode = "201", description = "Both legs created")
    @ApiResponse(
            responseCode = "422",
            description =
                    "Same account twice, a currency mismatch, an archived account, or a "
                            + "future date",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<TransferResponse> create(@Valid @RequestBody TransferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @DeleteMapping("/{legId}")
    @Operation(
            summary = "Delete a transfer, given either leg",
            description = "Soft-deletes both legs. Removing one alone would unbalance the pair.")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable UUID legId) {
        service.delete(legId);
        return ResponseEntity.noContent().build();
    }
}
