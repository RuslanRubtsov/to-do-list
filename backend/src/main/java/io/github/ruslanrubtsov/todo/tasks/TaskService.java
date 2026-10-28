package io.github.ruslanrubtsov.todo.tasks;

import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class TaskService {

    private final TaskRepository tasks;
    private final TodoListAccess access;

    TaskService(TaskRepository tasks, TodoListAccess access) {
        this.tasks = tasks;
        this.access = access;
    }

    @Transactional(readOnly = true)
    List<Task> list(long userId, long todoListId) {
        access.requireOwned(userId, todoListId);
        return tasks.findByTodoListIdOrderById(todoListId).stream()
                .map(TaskService::toApi)
                .toList();
    }

    @Transactional
    Task create(long userId, long todoListId, String title) {
        access.requireOwned(userId, todoListId);
        return toApi(tasks.save(new TaskEntity(todoListId, title)));
    }

    @Transactional(readOnly = true)
    Task get(long userId, long todoListId, long taskId) {
        return toApi(reachable(userId, todoListId, taskId));
    }

    @Transactional
    Task complete(long userId, long todoListId, long taskId) {
        TaskEntity task = reachable(userId, todoListId, taskId);
        task.complete();
        return toApi(task);
    }

    @Transactional
    Task uncomplete(long userId, long todoListId, long taskId) {
        TaskEntity task = reachable(userId, todoListId, taskId);
        task.uncomplete();
        return toApi(task);
    }

    @Transactional
    void delete(long userId, long todoListId, long taskId) {
        tasks.delete(reachable(userId, todoListId, taskId));
    }

    /**
     * The Task, reached through its own Todo List. One in another Todo List, or in one the User can't
     * reach, is reported as missing.
     */
    private TaskEntity reachable(long userId, long todoListId, long taskId) {
        access.requireOwned(userId, todoListId);
        return tasks.findByIdAndTodoListId(taskId, todoListId)
                .orElseThrow(() -> problem(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such Task."));
    }

    private static Task toApi(TaskEntity task) {
        return new Task(task.getId(), task.getTitle(), task.getPriority())
                .dueDate(task.getDueDate())
                .completedAt(
                        task.getCompletedAt() == null
                                ? null
                                : task.getCompletedAt().atOffset(ZoneOffset.UTC));
    }
}
