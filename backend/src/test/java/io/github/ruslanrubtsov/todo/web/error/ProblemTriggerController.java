package io.github.ruslanrubtsov.todo.web.error;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only endpoints that provoke errors no real endpoint can yet. Annotated {@code @Validated} like the
 * interfaces generated from the OpenAPI spec, so parameter validation fails the same way.
 */
@Validated
@RestController
@RequestMapping("/test/problems")
class ProblemTriggerController {

    record Payload(@NotBlank String name, @Email String email) {}

    @PostMapping("/validation")
    void validateBody(@Valid @RequestBody Payload payload) {}

    @GetMapping("/validation")
    void validateParameter(@RequestParam @Min(1) int size) {}

    @GetMapping("/failure")
    void fail() {
        throw new IllegalStateException("internal detail that must not leak");
    }

    /** A constraint broken by our own code rather than by the client's request. */
    @GetMapping("/internal-validation")
    void breakInternalConstraint() {
        collaborator.accept(0);
    }

    private final ValidatedCollaborator collaborator;

    ProblemTriggerController(ValidatedCollaborator collaborator) {
        this.collaborator = collaborator;
    }

    @Validated
    @Component
    static class ValidatedCollaborator {

        void accept(@Min(1) int value) {}
    }
}
