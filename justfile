# Bloom Room API — task runner

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

# Run unit tests
test:
    pnpm test

# Run e2e tests (needs Postgres up; uses an isolated bloom_room_test database)
test-e2e:
    pnpm test:e2e
