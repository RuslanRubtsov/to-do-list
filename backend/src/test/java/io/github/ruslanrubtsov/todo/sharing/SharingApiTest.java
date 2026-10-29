package io.github.ruslanrubtsov.todo.sharing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.Share;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import java.util.List;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.test.web.servlet.client.RestTestClient;

class SharingApiTest extends ApiTest {

    private LoggedIn owner;
    private LoggedIn recipient;
    private TodoList todoList;

    @BeforeEach
    void createATodoListToShare() {
        owner = newLoggedInUser("Olena");
        recipient = newLoggedInUser("Taras");
        todoList = createTodoList(owner, "Groceries");
    }

    @Test
    void sharesATodoListWithARegisteredUserByEmail() {
        Share share = Objects.requireNonNull(
                sharing(owner, todoList.getId(), "  " + recipient.email().toUpperCase() + " ", ShareRole.EDITOR)
                        .expectStatus()
                        .isCreated()
                        .expectBody(Share.class)
                        .returnResult()
                        .getResponseBody());

        assertThat(share.getUserId()).isEqualTo(recipient.session().getUser().getId());
        assertThat(share.getEmail()).isEqualTo(recipient.email());
        assertThat(share.getDisplayName()).isEqualTo("Taras");
        assertThat(share.getRole()).isEqualTo(ShareRole.EDITOR);
    }

    @Test
    void aSharedTodoListIsAmongTheRecipientsAtOnceWithTheirRoleAndItsOwner() {
        createTodoList(recipient, "Work");
        share(owner, todoList, recipient, ShareRole.VIEWER);

        assertThat(listing(recipient))
                .extracting(TodoList::getName, TodoList::getRole, TodoList::getOwnerDisplayName)
                .containsExactly(
                        tuple("Groceries", TodoListRole.VIEWER, "Olena"), tuple("Work", TodoListRole.OWNER, "Taras"));
        assertThat(listing(owner))
                .extracting(TodoList::getName, TodoList::getRole, TodoList::getOwnerDisplayName)
                .containsExactly(tuple("Groceries", TodoListRole.OWNER, "Olena"));
    }

    @Test
    void refusesAnEmailNoUserHas() {
        refusesEmail(sharing(owner, todoList.getId(), uniqueEmail(), ShareRole.VIEWER), "NOT_REGISTERED");
    }

    @Test
    void refusesToShareWithTheOwner() {
        refusesEmail(sharing(owner, todoList.getId(), owner.email(), ShareRole.EDITOR), "OWNER");
    }

    @Test
    void refusesToShareTwiceWithTheSameUser() {
        share(owner, todoList, recipient, ShareRole.VIEWER);

        refusesEmail(sharing(owner, todoList.getId(), recipient.email(), ShareRole.EDITOR), "ALREADY_SHARED");
        assertThat(listing(recipient)).extracting(TodoList::getRole).containsExactly(TodoListRole.VIEWER);
    }

    @Test
    void onlyTheOwnerShares() {
        LoggedIn editor = newLoggedInUser();
        LoggedIn viewer = newLoggedInUser();
        share(owner, todoList, editor, ShareRole.EDITOR);
        share(owner, todoList, viewer, ShareRole.VIEWER);

        isForbidden(sharing(editor, todoList.getId(), recipient.email(), ShareRole.VIEWER));
        isForbidden(sharing(viewer, todoList.getId(), recipient.email(), ShareRole.VIEWER));
        isNotFound(sharing(recipient, todoList.getId(), recipient.email(), ShareRole.EDITOR));
        assertThat(listing(recipient)).isEmpty();
    }

    private static void refusesEmail(RestTestClient.ResponseSpec response, String code) {
        response.expectStatus()
                .isBadRequest()
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors[0].field")
                .isEqualTo("email")
                .jsonPath("$.errors[0].code")
                .isEqualTo(code);
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
}
