package io.github.ruslanrubtsov.todo.ops;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Behind the HTTPS proxy of the public demo, links the backend builds keep the browser's scheme. */
class ForwardedHeadersApiTest extends ApiTest {

    @Test
    void linksUseTheSchemeTheProxyForwards() {
        LoggedIn user = newLoggedInUser();

        api.post()
                .uri("/api/v1/todo-lists")
                .headers(headers -> {
                    headers.setBearerAuth(user.accessToken());
                    headers.set("X-Forwarded-Proto", "https");
                })
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", "Groceries"))
                .exchange()
                .expectStatus()
                .isCreated()
                .expectHeader()
                .value(
                        "Location",
                        location -> assertThat(location).matches("https://localhost/api/v1/todo-lists/\\d+"));
    }
}
