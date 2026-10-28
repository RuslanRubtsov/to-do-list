package io.github.ruslanrubtsov.todo.users;

import io.github.ruslanrubtsov.todo.api.model.Language;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Converter;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Locale;

/** A User: someone with an account. */
@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;

    private String passwordHash;

    private String displayName;

    @Convert(converter = LanguageConverter.class)
    private Language preferredLanguage;

    @Column(updatable = false)
    private Instant createdAt;

    protected UserEntity() {}

    public UserEntity(String email, String passwordHash, String displayName, Language preferredLanguage) {
        this.email = normalizeEmail(email);
        this.passwordHash = passwordHash;
        this.displayName = displayName.strip();
        this.preferredLanguage = preferredLanguage;
        this.createdAt = Instant.now();
    }

    /** Emails identify Users regardless of letter case or stray surrounding spaces. */
    public static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Language getPreferredLanguage() {
        return preferredLanguage;
    }

    void rename(String displayName) {
        this.displayName = displayName.strip();
    }

    void preferLanguage(Language language) {
        this.preferredLanguage = language;
    }

    /** Stores the language as its API code ({@code en}, {@code uk}), not the Java constant's name. */
    @Converter
    static class LanguageConverter implements AttributeConverter<Language, String> {

        @Override
        public String convertToDatabaseColumn(Language language) {
            return language.getValue();
        }

        @Override
        public Language convertToEntityAttribute(String code) {
            return Language.fromValue(code);
        }
    }
}
