package com.primeledger.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

class PaginationTest {

    private static final Set<String> SORTABLE = Set.of("occurredOn", "amount");
    private static final Sort FALLBACK = Sort.by(Sort.Direction.DESC, "occurredOn");

    @Test
    @DisplayName("caps the page size so one request cannot read the whole table")
    void capsPageSize() {
        var sanitised = Pagination.sanitise(PageRequest.of(0, 5_000), SORTABLE, FALLBACK);

        assertThat(sanitised.getPageSize()).isEqualTo(Pagination.MAX_PAGE_SIZE);
    }

    @Test
    @DisplayName("applies the fallback ordering when the caller asked for none")
    void appliesFallbackSort() {
        var sanitised = Pagination.sanitise(PageRequest.of(0, 20), SORTABLE, FALLBACK);

        assertThat(sanitised.getSort()).isEqualTo(FALLBACK);
    }

    @Test
    @DisplayName("keeps a permitted ordering")
    void keepsAllowedSort() {
        Sort requested = Sort.by(Sort.Direction.ASC, "amount");

        var sanitised = Pagination.sanitise(PageRequest.of(0, 20, requested), SORTABLE, FALLBACK);

        assertThat(sanitised.getSort()).isEqualTo(requested);
    }

    @Test
    @DisplayName("rejects an unlisted sort property rather than silently ignoring it")
    void rejectsUnknownSort() {
        Sort requested = Sort.by("userId");

        assertThatThrownBy(
                        () -> Pagination.sanitise(PageRequest.of(0, 20, requested), SORTABLE, FALLBACK))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("userId")
                .extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }
}
