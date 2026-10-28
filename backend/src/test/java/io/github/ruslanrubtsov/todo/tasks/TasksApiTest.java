package io.github.ruslanrubtsov.todo.tasks;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.Priority;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TaskDetails;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

class TasksApiTest extends ApiTest {

    /** What the backend reckons today by. */
    @Autowired
    private Clock clock;

    @Test
    void addsATaskByTitleWithMediumPriorityAndNoDueDate() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");

        Task created = adding(user, todoList.getId(), "  Buy milk  ")
                .expectStatus()
                .isCreated()
                .expectHeader()
                .value(
                        "Location",
                        location -> assertThat(location)
                                .matches(".*/api/v1/todo-lists/" + todoList.getId() + "/tasks/\\d+"))
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody();

        assertThat(created).isNotNull();
        assertThat(created.getTitle()).isEqualTo("Buy milk");
        assertThat(created.getPriority()).isEqualTo(Priority.MEDIUM);
        assertThat(created.getDueDate()).isNull();
        assertThat(created.getDescription()).isNull();
        assertThat(created.getOverdue()).isFalse();
        assertThat(created.getCompletedAt()).isNull();
    }

    @Test
    void listsATodoListsTasksInTheOrderTheyWereAdded() {
        LoggedIn user = newLoggedInUser();
        TodoList groceries = createTodoList(user, "Groceries");
        TodoList work = createTodoList(user, "Work");
        add(user, groceries.getId(), "Buy milk");
        add(user, work.getId(), "Write report");
        add(user, groceries.getId(), "Buy bread");

        assertThat(listing(user, groceries.getId()))
                .extracting(Task::getTitle)
                .containsExactly("Buy milk", "Buy bread");
    }

    @Test
    void readsATask() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        Task task = add(user, todoList.getId(), "Buy milk");

        assertThat(reading(user, todoList.getId(), task.getId())
                        .expectStatus()
                        .isOk()
                        .expectBody(Task.class)
                        .returnResult()
                        .getResponseBody())
                .isEqualTo(task);
    }

    @Test
    void refusesABlankTitle() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");

        refusesTitle(adding(user, todoList.getId(), "   "), "PATTERN");
        assertThat(listing(user, todoList.getId())).isEmpty();
    }

    @Test
    void refusesATitleOfMoreThan200Characters() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");

        adding(user, todoList.getId(), "x".repeat(200)).expectStatus().isCreated();
        refusesTitle(adding(user, todoList.getId(), "x".repeat(201)), "SIZE");
    }

    @Test
    void completingATaskRecordsWhenItWasCompleted() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        Task task = add(user, todoList.getId(), "Buy milk");
        OffsetDateTime before = OffsetDateTime.now().truncatedTo(ChronoUnit.SECONDS);

        Task completed = completing(user, todoList.getId(), task.getId());

        assertThat(completed.getCompletedAt())
                .isBetween(before, OffsetDateTime.now().plusSeconds(1));
        assertThat(listing(user, todoList.getId())).containsExactly(completed);
    }

    @Test
    void completingACompletedTaskKeepsWhenItWasFirstCompleted() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        Task task = add(user, todoList.getId(), "Buy milk");
        Task completed = completing(user, todoList.getId(), task.getId());

        assertThat(completing(user, todoList.getId(), task.getId())).isEqualTo(completed);
    }

    @Test
    void uncompletingATaskClearsWhenItWasCompleted() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        Task task = add(user, todoList.getId(), "Buy milk");
        completing(user, todoList.getId(), task.getId());

        Task reopened = changingCompletion(HttpMethod.DELETE, user, todoList.getId(), task.getId())
                .expectStatus()
                .isOk()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody();

        // As it was before it was Completed, apart from the versions completing and reopening made
        assertThat(reopened)
                .usingRecursiveComparison()
                .ignoringFields("version")
                .isEqualTo(task);
        assertThat(listing(user, todoList.getId())).containsExactly(reopened);
    }

    @Test
    void countsOnlyOpenTasksInItsTodoList() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        add(user, todoList.getId(), "Buy milk");
        add(user, todoList.getId(), "Buy bread");
        Task done = add(user, todoList.getId(), "Buy eggs");
        completing(user, todoList.getId(), done.getId());

        assertThat(todoList(user, todoList.getId()).getOpenTaskCount()).isEqualTo(2);
        assertThat(todoLists(user)).extracting(TodoList::getOpenTaskCount).containsExactly(2);
    }

    @Test
    void deletesATask() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        Task milk = add(user, todoList.getId(), "Buy milk");
        add(user, todoList.getId(), "Buy bread");

        deleting(user, todoList.getId(), milk.getId()).expectStatus().isNoContent();

        isNotFound(reading(user, todoList.getId(), milk.getId()));
        assertThat(listing(user, todoList.getId())).extracting(Task::getTitle).containsExactly("Buy bread");
    }

    @Test
    void deletingATodoListDeletesItsTasks() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        Task task = add(user, todoList.getId(), "Buy milk");

        api.delete()
                .uri("/api/v1/todo-lists/{id}", todoList.getId())
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange()
                .expectStatus()
                .isNoContent();

        isNotFound(reading(user, todoList.getId(), task.getId()));
    }

    @Test
    void aTaskIsReachedOnlyThroughItsOwnTodoList() {
        LoggedIn user = newLoggedInUser();
        TodoList groceries = createTodoList(user, "Groceries");
        TodoList work = createTodoList(user, "Work");
        Task task = add(user, groceries.getId(), "Buy milk");

        isNotFound(reading(user, work.getId(), task.getId()));
        isNotFound(changingCompletion(HttpMethod.PUT, user, work.getId(), task.getId()));
        isNotFound(deleting(user, work.getId(), task.getId()));
        assertThat(listing(user, groceries.getId())).containsExactly(task);
    }

    @Nested
    class ChangingDetails {

        private LoggedIn user;
        private TodoList todoList;
        private Task task;

        @BeforeEach
        void addATask() {
            user = newLoggedInUser();
            todoList = createTodoList(user, "Groceries");
            task = add(user, todoList.getId(), "Buy milk");
        }

        @Test
        void changesTheTitleDescriptionDueDateAndPriority() {
            LocalDate nextWeek = today().plusWeeks(1);

            Task changed = update(details(" Buy oat milk ", Priority.HIGH)
                    .description("  Two cartons ")
                    .dueDate(nextWeek));

            assertThat(changed.getId()).isEqualTo(task.getId());
            assertThat(changed.getTitle()).isEqualTo("Buy oat milk");
            assertThat(changed.getDescription()).isEqualTo("Two cartons");
            assertThat(changed.getDueDate()).isEqualTo(nextWeek);
            assertThat(changed.getPriority()).isEqualTo(Priority.HIGH);
            assertThat(listing(user, todoList.getId())).containsExactly(changed);
        }

        @Test
        void clearsTheDetailsLeftOut() {
            update(details("Buy milk", Priority.HIGH).description("Two cartons").dueDate(today()));

            Task changed = update(details("Buy milk", Priority.LOW));

            assertThat(changed.getDescription()).isNull();
            assertThat(changed.getDueDate()).isNull();
            assertThat(changed.getPriority()).isEqualTo(Priority.LOW);
        }

        @Test
        void storesABlankDescriptionAsNone() {
            assertThat(update(details("Buy milk", Priority.MEDIUM).description("   "))
                            .getDescription())
                    .isNull();
        }

        @Test
        void keepsWhetherTheTaskIsCompleted() {
            Task completed = completing(user, todoList.getId(), task.getId());
            task = completed;

            Task changed = update(details("Buy oat milk", Priority.MEDIUM));

            assertThat(changed.getCompletedAt()).isEqualTo(completed.getCompletedAt());
        }

        @Test
        void refusesABlankTitle() {
            refusesField(updating(details(" ", Priority.MEDIUM)), "title", "PATTERN");
            assertThat(listing(user, todoList.getId())).containsExactly(task);
        }

        @Test
        void refusesADescriptionOfMoreThan2000Characters() {
            update(details("Buy milk", Priority.MEDIUM).description("x".repeat(2000)));

            refusesField(
                    updating(details("Buy milk", Priority.MEDIUM).description("x".repeat(2001))),
                    "description",
                    "SIZE");
        }

        @Test
        void needsAPriority() {
            api.put()
                    .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}", todoList.getId(), task.getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("title", "Buy milk", "version", task.getVersion()))
                    .exchange()
                    .expectStatus()
                    .isBadRequest()
                    .expectBody()
                    .jsonPath("$.errors[0].field")
                    .isEqualTo("priority");
        }

        @Test
        void isReachedOnlyThroughItsOwnTodoList() {
            TodoList work = createTodoList(user, "Work");

            isNotFound(TasksApiTest.this.updating(user, work.getId(), task.getId(), details("Moved", Priority.MEDIUM)));
            assertThat(listing(user, todoList.getId())).containsExactly(task);
        }

        /** Details based on the Task as last read. */
        private TaskDetails details(String title, Priority priority) {
            return new TaskDetails(title, priority, task.getVersion());
        }

        private RestTestClient.ResponseSpec updating(TaskDetails details) {
            return TasksApiTest.this.updating(user, todoList.getId(), task.getId(), details);
        }

        /** Changes the Task, which then is as last read. */
        private Task update(TaskDetails details) {
            task = Objects.requireNonNull(updating(details)
                    .expectStatus()
                    .isOk()
                    .expectBody(Task.class)
                    .returnResult()
                    .getResponseBody());
            return task;
        }
    }

    @Nested
    class EditConflicts {

        private LoggedIn user;
        private TodoList todoList;
        private Task task;

        @BeforeEach
        void addATask() {
            user = newLoggedInUser();
            todoList = createTodoList(user, "Groceries");
            task = add(user, todoList.getId(), "Buy milk");
        }

        @Test
        void eachChangeMakesANewVersion() {
            Task changed = read(updating(new TaskDetails("Buy oat milk", Priority.MEDIUM, task.getVersion())));
            Task completed = completing(user, todoList.getId(), task.getId());

            assertThat(changed.getVersion()).isNotEqualTo(task.getVersion());
            assertThat(completed.getVersion()).isNotIn(task.getVersion(), changed.getVersion());
            assertThat(read(reading(user, todoList.getId(), task.getId())).getVersion())
                    .isEqualTo(completed.getVersion());
        }

        @Test
        void aChangeBasedOnAnOlderVersionIsRefused() {
            Task theirs = read(updating(new TaskDetails("Buy oat milk", Priority.HIGH, task.getVersion())));

            updating(new TaskDetails("Buy soy milk", Priority.LOW, task.getVersion()))
                    .expectStatus()
                    .isEqualTo(HttpStatus.CONFLICT)
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("EDIT_CONFLICT");
            assertThat(listing(user, todoList.getId())).containsExactly(theirs);
        }

        @Test
        void aChangeBasedOnTheVersionBeforeCompletingIsRefused() {
            completing(user, todoList.getId(), task.getId());

            updating(new TaskDetails("Buy oat milk", Priority.MEDIUM, task.getVersion()))
                    .expectStatus()
                    .isEqualTo(HttpStatus.CONFLICT);
        }

        @Test
        void aChangeNeedsTheVersionItIsBasedOn() {
            api.put()
                    .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}", todoList.getId(), task.getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("title", "Buy milk", "priority", "HIGH"))
                    .exchange()
                    .expectStatus()
                    .isBadRequest()
                    .expectBody()
                    .jsonPath("$.errors[0].field")
                    .isEqualTo("version")
                    .jsonPath("$.errors[0].code")
                    .isEqualTo("NOT_NULL");
        }

        private RestTestClient.ResponseSpec updating(TaskDetails details) {
            return TasksApiTest.this.updating(user, todoList.getId(), task.getId(), details);
        }
    }

    @Nested
    class Overdue {

        private LoggedIn user;
        private TodoList todoList;

        @BeforeEach
        void createATodoList() {
            user = newLoggedInUser();
            todoList = createTodoList(user, "Groceries");
        }

        @Test
        void isATaskDueBeforeToday() {
            assertThat(dueOn(today().minusDays(1)).getOverdue()).isTrue();
        }

        @Test
        void isNotATaskDueToday() {
            assertThat(dueOn(today()).getOverdue()).isFalse();
        }

        @Test
        void isNotATaskDueLater() {
            assertThat(dueOn(today().plusDays(1)).getOverdue()).isFalse();
        }

        @Test
        void isNotATaskWithoutADueDate() {
            assertThat(add(user, todoList.getId(), "Someday").getOverdue()).isFalse();
        }

        @Test
        void isNeverACompletedTask() {
            Task late = dueOn(today().minusDays(1));

            assertThat(completing(user, todoList.getId(), late.getId()).getOverdue())
                    .isFalse();
            assertThat(read(changingCompletion(HttpMethod.DELETE, user, todoList.getId(), late.getId()))
                            .getOverdue())
                    .isTrue();
        }

        @Test
        void isShownWhereverTheTaskIs() {
            Task late = dueOn(today().minusDays(1));

            assertThat(listing(user, todoList.getId()))
                    .extracting(Task::getOverdue)
                    .containsExactly(true);
            assertThat(read(reading(user, todoList.getId(), late.getId())).getOverdue())
                    .isTrue();
        }

        private Task dueOn(LocalDate dueDate) {
            Task task = add(user, todoList.getId(), "Due " + dueDate);
            return read(updating(
                    user,
                    todoList.getId(),
                    task.getId(),
                    new TaskDetails(task.getTitle(), Priority.MEDIUM, task.getVersion()).dueDate(dueDate)));
        }
    }

    @Nested
    class InAnotherUsersTodoList {

        private LoggedIn owner;
        private TodoList todoList;
        private Task task;
        private LoggedIn stranger;

        @BeforeEach
        void createAnotherUsersTask() {
            owner = newLoggedInUser();
            todoList = createTodoList(owner, "Private");
            task = add(owner, todoList.getId(), "Secret");
            stranger = newLoggedInUser();
        }

        @Test
        void tasksCannotBeListed() {
            isNotFound(api.get()
                    .uri("/api/v1/todo-lists/{todoListId}/tasks", todoList.getId())
                    .headers(headers -> headers.setBearerAuth(stranger.accessToken()))
                    .exchange());
        }

        @Test
        void tasksCannotBeAdded() {
            isNotFound(adding(stranger, todoList.getId(), "Mine now"));
            assertThat(listing(owner, todoList.getId())).containsExactly(task);
        }

        @Test
        void aTaskCannotBeRead() {
            isNotFound(reading(stranger, todoList.getId(), task.getId()));
        }

        @Test
        void aTaskCannotBeCompletedOrUncompleted() {
            isNotFound(changingCompletion(HttpMethod.PUT, stranger, todoList.getId(), task.getId()));
            isNotFound(changingCompletion(HttpMethod.DELETE, stranger, todoList.getId(), task.getId()));
            assertThat(listing(owner, todoList.getId())).containsExactly(task);
        }

        @Test
        void aTaskCannotBeChanged() {
            isNotFound(updating(
                    stranger,
                    todoList.getId(),
                    task.getId(),
                    new TaskDetails("Mine now", Priority.HIGH, task.getVersion())));
            assertThat(listing(owner, todoList.getId())).containsExactly(task);
        }

        @Test
        void aTaskCannotBeDeleted() {
            isNotFound(deleting(stranger, todoList.getId(), task.getId()));
            assertThat(listing(owner, todoList.getId())).containsExactly(task);
        }
    }

    /** Today, as the backend reckons it. */
    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private RestTestClient.ResponseSpec updating(LoggedIn user, long todoListId, long taskId, TaskDetails details) {
        return api.put()
                .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}", todoListId, taskId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(details)
                .exchange();
    }

    /** The Task a successful response carries. */
    private static Task read(RestTestClient.ResponseSpec response) {
        return Objects.requireNonNull(response.expectStatus()
                .isOk()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody());
    }

    private RestTestClient.ResponseSpec adding(LoggedIn user, long todoListId, String title) {
        return api.post()
                .uri("/api/v1/todo-lists/{todoListId}/tasks", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("title", title))
                .exchange();
    }

    private Task add(LoggedIn user, long todoListId, String title) {
        return Objects.requireNonNull(adding(user, todoListId, title)
                .expectStatus()
                .isCreated()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody());
    }

    private List<Task> listing(LoggedIn user, long todoListId) {
        return api.get()
                .uri("/api/v1/todo-lists/{todoListId}/tasks", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(new ParameterizedTypeReference<List<Task>>() {})
                .returnResult()
                .getResponseBody();
    }

    private RestTestClient.ResponseSpec reading(LoggedIn user, long todoListId, long taskId) {
        return api.get()
                .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}", todoListId, taskId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange();
    }

    /** {@code PUT} completes the Task, {@code DELETE} un-completes it. */
    private RestTestClient.ResponseSpec changingCompletion(
            HttpMethod method, LoggedIn user, long todoListId, long taskId) {
        return api.method(method)
                .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}/completion", todoListId, taskId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange();
    }

    private Task completing(LoggedIn user, long todoListId, long taskId) {
        return Objects.requireNonNull(changingCompletion(HttpMethod.PUT, user, todoListId, taskId)
                .expectStatus()
                .isOk()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody());
    }

    private RestTestClient.ResponseSpec deleting(LoggedIn user, long todoListId, long taskId) {
        return api.delete()
                .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}", todoListId, taskId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange();
    }

    private TodoList todoList(LoggedIn user, long todoListId) {
        return api.get()
                .uri("/api/v1/todo-lists/{id}", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(TodoList.class)
                .returnResult()
                .getResponseBody();
    }

    private List<TodoList> todoLists(LoggedIn user) {
        return api.get()
                .uri("/api/v1/todo-lists")
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(new ParameterizedTypeReference<List<TodoList>>() {})
                .returnResult()
                .getResponseBody();
    }

    private static void refusesTitle(RestTestClient.ResponseSpec response, String code) {
        refusesField(response, "title", code);
    }

    private static void refusesField(RestTestClient.ResponseSpec response, String field, String code) {
        response.expectStatus()
                .isBadRequest()
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors[0].field")
                .isEqualTo(field)
                .jsonPath("$.errors[0].code")
                .isEqualTo(code);
    }

    private static void isNotFound(RestTestClient.ResponseSpec response) {
        response.expectStatus().isNotFound().expectBody().jsonPath("$.code").isEqualTo("NOT_FOUND");
    }
}
