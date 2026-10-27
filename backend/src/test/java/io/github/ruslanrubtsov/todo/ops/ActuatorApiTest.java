package io.github.ruslanrubtsov.todo.ops;

import io.github.ruslanrubtsov.todo.ApiTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ActuatorApiTest extends ApiTest {

    @Test
    void healthReportsUp() {
        api.get()
                .uri("/actuator/health")
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.status")
                .isEqualTo("UP");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/actuator/info", "/actuator/env", "/actuator/beans", "/actuator/metrics"})
    void exposesNothingButHealth(String endpoint) {
        api.get().uri(endpoint).exchange().expectStatus().isNotFound();
    }
}
