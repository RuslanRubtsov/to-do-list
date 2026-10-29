package io.github.ruslanrubtsov.todo.todolists;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface TodoListRepository extends JpaRepository<TodoListEntity, Long> {

    /**
     * The User's role on the Todo List: {@code OWNER}, or the role a Share gives them; none when they
     * have neither, or there is no such Todo List.
     */
    @Query(nativeQuery = true, value = """
            SELECT CASE WHEN l.owner_id = :userId THEN 'OWNER' ELSE s.role END
            FROM todo_lists l
            LEFT JOIN shares s ON s.todo_list_id = l.id AND s.user_id = :userId
            WHERE l.id = :todoListId
            """)
    Optional<String> findRole(long userId, long todoListId);

    /** The Todo List, locked against other writers until the transaction ends. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TodoListEntity> findWithLockById(long id);

    /**
     * The Todo Lists the User owns or that are Shared with them, by name, each with how many of its
     * Tasks are open, the User's role on it and its Owner's display name.
     */
    @Query(nativeQuery = true, value = SUMMARIES + """
            WHERE l.owner_id = :userId OR s.user_id IS NOT NULL
            ORDER BY l.name, l.id
            """)
    List<TodoListSummary> findSummaries(long userId);

    /** One Todo List as {@link #findSummaries} has it, whatever the User's access to it. */
    @Query(nativeQuery = true, value = SUMMARIES + """
            WHERE l.id = :todoListId
            """)
    Optional<TodoListSummary> findSummary(long userId, long todoListId);

    String SUMMARIES = """
            SELECT l.id, l.name, l.version,
                   (SELECT COUNT(*) FROM tasks t WHERE t.todo_list_id = l.id AND t.completed_at IS NULL)
                       AS openTaskCount,
                   CASE WHEN l.owner_id = :userId THEN 'OWNER' ELSE s.role END AS role,
                   u.display_name AS ownerDisplayName
            FROM todo_lists l
            JOIN users u ON u.id = l.owner_id
            LEFT JOIN shares s ON s.todo_list_id = l.id AND s.user_id = :userId
            """;

    /** A Todo List as the API shows it to one User. */
    interface TodoListSummary {
        long getId();

        String getName();

        long getVersion();

        int getOpenTaskCount();

        String getRole();

        String getOwnerDisplayName();
    }
}
