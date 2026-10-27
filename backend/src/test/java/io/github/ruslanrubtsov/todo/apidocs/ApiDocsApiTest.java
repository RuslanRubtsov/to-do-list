package io.github.ruslanrubtsov.todo.apidocs;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import org.junit.jupiter.api.Test;

class ApiDocsApiTest extends ApiTest {

    @Test
    void servesTheHandWrittenOpenApiSpec() {
        api.get()
                .uri("/openapi.yaml")
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(String.class)
                .value(spec -> assertThat(spec).contains("operationId: getAppInfo"));
    }

    @Test
    void specLetsSwaggerUiAuthoriseWithABearerToken() {
        api.get()
                .uri("/openapi.yaml")
                .exchange()
                .expectBody(String.class)
                // A Windows checkout may have CRLF line endings
                .value(spec -> assertThat(spec.replace("\r\n", "\n")).contains("""
                                  securitySchemes:
                                    bearerAuth:
                                      type: http
                                      scheme: bearer
                                """));
    }

    @Test
    void swaggerUiRendersTheHandWrittenSpec() {
        api.get()
                .uri("/swagger-ui/index.html")
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(String.class)
                .value(page -> assertThat(page).contains("url: '/openapi.yaml'"));
        api.get()
                .uri("/webjars/swagger-ui/swagger-ui-bundle.js")
                .exchange()
                .expectStatus()
                .isOk();
    }
}
