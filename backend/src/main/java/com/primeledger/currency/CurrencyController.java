package com.primeledger.currency;

import com.primeledger.currency.dto.CurrencyResponse;
import com.primeledger.profile.ProfileService;
import com.primeledger.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/currencies")
@Tag(name = "Currencies", description = "Supported currencies and the day's rates (F-05)")
public class CurrencyController {

    private final FxRateService rates;
    private final ProfileService profiles;
    private final CurrentUserProvider currentUser;

    public CurrencyController(
            FxRateService rates, ProfileService profiles, CurrentUserProvider currentUser) {
        this.rates = rates;
        this.profiles = profiles;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Operation(
            summary = "Supported currencies and today's rates",
            description =
                    "Rates are quoted against the caller's base currency, with the date they "
                            + "were published. A currency with a null rate is still selectable — "
                            + "it simply has nothing published against it yet.")
    public List<CurrencyResponse> list() {
        return rates.supported(profiles.baseCurrencyOf(currentUser.currentUserId()));
    }
}
