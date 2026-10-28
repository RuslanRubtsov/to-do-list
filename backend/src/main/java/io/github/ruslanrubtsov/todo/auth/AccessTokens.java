package io.github.ruslanrubtsov.todo.auth;

import io.github.ruslanrubtsov.todo.users.UserEntity;
import java.time.Instant;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

/** Issues the short-lived JWTs that authenticate API requests. Their subject is the User's id. */
@Component
class AccessTokens {

    private final JwtEncoder encoder;
    private final AuthProperties properties;

    AccessTokens(JwtEncoder encoder, AuthProperties properties) {
        this.encoder = encoder;
        this.properties = properties;
    }

    String issue(UserEntity user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(properties.accessTokenTtl()))
                .build();
        JwsHeader header =
                JwsHeader.with(SecurityConfiguration.ACCESS_TOKEN_ALGORITHM).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
