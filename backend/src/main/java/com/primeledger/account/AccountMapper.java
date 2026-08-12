package com.primeledger.account;

import com.primeledger.account.dto.AccountResponse;
import org.mapstruct.Mapper;

/** Entity → DTO at compile time, as with the other features (proposal §5.1). */
@Mapper
public interface AccountMapper {

    AccountResponse toResponse(Account account);
}
