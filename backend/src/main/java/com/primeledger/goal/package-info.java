/**
 * Savings goals: a named target against an account, and the projection that
 * says whether the user's actual behaviour will reach it (F-04, FR-24).
 *
 * <p>A goal owns no money. It is a way of reading an account, which is why
 * saving towards one is an ordinary transfer and why deleting a goal touches
 * nothing but the target itself.
 *
 * <p>Everything the user is shown beyond the name and the target is derived at
 * read time — see {@link com.primeledger.goal.GoalProjection}, which is a pure
 * function precisely so the interesting cases can be tested with fixed numbers.
 *
 * <p>Proposal §10 F-04, §12 Phase 6.
 */
package com.primeledger.goal;
