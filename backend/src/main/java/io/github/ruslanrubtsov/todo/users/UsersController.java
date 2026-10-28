package io.github.ruslanrubtsov.todo.users;

import io.github.ruslanrubtsov.todo.api.UsersApi;
import io.github.ruslanrubtsov.todo.api.model.User;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
class UsersController implements UsersApi {

    private final UserRepository users;

    UsersController(UserRepository users) {
        this.users = users;
    }

    @Override
    public ResponseEntity<User> getCurrentUser() {
        // Users can't be deleted (yet), so a valid access token always names an existing one
        return ResponseEntity.ok(
                UserMapper.toApi(users.findById(CurrentUser.id()).orElseThrow()));
    }
}
