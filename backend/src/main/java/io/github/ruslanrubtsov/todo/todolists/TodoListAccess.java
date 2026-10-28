package io.github.ruslanrubtsov.todo.todolists;

import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.ErrorResponseException;

/** Decides which Todo Lists a User may reach. For now, only those they own. */
@Component
public class TodoListAccess {

    private final TodoListRepository todoLists;

    TodoListAccess(TodoListRepository todoLists) {
        this.todoLists = todoLists;
    }

    /**
     * Throws {@code 404} unless the User owns the Todo List. Any other, existing or not, is reported
     * the same way, so its existence is never revealed.
     */
    public void requireOwned(long userId, long todoListId) {
        if (!todoLists.existsByIdAndOwnerId(todoListId, userId)) throw notFound();
    }

    /** The User's own Todo List, or {@code 404} as {@link #requireOwned} reports it. */
    TodoListEntity owned(long userId, long todoListId) {
        return todoLists.findByIdAndOwnerId(todoListId, userId).orElseThrow(TodoListAccess::notFound);
    }

    private static ErrorResponseException notFound() {
        return problem(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such Todo List.");
    }
}
