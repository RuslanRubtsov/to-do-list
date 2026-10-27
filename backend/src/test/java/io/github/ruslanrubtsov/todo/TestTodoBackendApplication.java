package io.github.ruslanrubtsov.todo;

import org.springframework.boot.SpringApplication;

public class TestTodoBackendApplication {

    public static void main(String[] args) {
        SpringApplication.from(TodoBackendApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
