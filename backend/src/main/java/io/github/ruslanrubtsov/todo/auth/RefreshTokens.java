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
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Opaque, random refresh tokens. The User gets the token itself, the database only its SHA-256 hash:
 * unlike a password it is already high-entropy, so a fast unsalted hash is enough to make a leaked
 * table useless.
 */
@Component
class RefreshTokens {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokens.class);

    private static final int TOKEN_BYTES = 32;

    private final SecureRandom random = new SecureRandom();
    private final RefreshTokenRepository repository;
    private final AuthProperties properties;

    RefreshTokens(RefreshTokenRepository repository, AuthProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    /** A token rotated to: the User it belongs to and the new token, the only copy of it. */
    record Rotation(UserEntity user, String token) {}

    /** The first refresh token of a new session; the returned value is the only copy of it. */
    String issue(UserEntity user) {
        return issue(user, UUID.randomUUID().toString());
    }

    /**
     * Trades a usable token for the next one in its family. A token that was already rotated has
     * been copied: whoever presents it, the thief or the User, the session can no longer be trusted,
     * so its whole family is revoked. Callers must commit that revocation even though nothing is
     * returned.
     */
    Optional<Rotation> rotate(String token) {
        Instant now = Instant.now();
        Optional<RefreshTokenEntity> found = repository.findLockedByTokenHash(hash(token));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        RefreshTokenEntity stored = found.get();
        if (stored.isRotated()) {
            log.warn(
                    "Rotated refresh token replayed; revoking session family {} of User {}",
                    stored.getFamilyId(),
                    stored.getUser().getId());
            repository.revokeFamily(stored.getFamilyId(), now);
            return Optional.empty();
        }
        if (!stored.isUsableAt(now)) {
            return Optional.empty();
        }
        stored.rotate(now);
        return Optional.of(new Rotation(stored.getUser(), issue(stored.getUser(), stored.getFamilyId())));
    }

    /** Revokes the session the token belongs to, every token in its family; unknown tokens are ignored. */
    void revokeSession(String token) {
        repository
                .findLockedByTokenHash(hash(token))
                .ifPresent(stored -> repository.revokeFamily(stored.getFamilyId(), Instant.now()));
    }

    private String issue(UserEntity user, String familyId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        repository.save(
                new RefreshTokenEntity(user, familyId, hash(token), now, now.plus(properties.refreshTokenTtl())));
        return token;
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
