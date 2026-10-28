package io.github.ruslanrubtsov.todo.users;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

class CurrentUserApiTest extends ApiTest {

    private RestTestClient.ResponseSpec reading(LoggedIn user) {
        return api.get()
                .uri("/api/v1/users/me")
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .exchange();
    }

    private RestTestClient.ResponseSpec updating(LoggedIn user, Map<String, String> update) {
        return api.patch()
                .uri("/api/v1/users/me")
                .headers(headers -> headers.setBearerAuth(user.accessToken()))
                .contentType(MediaType.APPLICATION_JSON)
                .body(update)
                .exchange();
    }

    @Test
    void readsTheProfile() {
        LoggedIn user = newLoggedInUser();

        reading(user)
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.email")
                .isEqualTo(user.session().getUser().getEmail())
                .jsonPath("$.displayName")
                .isEqualTo("Test User")
                .jsonPath("$.preferredLanguage")
                .isEqualTo("en");
    }

    @Test
    void changesThePreferredLanguageForGood() {
        LoggedIn user = newLoggedInUser();

        updating(user, Map.of("preferredLanguage", "uk"))
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.preferredLanguage")
                .isEqualTo("uk");

        reading(user).expectBody().jsonPath("$.preferredLanguage").isEqualTo("uk");
    }

    @Test
    void comesWithThePreferredLanguageWhenLoggingInElsewhere() {
        String email = uniqueEmail();
        register(email);
        updating(logIn(email), Map.of("preferredLanguage", "uk"));

        LoggedIn otherDevice = logIn(email);

        assertThat(otherDevice.session().getUser().getPreferredLanguage().getValue())
                .isEqualTo("uk");
    }

    @Test
    void renamesTheUserTrimmingTheName() {
        LoggedIn user = newLoggedInUser();

        updating(user, Map.of("displayName", "  Olena K.  "))
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.displayName")
                .isEqualTo("Olena K.");
    }

    @Test
    void leavesWhatTheUpdateLeavesOut() {
        LoggedIn user = newLoggedInUser();
        updating(user, Map.of("preferredLanguage", "uk"));

        updating(user, Map.of("displayName", "Olena"))
                .expectBody()
                .jsonPath("$.displayName")
                .isEqualTo("Olena")
                .jsonPath("$.preferredLanguage")
                .isEqualTo("uk");
    }

    @Test
    void refusesABlankName() {
        LoggedIn user = newLoggedInUser();

        updating(user, Map.of("displayName", "   "))
                .expectStatus()
                .isBadRequest()
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("VALIDATION_FAILED")
                .jsonPath("$.errors[0].field")
                .isEqualTo("displayName")
                .jsonPath("$.errors[0].code")
                .isEqualTo("PATTERN");

        reading(user).expectBody().jsonPath("$.displayName").isEqualTo("Test User");
    }

    @Test
    void refusesALanguageTheAppIsNotAvailableIn() {
        LoggedIn user = newLoggedInUser();

        updating(user, Map.of("preferredLanguage", "fr")).expectStatus().isBadRequest();
    }

    @Test
    void needsAnAccessToken() {
        api.patch()
                .uri("/api/v1/users/me")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("preferredLanguage", "uk"))
                .exchange()
                .expectStatus()
                .isUnauthorized()
                .expectBody()
                .jsonPath("$.code")
                .isEqualTo("UNAUTHENTICATED");
    }
}
