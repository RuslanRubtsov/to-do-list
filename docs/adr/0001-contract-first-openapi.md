# Contract-first REST API with OpenAPI

The REST API is defined by a hand-written OpenAPI spec, and both the Spring Boot controller interfaces and the Angular API client are generated from it with openapi-generator. Swagger UI serves that same spec. We chose this over code-first springdoc annotations so the frontend and backend cannot drift apart and the API design is reviewed as a contract before it is implemented.

## Consequences

- Changing an endpoint means editing the spec first, then regenerating both sides; hand-editing generated code is never correct.
- The build depends on the generator step, so both the Maven and Angular builds run it before compiling.
