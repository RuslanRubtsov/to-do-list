package io.github.ruslanrubtsov.todo.tasks;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Position arithmetic: plain unit tests, as it's awkward to reach every case through HTTP. */
class TaskPositionsTest {

    @Test
    void theFirstTaskOfATodoListGetsOneGap() {
        assertThat(TaskPositions.between(null, null)).hasValue(1024);
    }

    @Test
    void aTaskAfterTheLastGoesOneGapFurther() {
        assertThat(TaskPositions.between(3072L, null)).hasValue(4096);
    }

    @Test
    void aTaskBeforeTheFirstGoesOneGapEarlier() {
        assertThat(TaskPositions.between(null, 1024L)).hasValue(0);
        assertThat(TaskPositions.between(null, 0L)).hasValue(-1024);
    }

    @Test
    void aTaskBetweenTwoGoesHalfwayBetweenThem() {
        assertThat(TaskPositions.between(1024L, 2048L)).hasValue(1536);
        assertThat(TaskPositions.between(-3L, 4L)).hasValue(0);
        assertThat(TaskPositions.between(5L, 7L)).hasValue(6);
    }

    @Test
    void thereIsNoPlaceBetweenNeighboursWithNoGapLeft() {
        assertThat(TaskPositions.between(5L, 6L)).isEmpty();
        // Two Tasks added at once can share a position
        assertThat(TaskPositions.between(5L, 5L)).isEmpty();
    }

    @Test
    void renumberingSpreadsTasksOneGapApartFromTheFirstPosition() {
        assertThat(TaskPositions.renumbered(4)).containsExactly(1024, 2048, 3072, 4096);
        assertThat(TaskPositions.renumbered(0)).isEmpty();
    }

    @Test
    void halvingTheGapRunsOutAfterTenMoves() {
        long previous = 1024;
        long next = 2048;
        for (int move = 0; move < 10; move++) {
            next = TaskPositions.between(previous, next).orElseThrow();
        }

        assertThat(next).isEqualTo(previous + 1);
        assertThat(TaskPositions.between(previous, next)).isEmpty();
    }
}
