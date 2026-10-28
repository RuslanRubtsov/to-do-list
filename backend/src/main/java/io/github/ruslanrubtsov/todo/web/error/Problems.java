package io.github.ruslanrubtsov.todo.web.error;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.FieldError;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Problem Details that services throw; {@link ProblemDetailsExceptionHandler} renders them. */
public final class Problems {

    static final String CODE = "code";
    static final String ERRORS = "errors";

    private Problems() {}

    /** A failure the client can act on, identified by a stable code. */
    public static ErrorResponseException problem(HttpStatus status, ErrorCode code, String detail) {
        return new ErrorResponseException(status, problemDetail(status, code, detail), null);
    }

    static ProblemDetail problemDetail(HttpStatus status, ErrorCode code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setProperty(CODE, code.getValue());
        return problem;
    }

    /**
     * One invalid request field that only the service can judge, reported exactly like a failed Bean
     * Validation constraint.
     */
    public static ErrorResponseException invalidField(String field, String constraintCode) {
        return new ErrorResponseException(
                HttpStatus.BAD_REQUEST, validationProblem(List.of(new FieldError(field, constraintCode))), null);
    }

    static ProblemDetail validationProblem(List<FieldError> violations) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setDetail("The request has invalid fields.");
        problem.setProperty(CODE, ErrorCode.VALIDATION_FAILED.getValue());
        problem.setProperty(ERRORS, violations);
        return problem;
    }
}
