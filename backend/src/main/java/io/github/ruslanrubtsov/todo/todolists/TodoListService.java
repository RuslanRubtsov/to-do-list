package io.github.ruslanrubtsov.todo.todolists;

import static io.github.ruslanrubtsov.todo.web.error.Problems.editConflict;

import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListRename;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import io.github.ruslanrubtsov.todo.events.TodoListChange;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess.Action;
import io.github.ruslanrubtsov.todo.todolists.TodoListRepository.TodoListSummary;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class TodoListService {

    private final TodoListRepository todoLists;
    private final TodoListAccess access;
    private final ApplicationEventPublisher events;

    TodoListService(TodoListRepository todoLists, TodoListAccess access, ApplicationEventPublisher events) {
        this.todoLists = todoLists;
        this.access = access;
        this.events = events;
    }

    /** Those the User owns and those Shared with them. */
    @Transactional(readOnly = true)
    List<TodoList> list(long userId) {
        return todoLists.findSummaries(userId).stream()
                .map(TodoListService::toApi)
                .toList();
    }

    @Transactional
    TodoList create(long userId, String name) {
        TodoListEntity todoList = todoLists.saveAndFlush(new TodoListEntity(userId, name));
        return summary(userId, todoList.getId());
    }

    @Transactional(readOnly = true)
    TodoList get(long userId, long todoListId) {
        access.require(userId, todoListId, Action.READ);
        return summary(userId, todoListId);
    }

    /** Refused if someone else changed the Todo List since the version the rename is based on. */
    @Transactional
    TodoList rename(long userId, long todoListId, TodoListRename rename) {
        TodoListEntity todoList = access.todoList(userId, todoListId, Action.RENAME);
        if (todoList.getVersion() != rename.getVersion()) {
            throw editConflict("The Todo List has changed since that version.");
        }
        todoList.rename(rename.getName());
        // So the response carries the version saving the rename makes
        todoLists.flush();
        events.publishEvent(TodoListChange.renamed(todoListId, todoList.getName(), todoList.getVersion()));
        return summary(userId, todoListId);
    }

    /** Its Tasks and Shares go with it: the database cascades the delete. */
    @Transactional
    void delete(long userId, long todoListId) {
        todoLists.delete(access.todoList(userId, todoListId, Action.DELETE));
        events.publishEvent(TodoListChange.deleted(todoListId));
    }

    private TodoList summary(long userId, long todoListId) {
        return todoLists
                .findSummary(userId, todoListId)
                .map(TodoListService::toApi)
                .orElseThrow(TodoListAccess::notFound);
    }

    private static TodoList toApi(TodoListSummary summary) {
        return new TodoList(
                summary.getId(),
                summary.getName(),
                summary.getOpenTaskCount(),
                summary.getVersion(),
                TodoListRole.fromValue(summary.getRole()),
                summary.getOwnerDisplayName());
    }
}
