package io.github.ruslanrubtsov.todo.demo;

import io.github.ruslanrubtsov.todo.ApiTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Without the {@code demo} profile, as every other test runs, there is no demo data. */
class NoDemoDataApiTest extends ApiTest {

    @Test
    void theDemoUsersDoNotExist() {
        api.post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", DemoDataApiTest.OLENA, "password", DemoDataApiTest.PASSWORD))
                .exchange()
                .expectStatus()
                .isUnauthorized();
    }
}
