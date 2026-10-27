package io.github.ruslanrubtsov.todo;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    // Keep in step with the image in docker-compose.yml
    private static final DockerImageName MYSQL_IMAGE = DockerImageName.parse("mysql:9.7");

    // One container for the whole test run, even when tests need differently configured contexts
    private static final MySQLContainer MYSQL = new MySQLContainer(MYSQL_IMAGE);

    @Bean
    @ServiceConnection
    MySQLContainer mysqlContainer() {
        return MYSQL;
    }
}
