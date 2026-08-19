package com.primeledger.currency;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FxRateRepository extends JpaRepository<FxRate, FxRate.Id> {

    /** The newest day the table holds anything for, so the job knows what it is missing. */
    @Query("select max(r.id.rateDate) from FxRate r")
    Optional<LocalDate> latestRateDate();

    /** Every rate published on one day, for {@code GET /currencies}. */
    @Query("select r from FxRate r where r.id.rateDate = :on order by r.id.quote asc")
    List<FxRate> findAllOn(@Param("on") LocalDate on);

    /**
     * The rate in force for one currency on one date: the most recent published
     * on or before it.
     *
     * <p>The same rule {@code fx_convert} applies in SQL, for the callers that
     * need one conversion rather than a converted aggregate. Duplicated only in
     * the sense that a fact is stated twice — if the two ever disagree, this one
     * is wrong, because the aggregates are what the user actually reads.
     */
    @Query(
            """
            select r.rate from FxRate r
             where r.id.quote = :quote
               and r.id.rateDate <= :on
             order by r.id.rateDate desc
             limit 1
            """)
    Optional<BigDecimal> rateFor(@Param("quote") String quote, @Param("on") LocalDate on);

    /**
     * Inserts a day's rates, leaving any that are already there alone.
     *
     * <p>{@code ON CONFLICT DO UPDATE} rather than {@code DO NOTHING}: a
     * provider does occasionally restate a rate, and the corrected number is the
     * one worth holding. Written natively because JPA has no upsert — and the
     * alternative, read-then-decide, is a race whenever two instances run the
     * job at once, which on a platform that restarts containers is not a
     * hypothetical.
     */
    @Modifying
    @Query(
            value =
                    """
                    insert into fx_rates (base, quote, rate_date, rate)
                    values (:base, :quote, :rateDate, :rate)
                    on conflict (base, quote, rate_date)
                    do update set rate = excluded.rate
                    """,
            nativeQuery = true)
    void upsert(
            @Param("base") String base,
            @Param("quote") String quote,
            @Param("rateDate") LocalDate rateDate,
            @Param("rate") BigDecimal rate);
}
