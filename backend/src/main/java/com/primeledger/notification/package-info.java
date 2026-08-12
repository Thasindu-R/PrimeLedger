/**
 * In-app notifications: the things the bell in TopNavBar carries.
 *
 * <p>Not one of the twelve packages the Phase 2 scaffold created, and
 * deliberately so. Budget threshold alerts (F-02) are the first kind, but the
 * insights engine (F-07) emits notifications too, and a table living under
 * {@code budget} would have to be reached into from a package that has nothing
 * to do with budgets. The kind is a column, not a package.
 *
 * <p>Emission is idempotent by construction: a unique index in V4 makes a second
 * "Food is over budget for August" impossible to insert, rather than relying on
 * every caller remembering to check first.
 */
package com.primeledger.notification;
