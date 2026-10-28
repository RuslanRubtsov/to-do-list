package io.github.ruslanrubtsov.todo.users;

import io.github.ruslanrubtsov.todo.api.UsersApi;
import io.github.ruslanrubtsov.todo.api.model.ProfileUpdate;
import io.github.ruslanrubtsov.todo.api.model.User;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
class UsersController implements UsersApi {

    private final UserService userService;

    UsersController(UserService userService) {
        this.userService = userService;
    }

    @Override
    public ResponseEntity<User> getCurrentUser() {
        return ResponseEntity.ok(UserMapper.toApi(userService.get(CurrentUser.id())));
    }

    @Override
    public ResponseEntity<User> updateCurrentUser(ProfileUpdate profileUpdate) {
        return ResponseEntity.ok(UserMapper.toApi(userService.update(CurrentUser.id(), profileUpdate)));
    }
}
