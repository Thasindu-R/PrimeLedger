/**
 * Multi-currency: exchange rates, the job that fetches them, and the conversion
 * every reporting total goes through (F-05).
 *
 * <p>Three rules hold everywhere in this package, and the feature is wrong the
 * moment any of them is broken:
 *
 * <ol>
 *   <li><strong>Amounts are stored in the account's own currency, never
 *       converted on the way in.</strong> What is recorded is exactly what was
 *       spent. Conversion is a presentation concern and belongs at read time.
 *   <li><strong>A transaction converts at the rate on its own date.</strong>
 *       Otherwise last year's totals move every time this year's rate does, and
 *       a report the user checked in January says something different in June.
 *   <li><strong>Everything is quoted against one stored base.</strong> Cross
 *       rates are triangulated through it rather than fetched, so A→B and B→A
 *       cannot drift apart by the provider's own rounding.
 * </ol>
 *
 * <p>The second rule is the reason conversion is a SQL function rather than Java
 * — see {@code fx_convert} in V7, and the note in {@code AnalyticsRepository}
 * about what would be lost by converting after the GROUP BY.
 *
 * <p>Proposal §10 F-05, §12 Phase 6.
 */
package com.primeledger.currency;
