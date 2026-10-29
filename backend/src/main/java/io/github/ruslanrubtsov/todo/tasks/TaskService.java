package io.github.ruslanrubtsov.todo.tasks;

import static io.github.ruslanrubtsov.todo.web.error.Problems.editConflict;
import static io.github.ruslanrubtsov.todo.web.error.Problems.invalidField;
import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.Placement;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TaskDetails;
import io.github.ruslanrubtsov.todo.api.model.TaskMove;
import io.github.ruslanrubtsov.todo.api.model.TaskPage;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess.Action;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalLong;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class TaskService {

    private final TaskRepository tasks;
    private final TodoListAccess access;
    private final Clock clock;

    TaskService(TaskRepository tasks, TodoListAccess access, Clock clock) {
        this.tasks = tasks;
        this.access = access;
        this.clock = clock;
    }

    /** A page of the Todo List's Tasks that match the query, Overdue or not as of today. */
    @Transactional(readOnly = true)
    TaskPage query(long userId, long todoListId, TaskQuery query, int page, int size) {
        access.require(userId, todoListId, Action.READ);
        Page<TaskEntity> found =
                tasks.findAll(query.inTodoList(todoListId, LocalDate.now(clock)), PageRequest.of(page, size));
        return new TaskPage(
                found.map(this::toApi).toList(), page, size, found.getTotalElements(), found.getTotalPages());
    }

    /** Adds the Task at the end of the Todo List, after any other being added or moved meanwhile. */
    @Transactional
    Task create(long userId, long todoListId, String title) {
        access.lock(userId, todoListId, Action.CHANGE_TASKS);
        long position =
                TaskPositions.between(tasks.findLastPosition(todoListId), null).orElseThrow();
        return toApi(tasks.save(new TaskEntity(todoListId, title, position)));
    }

    @Transactional(readOnly = true)
    Task get(long userId, long todoListId, long taskId) {
        return toApi(reachable(userId, todoListId, taskId, Action.READ));
    }

    /** Refused if someone else changed the Task since the version the details are based on. */
    @Transactional
    Task change(long userId, long todoListId, long taskId, TaskDetails details) {
        TaskEntity task = reachable(userId, todoListId, taskId, Action.CHANGE_TASKS);
        if (task.getVersion() != details.getVersion()) {
            throw editConflict("The Task has changed since that version.");
        }
        task.change(details.getTitle(), details.getDescription(), details.getDueDate(), details.getPriority());
        return flushedToApi(task);
    }

    @Transactional
    Task complete(long userId, long todoListId, long taskId) {
        TaskEntity task = reachable(userId, todoListId, taskId, Action.CHANGE_TASKS);
        task.complete();
        return flushedToApi(task);
    }

    @Transactional
    Task uncomplete(long userId, long todoListId, long taskId) {
        TaskEntity task = reachable(userId, todoListId, taskId, Action.CHANGE_TASKS);
        task.uncomplete();
        return flushedToApi(task);
    }

    /**
     * Places the Task just before or after another of its Todo List, between that one and its
     * neighbour; when no gap is left there, renumbers the whole Todo List.
     */
    @Transactional
    Task move(long userId, long todoListId, long taskId, TaskMove move) {
        // One move at a time, so that each sees the order the one before it left
        access.lock(userId, todoListId, Action.CHANGE_TASKS);
        TaskEntity task = reachable(userId, todoListId, taskId, Action.CHANGE_TASKS);
        if (move.getRelativeTo() == taskId) return toApi(task);
        // In order, without the Task being moved
        List<TaskEntity> others = new ArrayList<>(tasks.findByTodoListIdOrderByPositionAscIdAsc(todoListId));
        others.remove(task);
        int relativeToIndex = indexOf(others, move.getRelativeTo());
        if (relativeToIndex < 0) throw invalidField("relativeTo", "NOT_IN_TODO_LIST");
        int at = move.getPlacement() == Placement.BEFORE ? relativeToIndex : relativeToIndex + 1;

        OptionalLong position = TaskPositions.between(
                at > 0 ? others.get(at - 1).getPosition() : null,
                at < others.size() ? others.get(at).getPosition() : null);
        if (position.isPresent()) {
            task.moveTo(position.getAsLong());
        } else {
            others.add(at, task);
            long[] renumbered = TaskPositions.renumbered(others.size());
            for (int i = 0; i < others.size(); i++) others.get(i).moveTo(renumbered[i]);
        }
        return flushedToApi(task);
    }

    private static int indexOf(List<TaskEntity> tasks, long taskId) {
        for (int i = 0; i < tasks.size(); i++) {
            if (tasks.get(i).getId() == taskId) return i;
        }
        return -1;
    }

    @Transactional
    void delete(long userId, long todoListId, long taskId) {
        tasks.delete(reachable(userId, todoListId, taskId, Action.CHANGE_TASKS));
    }

    /**
     * The Task, reached through its own Todo List, if the User's role on it allows the action. One in
     * another Todo List, or in one the User can't reach, is reported as missing.
     */
    private TaskEntity reachable(long userId, long todoListId, long taskId, Action action) {
        access.require(userId, todoListId, action);
        return tasks.findByIdAndTodoListId(taskId, todoListId)
                .orElseThrow(() -> problem(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such Task."));
    }

    /** The changed Task as the API shows it, with the version saving the change made. */
    private Task flushedToApi(TaskEntity task) {
        tasks.flush();
        return toApi(task);
    }

    /** The Task as the API shows it, Overdue or not as of today. */
    private Task toApi(TaskEntity task) {
        return new Task(
                        task.getId(),
                        task.getTitle(),
                        task.getPriority(),
                        task.isOverdueOn(LocalDate.now(clock)),
                        task.getVersion())
                .description(task.getDescription())
                .dueDate(task.getDueDate())
                .completedAt(
                        task.getCompletedAt() == null
                                ? null
                                : task.getCompletedAt().atOffset(ZoneOffset.UTC));
    }
}
