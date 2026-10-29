package io.github.ruslanrubtsov.todo.events;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.Placement;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListEvent;
import io.github.ruslanrubtsov.todo.api.model.TodoListEvent.TypeEnum;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.json.JsonMapper;

/** A Todo List's events stream, as clients follow it over HTTP. */
@Timeout(60)
class EventsApiTest extends ApiTest {

    /** Long enough for an event to arrive; an event that doesn't by then isn't coming. */
    private static final Duration WAIT = Duration.ofSeconds(5);

    @LocalServerPort
    private int port;

    @Autowired
    private JsonMapper json;

    private final List<EventStream> streams = new ArrayList<>();
    private LoggedIn owner;
    private LoggedIn editor;
    private TodoList todoList;

    @BeforeEach
    void shareATodoList() {
        owner = newLoggedInUser("Olena");
        editor = newLoggedInUser("Taras");
        todoList = createTodoList(owner, "Groceries");
        share(owner, todoList, editor, ShareRole.EDITOR);
    }

    @AfterEach
    void closeStreams() {
        streams.forEach(EventStream::close);
    }

    @Test
    void someoneWithTheTodoListOpenSeesATaskAddedByAnother() {
        EventStream stream = follow(editor);

        addTask(owner, "Buy milk");

        TodoListEvent event = stream.next();
        assertThat(event.getType()).isEqualTo(TypeEnum.TASK_CREATED);
        assertThat(event.getTodoListId()).isEqualTo(todoList.getId());
        assertThat(event.getTask()).isNotNull();
        assertThat(event.getTask().getTitle()).isEqualTo("Buy milk");
    }

    @Test
    void asksProxiesToPassEventsOnAsTheyCome() {
        assertThat(follow(editor).header("X-Accel-Buffering")).isEqualTo("no");
    }

    @Test
    void sendsEveryChangeToItsTasksOnceSaved() {
        Task milk = addTask(owner, "Buy milk");
        Task bread = addTask(owner, "Buy bread");
        EventStream stream = follow(owner);

        Task changed = call(
                        editor,
                        HttpMethod.PUT,
                        taskUri(milk),
                        Map.of("title", "Buy oat milk", "priority", "HIGH", "version", milk.getVersion()))
                .task();
        call(editor, HttpMethod.PUT, taskUri(milk) + "/completion", null);
        call(editor, HttpMethod.DELETE, taskUri(milk) + "/completion", null);
        call(
                editor,
                HttpMethod.POST,
                taskUri(bread) + "/move",
                Map.of("placement", Placement.BEFORE, "relativeTo", milk.getId()));
        call(editor, HttpMethod.DELETE, taskUri(bread), null);

        TodoListEvent updated = stream.next();
        assertThat(updated.getType()).isEqualTo(TypeEnum.TASK_UPDATED);
        assertThat(updated.getTask()).isEqualTo(changed);
        assertThat(stream.next().getType()).isEqualTo(TypeEnum.TASK_COMPLETED);
        assertThat(stream.next().getType()).isEqualTo(TypeEnum.TASK_UNCOMPLETED);
        TodoListEvent moved = stream.next();
        assertThat(moved.getType()).isEqualTo(TypeEnum.TASK_MOVED);
        assertThat(moved.getTask().getId()).isEqualTo(bread.getId());
        TodoListEvent deleted = stream.next();
        assertThat(deleted.getType()).isEqualTo(TypeEnum.TASK_DELETED);
        assertThat(deleted.getTaskId()).isEqualTo(bread.getId());
    }

    @Test
    void sendsARenameWithTheNewNameAndVersion() {
        EventStream stream = follow(editor);

        TodoList renamed = call(
                        owner,
                        HttpMethod.PATCH,
                        todoListUri(),
                        Map.of("name", "Shopping", "version", todoList.getVersion()))
                .todoList();

        TodoListEvent event = stream.next();
        assertThat(event.getType()).isEqualTo(TypeEnum.TODO_LIST_RENAMED);
        assertThat(event.getName()).isEqualTo("Shopping");
        assertThat(event.getVersion()).isEqualTo(renamed.getVersion());
    }

