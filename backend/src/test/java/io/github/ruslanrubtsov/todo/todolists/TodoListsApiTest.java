package io.github.ruslanrubtsov.todo.todolists;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

class TodoListsApiTest extends ApiTest {

    private RestTestClient.ResponseSpec creating(LoggedIn user, String name) {
        return api.post()
                .uri("/api/v1/todo-lists")
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name))
                .exchange();
    }

    @Test
    void createsATodoListTrimmingItsName() {
        LoggedIn user = newLoggedInUser();

        TodoList created = creating(user, "  Groceries  ")
                .expectStatus()
                .isCreated()
                .expectHeader()
                .value("Location", location -> assertThat(location).matches(".*/api/v1/todo-lists/\\d+"))
                .expectBody(TodoList.class)
                .returnResult()
                .getResponseBody();

        assertThat(created).isNotNull();
        assertThat(created.getName()).isEqualTo("Groceries");
        assertThat(created.getOpenTaskCount()).isZero();
    }

    @Test
    void listsTheUsersOwnTodoListsByName() {
        LoggedIn user = newLoggedInUser();
        createTodoList(user, "Work");
        createTodoList(user, "groceries");
        createTodoList(user, "Chores");
        createTodoList(newLoggedInUser(), "Someone else's");

        assertThat(listing(user)).extracting(TodoList::getName).containsExactly("Chores", "groceries", "Work");
        assertThat(listing(user)).extracting(TodoList::getOpenTaskCount).containsOnly(0);
    }

    @Test
    void refusesABlankName() {
        LoggedIn user = newLoggedInUser();

        refusesName(creating(user, "   "), "PATTERN");
        assertThat(listing(user)).isEmpty();
    }

    @Test
    void refusesANameOfMoreThan100Characters() {
        LoggedIn user = newLoggedInUser();

        creating(user, "x".repeat(100)).expectStatus().isCreated();
        refusesName(creating(user, "x".repeat(101)), "SIZE");
    }

    @Test
    void readsATodoList() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");

        assertThat(reading(user, todoList.getId())
                        .expectStatus()
                        .isOk()
                        .expectBody(TodoList.class)
                        .returnResult()
                        .getResponseBody())
                .isEqualTo(todoList);
    }

    @Test
    void renamesATodoList() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");

        renaming(user, todoList.getId(), " Shopping ")
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.id")
                .isEqualTo(todoList.getId())
                .jsonPath("$.name")
                .isEqualTo("Shopping");

        assertThat(listing(user)).extracting(TodoList::getName).containsExactly("Shopping");
    }

    @Test
    void refusesToRenameToABlankName() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");

        refusesName(renaming(user, todoList.getId(), " "), "PATTERN");
        assertThat(listing(user)).extracting(TodoList::getName).containsExactly("Groceries");
    }

    @Test
    void deletesATodoList() {
        LoggedIn user = newLoggedInUser();
        TodoList todoList = createTodoList(user, "Groceries");
        createTodoList(user, "Work");

        deleting(user, todoList.getId()).expectStatus().isNoContent();

        reading(user, todoList.getId()).expectStatus().isNotFound();
        assertThat(listing(user)).extracting(TodoList::getName).containsExactly("Work");
    }

    @Nested
    class AnotherUsersTodoList {

        private LoggedIn owner;
        private TodoList todoList;
        private LoggedIn stranger;

        @BeforeEach
        void createAnotherUsersTodoList() {
            owner = newLoggedInUser();
            todoList = createTodoList(owner, "Private");
            stranger = newLoggedInUser();
        }

        @Test
        void cannotBeRead() {
            isNotFound(reading(stranger, todoList.getId()));
        }

        @Test
        void cannotBeRenamed() {
            isNotFound(renaming(stranger, todoList.getId(), "Mine now"));
            assertThat(listing(owner)).extracting(TodoList::getName).containsExactly("Private");
        }

        @Test
        void cannotBeDeleted() {
            isNotFound(deleting(stranger, todoList.getId()));
            assertThat(listing(owner)).extracting(TodoList::getName).containsExactly("Private");
        }

        @Test
        void looksExactlyLikeOneThatDoesNotExist() {
            byte[] forbidden = reading(stranger, todoList.getId())
                    .expectBody()
                    .returnResult()
                    .getResponseBody();
            byte[] missing = reading(stranger, Long.MAX_VALUE)
                    .expectBody()
                    .returnResult()
                    .getResponseBody();

            assertThat(withoutInstance(forbidden)).isEqualTo(withoutInstance(missing));
        }

        /** The {@code instance} is the request's URL, which differs by the ID asked for. */
        private static String withoutInstance(byte[] problem) {
            return new String(problem, StandardCharsets.UTF_8).replaceAll("\"instance\":\"[^\"]*\",?", "");
        }
    }

    @Test
    void needsAnAccessToken() {
        api.get()
                .uri("/api/v1/todo-lists")
                .exchange()
                .expectStatus()
                .isUnauthorized()
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("UNAUTHENTICATED");
    }

    private List<TodoList> listing(LoggedIn user) {
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

    private RestTestClient.ResponseSpec reading(LoggedIn user, long todoListId) {
        return api.get()
                .uri("/api/v1/todo-lists/{id}", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange();
    }

    private RestTestClient.ResponseSpec renaming(LoggedIn user, long todoListId, String name) {
        return api.patch()
                .uri("/api/v1/todo-lists/{id}", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name))
                .exchange();
    }

    private RestTestClient.ResponseSpec deleting(LoggedIn user, long todoListId) {
        return api.delete()
                .uri("/api/v1/todo-lists/{id}", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange();
    }

    private static void refusesName(RestTestClient.ResponseSpec response, String code) {
        response.expectStatus()
                .isBadRequest()
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors[0].field")
                .isEqualTo("name")
                .jsonPath("$.errors[0].code")
                .isEqualTo(code);
    }

    private static void isNotFound(RestTestClient.ResponseSpec response) {
        response.expectStatus().isNotFound().expectBody().jsonPath("$.code").isEqualTo("NOT_FOUND");
    }
}
