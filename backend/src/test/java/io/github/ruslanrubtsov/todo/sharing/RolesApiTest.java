package io.github.ruslanrubtsov.todo.sharing;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TaskPage;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * The permission matrix, operation by operation: what an Editor, a Viewer and a User the Todo List
 * isn't Shared with may do with it. A User without access gets {@code 404}, as for a Todo List
 * that doesn't exist; one whose role forbids an action gets {@code 403}.
 */
class RolesApiTest extends ApiTest {

    private LoggedIn owner;
    private TodoList todoList;
    private Task milk;
    private Task bread;

    @BeforeEach
    void createATodoListWithTasks() {
        owner = newLoggedInUser("Olena");
        todoList = createTodoList(owner, "Groceries");
        milk = addTask(owner, "Buy milk");
        bread = addTask(owner, "Buy bread");
    }

    @Nested
    class AnEditor {

        private LoggedIn editor;

        @BeforeEach
        void shareAsEditor() {
            editor = newLoggedInUser();
            share(owner, todoList, editor, ShareRole.EDITOR);
        }

        @Test
        void readsTheTodoListAndItsTasks() {
            readsEverything(editor);
        }

        @Test
        void addsChangesCompletesMovesAndDeletesTasks() {
            Task eggs = addTask(editor, "Buy eggs");
            calling(editor, HttpMethod.PUT, taskUri(milk), details(milk, "Buy oat milk"))
                    .expectStatus()
                    .isOk();
            calling(editor, HttpMethod.PUT, taskUri(milk) + "/completion", null)
                    .expectStatus()
                    .isOk();
            calling(editor, HttpMethod.DELETE, taskUri(milk) + "/completion", null)
                    .expectStatus()
                    .isOk();
            calling(
                            editor,
                            HttpMethod.POST,
                            taskUri(eggs) + "/move",
                            Map.of("placement", "BEFORE", "relativeTo", milk.getId()))
                    .expectStatus()
                    .isOk();
            calling(editor, HttpMethod.DELETE, taskUri(bread), null)
                    .expectStatus()
                    .isNoContent();

            assertThat(titles(owner)).containsExactly("Buy eggs", "Buy oat milk");
        }

        @Test
        void cannotRenameDeleteOrShareTheTodoList() {
            isForbidden(calling(
                    editor, HttpMethod.PATCH, todoListUri(), Map.of("name", "Mine", "version", todoList.getVersion())));
            isForbidden(calling(editor, HttpMethod.DELETE, todoListUri(), null));
            isForbidden(sharing(editor, todoList.getId(), newLoggedInUser().email(), ShareRole.VIEWER));

            assertThat(readTodoList(owner).getName()).isEqualTo("Groceries");
        }
    }

    @Nested
    class AViewer {

        private LoggedIn viewer;

        @BeforeEach
        void shareAsViewer() {
            viewer = newLoggedInUser();
            share(owner, todoList, viewer, ShareRole.VIEWER);
        }

        @Test
        void readsTheTodoListAndItsTasks() {
            readsEverything(viewer);
        }

        @Test
        void cannotChangeAnyTask() {
            isForbidden(calling(viewer, HttpMethod.POST, tasksUri(), Map.of("title", "Buy eggs")));
            isForbidden(calling(viewer, HttpMethod.PUT, taskUri(milk), details(milk, "Buy oat milk")));
            isForbidden(calling(viewer, HttpMethod.PUT, taskUri(milk) + "/completion", null));
            isForbidden(calling(viewer, HttpMethod.DELETE, taskUri(milk) + "/completion", null));
            isForbidden(calling(
                    viewer,
                    HttpMethod.POST,
                    taskUri(bread) + "/move",
                    Map.of("placement", "BEFORE", "relativeTo", milk.getId())));
            isForbidden(calling(viewer, HttpMethod.DELETE, taskUri(milk), null));

            assertThat(titles(owner)).containsExactly("Buy milk", "Buy bread");
        }

        @Test
        void cannotRenameDeleteOrShareTheTodoList() {
            isForbidden(calling(
                    viewer, HttpMethod.PATCH, todoListUri(), Map.of("name", "Mine", "version", todoList.getVersion())));
            isForbidden(calling(viewer, HttpMethod.DELETE, todoListUri(), null));
            isForbidden(sharing(viewer, todoList.getId(), newLoggedInUser().email(), ShareRole.VIEWER));

            assertThat(readTodoList(owner).getName()).isEqualTo("Groceries");
        }
    }

