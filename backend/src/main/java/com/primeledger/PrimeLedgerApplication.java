package com.primeledger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * {@code @EnableScheduling} arrives with the budget sweep (F-02). Phase 6's
 * recurring-transaction materialiser is the other job it will carry.
 */
@SpringBootApplication
@EnableScheduling
public class PrimeLedgerApplication {

    public static void main(String[] args) {
        SpringApplication.run(PrimeLedgerApplication.class, args);
    }
}
