FROM node:22-alpine AS frontend-build

WORKDIR /build

COPY frontend/library-grid/package*.json frontend/library-grid/
WORKDIR /build/frontend/library-grid
RUN npm ci
COPY frontend/library-grid/ .
RUN mkdir -p ../../sharewarez/static/dist/library-grid && npm run build

WORKDIR /build
COPY frontend/ops-glance/package*.json frontend/ops-glance/
WORKDIR /build/frontend/ops-glance
RUN npm ci
COPY frontend/ops-glance/ .
RUN mkdir -p ../../sharewarez/static/dist/ops-glance && npm run build

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=frontend-build /build/sharewarez/static/dist/library-grid /app/sharewarez/static/dist/library-grid
COPY --from=frontend-build /build/sharewarez/static/dist/ops-glance /app/sharewarez/static/dist/ops-glance

RUN pip install -r requirements.txt
RUN sed -i 's/\r$//' /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/startweb-docker.sh
RUN chmod a+x /app/entrypoint.sh
RUN chmod a+x /app/startweb-docker.sh

EXPOSE 5006
ENTRYPOINT ["/bin/bash","/app/entrypoint.sh"]
