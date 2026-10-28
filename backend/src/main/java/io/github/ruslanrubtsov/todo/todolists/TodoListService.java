package io.github.ruslanrubtsov.todo.todolists;

import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.ErrorResponseException;

@Service
class TodoListService {

    private final TodoListRepository todoLists;

    TodoListService(TodoListRepository todoLists) {
        this.todoLists = todoLists;
    }

    @Transactional(readOnly = true)
    List<TodoList> list(long userId) {
        return todoLists.findSummariesByOwnerId(userId).stream()
                .map(summary -> new TodoList(summary.getId(), summary.getName(), summary.getOpenTaskCount()))
                .toList();
    }

    @Transactional
    TodoList create(long userId, String name) {
        return toApi(todoLists.save(new TodoListEntity(userId, name)));
    }

    @Transactional(readOnly = true)
    TodoList get(long userId, long todoListId) {
        return toApi(owned(userId, todoListId));
    }

    @Transactional
    TodoList rename(long userId, long todoListId, String name) {
        TodoListEntity todoList = owned(userId, todoListId);
        todoList.rename(name);
        return toApi(todoList);
    }

    /** Its Tasks go with it: the database cascades the delete. */
    @Transactional
    void delete(long userId, long todoListId) {
        todoLists.delete(owned(userId, todoListId));
    }

    /**
     * The User's own Todo List. Any other, existing or not, is reported the same way, so its existence is
     * never revealed.
     */
    private TodoListEntity owned(long userId, long todoListId) {
        return todoLists.findByIdAndOwnerId(todoListId, userId).orElseThrow(TodoListService::notFound);
    }

    private static ErrorResponseException notFound() {
        return problem(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such Todo List.");
    }

    private TodoList toApi(TodoListEntity todoList) {
        return new TodoList(todoList.getId(), todoList.getName(), todoLists.countOpenTasks(todoList.getId()));
    }
}
