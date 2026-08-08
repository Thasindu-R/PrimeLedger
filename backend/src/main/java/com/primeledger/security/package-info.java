/**
 * Authentication and per-request authorisation: {@code JwtAuthConverter}, the
 * {@code CurrentUser} argument resolver and {@code RlsConnectionCustomizer},
 * which sets the PostgreSQL session variable row-level security reads.
 *
 * <p>Proposal §6.3. Populated in Phase 3.
 */
package com.primeledger.security;
