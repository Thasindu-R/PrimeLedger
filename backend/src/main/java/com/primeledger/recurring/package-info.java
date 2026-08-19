/**
 * Recurring transactions: the standing instruction, and the nightly job that
 * turns it into ordinary ledger rows (F-03, FR-23).
 *
 * <p>The modelling choice worth knowing before reading anything here is that a
 * rule is a <em>template</em>, not a parent. What it generates is a normal
 * transaction — editable, deletable, severable — so a one-off rent increase is
 * an edit to one row rather than a change to the rule and a rewriting of
 * history.
 *
 * <p>Idempotency is spread across three collaborators on purpose; {@link
 * com.primeledger.recurring.RecurringMaterialiser} says which does what.
 *
 * <p>Proposal §10 F-03, §12 Phase 6.
 */
package com.primeledger.recurring;
