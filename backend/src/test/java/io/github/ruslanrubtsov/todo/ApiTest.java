package io.github.ruslanrubtsov.todo;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Base class for tests at the REST-API seam: the full Spring context on a real port, a real MySQL in
 * Testcontainers with the real Flyway migrations, and requests made over HTTP.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
public abstract class ApiTest {

    @LocalServerPort
    private int port;

    protected RestTestClient api;

    @BeforeEach
    void setUpApiClient() {
        api = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }
}
