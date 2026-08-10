package com.primeledger.transaction;

import com.primeledger.transaction.dto.TransactionResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity → DTO at compile time (proposal §5.1).
 *
 * <p>{@code amount} converts {@code BigDecimal} → {@code String} through
 * MapStruct's built-in conversion, which is exactly the wire format §7.3 asks
 * for.
 */
@Mapper
public interface TransactionMapper {

    @Mapping(target = "categoryId", source = "category.id")
    @Mapping(target = "categoryName", source = "category.name")
    TransactionResponse toResponse(Transaction transaction);
}
