FROM node:22-alpine AS frontend-build

WORKDIR /build

COPY frontend/member-app/package*.json frontend/member-app/
WORKDIR /build/frontend/member-app
RUN npm ci
COPY frontend/member-app/ .
RUN mkdir -p ../../gametheca/static/dist/member-app && npm run build

WORKDIR /build
COPY frontend/admin-app/package*.json frontend/admin-app/
WORKDIR /build/frontend/admin-app
RUN npm ci
COPY frontend/admin-app/ .
# admin-app re-exports theme SoT (../../../gametheca/... from src/); stage needs those files before vite build
WORKDIR /build
COPY gametheca/setup/default_theme/js/stageECandidates.js gametheca/setup/default_theme/js/
COPY gametheca/setup/default_theme/js/unmatchedTriage.js gametheca/setup/default_theme/js/
WORKDIR /build/frontend/admin-app
RUN mkdir -p ../../gametheca/static/dist/admin-app && npm run build

WORKDIR /build
COPY frontend/ops-glance/package*.json frontend/ops-glance/
WORKDIR /build/frontend/ops-glance
RUN npm ci
COPY frontend/ops-glance/ .
RUN mkdir -p ../../gametheca/static/dist/ops-glance && npm run build

FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (bash required by entrypoint/start scripts).
# libarchive-tools (bsdtar) and p7zip-full (7z) give rarfile a working
# extraction backend for .rar ROMs without needing Debian's non-free repo
# (plain `unrar` lives there and isn't enabled on this base image).
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    bash \
    libarchive-tools \
    p7zip-full \
    && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=frontend-build /build/gametheca/static/dist/member-app /app/gametheca/static/dist/member-app
COPY --from=frontend-build /build/gametheca/static/dist/admin-app /app/gametheca/static/dist/admin-app
COPY --from=frontend-build /build/gametheca/static/dist/ops-glance /app/gametheca/static/dist/ops-glance

RUN pip install -r requirements.txt
RUN sed -i 's/\r$//' /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/startweb-docker.sh
RUN chmod a+x /app/entrypoint.sh
RUN chmod a+x /app/startweb-docker.sh

EXPOSE 5006
ENTRYPOINT ["/bin/bash","/app/entrypoint.sh"]
