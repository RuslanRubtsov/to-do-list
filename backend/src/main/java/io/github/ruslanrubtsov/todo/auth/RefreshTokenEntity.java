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

    @Column(updatable = false)
    private String tokenHash;

    @Column(updatable = false)
    private Instant createdAt;

    @Column(updatable = false)
    private Instant expiresAt;

    private @Nullable Instant revokedAt;

    protected RefreshTokenEntity() {}

    RefreshTokenEntity(UserEntity user, String tokenHash, Instant createdAt, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    UserEntity getUser() {
        return user;
    }

    boolean isUsableAt(Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }

    void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }
}
