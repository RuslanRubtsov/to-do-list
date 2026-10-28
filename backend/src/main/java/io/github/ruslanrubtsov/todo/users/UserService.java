package io.github.ruslanrubtsov.todo.users;

import io.github.ruslanrubtsov.todo.api.model.ProfileUpdate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class UserService {

    private final UserRepository users;

    UserService(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    UserEntity get(long id) {
        // Users can't be deleted (yet), so a valid access token always names an existing one
        return users.findById(id).orElseThrow();
    }

    /** Changes what the update gives; what it leaves out keeps its value. */
    @Transactional
    UserEntity update(long id, ProfileUpdate update) {
        UserEntity user = get(id);
        if (update.getDisplayName() != null) {
            user.rename(update.getDisplayName());
        }
        if (update.getPreferredLanguage() != null) {
            user.preferLanguage(update.getPreferredLanguage());
        }
        return user;
    }
}
