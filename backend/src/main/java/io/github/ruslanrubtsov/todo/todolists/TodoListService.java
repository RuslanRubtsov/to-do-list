package io.github.ruslanrubtsov.todo.todolists;

import static io.github.ruslanrubtsov.todo.web.error.Problems.editConflict;

import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListRename;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class TodoListService {

    private final TodoListRepository todoLists;
    private final TodoListAccess access;

    TodoListService(TodoListRepository todoLists, TodoListAccess access) {
        this.todoLists = todoLists;
        this.access = access;
    }

    @Transactional(readOnly = true)
    List<TodoList> list(long userId) {
        return todoLists.findSummariesByOwnerId(userId).stream()
                .map(summary -> new TodoList(
                        summary.getId(), summary.getName(), summary.getOpenTaskCount(), summary.getVersion()))
                .toList();
    }

    @Transactional
    TodoList create(long userId, String name) {
        return toApi(todoLists.save(new TodoListEntity(userId, name)));
    }

    @Transactional(readOnly = true)
    TodoList get(long userId, long todoListId) {
        return toApi(access.owned(userId, todoListId));
    }

    /** Refused if someone else changed the Todo List since the version the rename is based on. */
    @Transactional
    TodoList rename(long userId, long todoListId, TodoListRename rename) {
        TodoListEntity todoList = access.owned(userId, todoListId);
        if (todoList.getVersion() != rename.getVersion()) {
            throw editConflict("The Todo List has changed since that version.");
        }
        todoList.rename(rename.getName());
        // So the response carries the version saving the rename makes
        todoLists.flush();
        return toApi(todoList);
    }

    /** Its Tasks go with it: the database cascades the delete. */
    @Transactional
    void delete(long userId, long todoListId) {
        todoLists.delete(access.owned(userId, todoListId));
    }

    private TodoList toApi(TodoListEntity todoList) {
        return new TodoList(
                todoList.getId(),
                todoList.getName(),
                todoLists.countOpenTasks(todoList.getId()),
                todoList.getVersion());
    }
}
