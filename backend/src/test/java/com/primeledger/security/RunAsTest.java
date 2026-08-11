package com.primeledger.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The identity a background thread carries. Leaks here are security bugs, not
 * tidiness ones: a pooled thread that keeps a previous user's id would hand the
 * next task somebody else's data.
 */
class RunAsTest {

    @Test
    @DisplayName("no identity outside a RunAs block")
    void emptyByDefault() {
        assertThat(RunAs.current()).isEmpty();
    }

    @Test
    @DisplayName("the identity is visible inside the block and gone after it")
    void scopesIdentity() {
        UUID user = UUID.randomUUID();

        RunAs.run(user, () -> assertThat(RunAs.current()).contains(user));

        assertThat(RunAs.current()).isEmpty();
    }

    @Test
    @DisplayName("nesting restores the outer identity rather than clearing it")
    void restoresPreviousIdentity() {
        UUID outer = UUID.randomUUID();
        UUID inner = UUID.randomUUID();

        RunAs.run(
                outer,
                () -> {
                    RunAs.run(inner, () -> assertThat(RunAs.current()).contains(inner));
                    assertThat(RunAs.current()).contains(outer);
                });

        assertThat(RunAs.current()).isEmpty();
    }

    @Test
    @DisplayName("an exception still unwinds the identity")
    void clearsOnFailure() {
        UUID user = UUID.randomUUID();

        assertThatThrownBy(
                        () ->
                                RunAs.run(
                                        user,
                                        () -> {
                                            throw new IllegalStateException("boom");
                                        }))
                .hasMessage("boom");

        assertThat(RunAs.current()).isEmpty();
    }

    @Test
    @DisplayName("the identity does not cross threads")
    void isThreadConfined() throws Exception {
        UUID user = UUID.randomUUID();
        var seenOnOtherThread = new java.util.concurrent.atomic.AtomicReference<Object>("unset");

        RunAs.run(
                user,
                () -> {
                    Thread other = new Thread(() -> seenOnOtherThread.set(RunAs.current()));
                    other.start();
                    try {
                        other.join();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                });

        assertThat(seenOnOtherThread.get()).isEqualTo(java.util.Optional.empty());
    }
}
