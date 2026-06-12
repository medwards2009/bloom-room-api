# Bloom Room API — Iteration 1 Build Plan

> Working plan for building out the first iteration of the API. We build in
> small, individually-testable, commit-sized chunks. The user tests each chunk
> locally against a Dockerized Postgres, tweaks, then we commit and move on.
> **Update the Progress checklist below as chunks land.**

## Progress

- [x] **Chunk 1 — Local dev setup** (committed `9a2a11d` on branch `dev-setup`)
- [ ] **Chunk 2 — Teacher entity + auth** (login → API JWT + global guard)
- [ ] **Chunk 3 — Classes CRUD** (teacher-scoped)
- [ ] **Chunk 4 — Students + Enrollment**
- [ ] **Chunk 5 — Behaviors** (per-student goals)
- [ ] **Chunk 6 — Behavior entries** (daily yes/no)
- [ ] **Chunk 7 — Reports** (computed snapshots)

Work happens on the `dev-setup` branch (one PR for the iteration) unless noted.

## Context

`bloom-room-api` backs a **mobile app for teachers to record student behavior**.
A teacher signs in with Google/Apple on the device; the API records the teacher,
then manages their classes, students, per-student behavior goals, daily yes/no
behavior entries, and generated report snapshots.

### Locked decisions
- **Data layer:** TypeORM (`@nestjs/typeorm`, TypeORM **1.0.0**) — decorator
  entities, dev `synchronize: true` for now, real migrations added before any
  shared data exists.
- **Auth:** API-issued JWT. Mobile sends a Google/Apple **ID token** once to
  `POST /auth/login`; API verifies it with the provider, finds-or-creates the
  teacher, and returns its **own** signed JWT. A global guard validates that JWT
  on every subsequent request and attaches the teacher (`@Public()` escape hatch
  for open routes).
- **Behavior scope:** a `behavior` belongs to a **student** and is tracked across
  **all** their classes; each `behavior_entry` carries `class_id` to record which
  subject it was logged in.
- **Enrollment:** many-to-many via an `enrollment` join table (unique on
  `class_id, student_id`).
- **Reports:** computed on demand (yes-count / total-count over a date range) and
  stored as a frozen `jsonb` snapshot.

### Env note (resolved)
The dev shell previously exported another project's `DB_*` vars from `~/.zshrc`,
which leaked into Node and overrode `.env` (caused `28P01`). Fixed by removing
those exports from `~/.zshrc` and relocating them to `skillshare-local/.env`.
This project's `.env` (gitignored; see `.env.example`) is authoritative. API
listens on **port 8080**.

## Schema (target end state)

All PKs are `uuid` (default gen), all tables get `created_at`. Ownership is always
scoped to the authenticated `teacher`.

- **teacher** — `first_name, last_name, school_email?(nullable),
  auth_provider('google'|'apple'), auth_subject(stable provider sub), created_at`.
  Unique `(auth_provider, auth_subject)`. Match login on `auth_subject`, not email.
- **class** — `teacher_id→teacher, period(string), subject(string), created_at`.
- **student** — `teacher_id→teacher, first_name, last_name, created_at`.
- **enrollment** — `class_id→class, student_id→student`. Unique `(class_id, student_id)`.
- **behavior** — `student_id→student, name, description,
  goal_type('yes_no' default), created_at`.
- **behavior_entry** — `behavior_id→behavior, student_id→student (denormalized for
  cheap report queries), class_id→class, behavior_present(bool), entry_date(date),
  comment?(nullable), created_at`. Unique `(behavior_id, class_id, entry_date)`.
- **report** — `student_id→student, period_type('weekly'|'nine_week'|'yearly'),
  period_start(date), period_end(date), data(jsonb: per-subject % + overall),
  generated_at`.

## Build chunks (one commit each)