    @Nested
    class AUserItIsNotSharedWith {

        private LoggedIn stranger;

        @BeforeEach
        void registerAStranger() {
            stranger = newLoggedInUser();
            // Shared with someone, just not with the stranger
            share(owner, todoList, newLoggedInUser(), ShareRole.EDITOR);
        }

        @Test
        void cannotReachTheTodoListOrItsTasksAtAll() {
            isNotFound(calling(stranger, HttpMethod.GET, todoListUri(), null));
            isNotFound(calling(stranger, HttpMethod.GET, tasksUri(), null));
            isNotFound(calling(stranger, HttpMethod.GET, taskUri(milk), null));
            isNotFound(calling(stranger, HttpMethod.POST, tasksUri(), Map.of("title", "Buy eggs")));
            isNotFound(calling(stranger, HttpMethod.PUT, taskUri(milk), details(milk, "Buy oat milk")));
            isNotFound(calling(stranger, HttpMethod.PUT, taskUri(milk) + "/completion", null));
            isNotFound(calling(stranger, HttpMethod.DELETE, taskUri(milk) + "/completion", null));
            isNotFound(calling(
                    stranger,
                    HttpMethod.POST,
                    taskUri(bread) + "/move",
                    Map.of("placement", "BEFORE", "relativeTo", milk.getId())));
            isNotFound(calling(stranger, HttpMethod.DELETE, taskUri(milk), null));
            isNotFound(calling(
                    stranger,
                    HttpMethod.PATCH,
                    todoListUri(),
                    Map.of("name", "Mine", "version", todoList.getVersion())));
            isNotFound(calling(stranger, HttpMethod.DELETE, todoListUri(), null));
        }
    }

    @Test
    void deletingTheTodoListTakesItAwayFromThoseItIsSharedWith() {
        LoggedIn editor = newLoggedInUser();
        share(owner, todoList, editor, ShareRole.EDITOR);

        calling(owner, HttpMethod.DELETE, todoListUri(), null).expectStatus().isNoContent();

        isNotFound(calling(editor, HttpMethod.GET, todoListUri(), null));
    }

    private void readsEverything(LoggedIn user) {
        TodoList read = readTodoList(user);
        assertThat(read.getName()).isEqualTo("Groceries");
        assertThat(read.getOpenTaskCount()).isEqualTo(2);
        assertThat(titles(user)).containsExactly("Buy milk", "Buy bread");
        calling(user, HttpMethod.GET, taskUri(milk), null)
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.title")
                .isEqualTo("Buy milk");
    }

    private Task addTask(LoggedIn user, String title) {
        return Objects.requireNonNull(calling(user, HttpMethod.POST, tasksUri(), Map.of("title", title))
                .expectStatus()
                .isCreated()
                .expectBody(Task.class)
                .returnResult()
                .getResponseBody());
    }

    private TodoList readTodoList(LoggedIn user) {
        return Objects.requireNonNull(calling(user, HttpMethod.GET, todoListUri(), null)
                .expectStatus()
                .isOk()
                .expectBody(TodoList.class)
                .returnResult()
                .getResponseBody());
    }

    private List<String> titles(LoggedIn user) {
        TaskPage page = Objects.requireNonNull(calling(user, HttpMethod.GET, tasksUri(), null)
                .expectStatus()
                .isOk()
                .expectBody(TaskPage.class)
                .returnResult()
                .getResponseBody());
        return page.getItems().stream().map(Task::getTitle).toList();
    }

    private static Map<String, Object> details(Task task, String title) {
        return Map.of("title", title, "priority", task.getPriority().getValue(), "version", task.getVersion());
    }

    private String todoListUri() {
        return "/api/v1/todo-lists/" + todoList.getId();
    }

    private String tasksUri() {
        return todoListUri() + "/tasks";
    }

    private String taskUri(Task task) {
        return tasksUri() + "/" + task.getId();
    }

    private RestTestClient.ResponseSpec calling(
            LoggedIn user, HttpMethod method, String uri, @Nullable Map<String, ?> body) {
        RestTestClient.RequestBodySpec request =
                api.method(method).uri(uri).headers(headers -> headers.setBearerAuth(user.accessToken()));
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).body(body);
        return request.exchange();
    }
}
