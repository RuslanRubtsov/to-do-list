package io.github.ruslanrubtsov.todo.tasks;

import io.github.ruslanrubtsov.todo.api.TasksApi;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TaskDraft;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import java.util.List;
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
    public ResponseEntity<List<Task>> getTasks(Long todoListId) {
        return ResponseEntity.ok(taskService.list(CurrentUser.id(), todoListId));
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
    public ResponseEntity<Task> completeTask(Long todoListId, Long taskId) {
        return ResponseEntity.ok(taskService.complete(CurrentUser.id(), todoListId, taskId));
    }

    @Override
    public ResponseEntity<Task> uncompleteTask(Long todoListId, Long taskId) {
        return ResponseEntity.ok(taskService.uncomplete(CurrentUser.id(), todoListId, taskId));
    }

    @Override
    public ResponseEntity<Void> deleteTask(Long todoListId, Long taskId) {
        taskService.delete(CurrentUser.id(), todoListId, taskId);
        return ResponseEntity.noContent().build();
    }
}
