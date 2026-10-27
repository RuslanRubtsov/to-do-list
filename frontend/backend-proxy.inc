# A variable makes nginx resolve the backend per request (see `resolver` in nginx.conf), so nginx
# starts without it and follows it across restarts instead of caching its first IP.
set $backend http://backend:8080;
proxy_pass $backend;
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# Fail fast when the backend is down, so the app can say so instead of hanging
proxy_connect_timeout 5s;
