package com.primeledger.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * "Now" is injected, never read from a static.
 *
 * <p>Date rules such as D-09's future-date bound are only testable if the test
 * can decide what today is.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
