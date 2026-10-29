package io.github.ruslanrubtsov.todo.tasks;

import io.github.ruslanrubtsov.todo.api.TasksApi;
import io.github.ruslanrubtsov.todo.api.model.Priority;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TaskDetails;
import io.github.ruslanrubtsov.todo.api.model.TaskDraft;
import io.github.ruslanrubtsov.todo.api.model.TaskMove;
import io.github.ruslanrubtsov.todo.api.model.TaskPage;
import io.github.ruslanrubtsov.todo.api.model.TaskSort;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import java.time.LocalDate;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
class TasksController implements TasksApi {

    private final TaskService taskService;

    TasksController(TaskService taskService) {
        this.taskService = taskService;
    }

    @Override
    public ResponseEntity<TaskPage> getTasks(
            Long todoListId,
            Integer page,
            Integer size,
            @Nullable TaskSort sort,
            @Nullable Boolean completed,
            @Nullable List<Priority> priority,
            @Nullable LocalDate dueFrom,
            @Nullable LocalDate dueTo,
            @Nullable Boolean overdue,
            @Nullable String q) {
        TaskQuery query = new TaskQuery(
                completed,
                priority == null ? List.of() : priority,
                dueFrom,
                dueTo,
                overdue,
                q,
                sort == null ? TaskSort.POSITION : sort);
        return ResponseEntity.ok(taskService.query(CurrentUser.id(), todoListId, query, page, size));
    }

    @Override
    public ResponseEntity<Task> createTask(Long todoListId, TaskDraft taskDraft) {
        Task created = taskService.create(CurrentUser.id(), todoListId, taskDraft.getTitle());
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequest()
                        .path("/{id}")
                        .buildAndExpand(created.getId())
                        .toUri())
                .body(created);
    }

    @Override
    public ResponseEntity<Task> getTask(Long todoListId, Long taskId) {
        return ResponseEntity.ok(taskService.get(CurrentUser.id(), todoListId, taskId));
    }

    @Override
    public ResponseEntity<Task> updateTask(Long todoListId, Long taskId, TaskDetails taskDetails) {
        return ResponseEntity.ok(taskService.change(CurrentUser.id(), todoListId, taskId, taskDetails));
    }

    @Override
    public ResponseEntity<Task> completeTask(Long todoListId, Long taskId) {
        return ResponseEntity.ok(taskService.complete(CurrentUser.id(), todoListId, taskId));
    }

    @Override
    public ResponseEntity<Task> uncompleteTask(Long todoListId, Long taskId) {
        return ResponseEntity.ok(taskService.uncomplete(CurrentUser.id(), todoListId, taskId));
    }

    @Override
    public ResponseEntity<Task> moveTask(Long todoListId, Long taskId, TaskMove taskMove) {
        return ResponseEntity.ok(taskService.move(CurrentUser.id(), todoListId, taskId, taskMove));
    }

    @Override
    public ResponseEntity<Void> deleteTask(Long todoListId, Long taskId) {
        taskService.delete(CurrentUser.id(), todoListId, taskId);
        return ResponseEntity.noContent().build();
    }
}
