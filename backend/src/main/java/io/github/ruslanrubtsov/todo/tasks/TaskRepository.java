package io.github.ruslanrubtsov.todo.tasks;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

interface TaskRepository extends JpaRepository<TaskEntity, Long>, JpaSpecificationExecutor<TaskEntity> {

    /** In their manual order; Tasks added at once may share a position, and then go in the order added. */
    List<TaskEntity> findByTodoListIdOrderByPositionAscIdAsc(long todoListId);

    /** The position of the Todo List's last Task; {@code null} when it has none. */
    @Query("SELECT MAX(t.position) FROM TaskEntity t WHERE t.todoListId = :todoListId")
    Long findLastPosition(long todoListId);

    Optional<TaskEntity> findByIdAndTodoListId(long id, long todoListId);
}
