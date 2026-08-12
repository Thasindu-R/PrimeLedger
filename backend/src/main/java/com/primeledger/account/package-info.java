/**
 * Accounts and transfers (F-01), including exclusion of transfers from income
 * and expense totals.
 *
 * <p>Proposal §6.3. Phase 5 owns this feature. Phase 4 added only what it could
 * not do without — reading the caller's accounts, and provisioning a default one
 * — because a transaction cannot be recorded without an account to file it
 * under. Creating, renaming, archiving, balances and transfers are still Phase 5.
 */
package com.primeledger.account;
