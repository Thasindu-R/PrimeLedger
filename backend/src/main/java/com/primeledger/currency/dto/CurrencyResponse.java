package com.primeledger.currency.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/**
 * A currency the app can hold an account in, and what it is worth (F-05).
 *
 * @param rate how many units of this currency one unit of the caller's base
 *     currency buys. Null when no rate has been published for it — the currency
 *     is still selectable, it simply cannot be converted yet.
 * @param asOf the date the rate was published. Shown next to any converted
 *     figure, because "converted" and "converted at last Tuesday's rate" are
 *     different claims and only the second one is honest.
 */
@Schema(name = "Currency")
public record CurrencyResponse(
        @Schema(example = "LKR") String code,
        @Schema(example = "Sri Lankan Rupee") String name,
        @Schema(type = "string", example = "302.41000000") String rate,
        LocalDate asOf) {}
