package io.github.ruslanrubtsov.todo.auth;

import io.github.ruslanrubtsov.todo.users.UserEntity;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Opaque, random refresh tokens. The User gets the token itself, the database only its SHA-256 hash:
 * unlike a password it is already high-entropy, so a fast unsalted hash is enough to make a leaked
 * table useless.
 */
@Component
class RefreshTokens {

    private static final int TOKEN_BYTES = 32;

    private final SecureRandom random = new SecureRandom();
    private final RefreshTokenRepository repository;
    private final AuthProperties properties;

    RefreshTokens(RefreshTokenRepository repository, AuthProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    /** A new refresh token for the User; the returned value is the only copy of it. */
    String issue(UserEntity user) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        repository.save(new RefreshTokenEntity(user, hash(token), now, now.plus(properties.refreshTokenTtl())));
        return token;
    }

    /** The User a token belongs to, if it was issued, hasn't expired and hasn't been revoked. */
    Optional<UserEntity> userOf(String token) {
        return repository
                .findByTokenHash(hash(token))
                .filter(stored -> stored.isUsableAt(Instant.now()))
                .map(RefreshTokenEntity::getUser);
    }

    /** Makes the token unusable; unknown tokens are ignored. */
    void revoke(String token) {
        repository.findByTokenHash(hash(token)).ifPresent(stored -> stored.revoke(Instant.now()));
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Every Java platform supports SHA-256", e);
        }
    }
}
