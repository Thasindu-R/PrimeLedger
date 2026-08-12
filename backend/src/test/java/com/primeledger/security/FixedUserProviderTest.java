package com.primeledger.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FixedUserProviderTest {

    private static final UUID FIXED = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID SOMEONE_ELSE = UUID.fromString("11111111-1111-4111-8111-111111111111");

    private final FixedUserProvider provider = new FixedUserProvider(FIXED);

    @Test
    @DisplayName("reports the configured user when nothing is impersonating")
    void returnsTheConfiguredUser() {
        assertThat(provider.currentUserIdIfPresent()).contains(FIXED);
    }

    @Test
    @DisplayName("RunAs wins, so a background block writes rows owned by the user it named")
    void runAsTakesPrecedence() {
        UUID seen =
                RunAs.callUnchecked(
                        SOMEONE_ELSE, () -> provider.currentUserIdIfPresent().orElseThrow());

        // Without this the connection would carry SOMEONE_ELSE — RlsTenantResolver
        // asks the same provider — while the service layer stamped user_id with
        // FIXED, and the insert would be rejected by its own RLS policy.
        assertThat(seen).isEqualTo(SOMEONE_ELSE);
    }

    @Test
    @DisplayName("the configured user is restored once the block ends")
    void doesNotLeakAfterTheBlock() {
        RunAs.run(SOMEONE_ELSE, () -> {});

        assertThat(provider.currentUserIdIfPresent()).contains(FIXED);
    }
}
