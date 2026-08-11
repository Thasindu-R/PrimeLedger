package com.primeledger;

import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * Skips a test class when there is no Docker daemon to run a container on.
 *
 * <p>An {@link ExecutionCondition} registered with {@code @ExtendWith} rather
 * than a {@code @EnabledIf} on the base class, and the difference is not
 * stylistic: JUnit inherits registered <em>extensions</em> from a superclass but
 * does not inherit {@code @EnabledIf}. With the annotation on an abstract base,
 * the subclasses ran anyway and every one of them failed trying to reach a
 * daemon that was not there — while the one class that declared it directly
 * skipped cleanly. That asymmetry is what this class removes.
 */
public class DockerRequired implements ExecutionCondition {

    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        return PostgresContainer.dockerAvailable()
                ? ConditionEvaluationResult.enabled("Docker is available")
                : ConditionEvaluationResult.disabled(
                        "No Docker daemon — skipping the Testcontainers suite. A green run "
                                + "therefore proves nothing on its own; check the skipped count.");
    }
}
