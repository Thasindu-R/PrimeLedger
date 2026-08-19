package com.primeledger.profile;

import com.primeledger.profile.dto.ProfileRequest;
import com.primeledger.profile.dto.ProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
@Tag(name = "Profile", description = "Display name, base currency and display preferences (§6.3)")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "The caller's profile",
            description =
                    "Created with defaults on first call, so this never 404s for an "
                            + "authenticated user.")
    public ProfileResponse current() {
        return service.current();
    }

    @PutMapping
    @Operation(
            summary = "Update the profile",
            description =
                    "Changing `baseCurrency` re-expresses every reporting total at the rates "
                            + "that applied on each transaction's own date — it converts what is "
                            + "displayed and never what is stored (F-05).")
    public ProfileResponse update(@Valid @RequestBody ProfileRequest request) {
        return service.update(request);
    }
}
