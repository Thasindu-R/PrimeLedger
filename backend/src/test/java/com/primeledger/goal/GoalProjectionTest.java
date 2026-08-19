package com.primeledger.goal;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The savings-goal projection (F-04).
 *
 * <p>Every case here is a fixed set of numbers, which is the reason {@link
 * GoalProjection} is a pure function: "what happens when the user is saving
 * nothing" should be four lines to state, not a database arranged into the right
 * shape.
 */
class GoalProjectionTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 19);

    @Test
    @DisplayName("projects a completion date from the observed rate, not the required one")
    void projectsFromObservedRate() {
        GoalProjection projection = project("2000.00", "5000.00", LocalDate.of(2027, 8, 31), "500.00");

        assertThat(projection.remaining()).isEqualByComparingTo("3000.00");
        assertThat(projection.progressPercent()).isEqualTo(40.0);
        // 3,000 still to find at 500 a month is six months, not the 250 a month
        // the deadline asks for.
        assertThat(projection.projectedCompletion()).isEqualTo(LocalDate.of(2027, 2, 19));
        assertThat(projection.onTrack()).isTrue();
    }

    @Test
    @DisplayName("says so when the current rate will not make the deadline")
    void notOnTrack() {
        GoalProjection projection = project("2000.00", "5000.00", LocalDate.of(2026, 12, 31), "100.00");

        // 3,000 at 100 a month is thirty months; the deadline is four away.
        assertThat(projection.projectedCompletion()).isEqualTo(LocalDate.of(2029, 2, 19));
        assertThat(projection.onTrack()).isFalse();
        assertThat(projection.requiredMonthly()).isEqualByComparingTo("750.00");
    }

    @Test
    @DisplayName("no projection at all when nothing is going in")
    void flatRateHasNoProjection() {
        GoalProjection projection = project("2000.00", "5000.00", LocalDate.of(2027, 8, 31), "0.00");

        assertThat(projection.projectedCompletion()).isNull();
        assertThat(projection.onTrack()).isFalse();
    }

    @Test
    @DisplayName("an account being drawn down is not on its way to a target")
    void negativeRateHasNoProjection() {
        GoalProjection projection = project("2000.00", "5000.00", LocalDate.of(2027, 8, 31), "-300.00");

        assertThat(projection.monthlyRate()).isEqualByComparingTo("-300.00");
        assertThat(projection.projectedCompletion()).isNull();
        assertThat(projection.onTrack()).isFalse();
    }

    @Test
    @DisplayName("a rate that would take a century projects nothing rather than a date in 2130")
    void absurdlySlowRateProjectsNothing() {
        GoalProjection projection = project("0.00", "500000.00", null, "1.00");

        assertThat(projection.projectedCompletion()).isNull();
    }

    @Test
    @DisplayName("an undated goal still projects; there is simply nothing to be on track for")
    void undatedGoalProjectsWithoutOnTrack() {
        GoalProjection projection = project("1000.00", "4000.00", null, "1000.00");

        assertThat(projection.projectedCompletion()).isEqualTo(LocalDate.of(2026, 11, 19));
        assertThat(projection.requiredMonthly()).isNull();
        assertThat(projection.onTrack()).isNull();
    }

    @Test
    @DisplayName("a met target reports no remaining, no requirement and no projection")
    void achieved() {
        GoalProjection projection = project("5200.00", "5000.00", LocalDate.of(2027, 1, 31), "100.00");

        assertThat(projection.achieved()).isTrue();
        assertThat(projection.remaining()).isEqualByComparingTo("0.00");
        assertThat(projection.progressPercent()).isEqualTo(104.0);
        assertThat(projection.requiredMonthly()).isNull();
        assertThat(projection.projectedCompletion()).isNull();
        assertThat(projection.onTrack()).isTrue();
    }

    @Test
    @DisplayName("a deadline that has already passed asks for the whole shortfall, not a rate")
    void pastDeadline() {
        GoalProjection projection = project("2000.00", "5000.00", LocalDate.of(2026, 3, 31), "500.00");

        assertThat(projection.requiredMonthly()).isEqualByComparingTo("3000.00");
        assertThat(projection.onTrack()).isFalse();
    }

    @Test
    @DisplayName("an overdrawn account reports negative progress rather than hiding it")
    void overdrawnAccount() {
        GoalProjection projection = project("-500.00", "5000.00", null, "0.00");

        assertThat(projection.progressPercent()).isEqualTo(-10.0);
        assertThat(projection.remaining()).isEqualByComparingTo("5500.00");
    }

    @Test
    @DisplayName("the required contribution rounds up, so paying it exactly does arrive in time")
    void requiredMonthlyRoundsUp() {
        // 1,000 over 3 months is 333.333…; 333.33 a month lands 1 cent short.
        GoalProjection projection = project("0.00", "1000.00", LocalDate.of(2026, 11, 30), "0.00");

        assertThat(projection.requiredMonthly()).isEqualByComparingTo("333.34");
    }

    private static GoalProjection project(
            String current, String target, LocalDate targetDate, String monthlyRate) {
        return GoalProjection.of(
                new BigDecimal(current),
                new BigDecimal(target),
                targetDate,
                new BigDecimal(monthlyRate),
                TODAY);
    }
}
