package com.primeledger.account;

import com.primeledger.account.dto.AccountResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The read half of accounts, plus default provisioning.
 *
 * <p>Creating, renaming, archiving and transferring between accounts is Phase 5
 * (F-01). This exists because Phase 4 cannot record a transaction without an
 * account to file it under — see {@link AccountService}.
 */
@RestController
@RequestMapping("/api/v1/accounts")
@Tag(name = "Accounts", description = "Ledger accounts")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "Accounts the caller owns",
            description = "Ordered by name. Empty until a default is provisioned.")
    public List<AccountResponse> list() {
        return service.list();
    }

    @PostMapping("/default")
    @Operation(
            summary = "The caller's default account, creating it if absent",
            description =
                    "Idempotent. Returns the caller's first account, or creates 'Everyday' "
                            + "when they have none, so a newly signed-up user can record a "
                            + "transaction immediately.")
    public AccountResponse ensureDefault() {
        return service.ensureDefault();
    }
}
