package com.primeledger.currency;

import com.primeledger.currency.dto.CurrencyResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;

/**
 * Stores and serves exchange rates (F-05).
 *
 * <p>Two responsibilities that look separate and are not: fetching rates is only
 * worth doing because a conversion needs one, and the shape of what is fetched
 * — one base, many quotes, dated — is exactly what makes the conversion
 * consistent. Splitting them would put the triangulation rule in one class and
 * the storage layout it depends on in another.
 */
@Service
public class FxRateService {

    private static final Logger log = LoggerFactory.getLogger(FxRateService.class);

    /**
     * How long a fetched list of currency names is trusted.
     *
     * <p>The names, not the rates. New currency codes appear roughly never, and
     * the alternative — asking the provider on every page load — turns a display
     * label into a network dependency on the busiest screen in Settings.
     */
    private static final Duration NAME_CACHE_TTL = Duration.ofHours(24);

    private final FxRateRepository rates;
    private final FxRateClient client;
    private final Clock clock;
    private final String storedBase;

    private volatile Map<String, String> cachedNames = Map.of();
    private volatile Instant namesFetchedAt = Instant.EPOCH;

    public FxRateService(
            FxRateRepository rates,
            FxRateClient client,
            Clock clock,
            @Value("${primeledger.fx.base}") String storedBase) {
        this.rates = rates;
        this.client = client;
        this.clock = clock;
        this.storedBase = storedBase;
    }

    /**
     * Fetches the latest published rates and stores them.
     *
     * @return how many rates were written, or zero if the provider had nothing
     *     new or could not be reached
     */
    @Transactional
    public int refresh() {
        FxRateClient.RateSet published;
        try {
            published = client.latest();
        } catch (RestClientException e) {
            // Yesterday's rates stay in place and every conversion keeps working
            // against them. A failed fetch is a stale number, not a broken app,
            // and it must not be either an exception to a user or a reason for
            // the job to stop running tomorrow.
            log.warn("Exchange-rate provider unreachable; keeping the rates already stored", e);
            return 0;
        }

        if (published == null || published.rates() == null || published.date() == null) {
            log.warn("Exchange-rate provider returned nothing usable");
            return 0;
        }

        if (!storedBase.equals(published.base())) {
            // Storing a second base would break the triangulation the whole
            // scheme rests on: fx_convert divides one quote by another and
            // assumes both are against the same thing. Refusing is the only safe
            // response — silently storing them would corrupt every conversion
            // made afterwards, including historical ones.
            log.error(
                    "Provider changed its base from {} to {}; refusing to mix bases in fx_rates",
                    storedBase,
                    published.base());
            return 0;
        }

        LocalDate date = published.date();
        int written = 0;

        for (Map.Entry<String, BigDecimal> quote : published.rates().entrySet()) {
            rates.upsert(storedBase, quote.getKey(), date, quote.getValue());
            written++;
        }

        // The base against itself. The provider never sends it — a rate of one
        // is not news — but fx_convert divides by the *from* currency's rate,
        // and without a row for the base every conversion out of it would divide
        // by null and vanish.
        rates.upsert(storedBase, storedBase, date, BigDecimal.ONE);
        written++;

        log.info("Stored {} exchange rates for {}", written, date);
        return written;
    }

    /** True when there is nothing stored at all, which is only true of a fresh database. */
    @Transactional(readOnly = true)
    public boolean isEmpty() {
        return rates.latestRateDate().isEmpty();
    }

    /**
     * Fills an empty table with history, not just today.
     *
     * <p>Without this the feature looks broken on the day it ships. Conversion
     * is deliberately "the rate on the transaction's own date", so a database
     * holding only this morning's rates can convert nothing that happened
     * before this morning — which is the entire ledger. Every historical total
     * comes back understated with a non-zero {@code unconverted}, and the
     * honest report of a real limitation is indistinguishable from a bug.
     *
     * <p>Two years back, matching the furthest a recurring rule may be
     * backdated, in one request rather than seven hundred.
     *
     * @return how many rates were written
     */
    @Transactional
    public int backfill(int years) {
        LocalDate to = LocalDate.now(clock);
        LocalDate from = to.minusYears(years);

        FxRateClient.Series series;
        try {
            series = client.between(from, to);
        } catch (RestClientException e) {
            log.warn("Could not backfill exchange rates from {} to {}", from, to, e);
            return 0;
        }

        if (series == null || series.rates() == null || !storedBase.equals(series.base())) {
            log.warn("Exchange-rate backfill returned nothing usable");
            return 0;
        }

        int written = 0;
        for (Map.Entry<LocalDate, Map<String, BigDecimal>> day : series.rates().entrySet()) {
            for (Map.Entry<String, BigDecimal> quote : day.getValue().entrySet()) {
                rates.upsert(storedBase, quote.getKey(), day.getKey(), quote.getValue());
                written++;
            }
            // The base against itself, on every day it published. See refresh().
            rates.upsert(storedBase, storedBase, day.getKey(), BigDecimal.ONE);
            written++;
        }

        log.info("Backfilled {} exchange rates over {} publication days", written, series.rates().size());
        return written;
    }

