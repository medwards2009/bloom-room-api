# Bloom Room API — task runner

image := "medwards2009/bloom-room-api"
# The docker-compose network, so a containerised API can reach the `db` service.
db_network := "bloom-room-api_default"

# Default: list available recipes
default:
    @just --list

# Start dependencies (PostgreSQL) in the background
deps-start:
    docker compose up -d

# Stop dependencies (keeps the data volume)
deps-stop:
    docker compose down

# Stop dependencies AND delete the data volume (fresh DB)
deps-reset:
    docker compose down -v

# Tail the database logs
deps-logs:
    docker compose logs -f db

# Open a psql shell inside the running db container
db-shell:
    docker compose exec db psql -U bloom -d bloom_room_dev

# Install dependencies
install:
    pnpm install --strict-peer-dependencies=false

# Run the API in watch mode
dev:
    pnpm start:dev

# Lint (with --fix)
lint:
    pnpm lint

# Format with prettier
format:
    pnpm format

# Run unit tests (commented out until unit tests are added)
# test:
#     pnpm test

# Run e2e tests (needs Postgres up; uses an isolated bloom_room_test database)
test-e2e:
    pnpm test:e2e

# --- Docker -------------------------------------------------------------------
# This laptop is arm64 and the server is x86_64, so `docker-build` is for local
# use only — never push what it produces. Use `docker-push` to publish, which
# builds both architectures.

# Build the image for this machine's architecture (local use only)
docker-build:
    docker build -t {{image}}:latest .

# Run the image locally against the docker-compose Postgres (needs deps-start).
# Config comes from .env, except DB_HOST: .env points at localhost for host-based
# dev, but from inside the container the compose db is reached by its service name
# `db` on the shared network — so we override just that one.
docker-run: docker-build
    docker run --rm -d --name bloom-room-api \
        --network {{db_network}} \
        -p 8080:8080 \
        --env-file .env \
        -e DB_HOST=db \
        {{image}}:latest
    @echo "API on http://localhost:8080 — try: curl -s localhost:8080/health"

# Tail the local container's logs
docker-logs:
    docker logs -f bloom-room-api

# Stop the local container
docker-stop:
    docker stop bloom-room-api

# Build for BOTH architectures and push to Docker Hub. The server pulls linux/amd64;
# linux/arm64 is included so the same tag runs on this laptop.
docker-push tag="latest":
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t {{image}}:{{tag}} \
        --push .

# Pull the image from Docker Hub (defaults to :latest)
docker-pull tag="latest":
    docker pull {{image}}:{{tag}}
