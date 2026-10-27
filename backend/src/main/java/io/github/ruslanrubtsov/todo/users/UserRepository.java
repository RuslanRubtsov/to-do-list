package io.github.ruslanrubtsov.todo.users;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    /** Looks up by an email already passed through {@link UserEntity#normalizeEmail}. */
    Optional<UserEntity> findByEmail(String normalizedEmail);

    boolean existsByEmail(String normalizedEmail);
}
