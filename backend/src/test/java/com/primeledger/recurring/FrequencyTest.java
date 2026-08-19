package com.primeledger.recurring;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Date arithmetic for recurring rules (F-03).
 *
 * <p>Almost every test here is about a month end. That is not disproportionate:
 * month ends are the only place the two plausible implementations disagree, and
 * rent — the headline example in the proposal — is exactly the rule most likely
 * to fall on one.
 */
class FrequencyTest {

    @Nested
    @DisplayName("monthly")
    class Monthly {

        @Test
        @DisplayName("a rule that starts on the 31st stays on the 31st")
        void anchorsOnTheStartDate() {
            assertThat(occurrences(Frequency.MONTHLY, LocalDate.of(2026, 1, 31), 1, 5))
                    .containsExactly(
                            LocalDate.of(2026, 1, 31),
                            // February has no 31st, so this one is clamped...
                            LocalDate.of(2026, 2, 28),
                            // ...and the clamp does not stick. This is the whole
                            // point: stepping forward from 28 February would give
                            // 28 March and every month after, silently moving the
                            // user's rent four days earlier for ever.
                            LocalDate.of(2026, 3, 31),
                            LocalDate.of(2026, 4, 30),
                            LocalDate.of(2026, 5, 31));
        }

        @Test
        @DisplayName("next() from a clamped occurrence returns to the anchor day")
        void nextRecoversFromAClamp() {
            LocalDate startsOn = LocalDate.of(2026, 1, 31);

            assertThat(Frequency.MONTHLY.next(startsOn, 1, LocalDate.of(2026, 2, 28)))
                    .isEqualTo(LocalDate.of(2026, 3, 31));
        }

        @Test
        @DisplayName("28 February is the first occurrence of a rule that began on 31 January")
        void ordinalCountsCalendarMonths() {
            LocalDate startsOn = LocalDate.of(2026, 1, 31);

            // ChronoUnit.MONTHS.between would say 0 here — not a whole month has
            // elapsed — and the cursor would never advance past February.
            assertThat(Frequency.MONTHLY.ordinalOf(startsOn, 1, LocalDate.of(2026, 2, 28)))
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("an interval of 3 is quarterly")
        void honoursTheInterval() {
            assertThat(occurrences(Frequency.MONTHLY, LocalDate.of(2026, 1, 15), 3, 4))
                    .containsExactly(
                            LocalDate.of(2026, 1, 15),
                            LocalDate.of(2026, 4, 15),
                            LocalDate.of(2026, 7, 15),
                            LocalDate.of(2026, 10, 15));
        }
    }

    @Nested
    @DisplayName("yearly")
    class Yearly {

        @Test
        @DisplayName("29 February survives the three years it does not exist")
        void anchorsOnALeapDay() {
            assertThat(occurrences(Frequency.YEARLY, LocalDate.of(2024, 2, 29), 1, 5))
                    .containsExactly(
                            LocalDate.of(2024, 2, 29),
                            LocalDate.of(2025, 2, 28),
                            LocalDate.of(2026, 2, 28),
                            LocalDate.of(2027, 2, 28),
                            // Back to the 29th, because the ordinal is counted
                            // from the start date rather than from last year's
                            // clamped value.
                            LocalDate.of(2028, 2, 29));
        }
    }

    @Nested
    @DisplayName("daily and weekly")
    class ShortPeriods {

        @Test
        @DisplayName("weekly holds the day of the week")
        void weeklyKeepsTheWeekday() {
            LocalDate friday = LocalDate.of(2026, 8, 7);

            assertThat(occurrences(Frequency.WEEKLY, friday, 1, 3))
                    .allSatisfy(date -> assertThat(date.getDayOfWeek()).isEqualTo(friday.getDayOfWeek()));
        }

        @Test
        @DisplayName("a fortnightly rule skips the intervening week")
        void fortnightly() {
            assertThat(occurrences(Frequency.WEEKLY, LocalDate.of(2026, 8, 7), 2, 3))
                    .containsExactly(
                            LocalDate.of(2026, 8, 7),
                            LocalDate.of(2026, 8, 21),
                            LocalDate.of(2026, 9, 4));
        }

        @Test
        @DisplayName("daily with an interval steps by that many days")
        void everyThirdDay() {
            assertThat(occurrences(Frequency.DAILY, LocalDate.of(2026, 8, 7), 3, 3))
                    .containsExactly(
                            LocalDate.of(2026, 8, 7),
                            LocalDate.of(2026, 8, 10),
                            LocalDate.of(2026, 8, 13));
        }
    }

    /**
     * The property the materialiser's cursor depends on: whatever occurrence you
     * are standing on, {@code next} lands on the following one and never on the
     * same one again.
     */
    @Test
    @DisplayName("next() of an occurrence is always the occurrence after it")
    void nextIsTotalAndStrictlyIncreasing() {
        for (Frequency frequency : Frequency.values()) {
            LocalDate startsOn = LocalDate.of(2026, 1, 31);
            List<LocalDate> series = occurrences(frequency, startsOn, 1, 30);

            for (int i = 0; i < series.size() - 1; i++) {
                assertThat(frequency.next(startsOn, 1, series.get(i)))
                        .as("%s occurrence %d", frequency, i)
                        .isEqualTo(series.get(i + 1))
                        .isAfter(series.get(i));
            }
        }
    }

    private static List<LocalDate> occurrences(
            Frequency frequency, LocalDate startsOn, int interval, int count) {
        List<LocalDate> dates = new ArrayList<>(count);
        for (long ordinal = 0; ordinal < count; ordinal++) {
            dates.add(frequency.occurrence(startsOn, interval, ordinal));
        }
        return dates;
    }
}
