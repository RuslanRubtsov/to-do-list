package io.github.ruslanrubtsov.todo.appinfo;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AppInfoApiTest extends ApiTest {

    @Test
    void returnsApplicationNameAndVersion() {
        api.get()
                .uri("/api/v1/app-info")
                .exchange()
                .expectStatus()
                .isOk()
                .expectHeader()
                .contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .expectBody()
                .jsonPath("$.name")
                .isEqualTo("todo-backend")
                .jsonPath("$.version")
                .value(String.class, version -> assertThat(version).matches("\\d+\\.\\d+\\.\\d+(-SNAPSHOT)?"));
    }
}
