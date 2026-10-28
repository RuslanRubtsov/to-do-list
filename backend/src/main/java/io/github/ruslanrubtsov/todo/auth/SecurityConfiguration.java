package io.github.ruslanrubtsov.todo.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.security.NoSuchAlgorithmException;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Stateless bearer-token security: every {@code /api/} request needs a valid access token, except the
 * ones that obtain one and the public app info. Everything else the backend serves (Swagger UI, the
 * spec, health) is public.
 */
@Configuration
@EnableConfigurationProperties(AuthProperties.class)
class SecurityConfiguration {

    static final MacAlgorithm ACCESS_TOKEN_ALGORITHM = MacAlgorithm.HS256;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ProblemAuthenticationEntryPoint entryPoint) {
        return http
                // No cookie authenticates API calls, so there is nothing to forge. The refresh token
                // cookie only reaches the session endpoints, and SameSite=Strict keeps it off
                // cross-site requests.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests.requestMatchers("/api/v1/auth/**", "/api/v1/app-info")
                        .permitAll()
                        .requestMatchers("/api/**")
                        .authenticated()
                        .anyRequest()
                        .permitAll())
                .oauth2ResourceServer(
                        resourceServer -> resourceServer.jwt(jwt -> {}).authenticationEntryPoint(entryPoint))
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(entryPoint))
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Signs access tokens. A fresh key every start: one backend instance both issues and checks them,
     * and after a restart the refresh token, stored in the database, gets the User a new one.
     */
    @Bean
    SecretKey accessTokenKey() throws NoSuchAlgorithmException {
        return KeyGenerator.getInstance("HmacSHA256").generateKey();
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey accessTokenKey) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(accessTokenKey));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey accessTokenKey) {
        return NimbusJwtDecoder.withSecretKey(accessTokenKey)
                .macAlgorithm(ACCESS_TOKEN_ALGORITHM)
                .build();
    }
}
