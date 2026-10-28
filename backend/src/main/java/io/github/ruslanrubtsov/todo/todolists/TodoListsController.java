package io.github.ruslanrubtsov.todo.todolists;

import io.github.ruslanrubtsov.todo.api.TodoListsApi;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListDraft;
import io.github.ruslanrubtsov.todo.api.model.TodoListRename;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
class TodoListsController implements TodoListsApi {

    private final TodoListService todoListService;

    TodoListsController(TodoListService todoListService) {
        this.todoListService = todoListService;
    }

    @Override
    public ResponseEntity<List<TodoList>> getTodoLists() {
        return ResponseEntity.ok(todoListService.list(CurrentUser.id()));
    }

    @Override
    public ResponseEntity<TodoList> createTodoList(TodoListDraft todoListDraft) {
        TodoList created = todoListService.create(CurrentUser.id(), todoListDraft.getName());
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequest()
                        .path("/{id}")
                        .buildAndExpand(created.getId())
                        .toUri())
                .body(created);
    }

    @Override
    public ResponseEntity<TodoList> getTodoList(Long todoListId) {
        return ResponseEntity.ok(todoListService.get(CurrentUser.id(), todoListId));
    }

    @Override
    public ResponseEntity<TodoList> renameTodoList(Long todoListId, TodoListRename todoListRename) {
        return ResponseEntity.ok(todoListService.rename(CurrentUser.id(), todoListId, todoListRename));
    }

    @Override
    public ResponseEntity<Void> deleteTodoList(Long todoListId) {
        todoListService.delete(CurrentUser.id(), todoListId);
        return ResponseEntity.noContent().build();
    }
}
