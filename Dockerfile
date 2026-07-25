FROM node:22-alpine AS frontend-build

WORKDIR /build

COPY frontend/member-app/package*.json frontend/member-app/
WORKDIR /build/frontend/member-app
RUN npm ci
COPY frontend/member-app/ .
RUN mkdir -p ../../gametheca/static/dist/member-app && npm run build

WORKDIR /build
COPY frontend/ops-glance/package*.json frontend/ops-glance/
WORKDIR /build/frontend/ops-glance
RUN npm ci
COPY frontend/ops-glance/ .
RUN mkdir -p ../../gametheca/static/dist/ops-glance && npm run build

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (bash required by entrypoint/start scripts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=frontend-build /build/gametheca/static/dist/member-app /app/gametheca/static/dist/member-app
COPY --from=frontend-build /build/gametheca/static/dist/ops-glance /app/gametheca/static/dist/ops-glance

RUN pip install -r requirements.txt
RUN sed -i 's/\r$//' /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/startweb-docker.sh
RUN chmod a+x /app/entrypoint.sh
RUN chmod a+x /app/startweb-docker.sh

EXPOSE 5006
ENTRYPOINT ["/bin/bash","/app/entrypoint.sh"]
