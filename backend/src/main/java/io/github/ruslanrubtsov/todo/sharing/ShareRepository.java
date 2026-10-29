package io.github.ruslanrubtsov.todo.sharing;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface ShareRepository extends JpaRepository<ShareEntity, Long> {

    boolean existsByTodoListIdAndUserId(long todoListId, long userId);

    Optional<ShareEntity> findByTodoListIdAndUserId(long todoListId, long userId);

    /** The Todo List's Shares, with the Users they are with, by display name. */
    @Query(nativeQuery = true, value = """
            SELECT s.user_id AS userId, u.email, u.display_name AS displayName, s.role
            FROM shares s
            JOIN users u ON u.id = s.user_id
            WHERE s.todo_list_id = :todoListId
            ORDER BY u.display_name, u.id
            """)
    List<ShareSummary> findSummaries(long todoListId);

    /** A Share as the API shows it. */
    interface ShareSummary {
        long getUserId();

        String getEmail();

        String getDisplayName();

        String getRole();
    }
}
