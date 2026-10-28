package io.github.ruslanrubtsov.todo.auth;

import io.github.ruslanrubtsov.todo.api.model.AuthSession;
import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.Language;
import io.github.ruslanrubtsov.todo.api.model.LoginRequest;
import io.github.ruslanrubtsov.todo.api.model.RegisterRequest;
import io.github.ruslanrubtsov.todo.users.UserEntity;
import io.github.ruslanrubtsov.todo.users.UserMapper;
import io.github.ruslanrubtsov.todo.users.UserRepository;
import io.github.ruslanrubtsov.todo.web.error.Problems;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;

@Service
class AuthService {

    /** BCrypt ignores everything past its first 72 bytes, and Spring Security refuses longer input. */
    private static final int BCRYPT_MAX_BYTES = 72;

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokens accessTokens;
    private final RefreshTokens refreshTokens;
    private final AuthProperties properties;

    /** Checked against when the email is unknown, so a login takes as long either way. */
    private final String unknownUserPasswordHash;

    AuthService(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            AccessTokens accessTokens,
            RefreshTokens refreshTokens,
            AuthProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.properties = properties;
        this.unknownUserPasswordHash = passwordEncoder.encode("not-anyone's-password-1");
    }

    /** A logged-in session: what the response body carries, plus the refresh token for the cookie. */
    record Login(AuthSession session, String refreshToken) {}

    @Transactional
    UserEntity register(RegisterRequest request) {
        if (request.getPassword().getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw Problems.invalidField("password", "SIZE");
        }
        String email = UserEntity.normalizeEmail(request.getEmail());
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        UserEntity user = new UserEntity(
                email,
                passwordEncoder.encode(request.getPassword()),
                request.getDisplayName().strip(),
                Objects.requireNonNullElse(request.getPreferredLanguage(), Language.EN));
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Someone registered the same email between the check and the insert
            throw emailTaken();
        }
    }

    @Transactional
    Login login(LoginRequest request) {
        Optional<UserEntity> user = users.findByEmail(UserEntity.normalizeEmail(request.getEmail()));
        String passwordHash = user.map(UserEntity::getPasswordHash).orElse(unknownUserPasswordHash);
        boolean passwordMatches = passwordEncoder.matches(request.getPassword(), passwordHash);
        if (user.isEmpty() || !passwordMatches) {
            // One answer for both, so the response doesn't reveal which emails are registered
            throw Problems.problem(
                    HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, "The email or password is wrong.");
        }
        return new Login(session(user.get()), refreshTokens.issue(user.get()));
    }

    @Transactional(readOnly = true)
    AuthSession refresh(@Nullable String refreshToken) {
        return Optional.ofNullable(refreshToken)
                .flatMap(refreshTokens::userOf)
                .map(this::session)
                .orElseThrow(() -> Problems.problem(
                        HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "The session has expired or ended."));
    }

    @Transactional
    void logout(String refreshToken) {
        refreshTokens.revoke(refreshToken);
    }

    private AuthSession session(UserEntity user) {
        return new AuthSession(
                accessTokens.issue(user),
                AuthSession.TokenTypeEnum.BEARER,
                Math.toIntExact(properties.accessTokenTtl().toSeconds()),
                UserMapper.toApi(user));
    }

    private static ErrorResponseException emailTaken() {
        return Problems.problem(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN, "A User with this email already exists.");
    }
}
