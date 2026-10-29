package io.github.ruslanrubtsov.todo.events;

import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TodoListEvent;
import io.github.ruslanrubtsov.todo.api.model.TodoListEvent.TypeEnum;

/**
 * A change to a Todo List, published as an application event while the change is being saved; its
 * {@link #event()} goes out on the Todo List's events stream once the change commits.
 */
public record TodoListChange(TodoListEvent event) {

    /** The Task was added, changed, Completed, un-Completed or moved, and is now as given. */
    public static TodoListChange ofTask(TypeEnum type, long todoListId, Task task) {
        return new TodoListChange(new TodoListEvent(type, todoListId).task(task));
    }

    public static TodoListChange taskDeleted(long todoListId, long taskId) {
        return new TodoListChange(new TodoListEvent(TypeEnum.TASK_DELETED, todoListId).taskId(taskId));
    }

    public static TodoListChange renamed(long todoListId, String name, long version) {
        return new TodoListChange(new TodoListEvent(TypeEnum.TODO_LIST_RENAMED, todoListId)
                .name(name)
                .version(version));
    }

    public static TodoListChange deleted(long todoListId) {
        return new TodoListChange(new TodoListEvent(TypeEnum.TODO_LIST_DELETED, todoListId));
    }

    /** The User's access ended: the Owner revoked their Share, or they left. */
    public static TodoListChange shareRevoked(long todoListId, long userId) {
        return new TodoListChange(new TodoListEvent(TypeEnum.SHARE_REVOKED, todoListId).userId(userId));
    }

    public long todoListId() {
        return event.getTodoListId();
    }
}
