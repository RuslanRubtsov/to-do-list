package io.github.ruslanrubtsov.todo.sharing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.Share;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
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

    @Nested
    class ManagingShares {

        private LoggedIn anna;

        @BeforeEach
        void shareWithTwo() {
            anna = newLoggedInUser("Anna");
            share(owner, todoList, recipient, ShareRole.VIEWER);
            share(owner, todoList, anna, ShareRole.EDITOR);
        }

        @Test
        void theOwnerSeesWhomItIsSharedWithByName() {
            assertThat(shares(owner))
                    .extracting(Share::getDisplayName, Share::getEmail, Share::getRole)
                    .containsExactly(
                            tuple("Anna", anna.email(), ShareRole.EDITOR),
                            tuple("Taras", recipient.email(), ShareRole.VIEWER));
        }

        @Test
        void theOwnerChangesTheRoleAShareGives() {
            Share changed = Objects.requireNonNull(changing(owner, recipient, ShareRole.EDITOR)
                    .expectStatus()
                    .isOk()
                    .expectBody(Share.class)
                    .returnResult()
                    .getResponseBody());

            assertThat(changed.getUserId())
                    .isEqualTo(recipient.session().getUser().getId());
            assertThat(changed.getRole()).isEqualTo(ShareRole.EDITOR);
            assertThat(listing(recipient)).extracting(TodoList::getRole).containsExactly(TodoListRole.EDITOR);
        }

        @Test
        void theOwnerRevokesAShareWithImmediateEffect() {
            revoking(owner, recipient).expectStatus().isNoContent();

            assertThat(listing(recipient)).isEmpty();
            isNotFound(reading(recipient));
            assertThat(shares(owner)).extracting(Share::getDisplayName).containsExactly("Anna");
        }

        @Test
        void aRevokedUserCanBeSharedWithAgain() {
            revoking(owner, recipient).expectStatus().isNoContent();

            share(owner, todoList, recipient, ShareRole.EDITOR);

            assertThat(listing(recipient)).extracting(TodoList::getRole).containsExactly(TodoListRole.EDITOR);
        }

        @Test
        void aUserItIsSharedWithLeavesIt() {
            leaving(recipient).expectStatus().isNoContent();

            assertThat(listing(recipient)).isEmpty();
            isNotFound(reading(recipient));
            assertThat(shares(owner)).extracting(Share::getDisplayName).containsExactly("Anna");
        }

        @Test
        void onlyTheOwnerSeesAndChangesShares() {
            for (LoggedIn other : List.of(recipient, anna)) {
                isForbidden(sharesOf(other));
                isForbidden(changing(other, anna, ShareRole.VIEWER));
                isForbidden(revoking(other, recipient));
            }
            LoggedIn stranger = newLoggedInUser();
            isNotFound(sharesOf(stranger));
            isNotFound(changing(stranger, anna, ShareRole.VIEWER));
            isNotFound(revoking(stranger, anna));
            assertThat(shares(owner)).extracting(Share::getRole).containsExactly(ShareRole.EDITOR, ShareRole.VIEWER);
        }

        @Test
        void theOwnerCannotLeaveAndAStrangerHasNothingToLeave() {
            isForbidden(leaving(owner));
            isNotFound(leaving(newLoggedInUser()));
            assertThat(shares(owner)).hasSize(2);
        }

        @Test
        void aUserItIsNotSharedWithHasNoShareToChangeOrRevoke() {
            LoggedIn stranger = newLoggedInUser();

            isNotFound(changing(owner, stranger, ShareRole.EDITOR));
            isNotFound(revoking(owner, stranger));
            isNotFound(changing(owner, owner, ShareRole.EDITOR));
        }

        private List<Share> shares(LoggedIn user) {
            return sharesOf(user)
                    .expectStatus()
                    .isOk()
                    .expectBody(new ParameterizedTypeReference<List<Share>>() {})
                    .returnResult()
                    .getResponseBody();
        }

        private RestTestClient.ResponseSpec sharesOf(LoggedIn user) {
            return api.get()
                    .uri("/api/v1/todo-lists/{todoListId}/shares", todoList.getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .exchange();
        }

        private RestTestClient.ResponseSpec changing(LoggedIn user, LoggedIn sharedWith, ShareRole role) {
            return api.patch()
                    .uri(
                            "/api/v1/todo-lists/{todoListId}/shares/{userId}",
                            todoList.getId(),
                            sharedWith.session().getUser().getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("role", role.getValue()))
                    .exchange();
        }

        private RestTestClient.ResponseSpec revoking(LoggedIn user, LoggedIn sharedWith) {
            return api.delete()
                    .uri(
                            "/api/v1/todo-lists/{todoListId}/shares/{userId}",
                            todoList.getId(),
                            sharedWith.session().getUser().getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .exchange();
        }

        private RestTestClient.ResponseSpec leaving(LoggedIn user) {
            return api.delete()
                    .uri("/api/v1/todo-lists/{todoListId}/shares/me", todoList.getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .exchange();
        }

        private RestTestClient.ResponseSpec reading(LoggedIn user) {
            return api.get()
                    .uri("/api/v1/todo-lists/{todoListId}", todoList.getId())
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .exchange();
        }
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
