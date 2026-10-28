package io.github.ruslanrubtsov.todo.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.ruslanrubtsov.todo.ApiTest;
import io.github.ruslanrubtsov.todo.api.model.AuthSession;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

class AuthApiTest extends ApiTest {

    private RestTestClient.ResponseSpec registering(Map<String, String> request) {
        return api.post()
                .uri("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .exchange();
    }

    private RestTestClient.ResponseSpec loggingIn(String email, String password) {
        return api.post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", password))
                .exchange();
    }

    private RestTestClient.ResponseSpec refreshing(String refreshToken) {
        return api.post()
                .uri("/api/v1/auth/session/refresh")
                .cookie(REFRESH_TOKEN_COOKIE, refreshToken)
                .exchange();
    }

    private RestTestClient.ResponseSpec loggingOut(String refreshToken) {
        return api.post()
                .uri("/api/v1/auth/session/logout")
                .cookie(REFRESH_TOKEN_COOKIE, refreshToken)
                .exchange();
    }

    @Nested
    class Registering {

        @Test
        void returnsTheNewUserWithoutThePassword() {
            String email = uniqueEmail();

            registering(Map.of("email", email, "password", PASSWORD, "displayName", "Olena"))
                    .expectStatus()
                    .isCreated()
                    .expectBody()
                    .jsonPath("$.id")
                    .isNumber()
                    .jsonPath("$.email")
                    .isEqualTo(email)
                    .jsonPath("$.displayName")
                    .isEqualTo("Olena")
                    .jsonPath("$.password")
                    .doesNotExist();
        }

        @Test
        void defaultsThePreferredLanguageToEnglish() {
            registering(Map.of("email", uniqueEmail(), "password", PASSWORD, "displayName", "Olena"))
                    .expectBody()
                    .jsonPath("$.preferredLanguage")
                    .isEqualTo("en");
        }

        @Test
        void remembersThePreferredLanguage() {
            registering(Map.of(
                            "email",
                            uniqueEmail(),
                            "password",
                            PASSWORD,
                            "displayName",
                            "Олена",
                            "preferredLanguage",
                            "uk"))
                    .expectBody()
                    .jsonPath("$.preferredLanguage")
                    .isEqualTo("uk");
        }

        @Test
        void storesTheEmailLowerCasedAndTrimmed() {
            String email = uniqueEmail();

            registering(Map.of("email", email.toUpperCase(), "password", PASSWORD, "displayName", "Olena"))
                    .expectBody()
                    .jsonPath("$.email")
                    .isEqualTo(email);
        }

        @Test
        void rejectsAnEmailThatIsAlreadyRegisteredIgnoringCase() {
            String email = uniqueEmail();
            register(email);

            registering(Map.of("email", email.toUpperCase(), "password", PASSWORD, "displayName", "Someone"))
                    .expectStatus()
                    .isEqualTo(409)
                    .expectHeader()
                    .contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("EMAIL_TAKEN");
        }

        @Test
        void tellsEmailsApartThatDifferOnlyInAccents() {
            String id = UUID.randomUUID().toString();
            register("jose-" + id + "@example.com");

            registering(Map.of("email", "josé-" + id + "@example.com", "password", PASSWORD, "displayName", "José"))
                    .expectStatus()
                    .isCreated();
        }

        @Test
        void listsEveryInvalidField() {
            registering(Map.of("email", "not-an-email", "password", "short1", "displayName", "   "))
                    .expectStatus()
                    .isBadRequest()
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("VALIDATION_FAILED")
                    .jsonPath("$.errors[?(@.field == 'email')].code")
                    .isEqualTo("EMAIL")
                    .jsonPath("$.errors[?(@.field == 'password')].code")
                    .isEqualTo("SIZE")
                    .jsonPath("$.errors[?(@.field == 'displayName')].code")
                    .isEqualTo("PATTERN");
        }

        @ParameterizedTest
        @CsvSource({"only-letters-here", "1234567890"})
        void requiresALetterAndADigitInThePassword(String password) {
            registering(Map.of("email", uniqueEmail(), "password", password, "displayName", "Olena"))
                    .expectStatus()
                    .isBadRequest()
                    .expectBody()
                    .jsonPath("$.errors[?(@.field == 'password')].code")
                    .isEqualTo("PATTERN");
        }

        @Test
        void acceptsLettersAndDigitsOfAnyScript() {
            registering(Map.of("email", uniqueEmail(), "password", "пароль-сім-7", "displayName", "Olena"))
                    .expectStatus()
                    .isCreated();
        }

        @Test
        void rejectsAPasswordLongerThanBcryptHashesEvenWithinTheCharacterLimit() {
            // 41 characters, but 81 bytes in UTF-8: Cyrillic letters take two each
            String password = "ж".repeat(40) + "7";

            registering(Map.of("email", uniqueEmail(), "password", password, "displayName", "Olena"))
                    .expectStatus()
                    .isBadRequest()
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("VALIDATION_FAILED")
                    .jsonPath("$.errors[?(@.field == 'password')].code")
                    .isEqualTo("SIZE");
        }
    }

    @Nested
    class LoggingIn {

        @Test
        void returnsAnAccessTokenForTheUser() {
            String email = uniqueEmail();
            register(email);

            loggingIn(email, PASSWORD)
                    .expectStatus()
                    .isOk()
                    .expectBody()
                    .jsonPath("$.accessToken")
                    .isNotEmpty()
                    .jsonPath("$.tokenType")
                    .isEqualTo("Bearer")
                    .jsonPath("$.expiresIn")
                    .isEqualTo(900)
                    .jsonPath("$.user.email")
                    .isEqualTo(email)
                    .jsonPath("$.user.displayName")
                    .isEqualTo("Test User");
        }

        @Test
        void setsTheRefreshTokenAsACookieOnlyTheSessionEndpointsReceive() {
            String email = uniqueEmail();
            register(email);

            loggingIn(email, PASSWORD)
                    .expectHeader()
                    .value(
                            HttpHeaders.SET_COOKIE,
                            cookie -> assertThat(cookie)
                                    .startsWith(REFRESH_TOKEN_COOKIE + "=")
                                    .contains("Path=/api/v1/auth/session;")
                                    .contains("Max-Age=1209600;")
                                    .contains("Secure")
                                    .contains("HttpOnly")
                                    .contains("SameSite=Strict"));
        }

        @Test
        void ignoresTheLetterCaseOfTheEmail() {
            String email = uniqueEmail();
            register(email);

            loggingIn(email.toUpperCase(), PASSWORD).expectStatus().isOk();
        }

        @Test
        void answersAWrongPasswordAndAnUnknownEmailAlike() {
            String email = uniqueEmail();
            register(email);

            String wrongPassword = loggingIn(email, "wrong-password-1")
                    .expectStatus()
                    .isUnauthorized()
                    .expectBody(String.class)
                    .returnResult()
                    .getResponseBody();
            String unknownEmail = loggingIn(uniqueEmail(), PASSWORD)
                    .expectStatus()
                    .isUnauthorized()
                    .expectBody(String.class)
                    .returnResult()
                    .getResponseBody();

            assertThat(wrongPassword).contains("\"code\":\"INVALID_CREDENTIALS\"");
            assertThat(unknownEmail).isEqualTo(wrongPassword);
        }
    }

    @Nested
    class AccessToken {

        @Test
        void authenticatesRequestsAsItsUser() {
            LoggedIn user = newLoggedInUser();

            api.get()
                    .uri("/api/v1/users/me")
                    .headers(headers -> headers.setBearerAuth(user.accessToken()))
                    .exchange()
                    .expectStatus()
                    .isOk()
                    .expectBody()
                    .jsonPath("$.email")
                    .isEqualTo(user.session().getUser().getEmail());
        }

        @Test
        void isRequiredByProtectedEndpoints() {
            api.get()
                    .uri("/api/v1/users/me")
                    .exchange()
                    .expectStatus()
                    .isUnauthorized()
                    .expectHeader()
                    .valueEquals(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
                    .expectHeader()
                    .contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("UNAUTHENTICATED");
        }

        @Test
        void mustBeOneTheBackendSigned() {
            String forged = newLoggedInUser().accessToken().replaceFirst("\\.[^.]+$", ".forged-signature");

            api.get()
                    .uri("/api/v1/users/me")
                    .headers(headers -> headers.setBearerAuth(forged))
                    .exchange()
                    .expectStatus()
                    .isUnauthorized()
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("UNAUTHENTICATED");
        }
    }

    @Nested
    class Refreshing {

        @Test
        void restoresTheSessionFromTheRefreshTokenCookie() {
            LoggedIn user = newLoggedInUser();

            refreshing(user.refreshToken())
                    .expectStatus()
                    .isOk()
                    .expectBody()
                    .jsonPath("$.accessToken")
                    .isNotEmpty()
                    .jsonPath("$.user.email")
                    .isEqualTo(user.session().getUser().getEmail());
        }

        @Test
        void issuesAnAccessTokenThatAuthenticatesRequests() {
            LoggedIn user = newLoggedInUser();
            String accessToken = refreshing(user.refreshToken())
                    .expectBody(AuthSession.class)
                    .returnResult()
                    .getResponseBody()
                    .getAccessToken();

            api.get()
                    .uri("/api/v1/users/me")
                    .headers(headers -> headers.setBearerAuth(accessToken))
                    .exchange()
                    .expectStatus()
                    .isOk();
        }

        @Test
        void needsTheCookie() {
            api.post()
                    .uri("/api/v1/auth/session/refresh")
                    .exchange()
                    .expectStatus()
                    .isUnauthorized()
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("UNAUTHENTICATED");
        }

        @Test
        void rejectsATokenItNeverIssued() {
            refreshing("made-up-token")
                    .expectStatus()
                    .isUnauthorized()
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("UNAUTHENTICATED");
        }
    }

    /** Refreshes successfully, returning the new refresh token the response rotated to. */
    private String rotate(String refreshToken) {
        return refreshTokenSetBy(
                refreshing(refreshToken).expectStatus().isOk().expectBody().returnResult());
    }

    @Nested
    class Rotation {

        @Test
        void replacesTheRefreshTokenCookieWithANewOneOnEveryRefresh() {
            LoggedIn user = newLoggedInUser();

            refreshing(user.refreshToken())
                    .expectHeader()
                    .value(
                            HttpHeaders.SET_COOKIE,
                            cookie -> assertThat(cookie)
                                    .startsWith(REFRESH_TOKEN_COOKIE + "=")
                                    .doesNotContain(user.refreshToken())
                                    .contains("Path=/api/v1/auth/session;")
                                    .contains("Max-Age=1209600;")
                                    .contains("Secure")
                                    .contains("HttpOnly")
                                    .contains("SameSite=Strict"));
        }

        @Test
        void keepsTheSessionGoingWithEachNewToken() {
            LoggedIn user = newLoggedInUser();

            String second = rotate(user.refreshToken());
            String third = rotate(second);

            refreshing(third).expectStatus().isOk();
        }

        @Test
        void makesThePreviousTokenUnusable() {
            LoggedIn user = newLoggedInUser();

            rotate(user.refreshToken());

            refreshing(user.refreshToken())
                    .expectStatus()
                    .isUnauthorized()
                    .expectBody()
                    .jsonPath("$.code")
                    .isEqualTo("UNAUTHENTICATED");
        }

        @Test
        void treatsAReplayedTokenAsTheftAndEndsTheWholeSession() {
            LoggedIn user = newLoggedInUser();
            String current = rotate(user.refreshToken());

            // Whoever presents the rotated token, the thief or the User, the session can't be trusted
            refreshing(user.refreshToken()).expectStatus().isUnauthorized();

            refreshing(current).expectStatus().isUnauthorized();
        }

        @Test
        void letsOnlyOneOfTwoSimultaneousRefreshesRotateTheToken() {
            LoggedIn user = newLoggedInUser();

            // The second waits for the first to finish rotating, then presents a rotated token
            List<EntityExchangeResult<byte[]>> results = Stream.of(1, 2)
                    .parallel()
                    .map(attempt -> refreshing(user.refreshToken()).expectBody().returnResult())
                    .toList();

            assertThat(results).extracting(result -> result.getStatus().value()).containsExactlyInAnyOrder(200, 401);
            String rotated = refreshTokenSetBy(results.stream()
                    .filter(result -> result.getStatus().is2xxSuccessful())
                    .findFirst()
                    .orElseThrow());
            refreshing(rotated).expectStatus().isUnauthorized();
        }

        @Test
        void endsOnlyTheSessionTheReplayedTokenBelongsTo() {
            String email = uniqueEmail();
            register(email);
            LoggedIn laptop = logIn(email);
            LoggedIn phone = logIn(email);
            rotate(laptop.refreshToken());

            refreshing(laptop.refreshToken()).expectStatus().isUnauthorized();

            refreshing(phone.refreshToken()).expectStatus().isOk();
        }
    }

    @Nested
    class LoggingOut {

        @Test
        void revokesTheRefreshToken() {
            LoggedIn user = newLoggedInUser();

            loggingOut(user.refreshToken()).expectStatus().isNoContent();

            refreshing(user.refreshToken()).expectStatus().isUnauthorized();
        }

        @Test
        void endsTheSessionAfterItsTokenWasRotated() {
            LoggedIn user = newLoggedInUser();
            String current = rotate(user.refreshToken());

            loggingOut(current).expectStatus().isNoContent();

            refreshing(current).expectStatus().isUnauthorized();
        }

        @Test
        void withAnOlderTokenOfTheSessionStillEndsIt() {
            LoggedIn user = newLoggedInUser();
            String current = rotate(user.refreshToken());

            loggingOut(user.refreshToken()).expectStatus().isNoContent();

            refreshing(current).expectStatus().isUnauthorized();
        }

        @Test
        void clearsTheCookie() {
            LoggedIn user = newLoggedInUser();

            loggingOut(user.refreshToken())
                    .expectHeader()
                    .value(
                            HttpHeaders.SET_COOKIE,
                            cookie -> assertThat(cookie)
                                    .startsWith(REFRESH_TOKEN_COOKIE + "=;")
                                    .contains("Path=/api/v1/auth/session;")
                                    .contains("Max-Age=0;"));
        }

        @Test
        void leavesTheUsersOtherSessionsLoggedIn() {
            String email = uniqueEmail();
            register(email);
            LoggedIn laptop = logIn(email);
            LoggedIn phone = logIn(email);

            loggingOut(laptop.refreshToken());

            refreshing(phone.refreshToken()).expectStatus().isOk();
        }

        @Test
        void succeedsWithoutASession() {
            api.post()
                    .uri("/api/v1/auth/session/logout")
                    .exchange()
                    .expectStatus()
                    .isNoContent();
        }
    }
}
