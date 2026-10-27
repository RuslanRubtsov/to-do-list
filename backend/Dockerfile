# Build context is the repository root: the build needs the OpenAPI spec in api/ (ADR-0001).

FROM maven:3.10.0-eclipse-temurin-25 AS build
WORKDIR /workspace
COPY api/ api/
COPY backend/pom.xml backend/
RUN --mount=type=cache,target=/root/.m2 mvn -B -f backend/pom.xml dependency:go-offline
COPY backend/src backend/src
RUN --mount=type=cache,target=/root/.m2 mvn -B -f backend/pom.xml package -DskipTests -Dspotless.check.skip=true -Djacoco.skip=true \
    && java -Djarmode=tools -jar backend/target/todo-backend-*.jar extract --layers --launcher --destination /extracted

FROM eclipse-temurin:25-jre-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
