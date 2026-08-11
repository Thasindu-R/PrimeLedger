package com.primeledger.security;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Mints RS256 tokens the way Supabase does, signed with a keypair generated for
 * the test run.
 *
 * <p>This is what lets the resource server be tested honestly without a Supabase
 * project, a network call, or a checked-in key. The production
 * {@code NimbusJwtDecoder} is replaced by one holding this keypair's public
 * half; everything else — the signature check, the issuer and audience
 * validators, the claim converter, the identity that reaches RLS — is the real
 * code path.
 */
public final class JwtTestTokens {

    public static final String ISSUER = "https://project.supabase.co/auth/v1";
    public static final String AUDIENCE = "authenticated";

    private final RSAPublicKey publicKey;
    private final RSAPrivateKey privateKey;

    public JwtTestTokens() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair pair = generator.generateKeyPair();
            this.publicKey = (RSAPublicKey) pair.getPublic();
            this.privateKey = (RSAPrivateKey) pair.getPrivate();
        } catch (Exception e) {
            throw new IllegalStateException("Could not generate a test RSA keypair", e);
        }
    }

    public RSAPublicKey publicKey() {
        return publicKey;
    }

    /** A token Supabase would accept as ordinary and valid. */
    public String validFor(UUID userId) {
        return token(builder(userId).build());
    }

    public String expiredFor(UUID userId) {
        Instant longAgo = Instant.now().minusSeconds(7200);
        return token(
                builder(userId)
                        .issueTime(Date.from(longAgo))
                        .expirationTime(Date.from(longAgo.plusSeconds(3600)))
                        .build());
    }

    public String wrongIssuerFor(UUID userId) {
        return token(builder(userId).issuer("https://attacker.example/auth/v1").build());
    }

    public String wrongAudienceFor(UUID userId) {
        return token(builder(userId).audience("some-other-service").build());
    }

    /** Signed by a different keypair — structurally perfect, cryptographically not ours. */
    public String forgedFor(UUID userId) {
        return new JwtTestTokens().token(builder(userId).build());
    }

    private JWTClaimsSet.Builder builder(UUID userId) {
        Instant now = Instant.now();
        return new JWTClaimsSet.Builder()
                .subject(userId.toString())
                .issuer(ISSUER)
                .audience(AUDIENCE)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(3600)))
                .claim("role", "authenticated")
                .claim("email", userId + "@primeledger.test")
                .claim("app_metadata", Map.of("provider", "email", "roles", List.of()));
    }

    private String token(JWTClaimsSet claims) {
        try {
            SignedJWT jwt =
                    new SignedJWT(
                            new JWSHeader.Builder(JWSAlgorithm.RS256)
                                    .type(JOSEObjectType.JWT)
                                    .build(),
                            claims);
            jwt.sign(new RSASSASigner(privateKey));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException("Could not sign a test token", e);
        }
    }
}
