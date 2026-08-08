/**
 * Recurring transaction rules (F-03): the rule entity and the {@code @Scheduled}
 * materialiser that instantiates due occurrences. The materialiser must be
 * idempotent — a repeated run may not double-post a transaction.
 *
 * <p>Proposal §6.3. Populated in Phase 6.
 */
package com.primeledger.recurring;
