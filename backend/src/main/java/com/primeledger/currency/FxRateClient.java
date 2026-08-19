package com.primeledger.currency;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The one place that talks to the exchange-rate provider (F-05).
 *
 * <p>Frankfurter by default: no key, no quota, no account, and it publishes the
 * European Central Bank's reference rates, which is exactly what a personal
 * finance app wants — a public, citable number rather than one broker's idea of
 * the price. The URL is configurable because a free service is a free service
 * and the alternative named in the proposal (exchangerate.host) speaks a close
 * enough dialect to be worth being able to switch to.
 *
 * <p>Timeouts are short and deliberate. This runs inside a nightly job; a
 * provider that has become a black hole must fail the job in seconds and leave
 * yesterday's rates in place, not hold a thread until something else times out.
 */
@Component
public class FxRateClient {

    private final RestClient http;

    public FxRateClient(@Value("${primeledger.fx.api-url}") String apiUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));

        this.http = RestClient.builder().baseUrl(apiUrl).requestFactory(factory).build();
    }

    /**
     * The most recent published rates, against the provider's base.
     *
     * @throws RestClientException if the provider is unreachable or answers with
     *     something that is not a rate set. Deliberately not caught here: the
     *     job above decides what a failed fetch means, and swallowing it here
     *     would leave it with nothing to decide.
     */
    public RateSet latest() {
        return http.get().uri("/latest").retrieve().body(RateSet.class);
    }

    /** Rates as published on one past date, for filling a single gap. */
    public RateSet on(LocalDate date) {
        return http.get().uri("/{date}", date.toString()).retrieve().body(RateSet.class);
    }

    /**
     * Every publication between two dates, in one request.
     *
     * <p>The provider's time-series form. Used once, to fill an empty table: the
     * alternative is one request per day, which for two years of history is
     * seven hundred round trips against a free service that has been generous
     * enough not to ask for a key.
     */
    public Series between(LocalDate from, LocalDate to) {
        return http.get()
                .uri("/{from}..{to}", from.toString(), to.toString())
                .retrieve()
                .body(Series.class);
    }

    /** Currency code to display name, as the provider knows them. */
    @SuppressWarnings("unchecked")
    public Map<String, String> supportedCurrencies() {
        return http.get().uri("/currencies").retrieve().body(Map.class);
    }

    /**
     * A published set of rates: one base, one date, many quotes.
     *
     * @param amount the provider echoes the amount the rates are quoted for,
     *     which is always 1 for our requests and is ignored
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RateSet(
            BigDecimal amount, String base, LocalDate date, Map<String, BigDecimal> rates) {}

    /**
     * Many days of rates: {@code rates} is keyed by date, then by currency.
     *
     * <p>Weekends and holidays are simply absent — the ECB does not publish on
     * them. That is not a gap to fill: {@code fx_convert} asks for the most
     * recent rate on or before a date precisely so a Sunday converts at
     * Friday's rate rather than at nothing.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Series(
            BigDecimal amount, String base, Map<LocalDate, Map<String, BigDecimal>> rates) {}
}
