package io.github.ruslanrubtsov.todo.auth;

import io.github.ruslanrubtsov.todo.api.AuthApi;
import io.github.ruslanrubtsov.todo.api.model.AuthSession;
import io.github.ruslanrubtsov.todo.api.model.LoginRequest;
import io.github.ruslanrubtsov.todo.api.model.RegisterRequest;
import io.github.ruslanrubtsov.todo.api.model.User;
import io.github.ruslanrubtsov.todo.users.UserMapper;
import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AuthController implements AuthApi {

    /** Only the refresh and logout endpoints, under this path, ever receive the refresh token. */
    static final String REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth/session";

    static final String REFRESH_TOKEN_COOKIE = "todo_refresh";

    private final AuthService authService;
    private final AuthProperties properties;

    AuthController(AuthService authService, AuthProperties properties) {
        this.authService = authService;
        this.properties = properties;
    }

    @Override
    public ResponseEntity<User> register(RegisterRequest registerRequest) {
        return ResponseEntity.status(HttpStatus.CREATED).body(UserMapper.toApi(authService.register(registerRequest)));
    }

    @Override
    public ResponseEntity<AuthSession> login(LoginRequest loginRequest) {
        return withRefreshTokenCookie(authService.login(loginRequest));
    }

    @Override
    public ResponseEntity<AuthSession> refreshSession(@Nullable String todoRefresh) {
        try {
            return withRefreshTokenCookie(authService.refresh(todoRefresh));
        } catch (ErrorResponseException refused) {
            // The token can never work again, so stop the browser sending it
            refused.getHeaders().add(HttpHeaders.SET_COOKIE, clearedRefreshTokenCookie());
            throw refused;
        }
    }

    private ResponseEntity<AuthSession> withRefreshTokenCookie(AuthService.IssuedSession issued) {
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        refreshTokenCookie(issued.refreshToken(), properties.refreshTokenTtl())
                                .toString())
                .body(issued.session());
    }

    @Override
    public ResponseEntity<Void> logout(@Nullable String todoRefresh) {
        if (todoRefresh != null) {
            authService.logout(todoRefresh);
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearedRefreshTokenCookie())
                .build();
    }

    /** Expires the browser's refresh token cookie. */
    private static String clearedRefreshTokenCookie() {
        return refreshTokenCookie("", Duration.ZERO).toString();
    }

    /** JavaScript can't read it, other sites can't make the browser send it, and plain HTTP never carries it. */
    private static ResponseCookie refreshTokenCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, value)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path(REFRESH_TOKEN_COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
