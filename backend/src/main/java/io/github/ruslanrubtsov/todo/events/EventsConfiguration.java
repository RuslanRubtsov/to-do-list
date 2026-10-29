package io.github.ruslanrubtsov.todo.events;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Todo List events streams, with the task scheduler their heartbeats run on. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(EventsProperties.class)
@EnableScheduling
class EventsConfiguration {}