    /**
     * Every currency the app knows, priced against {@code baseCurrency}.
     *
     * <p>The provider's full list, not merely the currencies the user already
     * holds: this is what populates the picker on the account form, and a picker
     * that only offers what you have already chosen is not a picker.
     */
    @Transactional(readOnly = true)
    public List<CurrencyResponse> supported(String baseCurrency) {
        LocalDate asOf = rates.latestRateDate().orElse(null);
        Map<String, String> names = currencyNames();

        Map<String, BigDecimal> onDate = new TreeMap<>();
        if (asOf != null) {
            rates.findAllOn(asOf)
                    .forEach(rate -> onDate.put(rate.getId().getQuote(), rate.getRate()));
        }

        // Union of the two: a currency with a name but no rate is still
        // selectable, and a rate for a code the name list has not caught up with
        // is still a rate.
        TreeMap<String, String> all = new TreeMap<>(names);
        onDate.keySet().forEach(code -> all.putIfAbsent(code, code));
        all.putIfAbsent(baseCurrency, names.getOrDefault(baseCurrency, baseCurrency));

        BigDecimal baseRate = onDate.get(baseCurrency);

        return all.entrySet().stream()
                .map(
                        entry -> {
                            BigDecimal quoteRate = onDate.get(entry.getKey());
                            BigDecimal rate = cross(baseRate, quoteRate);
                            return new CurrencyResponse(
                                    entry.getKey(),
                                    entry.getValue(),
                                    rate == null ? null : rate.toPlainString(),
                                    rate == null ? null : asOf);
                        })
                .sorted(Comparator.comparing(CurrencyResponse::code))
                .toList();
    }

    /**
     * The rate to convert {@code from} into {@code to} as at {@code on}, for the
     * callers that need one number rather than a converted aggregate.
     *
     * <p>Aggregates use {@code fx_convert} in SQL instead, for the reason V7
     * gives: after a GROUP BY the individual dates are gone, and converting a
     * group at one date is the error F-05 exists to prevent.
     */
    @Transactional(readOnly = true)
    public Optional<BigDecimal> rate(String from, String to, LocalDate on) {
        if (from.equals(to)) return Optional.of(BigDecimal.ONE);

        BigDecimal fromRate = rates.rateFor(from, on).orElse(null);
        BigDecimal toRate = rates.rateFor(to, on).orElse(null);

        return Optional.ofNullable(cross(fromRate, toRate));
    }

    /** {@code from} → {@code to}, both quoted against the stored base. */
    private static BigDecimal cross(BigDecimal fromRate, BigDecimal toRate) {
        if (fromRate == null || toRate == null || fromRate.signum() == 0) return null;
        return toRate.divide(fromRate, 8, RoundingMode.HALF_UP);
    }

    private Map<String, String> currencyNames() {
        Instant now = clock.instant();
        if (!cachedNames.isEmpty() && now.isBefore(namesFetchedAt.plus(NAME_CACHE_TTL))) {
            return cachedNames;
        }

        try {
            Map<String, String> fetched = client.supportedCurrencies();
            if (fetched != null && !fetched.isEmpty()) {
                cachedNames = Map.copyOf(fetched);
                namesFetchedAt = now;
            }
        } catch (RestClientException e) {
            // Names are decoration. Serving codes without them is a worse
            // picker, not a broken one, and the stale cache is better than both.
            log.debug("Could not refresh currency names; using what is cached", e);
        }

        return cachedNames;
    }
}
