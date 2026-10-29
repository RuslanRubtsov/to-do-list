# A variable makes nginx resolve the backend per request (see `resolver` in nginx.conf), so nginx
# starts without it and follows it across restarts instead of caching its first IP.
set $backend http://backend:8080;
proxy_pass $backend;
proxy_set_header Host $host;
# Adds the address this request came from to any that a proxy in front already forwarded
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $forwarded_proto;
# Live updates stay open: their heartbeats (EventsProperties) come well within this, and the
# backend's X-Accel-Buffering header turns buffering off for them
proxy_read_timeout 60s;
# Fail fast when the backend is down, so the app can say so instead of hanging
proxy_connect_timeout 5s;
