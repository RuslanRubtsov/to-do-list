package io.github.ruslanrubtsov.todo.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How long credentials last.
 *
 * @param accessTokenTtl lifetime of the JWT sent with each request; short, because it can't be revoked
 * @param refreshTokenTtl lifetime of the refresh token cookie, which keeps a User logged in
 */
@ConfigurationProperties("todo.auth")
record AuthProperties(
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("14d") Duration refreshTokenTtl) {}
