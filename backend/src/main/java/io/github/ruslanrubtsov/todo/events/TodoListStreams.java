package io.github.ruslanrubtsov.todo.events;

import io.github.ruslanrubtsov.todo.api.model.TodoListEvent;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import org.jspecify.annotations.Nullable;
import org.springframework.context.SmartLifecycle;
import org.springframework.http.MediaType;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The open events streams of each Todo List, and what goes out on them: each change once it
 * commits, to those who can still read the Todo List, and heartbeats. Single instance: the streams
 * live in this backend's memory.
 *
 * <p>As the backend stops, it ends every stream first: a stream never ends by itself, so the graceful
 * shutdown, which waits for requests to end, would otherwise wait for them until it gives up. Clients
 * follow again once the backend is back.
 */
@Component
class TodoListStreams implements SmartLifecycle {

    private final TodoListAccess access;
    private final EventsProperties properties;
    private final TaskScheduler scheduler;
    private @Nullable ScheduledFuture<?> heartbeats;
    private final Map<Long, Set<Subscriber>> byTodoList = new ConcurrentHashMap<>();
    private volatile boolean running;

    TodoListStreams(TodoListAccess access, EventsProperties properties, TaskScheduler scheduler) {
        this.access = access;
        this.properties = properties;
        this.scheduler = scheduler;
    }

    /** A new stream of the Todo List's events for the User, who can read it. */
    SseEmitter open(long userId, long todoListId) {
        SseEmitter emitter = new SseEmitter(properties.timeout().toMillis());
        Subscriber subscriber = new Subscriber(userId, todoListId, emitter);
        byTodoList
                .computeIfAbsent(todoListId, id -> ConcurrentHashMap.newKeySet())
                .add(subscriber);
        emitter.onCompletion(() -> forget(subscriber));
        emitter.onTimeout(() -> forget(subscriber));
        emitter.onError(error -> forget(subscriber));
        // At once, so that the response starts and the client knows it is following the Todo List
        send(subscriber, SseEmitter.event().comment("connected"));
        return emitter;
    }

    /**
     * Sends the change, now that it is saved, to each subscriber who can still read the Todo List.
     * Those whose access it ended, as a delete or a revoked Share does, get it too, and then their
     * stream ends; anyone else who can no longer read it just stops getting its events.
     */
    @TransactionalEventListener
    void publish(TodoListChange change) {
        TodoListEvent event = change.event();
        for (Subscriber subscriber : subscribers(change.todoListId())) {
            boolean canRead =
                    access.roleOf(subscriber.userId(), change.todoListId()).isPresent();
            if (canRead || endsAccessOf(event, subscriber)) {
                send(subscriber, SseEmitter.event().data(event, MediaType.APPLICATION_JSON));
            }
            if (!canRead) end(subscriber);
        }
    }

    /** Keeps every stream alive with a comment line, which clients ignore. */
    private void heartbeat() {
        allSubscribers()
                .forEach(subscriber -> send(subscriber, SseEmitter.event().comment("heartbeat")));
    }

    private static boolean endsAccessOf(TodoListEvent event, Subscriber subscriber) {
        return switch (event.getType()) {
            case TODO_LIST_DELETED -> true;
            case SHARE_REVOKED -> Objects.equals(event.getUserId(), subscriber.userId());
            default -> false;
        };
    }

    @Override
    public void start() {
        heartbeats = scheduler.scheduleAtFixedRate(this::heartbeat, properties.heartbeat());
        running = true;
    }

    /** Ends every stream. In the default phase, so before the web server's graceful shutdown. */
    @Override
    public void stop() {
        running = false;
        if (heartbeats != null) heartbeats.cancel(false);
        allSubscribers().forEach(this::end);
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    private List<Subscriber> allSubscribers() {
        return byTodoList.values().stream().flatMap(Set::stream).toList();
    }

    private List<Subscriber> subscribers(long todoListId) {
        return List.copyOf(byTodoList.getOrDefault(todoListId, Set.of()));
    }

    /** Sends, or ends the stream if the subscriber has gone. */
    private void send(Subscriber subscriber, SseEmitter.SseEventBuilder event) {
        try {
            subscriber.emitter().send(event);
        } catch (IOException | IllegalStateException e) {
            subscriber.emitter().completeWithError(e);
            forget(subscriber);
        }
    }

    private void end(Subscriber subscriber) {
        subscriber.emitter().complete();
        forget(subscriber);
    }

    private void forget(Subscriber subscriber) {
        byTodoList.computeIfPresent(subscriber.todoListId(), (id, subscribers) -> {
            subscribers.remove(subscriber);
            return subscribers.isEmpty() ? null : subscribers;
        });
    }

    private record Subscriber(long userId, long todoListId, SseEmitter emitter) {}
}
