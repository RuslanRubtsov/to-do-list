package io.github.ruslanrubtsov.todo;

import io.github.ruslanrubtsov.todo.api.model.AuthSession;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.ExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Base class for tests at the REST-API seam: the full Spring context on a real port, a real MySQL in
 * Testcontainers with the real Flyway migrations, and requests made over HTTP.
 *
 * <p>The database is shared by every test and never cleaned, so tests create their own Users with
 * {@link #uniqueEmail()} rather than relying on fixed ones.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
public abstract class ApiTest {

    /** A password every User created by the helpers has; it meets the strength rules. */
    protected static final String PASSWORD = "correct-horse-7";

    protected static final String REFRESH_TOKEN_COOKIE = "todo_refresh";

    @LocalServerPort
    private int port;

    protected RestTestClient api;

    @BeforeEach
    void setUpApiClient() {
        api = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    /** An email no other test uses. */
    protected static String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    /** Registers a User with {@link #PASSWORD} and the display name "Test User". */
    protected void register(String email) {
        register(email, "Test User");
    }

    /** Registers a User with {@link #PASSWORD}. */
    protected void register(String email, String displayName) {
        api.post()
                .uri("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", PASSWORD, "displayName", displayName))
                .exchange()
                .expectStatus()
                .isCreated();
    }

    /** Logs in with {@link #PASSWORD}. */
    protected LoggedIn logIn(String email) {
        EntityExchangeResult<AuthSession> result = api.post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", PASSWORD))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(AuthSession.class)
                .returnResult();
        return new LoggedIn(Objects.requireNonNull(result.getResponseBody()), refreshTokenSetBy(result));
    }

    /** The refresh token a response set as its cookie. */
    protected static String refreshTokenSetBy(ExchangeResult result) {
        return Objects.requireNonNull(result.getResponseCookies().getFirst(REFRESH_TOKEN_COOKIE))
                .getValue();
    }

    /** A newly registered User, logged in. */
    protected LoggedIn newLoggedInUser() {
        return newLoggedInUser("Test User");
    }

    /** A newly registered User with this display name, logged in. */
    protected LoggedIn newLoggedInUser(String displayName) {
        String email = uniqueEmail();
        register(email, displayName);
        return logIn(email);
    }

    /** Creates a Todo List the User owns and returns it. */
    protected TodoList createTodoList(LoggedIn owner, String name) {
        return Objects.requireNonNull(api.post()
                .uri("/api/v1/todo-lists")
                .headers(headers -> headers.setBearerAuth(owner.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name))
                .exchange()
                .expectStatus()
                .isCreated()
                .expectBody(TodoList.class)
                .returnResult()
                .getResponseBody());
    }

    /** Shares the Todo List with the User who has this email, as the given User. */
    protected RestTestClient.ResponseSpec sharing(LoggedIn user, long todoListId, String email, ShareRole role) {
        return api.post()
                .uri("/api/v1/todo-lists/{todoListId}/shares", todoListId)
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "role", role.getValue()))
                .exchange();
    }

    /** Shares the Owner's Todo List with the recipient, in this role. */
    protected void share(LoggedIn owner, TodoList todoList, LoggedIn recipient, ShareRole role) {
        sharing(owner, todoList.getId(), recipient.email(), role).expectStatus().isCreated();
    }

    /**
     * Asserts the answer for a Todo List the User has no access to, or one that doesn't exist: the
     * two are indistinguishable.
     */
    protected static void isNotFound(RestTestClient.ResponseSpec response) {
        response.expectStatus().isNotFound().expectBody().jsonPath("$.code").isEqualTo("NOT_FOUND");
    }

    /** Asserts the answer for an action the User's role on the Todo List doesn't allow. */
    protected static void isForbidden(RestTestClient.ResponseSpec response) {
        response.expectStatus().isForbidden().expectBody().jsonPath("$.code").isEqualTo("FORBIDDEN");
    }

    /** What logging in gives a client: the response body, and the refresh token from its cookie. */
    protected record LoggedIn(AuthSession session, String refreshToken) {

        public String accessToken() {
            return session.getAccessToken();
        }

        public String email() {
            return session.getUser().getEmail();
        }
    }
}
