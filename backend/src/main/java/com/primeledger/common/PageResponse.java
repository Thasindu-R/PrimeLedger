package com.primeledger.common;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * The paginated collection envelope (proposal §8.2).
 *
 * <p>Spring's own {@code Page} serialisation is unstable across versions and
 * leaks the {@code Pageable}; this is a fixed, documented shape instead.
 *
 * @param <T> the element type as it appears on the wire
 */
@Schema(name = "PageResponse", description = "Paginated collection envelope")
public record PageResponse<T>(
        List<T> content,
        @Schema(example = "0") int page,
        @Schema(example = "50") int size,
        @Schema(example = "384") long totalElements,
        @Schema(example = "8") int totalPages,
        boolean first,
        boolean last) {

    /** Maps a repository page straight into the wire shape. */
    public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast());
    }
}
