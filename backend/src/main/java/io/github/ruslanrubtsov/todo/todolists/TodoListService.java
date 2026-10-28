package io.github.ruslanrubtsov.todo.todolists;

import io.github.ruslanrubtsov.todo.api.model.TodoList;
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
                .map(summary -> new TodoList(summary.getId(), summary.getName(), summary.getOpenTaskCount()))
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

    @Transactional
    TodoList rename(long userId, long todoListId, String name) {
        TodoListEntity todoList = access.owned(userId, todoListId);
        todoList.rename(name);
        return toApi(todoList);
    }

    /** Its Tasks go with it: the database cascades the delete. */
    @Transactional
    void delete(long userId, long todoListId) {
        todoLists.delete(access.owned(userId, todoListId));
    }

    private TodoList toApi(TodoListEntity todoList) {
        return new TodoList(todoList.getId(), todoList.getName(), todoLists.countOpenTasks(todoList.getId()));
    }
}
