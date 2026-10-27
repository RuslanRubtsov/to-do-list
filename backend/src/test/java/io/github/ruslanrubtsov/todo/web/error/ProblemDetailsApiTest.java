package io.github.ruslanrubtsov.todo.web.error;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;

@Import({ProblemTriggerController.class, ProblemTriggerController.ValidatedCollaborator.class})
class ProblemDetailsApiTest extends ApiTest {

    @Test
    void invalidRequestBodyIsValidationProblemListingEachField() {
        api.post()
                .uri("/test/problems/validation")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"name": " ", "email": "not-an-email"}
                        """)
                .exchange()
                .expectStatus()
                .isBadRequest()
                .expectHeader()
                .contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors.length()")
                .isEqualTo(2)
                .jsonPath("$.errors[?(@.field == 'name')].code")
                .isEqualTo("NOT_BLANK")
                .jsonPath("$.errors[?(@.field == 'email')].code")
                .isEqualTo("EMAIL");
    }

    @Test
    void invalidQueryParameterIsValidationProblemNamingTheParameter() {
        api.get()
                .uri("/test/problems/validation?size=0")
                .exchange()
                .expectStatus()
                .isBadRequest()
                .expectHeader()
                .contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors[0].field")
                .isEqualTo("size")
                .jsonPath("$.errors[0].code")
                .isEqualTo("MIN");
    }

    @Test
    void constraintBrokenByServerCodeIsInternalErrorNotClientValidationProblem() {
        api.get()
                .uri("/test/problems/internal-validation")
                .exchange()
                .expectStatus()
                .isEqualTo(500)
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("INTERNAL_ERROR")
                .jsonPath("$.errors")
                .doesNotExist();
    }

    @Test
    void unexpectedExceptionIsInternalErrorProblemWithoutInternalDetails() {
        api.get()
                .uri("/test/problems/failure")
                .exchange()
                .expectStatus()
                .isEqualTo(500)
                .expectHeader()
                .contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("INTERNAL_ERROR")
                .jsonPath("$.detail")
                .value(String.class, detail -> assertThat(detail).doesNotContain("internal detail"));
    }

    @Test
    void unknownRouteIsNotFoundProblem() {
        // Logged in: the API answers anonymous callers 401 before it looks for a route
        String accessToken = newLoggedInUser().accessToken();

        api.get()
                .uri("/api/v1/does-not-exist")
                .headers(headers -> headers.setBearerAuth(accessToken))
                .exchange()
                .expectStatus()
                .isNotFound()
                .expectHeader()
                .contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .expectBody()
                .jsonPath("$.status")
                .isEqualTo(404)
                .jsonPath("$.title")
                .isEqualTo("Not Found")
                .jsonPath("$.code")
                .isEqualTo("NOT_FOUND");
    }
}
