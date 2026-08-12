package com.primeledger.transaction.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The pair a transfer produced.
 *
 * <p>Both legs are returned rather than one synthetic "transfer" object,
 * because both are real rows the user will see in their ledger and either can
 * be the one they click on.
 */
@Schema(name = "Transfer")
public record TransferResponse(
        @Schema(description = "The expense leg, on the source account") TransactionResponse from,
        @Schema(description = "The income leg, on the destination account")
                TransactionResponse to) {}
