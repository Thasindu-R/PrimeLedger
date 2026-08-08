/**
 * Cross-cutting types shared by every feature package:
 * {@code GlobalExceptionHandler}, {@code ApiError}, {@code PageResponse} and
 * {@code Auditable}.
 *
 * <p>This package may not depend on any feature package — the dependency runs
 * one way only, or the feature-package boundary stops meaning anything.
 *
 * <p>Proposal §6.3. Populated in Phase 2.
 */
package com.primeledger.common;
