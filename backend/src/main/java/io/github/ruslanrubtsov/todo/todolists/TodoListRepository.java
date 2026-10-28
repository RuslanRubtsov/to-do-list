package io.github.ruslanrubtsov.todo.todolists;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface TodoListRepository extends JpaRepository<TodoListEntity, Long> {

    Optional<TodoListEntity> findByIdAndOwnerId(long id, long ownerId);

    boolean existsByIdAndOwnerId(long id, long ownerId);

    /** The Owner's Todo Lists by name, each with how many of its Tasks are open. */
    @Query(nativeQuery = true, value = """
            SELECT l.id, l.name, l.version,
                   (SELECT COUNT(*) FROM tasks t WHERE t.todo_list_id = l.id AND t.completed_at IS NULL)
                       AS openTaskCount
            FROM todo_lists l
            WHERE l.owner_id = :ownerId
            ORDER BY l.name, l.id
            """)
    List<TodoListSummary> findSummariesByOwnerId(long ownerId);

    @Query(nativeQuery = true, value = """
            SELECT COUNT(*) FROM tasks WHERE todo_list_id = :todoListId AND completed_at IS NULL
            """)
    int countOpenTasks(long todoListId);

    /** A Todo List as the API shows it. */
    interface TodoListSummary {
        long getId();

        String getName();

        long getVersion();

        int getOpenTaskCount();
    }
}
