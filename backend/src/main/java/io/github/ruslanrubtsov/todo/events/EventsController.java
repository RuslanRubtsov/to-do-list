package io.github.ruslanrubtsov.todo.events;

import io.github.ruslanrubtsov.todo.api.EventsApi;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess.Action;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The {@code getTodoListEvents} operation of the spec (ADR-0001). Mapped by hand rather than by
 * implementing the generated {@code EventsApi}: its method can't return a stream that stays open.
 */
@RestController
class EventsController {

    private final TodoListStreams streams;
    private final TodoListAccess access;

    EventsController(TodoListStreams streams, TodoListAccess access) {
        this.streams = streams;
        this.access = access;
    }

    @GetMapping(path = EventsApi.PATH_GET_TODO_LIST_EVENTS, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    ResponseEntity<SseEmitter> getTodoListEvents(@PathVariable long todoListId) {
        long userId = CurrentUser.id();
        access.require(userId, todoListId, Action.READ);
        return ResponseEntity.ok()
                // For proxies such as the frontend's nginx to pass each event on as it comes, not hold it back
                .header("X-Accel-Buffering", "no")
                .body(streams.open(userId, todoListId));
    }
}
