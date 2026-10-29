package io.github.ruslanrubtsov.todo.sharing;

import io.github.ruslanrubtsov.todo.api.SharingApi;
import io.github.ruslanrubtsov.todo.api.model.Share;
import io.github.ruslanrubtsov.todo.api.model.ShareDraft;
import io.github.ruslanrubtsov.todo.auth.CurrentUser;
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
    public ResponseEntity<Share> createShare(Long todoListId, ShareDraft shareDraft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sharingService.create(CurrentUser.id(), todoListId, shareDraft));
    }
}
