package io.github.ruslanrubtsov.todo.demo;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.boot.flyway.autoconfigure.FlywayConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * The {@code demo} profile's demo data (see {@code db/demo}), with its Tasks Overdue, due today,
 * upcoming and Completed relative to the day it is seeded.
 */
@Configuration(proxyBeanMethods = false)
@Profile("demo")
class DemoDataConfiguration {

    /**
     * Today as the app reckons it, in its time zone, for the seed's dates. The database's own date
     * may be another day: it reckons in UTC.
     */
    @Bean
    FlywayConfigurationCustomizer demoTodayPlaceholder(Clock clock) {
        return configuration -> configuration.placeholders(
                Map.of("demoToday", LocalDate.now(clock).toString()));
    }
}
