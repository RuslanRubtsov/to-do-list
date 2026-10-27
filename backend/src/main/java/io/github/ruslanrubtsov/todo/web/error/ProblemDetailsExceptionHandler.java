package io.github.ruslanrubtsov.todo.web.error;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.FieldError;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Renders every error as RFC 9457 Problem Details with a stable {@code code} the frontend translates
 * (ADR-0002).
 */
@RestControllerAdvice
class ProblemDetailsExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsExceptionHandler.class);

    private static final String CODE = "code";
    private static final String ERRORS = "errors";

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<FieldError> violations = ex.getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), constraintCode(error.getCode())))
                .toList();
        return handleExceptionInternal(ex, validationProblem(violations), headers, status, request);
    }

    /**
     * Parameter validation on {@code @Validated} controllers, which all generated API interfaces are. A
     * constraint broken anywhere else is our bug, not the client's, so it is an internal error.
     */
    @ExceptionHandler
    ResponseEntity<Object> handleConstraintViolation(ConstraintViolationException ex, WebRequest request) {
        if (!ex.getConstraintViolations().stream().allMatch(ProblemDetailsExceptionHandler::isOnController)) {
            return handleUnexpected(ex, request);
        }
        List<FieldError> violations = ex.getConstraintViolations().stream()
                .map(violation -> new FieldError(parameterPath(violation.getPropertyPath()), constraintCode(violation)))
                .toList();
        return handleExceptionInternal(
                ex, validationProblem(violations), new HttpHeaders(), HttpStatus.BAD_REQUEST, request);
    }

    /** Anything unanticipated: logged in full here, but nothing about it reaches the client. */
    @ExceptionHandler
    ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        log.error("Unexpected error handling {}", request.getDescription(false), ex);
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.INTERNAL_SERVER_ERROR, request);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, @Nullable Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem) {
            withDefaultCode(problem, statusCode);
        }
        return response;
    }

    private static boolean isOnController(ConstraintViolation<?> violation) {
        return AnnotatedElementUtils.hasAnnotation(violation.getRootBeanClass(), Controller.class);
    }

    private static ProblemDetail validationProblem(List<FieldError> violations) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setDetail("The request has invalid fields.");
        problem.setProperty(CODE, ErrorCode.VALIDATION_FAILED.getValue());
        problem.setProperty(ERRORS, violations);
        return problem;
    }

    /** {@code getTasks.size} becomes {@code size}: the client knows the parameter, not the Java method. */
    private static String parameterPath(Path propertyPath) {
        String path = propertyPath.toString();
        return path.substring(path.indexOf('.') + 1);
    }

    private static String constraintCode(ConstraintViolation<?> violation) {
        return constraintCode(violation
                .getConstraintDescriptor()
                .getAnnotation()
                .annotationType()
                .getSimpleName());
    }

    /** {@code NotBlank} becomes {@code NOT_BLANK}: stable as long as the constraint annotation is. */
    private static String constraintCode(@Nullable String constraintName) {
        if (constraintName == null) {
            return "INVALID";
        }
        return constraintName.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toUpperCase(Locale.ROOT);
    }

    private static void withDefaultCode(ProblemDetail problem, HttpStatusCode status) {
        if (problem.getProperties() == null || !problem.getProperties().containsKey(CODE)) {
            problem.setProperty(CODE, codeFor(status).getValue());
        }
    }

    private static ErrorCode codeFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 404 -> ErrorCode.NOT_FOUND;
            case 405 -> ErrorCode.METHOD_NOT_ALLOWED;
            case 406 -> ErrorCode.NOT_ACCEPTABLE;
            case 413 -> ErrorCode.PAYLOAD_TOO_LARGE;
            case 415 -> ErrorCode.UNSUPPORTED_MEDIA_TYPE;
            default -> status.is5xxServerError() ? ErrorCode.INTERNAL_ERROR : ErrorCode.MALFORMED_REQUEST;
        };
    }
}