    @Test
    void sendsTheDeleteOfTheTodoListToEveryoneAndEndsTheirStreams() {
        EventStream editorStream = follow(editor);
        EventStream ownerStream = follow(owner);

        call(owner, HttpMethod.DELETE, todoListUri(), null);

        assertThat(editorStream.next().getType()).isEqualTo(TypeEnum.TODO_LIST_DELETED);
        assertThat(editorStream.ended()).isTrue();
        assertThat(ownerStream.next().getType()).isEqualTo(TypeEnum.TODO_LIST_DELETED);
        assertThat(ownerStream.ended()).isTrue();
    }

    @Nested
    class OnlyThoseWhoCanReadIt {

        @Test
        void receiveItsEvents() {
            open(newLoggedInUser(), todoList.getId()).hasStatus(404);
            open(null, todoList.getId()).hasStatus(401);
        }

        @Test
        void soARevokedUserIsToldAndTheirStreamEnds() {
            EventStream editorStream = follow(editor);
            EventStream ownerStream = follow(owner);

            call(owner, HttpMethod.DELETE, todoListUri() + "/shares/" + userId(editor), null);
            addTask(owner, "Buy milk");

            TodoListEvent revoked = editorStream.next();
            assertThat(revoked.getType()).isEqualTo(TypeEnum.SHARE_REVOKED);
            assertThat(revoked.getUserId()).isEqualTo(userId(editor));
            assertThat(editorStream.ended())
                    .as("the revoked User's stream ended")
                    .isTrue();
            assertThat(ownerStream.next().getType()).isEqualTo(TypeEnum.SHARE_REVOKED);
            assertThat(ownerStream.next().getType()).isEqualTo(TypeEnum.TASK_CREATED);
        }

        @Test
        void soAUserWhoLeavesIsToldAndTheirStreamEnds() {
            EventStream editorStream = follow(editor);

            call(editor, HttpMethod.DELETE, todoListUri() + "/shares/me", null);

            TodoListEvent left = editorStream.next();
            assertThat(left.getType()).isEqualTo(TypeEnum.SHARE_REVOKED);
            assertThat(left.getUserId()).isEqualTo(userId(editor));
            assertThat(editorStream.ended()).isTrue();
        }
    }

    @Test
    void aClientThatLostItsStreamConnectsAgainAndReceivesWhatFollows() {
        EventStream lost = follow(editor);
        lost.close();

        EventStream again = follow(editor);
        addTask(owner, "Buy milk");

        assertThat(again.next().getType()).isEqualTo(TypeEnum.TASK_CREATED);
    }

    @Nested
    @TestPropertySource(properties = "todo.events.heartbeat=200ms")
    class Heartbeats {

        @Test
        void keepAQuietStreamAlive() {
            EventStream stream = follow(editor);

            assertThat(stream.nextHeartbeat()).isTrue();
            assertThat(stream.nextHeartbeat()).isTrue();
        }
    }

    private Task addTask(LoggedIn user, String title) {
        return call(user, HttpMethod.POST, todoListUri() + "/tasks", Map.of("title", title))
                .task();
    }

    private String todoListUri() {
        return "/api/v1/todo-lists/" + todoList.getId();
    }

    private String taskUri(Task task) {
        return todoListUri() + "/tasks/" + task.getId();
    }

    private static long userId(LoggedIn user) {
        return user.session().getUser().getId();
    }

