package io.github.ruslanrubtsov.todo.todolists;

import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.ErrorResponseException;

/**
 * Decides what a User may do with a Todo List: resolves their role on it, Owner, Editor, Viewer or
 * none, and enforces the permission matrix. Every Todo List and Task operation goes through it.
 */
@Component
public class TodoListAccess {

    /** What a User may want to do with a Todo List; their role decides whether they may. */
    public enum Action {
        READ,
        CHANGE_TASKS,
        RENAME,
        DELETE,
        /** Share it, see whom it is Shared with, change their roles and revoke their Shares. */
        SHARE,
        /** End one's own Share of it. */
        LEAVE
    }

    private final TodoListRepository todoLists;

    TodoListAccess(TodoListRepository todoLists) {
        this.todoLists = todoLists;
    }

    /**
     * The permission matrix: Viewers only read, Editors also change Tasks, the Owner does anything
     * else. Those it is Shared with may leave it; its Owner can't.
     */
    static boolean allows(TodoListRole role, Action action) {
        return switch (action) {
            case READ -> true;
            case CHANGE_TASKS -> role != TodoListRole.VIEWER;
            case RENAME, DELETE, SHARE -> role == TodoListRole.OWNER;
            case LEAVE -> role != TodoListRole.OWNER;
        };
    }

    /**
     * Throws unless the User's role on the Todo List allows the action: {@code 404} when they have
     * none, exactly as for a Todo List that doesn't exist, so its existence is never revealed;
     * {@code 403} when their role doesn't allow it.
     */
    public TodoListRole require(long userId, long todoListId, Action action) {
        TodoListRole role = todoLists
                .findRole(userId, todoListId)
                .map(TodoListRole::fromValue)
                .orElseThrow(TodoListAccess::notFound);
        if (!allows(role, action)) {
            throw problem(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "Your role on this Todo List doesn't allow that.");
        }
        return role;
    }

    /**
     * Like {@link #require}, and holds the Todo List until the transaction ends, so that changes to
     * the order of its Tasks, or to whom it is Shared with, are made one at a time.
     */
    public void lock(long userId, long todoListId, Action action) {
        require(userId, todoListId, action);
        todoLists.findWithLockById(todoListId).orElseThrow(TodoListAccess::notFound);
    }

    /** The Todo List, if the User's role on it allows the action; refused as {@link #require} does. */
    TodoListEntity todoList(long userId, long todoListId, Action action) {
        require(userId, todoListId, action);
        return todoLists.findById(todoListId).orElseThrow(TodoListAccess::notFound);
    }

    static ErrorResponseException notFound() {
        return problem(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such Todo List.");
    }
}
