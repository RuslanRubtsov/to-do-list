package io.github.ruslanrubtsov.todo.auth;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, Long> {

    /**
     * Locks the token's row until the transaction ends, so whatever else is done with the same
     * token waits: a second refresh then finds it rotated, and a logout revokes the token the
     * rotation added to its family. Only this row: fetching its User here would lock theirs too.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshTokenEntity> findLockedByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshTokenEntity t set t.revokedAt = :now where t.familyId = :familyId and t.revokedAt is null")
    void revokeFamily(String familyId, Instant now);
}
