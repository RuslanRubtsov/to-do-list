package io.github.ruslanrubtsov.todo.time;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TimeProperties.class)
class TimeConfiguration {

    /** The clock that dates are reckoned by: the system's, in the configured time zone. */
    @Bean
    Clock clock(TimeProperties properties) {
        return Clock.system(properties.zone());
    }
}
