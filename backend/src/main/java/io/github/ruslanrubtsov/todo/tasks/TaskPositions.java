package io.github.ruslanrubtsov.todo.tasks;

import java.util.OptionalLong;
import java.util.stream.LongStream;
import org.jspecify.annotations.Nullable;

/**
 * The sparse positions that keep a Todo List's Tasks in their manual order. Tasks start a gap apart,
 * so most moves only change the moved Task; once a gap is used up, the Todo List is renumbered.
 */
final class TaskPositions {

    /** How far apart Tasks are placed: room for ten moves into the same gap before renumbering. */
    static final long GAP = 1024;

    private TaskPositions() {}

    /**
     * A position between two neighbours' positions, either of which is {@code null} at that end of the
     * Todo List; none when no whole number is left between them.
     */
    static OptionalLong between(@Nullable Long previous, @Nullable Long next) {
        if (previous == null && next == null) return OptionalLong.of(GAP);
        if (next == null) return OptionalLong.of(previous + GAP);
        if (previous == null) return OptionalLong.of(next - GAP);
        // Halfway, rounding down, without overflowing
        long position = previous + (next - previous) / 2;
        return position > previous ? OptionalLong.of(position) : OptionalLong.empty();
    }

    /** Fresh positions for this many Tasks in order, a gap apart. */
    static long[] renumbered(int count) {
        return LongStream.rangeClosed(1, count).map(n -> n * GAP).toArray();
    }
}
