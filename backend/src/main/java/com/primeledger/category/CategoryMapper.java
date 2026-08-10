package com.primeledger.category;

import com.primeledger.category.dto.CategoryResponse;
import org.mapstruct.Mapper;

/**
 * Entity → DTO at compile time (proposal §5.1). {@code unmappedTargetPolicy} is
 * ERROR in build.gradle.kts, so a field added to the response without a source
 * fails the build rather than serialising as null.
 */
@Mapper
public interface CategoryMapper {

    CategoryResponse toResponse(Category category);
}
