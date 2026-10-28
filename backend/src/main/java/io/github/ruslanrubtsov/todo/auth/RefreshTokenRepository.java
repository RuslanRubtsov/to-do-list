package io.github.ruslanrubtsov.todo.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, Long> {

    @EntityGraph(attributePaths = "user")
    Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);
}
