package io.github.ruslanrubtsov.todo.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.Dashboard;
import io.github.ruslanrubtsov.todo.api.model.DashboardCounts;
import io.github.ruslanrubtsov.todo.api.model.DashboardTask;
import io.github.ruslanrubtsov.todo.api.model.Priority;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class DashboardApiTest extends ApiTest {

    /** What the backend reckons today by. */
    @Autowired
    private Clock clock;

    private LoggedIn olena;
    private TodoList groceries;
    private TodoList garden;

    /**
     * Olena's own Groceries, and Taras's Garden, which he Shared with her as a Viewer. A stranger's
     * Todo List, with a Task due today, isn't hers to see.
     */
    @BeforeEach
    void createTodoLists() {
        olena = newLoggedInUser("Olena");
        LoggedIn taras = newLoggedInUser("Taras");
        groceries = createTodoList(olena, "Groceries");
        garden = createTodoList(taras, "Garden");
        share(taras, garden, olena, ShareRole.VIEWER);
        LoggedIn stranger = newLoggedInUser();
        add(stranger, createTodoList(stranger, "Secret"), "Hidden", Priority.HIGH, today());

        add(olena, groceries, "Buy milk", Priority.MEDIUM, today());
        add(olena, groceries, "Pay bills", Priority.HIGH, today().minusDays(1));
        add(olena, groceries, "Buy bread", Priority.MEDIUM, null);
        Task old = add(olena, groceries, "Return bottles", Priority.LOW, today().minusDays(1));
        complete(olena, groceries, old);
        add(olena, groceries, "Plan party", Priority.LOW, today().plusDays(3));
        add(olena, groceries, "Renew passport", Priority.HIGH, today().plusDays(8));
        add(olena, groceries, "Book flights", Priority.HIGH, today().plusDays(3));
        add(taras, garden, "Water plants", Priority.HIGH, today());
        add(taras, garden, "Prune roses", Priority.MEDIUM, today().minusDays(5));
    }

    @Test
    void listsOpenTasksOverdueDueTodayAndDueThisWeekAcrossOwnedAndSharedTodoLists() {
        Dashboard dashboard = dashboard(olena);

        assertThat(titles(dashboard.getOverdue())).containsExactly("Prune roses", "Pay bills");
        assertThat(titles(dashboard.getDueToday())).containsExactly("Water plants", "Buy milk");
        assertThat(titles(dashboard.getUpcoming())).containsExactly("Book flights", "Plan party");
    }

    @Test
    void showsTheTodoListOfEachTaskAndTheUsersRoleOnIt() {
        Dashboard dashboard = dashboard(olena);

        assertThat(dashboard.getDueToday())
                .extracting(
                        task -> task.getTodoList().getId(),
                        task -> task.getTodoList().getName(),
                        task -> task.getTodoList().getRole())
                .containsExactly(
                        tuple(garden.getId(), "Garden", TodoListRole.VIEWER),
                        tuple(groceries.getId(), "Groceries", TodoListRole.OWNER));
        assertThat(dashboard.getOverdue().getFirst().getTask().getOverdue()).isTrue();
    }

    @Test
    void countsOpenOverdueDueTodayAndCompletedThisWeek() {
        DashboardCounts counts = dashboard(olena).getCounts();

        assertThat(counts.getOpen()).isEqualTo(8);
        assertThat(counts.getOverdue()).isEqualTo(2);
        assertThat(counts.getDueToday()).isEqualTo(2);
        assertThat(counts.getCompletedThisWeek()).isEqualTo(1);
    }

    @Test
    void completingATaskTakesItOffAndCountsIt() {
        DashboardTask milk = dashboard(olena).getDueToday().get(1);

        complete(olena, groceries, milk.getTask());

        Dashboard dashboard = dashboard(olena);
        assertThat(titles(dashboard.getDueToday())).containsExactly("Water plants");
        assertThat(dashboard.getCounts().getOpen()).isEqualTo(7);
        assertThat(dashboard.getCounts().getCompletedThisWeek()).isEqualTo(2);
    }

    @Test
    void showsAnEditorTheirRoleAndDropsTasksOnceTheShareIsRevoked() {
        LoggedIn anna = newLoggedInUser("Anna");
        TodoList work = createTodoList(anna, "Work");
        share(anna, work, olena, ShareRole.EDITOR);
        add(anna, work, "Send report", Priority.MEDIUM, today());

        assertThat(dashboard(olena).getDueToday())
                .extracting(
                        task -> task.getTask().getTitle(),
                        task -> task.getTodoList().getRole())
                .contains(tuple("Send report", TodoListRole.EDITOR));

        api.delete()
                .uri(
                        "/api/v1/todo-lists/{todoListId}/shares/{userId}",
                        work.getId(),
                        olena.session().getUser().getId())
                .headers(headers -> headers.setBearerAuth(anna.accessToken()))
                .exchange()
                .expectStatus()
                .isNoContent();

        Dashboard dashboard = dashboard(olena);
        assertThat(titles(dashboard.getDueToday())).containsExactly("Water plants", "Buy milk");
        assertThat(dashboard.getCounts().getOpen()).isEqualTo(8);
    }

    @Test
    void isEmptyForAUserWithNoTodoLists() {
        Dashboard dashboard = dashboard(newLoggedInUser());

        assertThat(dashboard.getOverdue()).isEmpty();
        assertThat(dashboard.getDueToday()).isEmpty();
        assertThat(dashboard.getUpcoming()).isEmpty();
        assertThat(dashboard.getCounts()).isEqualTo(new DashboardCounts(0, 0, 0, 0));
    }

    @Test
    void needsAnAccessToken() {
        api.get().uri("/api/v1/dashboard").exchange().expectStatus().isUnauthorized();
    }

    private Dashboard dashboard(LoggedIn user) {
        return Objects.requireNonNull(api.get()
                .uri("/api/v1/dashboard")
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(Dashboard.class)
                .returnResult()
                .getResponseBody());
    }

    /** Adds a Task and gives it this Priority and Due Date. */
    private Task add(LoggedIn user, TodoList todoList, String title, Priority priority, @Nullable LocalDate dueDate) {
        Task task = Objects.requireNonNull(api.post()
                .uri("/api/v1/todo-lists/{todoListId}/tasks", todoList.getId())
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("title", title))
                .exchange()
                .expectStatus()
                .isCreated()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody());
        Map<String, Object> details = new HashMap<>();
        details.put("title", title);
        details.put("priority", priority.getValue());
        details.put("dueDate", dueDate == null ? null : dueDate.toString());
        details.put("version", task.getVersion());
        return Objects.requireNonNull(api.put()
                .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}", todoList.getId(), task.getId())
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(details)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody());
    }

    private void complete(LoggedIn user, TodoList todoList, Task task) {
        api.put()
                .uri("/api/v1/todo-lists/{todoListId}/tasks/{taskId}/completion", todoList.getId(), task.getId())
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange()
                .expectStatus()
                .isOk();
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static List<String> titles(List<DashboardTask> tasks) {
        return tasks.stream().map(task -> task.getTask().getTitle()).toList();
    }
}