    /** Makes the request as the User, asserting it succeeded. */
    private Response call(LoggedIn user, HttpMethod method, String uri, @Nullable Map<String, ?> body) {
        var request = api.method(method).uri(uri).headers(headers -> headers.setBearerAuth(user.accessToken()));
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).body(body);
        byte[] response = request.exchange()
                .expectStatus()
                .is2xxSuccessful()
                .expectBody()
                .returnResult()
                .getResponseBody();
        return new Response(response == null ? "" : new String(response, StandardCharsets.UTF_8));
    }

    /** A response body, as a Task or a Todo List. */
    private final class Response {

        private final String body;

        Response(String body) {
            this.body = body;
        }

        Task task() {
            return json.readValue(body, Task.class);
        }

        TodoList todoList() {
            return json.readValue(body, TodoList.class);
        }
    }

    /** Opens the Todo List's events stream as the User, asserting it opened. */
    private EventStream follow(LoggedIn user) {
        EventStream stream = open(user, todoList.getId());
        stream.hasStatus(200);
        return stream;
    }

    /** Opens the Todo List's events stream as the User; without a token if none. */
    private EventStream open(@Nullable LoggedIn user, long todoListId) {
        HttpRequest.Builder request = HttpRequest.newBuilder(
                        URI.create("http://localhost:" + port + "/api/v1/todo-lists/" + todoListId + "/events"))
                .header("Accept", MediaType.TEXT_EVENT_STREAM_VALUE)
                // For the response to start, not to end
                .timeout(WAIT);
        if (user != null) request.header("Authorization", "Bearer " + user.accessToken());
        HttpClient http = HttpClient.newHttpClient();
        try {
            HttpResponse<Stream<String>> response = http.send(request.build(), HttpResponse.BodyHandlers.ofLines());
            EventStream stream = new EventStream(http, response);
            streams.add(stream);
            Thread.ofVirtual().start(() -> stream.read(response.body()));
            return stream;
        } catch (Exception e) {
            http.shutdownNow();
            throw new IllegalStateException(e);
        }
    }

    /** What a stream sends, line by line, as it arrives. */
    private final class EventStream {

        /** Marks the end of the stream among its lines. */
        private static final String ENDED = "\0ended";

        private final HttpClient http;
        private final HttpResponse<?> response;
        private final BlockingQueue<String> lines = new LinkedBlockingQueue<>();
        private boolean end;

        EventStream(HttpClient http, HttpResponse<?> response) {
            this.http = http;
            this.response = response;
        }

        void hasStatus(int expected) {
            assertThat(response.statusCode()).isEqualTo(expected);
        }

        @Nullable
        String header(String name) {
            return response.headers().firstValue(name).orElse(null);
        }

        void read(Stream<String> body) {
            try (body) {
                body.forEach(lines::add);
            } catch (Exception e) {
                // Closed under it, as the test ends
            }
            lines.add(ENDED);
        }

        /** Drops the connection, as a network blip would. */
        void close() {
            http.shutdownNow();
        }

        /** The next event's data, skipping heartbeats; fails if none comes in time. */
        TodoListEvent next() {
            String line = nextLine(candidate -> candidate.startsWith("data:"));
            assertThat(line).as("an event").isNotNull();
            return json.readValue(
                    Objects.requireNonNull(line).substring("data:".length()).strip(), TodoListEvent.class);
        }

        /** Whether a heartbeat comes in time. */
        boolean nextHeartbeat() {
            return nextLine(candidate -> candidate.startsWith(":heartbeat")) != null;
        }

        /** Whether the stream ends in time, with no event before. */
        boolean ended() {
            return nextLine(candidate -> candidate.startsWith("data:")) == null && end;
        }

        /** The next line that matches, or {@code null} once the stream ends or nothing comes in time. */
        @Nullable
        String nextLine(Predicate<String> matches) {
            if (end) return null;
            try {
                long deadline = System.nanoTime() + WAIT.toNanos();
                while (true) {
                    String line = lines.poll(deadline - System.nanoTime(), TimeUnit.NANOSECONDS);
                    if (line == null) return null;
                    if (line.equals(ENDED)) {
                        end = true;
                        return null;
                    }
                    if (matches.test(line)) return line;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }
        }
    }
}
