# Local Postgres for pytest / native Windows when Docker Desktop is running.
# Usage:
#   docker start gametheca-postgres
#   # or first-time:
#   docker run -d --name gametheca-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 5432:5432 postgres:17.6
#   docker exec -u postgres gametheca-postgres psql -c "CREATE DATABASE gamethecatest;"
#
# Required in .env:
#   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gamethecatest
#
# Compose alternative (publishes 5432 via POSTGRES_HOST_PORT):
#   docker compose up -d db
#   docker compose exec db psql -U postgres -c "CREATE DATABASE gamethecatest;"
