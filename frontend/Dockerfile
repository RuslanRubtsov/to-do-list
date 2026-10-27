# Build context is the repository root: the build generates the API client from api/ (ADR-0001).

FROM node:24-alpine AS build
# openapi-generator runs on the JVM
RUN apk add --no-cache openjdk21-jre-headless
WORKDIR /workspace
COPY api/ api/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN --mount=type=cache,target=/root/.npm npm ci --prefix frontend
COPY frontend/ frontend/
RUN npm run build --prefix frontend

FROM nginx:1.30-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/backend-proxy.inc /etc/nginx/conf.d/backend-proxy.inc
COPY --from=build /workspace/frontend/dist/frontend/browser /usr/share/nginx/html
