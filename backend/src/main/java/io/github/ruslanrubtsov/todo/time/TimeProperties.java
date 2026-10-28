package io.github.ruslanrubtsov.todo.time;

import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How the app tells the time.
 *
 * @param zone the time zone that "today" is reckoned in, as for which Tasks are Overdue; Due Dates
 *     are dates without a zone, so they are compared with today's date there
 */
@ConfigurationProperties("todo.time")
record TimeProperties(@DefaultValue("Europe/Kyiv") ZoneId zone) {}
