package io.github.ruslanrubtsov.todo.auth;

import io.github.ruslanrubtsov.todo.users.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** A refresh token that was handed out, known only by its hash. */
@Entity
@Table(name = "refresh_tokens")
class RefreshTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", updatable = false)
    private UserEntity user;

    /** The chain of tokens descended, by rotation, from one login. */
    @Column(updatable = false)
    private String familyId;

    @Column(updatable = false)
    private String tokenHash;

    @Column(updatable = false)
    private Instant createdAt;

    @Column(updatable = false)
    private Instant expiresAt;

    /** When a refresh replaced this token with the next one in its family. */
    private @Nullable Instant rotatedAt;

    /** When its family was revoked, by logging out or because a rotated token was replayed. */
    private @Nullable Instant revokedAt;

    protected RefreshTokenEntity() {}

    RefreshTokenEntity(UserEntity user, String familyId, String tokenHash, Instant createdAt, Instant expiresAt) {
        this.user = user;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    UserEntity getUser() {
        return user;
    }

    String getFamilyId() {
        return familyId;
    }

    boolean isRotated() {
        return rotatedAt != null;
    }

    boolean isUsableAt(Instant now) {
        return rotatedAt == null && revokedAt == null && now.isBefore(expiresAt);
    }

    void rotate(Instant now) {
        rotatedAt = now;
    }
}
