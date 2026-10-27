package io.github.ruslanrubtsov.todo.users;

import io.github.ruslanrubtsov.todo.api.model.User;

public final class UserMapper {

    private UserMapper() {}

    public static User toApi(UserEntity user) {
        return new User(user.getId(), user.getEmail(), user.getDisplayName(), user.getPreferredLanguage());
    }
}
