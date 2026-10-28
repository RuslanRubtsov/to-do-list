package io.github.ruslanrubtsov.todo.tasks;

import static io.github.ruslanrubtsov.todo.web.error.Problems.editConflict;
import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TaskDetails;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class TaskService {

    private final TaskRepository tasks;
    private final TodoListAccess access;
    private final Clock clock;

    TaskService(TaskRepository tasks, TodoListAccess access, Clock clock) {
        this.tasks = tasks;
        this.access = access;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    List<Task> list(long userId, long todoListId) {
        access.requireOwned(userId, todoListId);
        return tasks.findByTodoListIdOrderById(todoListId).stream()
                .map(this::toApi)
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

    /** Refused if someone else changed the Task since the version the details are based on. */
    @Transactional
    Task change(long userId, long todoListId, long taskId, TaskDetails details) {
        TaskEntity task = reachable(userId, todoListId, taskId);
        if (task.getVersion() != details.getVersion()) {
            throw editConflict("The Task has changed since that version.");
        }
        task.change(details.getTitle(), details.getDescription(), details.getDueDate(), details.getPriority());
        return flushedToApi(task);
    }

    @Transactional
    Task complete(long userId, long todoListId, long taskId) {
        TaskEntity task = reachable(userId, todoListId, taskId);
        task.complete();
        return flushedToApi(task);
    }

    @Transactional
    Task uncomplete(long userId, long todoListId, long taskId) {
        TaskEntity task = reachable(userId, todoListId, taskId);
        task.uncomplete();
        return flushedToApi(task);
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

    /** The changed Task as the API shows it, with the version saving the change made. */
    private Task flushedToApi(TaskEntity task) {
        tasks.flush();
        return toApi(task);
    }

    /** The Task as the API shows it, Overdue or not as of today. */
    private Task toApi(TaskEntity task) {
        return new Task(
                        task.getId(),
                        task.getTitle(),
                        task.getPriority(),
                        task.isOverdueOn(LocalDate.now(clock)),
                        task.getVersion())
                .description(task.getDescription())
                .dueDate(task.getDueDate())
                .completedAt(
                        task.getCompletedAt() == null
                                ? null
                                : task.getCompletedAt().atOffset(ZoneOffset.UTC));
    }
}
