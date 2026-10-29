package io.github.ruslanrubtsov.todo.sharing;

import io.github.ruslanrubtsov.todo.api.SharingApi;
import io.github.ruslanrubtsov.todo.api.model.Share;
import io.github.ruslanrubtsov.todo.api.model.ShareChange;
import io.github.ruslanrubtsov.todo.api.model.ShareDraft;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SharesController implements SharingApi {

    private final SharingService sharingService;

    SharesController(SharingService sharingService) {
        this.sharingService = sharingService;
    }

    @Override
    public ResponseEntity<List<Share>> getShares(Long todoListId) {
        return ResponseEntity.ok(sharingService.list(CurrentUser.id(), todoListId));
    }

    @Override
    public ResponseEntity<Share> changeShare(Long todoListId, Long userId, ShareChange shareChange) {
        return ResponseEntity.ok(
                sharingService.changeRole(CurrentUser.id(), todoListId, userId, shareChange.getRole()));
    }

    @Override
    public ResponseEntity<Void> revokeShare(Long todoListId, Long userId) {
        sharingService.revoke(CurrentUser.id(), todoListId, userId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> leaveTodoList(Long todoListId) {
        sharingService.leave(CurrentUser.id(), todoListId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Share> createShare(Long todoListId, ShareDraft shareDraft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sharingService.create(CurrentUser.id(), todoListId, shareDraft));
    }
}
