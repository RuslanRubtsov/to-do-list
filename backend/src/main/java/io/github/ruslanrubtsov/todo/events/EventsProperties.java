package io.github.ruslanrubtsov.todo.events;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How Todo List events streams are kept.
 *
 * @param heartbeat how often each stream gets a heartbeat, so that proxies and clients don't take a
 *     quiet stream for a dead one
 * @param timeout how long a stream stays open before it ends, for the client to connect again
 */
@ConfigurationProperties("todo.events")
record EventsProperties(
        @DefaultValue("PT20S") Duration heartbeat,
        @DefaultValue("PT30M") Duration timeout) {}
