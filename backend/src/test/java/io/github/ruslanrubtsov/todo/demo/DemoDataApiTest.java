package io.github.ruslanrubtsov.todo.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.github.ruslanrubtsov.todo.TestcontainersConfiguration;
import io.github.ruslanrubtsov.todo.api.model.AuthSession;
import io.github.ruslanrubtsov.todo.api.model.Dashboard;
import io.github.ruslanrubtsov.todo.api.model.Language;
import io.github.ruslanrubtsov.todo.api.model.TodoList;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import io.github.ruslanrubtsov.todo.api.model.User;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

/**
 * The demo data, as the two demo Users see it through the API. Runs the {@code demo} profile on a
 * database of its own: the one the other tests share never gets demo data.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("demo")
@Testcontainers
class DemoDataApiTest {

    /** The demo Users' credentials, as docs/demo-data.md has them. */
    static final String OLENA = "olena@example.com";

    static final String TARAS = "taras@example.com";
    static final String PASSWORD = "todo-demo-1";

    @Container
    @ServiceConnection
    private static final MySQLContainer MYSQL = new MySQLContainer(TestcontainersConfiguration.MYSQL_IMAGE);

    @LocalServerPort
    private int port;

    private RestTestClient api;

    @BeforeEach
    void setUpApiClient() {
        api = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    @Test
    void theDemoUsersLogInWithTheDocumentedCredentials() {
        assertThat(logIn(OLENA).getUser())
                .extracting(User::getDisplayName, User::getPreferredLanguage)
                .containsExactly("Olena", Language.EN);
        assertThat(logIn(TARAS).getUser())
                .extracting(User::getDisplayName, User::getPreferredLanguage)
                .containsExactly("Taras", Language.UK);
    }

    @Test
    void eachOwnsTodoListsAndSharesSomeWithTheOtherInBothRoles() {
        assertThat(todoLists(logIn(OLENA)))
                .extracting(TodoList::getName, TodoList::getRole, TodoList::getOwnerDisplayName)
                .containsExactly(
                        tuple("Garden", TodoListRole.VIEWER, "Taras"),
                        tuple("Groceries", TodoListRole.OWNER, "Olena"),
                        tuple("Home repairs", TodoListRole.EDITOR, "Taras"),
                        tuple("Trip to Lviv", TodoListRole.OWNER, "Olena"),
                        tuple("Work", TodoListRole.OWNER, "Olena"));
        assertThat(todoLists(logIn(TARAS)))
                .extracting(TodoList::getName, TodoList::getRole)
                .containsExactly(
                        tuple("Garden", TodoListRole.OWNER),
                        tuple("Groceries", TodoListRole.EDITOR),
                        tuple("Home repairs", TodoListRole.OWNER),
                        tuple("Trip to Lviv", TodoListRole.VIEWER));
    }

    @Test
    void hasTasksOverdueDueTodayUpcomingAndCompletedRelativeToToday() {
        for (String email : List.of(OLENA, TARAS)) {
            Dashboard dashboard = dashboard(logIn(email));

            assertThat(dashboard.getOverdue()).as(email + "'s Overdue Tasks").isNotEmpty();
            assertThat(dashboard.getDueToday()).as(email + "'s Tasks due today").isNotEmpty();
            assertThat(dashboard.getUpcoming()).as(email + "'s upcoming Tasks").isNotEmpty();
            assertThat(dashboard.getCounts().getCompletedThisWeek())
                    .as(email + "'s Tasks Completed this week")
                    .isPositive();
        }
    }

    private AuthSession logIn(String email) {
        return Objects.requireNonNull(api.post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", PASSWORD))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(AuthSession.class)
                .returnResult()
                .getResponseBody());
    }

    private List<TodoList> todoLists(AuthSession session) {
        return api.get()
                .uri("/api/v1/todo-lists")
                .headers(headers -> headers.setBearerAuth(session.getAccessToken()))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(new ParameterizedTypeReference<List<TodoList>>() {})
                .returnResult()
                .getResponseBody();
    }

    private Dashboard dashboard(AuthSession session) {
        return Objects.requireNonNull(api.get()
                .uri("/api/v1/dashboard")
                .headers(headers -> headers.setBearerAuth(session.getAccessToken()))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(Dashboard.class)
                .returnResult()
                .getResponseBody());
    }
}
