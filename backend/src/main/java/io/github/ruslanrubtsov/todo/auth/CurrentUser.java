package io.github.ruslanrubtsov.todo.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** The User whose access token authenticated the current request. */
public final class CurrentUser {

    private CurrentUser() {}

    /** Only for requests Spring Security has already authenticated with an access token. */
    public static long id() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new IllegalStateException("The request is not authenticated with an access token");
        }
        return Long.parseLong(jwt.getSubject());
    }
}
