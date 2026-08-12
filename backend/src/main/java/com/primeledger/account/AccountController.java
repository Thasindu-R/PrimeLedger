package com.primeledger.account;

import com.primeledger.account.dto.AccountRequest;
import com.primeledger.account.dto.AccountResponse;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/accounts")
@Tag(name = "Accounts", description = "Ledger accounts and their balances (F-01)")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "Accounts the caller owns, with balances",
            description = "Ordered by name. Archived accounts are excluded unless asked for.")
    public List<AccountResponse> list(
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return service.list(includeArchived);
    }

    @GetMapping("/{id}")
    @Operation(summary = "One account")
    @ApiResponse(
            responseCode = "404",
            description = "Absent, or owned by another user",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public AccountResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @Operation(summary = "Create an account")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(
            responseCode = "409",
            description = "The caller already has an account with this name",
            content = @Content(schema = @Schema(implementation = ApiError.class)))
    public ResponseEntity<AccountResponse> create(@Valid @RequestBody AccountRequest request) {
        AccountResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/v1/accounts/" + created.id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Update an account",
            description =
                    "The currency cannot be changed once the account holds transactions — that "
                            + "would reinterpret every amount in it (422).")
    public AccountResponse update(
            @PathVariable UUID id, @Valid @RequestBody AccountRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/archive")
    @Operation(
            summary = "Archive an account",
            description =
                    "Hides it from pickers and keeps its history. Refused for the caller's last "
                            + "active account, which would leave nothing to record against.")
    public AccountResponse archive(@PathVariable UUID id) {
        return service.setArchived(id, true);
    }

    @PostMapping("/{id}/unarchive")
    @Operation(summary = "Bring an archived account back into use")
    public AccountResponse unarchive(@PathVariable UUID id) {
        return service.setArchived(id, false);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete an empty account",
            description =
                    "Permitted only while the account holds no transactions; archive it instead "
                            + "to keep history (422).")
    @ApiResponse(responseCode = "204", description = "Deleted")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/default")
    @Operation(
            summary = "The caller's default account, creating it if absent",
            description =
                    "Idempotent. Returns the caller's first active account, or creates 'Everyday' "
                            + "when they have none.")
    public AccountResponse ensureDefault() {
        return service.ensureDefault();
    }
}