### Chunk 1 — Local dev setup ✅
docker-compose (postgres:16, named `pgdata` volume, healthcheck); justfile
(`deps-start/-stop/-reset/-logs`, `db-shell`, `dev`, `install`, `lint`, `format`,
`test`); `.env`/`.env.example`; ConfigModule + TypeOrmModule wired in
`app.module.ts`; global ValidationPipe in `main.ts`; `GET /health` checks DB.
**Commit:** `chore: local dev setup (docker postgres, justfile, typeorm + config wiring)`

### Chunk 2 — Teacher entity + auth
`Teacher` entity + module. Deps `@nestjs/jwt`, `google-auth-library` (Google
first; Apple stubbed behind a provider-agnostic `TokenVerifier`). `AuthService`:
`verifyProviderToken` → `{provider, subject, firstName, lastName, email?}`;
`loginOrCreate` (upsert by `(auth_provider, auth_subject)`); `issueJwt`.
`POST /auth/login {provider, idToken}` → `{accessToken, teacher}` (`@Public()`).
Global `JwtAuthGuard` (APP_GUARD) reads Bearer, verifies, loads teacher onto
`request.teacher`; `@Public()` decorator bypasses; `@CurrentTeacher()` param
decorator. `GET /me` smoke test. **Open item:** dev-only verifier so `/auth/login`
accepts a fake subject locally without a device. **Commit:** `feat: teacher auth
via provider id-token exchange for api jwt`

### Chunk 3 — Classes CRUD (teacher-scoped)
`Class` entity + module/service/controller + DTOs. `POST/GET/GET:id/PATCH/DELETE
/classes`, all scoped to `@CurrentTeacher()`; 404 (not 403) if not the teacher's.
**Commit:** `feat: class crud scoped to authenticated teacher`

### Chunk 4 — Students + Enrollment
`Student` entity (teacher-scoped CRUD) + `Enrollment` join entity (unique
`class_id, student_id`). `POST /classes/:id/students` (enroll),
`DELETE /classes/:id/students/:studentId` (unenroll), `GET /classes/:id/students`
(roster). Validate both class and student belong to the teacher.
**Commit:** `feat: students and class enrollment`

### Chunk 5 — Behaviors (per-student goals)
`Behavior` entity (`goal_type` default `'yes_no'`). `POST /students/:id/behaviors`,
`GET /students/:id/behaviors`, `PATCH /behaviors/:id`, `DELETE /behaviors/:id`.
Teacher-scoped via owning student. **Commit:** `feat: per-student behavior goals`

### Chunk 6 — Behavior entries (daily yes/no)
`BehaviorEntry` entity (unique `behavior_id, class_id, entry_date`).
`POST /behaviors/:id/entries {classId, entryDate, behaviorPresent, comment?}`
(denormalize `student_id` from the behavior). `GET /behaviors/:id/entries?from=&to=`
and/or `GET /students/:id/entries?from=&to=`. **Open item:** duplicate handling —
409 vs upsert. **Commit:** `feat: daily behavior entries with per-class/day uniqueness`

### Chunk 7 — Reports (computed snapshots)
`Report` entity (`jsonb data`). `POST /students/:id/reports {periodType,
periodStart, periodEnd}` → compute per-subject % (yes/total grouped by class over
range) + overall, store snapshot, return it. `GET /students/:id/reports`,
`GET /reports/:id`. Verify editing an entry afterward does NOT change a stored
snapshot. **Commit:** `feat: generate and store student report snapshots`

## Conventions
- One Nest module per resource; entities as `*.entity.ts`; DTOs validated with
  `class-validator`.
- Every data-touching endpoint is teacher-scoped via `@CurrentTeacher()`;
  not-owned resources return **404** (not 403) to avoid leaking existence.
- snake_case columns, camelCase API DTOs.
- `synchronize: true` only through iteration 1; switching to migrations is a
  follow-up (adds `db-migrate` / `db-generate` justfile recipes).

## Verification (per chunk)
`just deps-start`, `just dev`, exercise new endpoints with curl using a Bearer
token from `/auth/login`, confirm rows via `just db-shell`. Restart the Postgres
container to confirm volume persistence. Create a second teacher to confirm no
cross-teacher data leaks.
