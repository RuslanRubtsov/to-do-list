package io.github.ruslanrubtsov.todo.tasks;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface TaskRepository extends JpaRepository<TaskEntity, Long> {

    List<TaskEntity> findByTodoListIdOrderById(long todoListId);

    Optional<TaskEntity> findByIdAndTodoListId(long id, long todoListId);
}
