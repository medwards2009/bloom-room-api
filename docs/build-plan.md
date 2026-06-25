# Bloom Room API — Build Plan

> Working plan for building out the API. We build in small, individually-testable,
> commit-sized chunks. The user tests each chunk locally against a Dockerized
> Postgres, tweaks, then we commit and move on.
> **Update the Progress checklist below as chunks land.**

## Progress

- [x] **Chunk 1 — Local dev setup** (committed `9a2a11d`)
- [~] **Chunk 2 — Identity table + config validation** (in progress; branch `chunk-2`)
  - [x] Joi config validation (fail-fast on bad env; `AUTH_DEV_MODE` escape hatch)
  - [x] `User` identity entity + enums (replaces the old `teacher` entity)
  - [ ] commit
- [ ] **Chunk 3 — Auth** (provider id-token → API JWT + global guard + `/me`)
- [ ] **Chunk 4 — School + role profiles** (`Teacher`/`Administrator`, onboarding)
- [ ] **Chunk 5 — Classes CRUD** (teacher-scoped)
- [ ] **Chunk 6 — Students + Enrollment** (school-scoped students; M2M enrollment)
- [ ] **Chunk 7 — Behaviors** (per-student goals)
- [ ] **Chunk 8 — Behavior entries** (daily yes/no)
- [ ] **Chunk 9 — Reports** (computed jsonb snapshots)
- [ ] **Chunk 10 — Audit log** (write-always + conditional view logging)
- [ ] **Follow-up — Migrations** (turn off `synchronize`, add `db-migrate`/`db-generate`)

One PR per chunk (branch `chunk-N`), merged to `main`.

## Context

`bloom-room-api` backs a **web/mobile app for teachers to record student behavior**
(SPED-oriented). A user signs in with Google/Apple, the API records the identity,
then manages schools, role profiles, classes, students, per-student behavior goals,
daily yes/no behavior entries, and generated report snapshots.

### Env note (resolved)
The dev shell previously exported another project's `DB_*` vars from `~/.zshrc`,
which leaked into Node and overrode `.env` (caused `28P01`). Fixed by removing
those exports and relocating them to `skillshare-local/.env`. This project's `.env`
(gitignored; see `.env.example`) is authoritative. API listens on **port 8080**.

### Source of truth for entities
TypeORM 0.3-style entity files for the whole model already exist in
`generated_entities/` (reference copies). We pull them into `src/` **chunk by
chunk** — only what each chunk needs — adapting import paths and deferring
inverse-side relations until the related entity lands. Do not wire all of them at
once.

---

## Architecture decisions (data model)

### The big shift: identity split from role
The original model had a single `teacher` table that also held auth/login data —
collapsing *who you are* (identity) with *what you do* (role). Administrators
entered the picture (a teacher owns classes; an admin oversees a school), so we
split them:

- **`user`** — the identity table. One row per login. Holds OAuth fields
  (`auth_provider`, `auth_subject`), `email`, and a `user_type` enum
  (`teacher` | `administrator`). **Login resolves against this table.**
- **`teacher`** / **`administrator`** — profile tables. Each has a `user_id` FK
  pointing *back up* to `user`. Role-specific fields live here, not on `user`.

Direction matters: `user` is the parent; profiles point to it via `user_id`
(identity-first, the conventional shape — and it lets the audit log reference
`user_id` universally). Each profile is one-to-one: a user has at most one teacher
profile OR one administrator profile.

### School as its own entity
- An **administrator manages a school** — `administrator.school_id` FK.
- A **teacher belongs to a school** — `teacher.school_id` FK (linked directly, not
  through an admin, so roster scoping/reports filter by school in one join).

### Students belong to the school, not a teacher
Students enroll in multiple classes (different teachers per subject), so single
ownership is wrong. **`student.school_id`** FK — a student is a member of the
school. Teacher access flows *through enrollment*.

Authorization (build into guards):
- **Teacher access**: "Is this student enrolled in a class I teach?" (join through
  `class` + `enrollment`).
- **Admin access**: "Is this student in my school?" (single-join lookup).
- Not-owned/not-visible resources return **404** (not 403) to avoid leaking existence.

UI implication: adding a student is conceptually two steps — create the student on
the school, then enroll in the class (can be one form behind the scenes).

### Enrollment is a join table (M2M)
**`enrollment`** links `class` and `student`. Unique on (`class_id`, `student_id`).

### Behavior tracking
- **`behavior`** — one tracked goal per student (`student_id`, `name`,
  `description`, `goal_type` enum, currently only `yes_no`). Scoped to the
  *student*, tracked across all their classes (see open item #1).
- **`behavior_entry`** — daily yes/no record. `behavior_id`, `class_id`,
  `behavior_present` (bool), `entry_date`, optional `comment`, plus a
  **deliberately denormalized `student_id`** (reachable via `behavior_id`, but
  denormalized so report queries group by student/class/date without an extra
  join). Unique (`behavior_id`, `class_id`, `entry_date`); index
  (`student_id`, `entry_date`). No percentage column — % is computed at report time.

### Reports are stored snapshots, not live queries
**`report`** holds a computed snapshot (weekly / 9-week / yearly): `student_id`,
`period_type` enum, `period_start`, `period_end`, `data` (jsonb), `generated_at`.
- Percentage computed at generation time (`yes_count / total_count` over the range).
- **Frozen** into the snapshot, so editing an entry later cannot silently change an
  already-generated report. This is the main reason reports are stored, not live.
- jsonb `data` holds per-subject percentages + an overall percentage; typed by a
  `ReportData` TS interface (`overallPercent` + `perSubject[]` of
  `{ subject, classId, percent, yesCount, totalCount }`).

### Audit log
**`audit_log`** references `user_id` universally: `user_id`, `action` enum
(`create`|`update`|`delete`|`view`|`generate_report`), `target_entity` (string),
`target_id` (uuid, nullable), `created_at`. `target_entity`+`target_id` is a
lightweight polymorphic pointer (not a real FK). Indexed on
(`target_entity`, `target_id`) and (`user_id`, `created_at`).

**Logging policy (FERPA-informed, not legal advice):**
- **Always log writes**: `create`, `update`, `delete`, `generate_report`.
- **Log views conditionally** — only when access crosses a boundary: an admin
  viewing a student, any access where the actor isn't the student's enrolling
  teacher, or bulk/report exports. A teacher opening a student in their own class
  does **not** get a row.
- Rationale: FERPA's logging requirement covers disclosures to third parties, not
  routine legitimate-interest internal access; logging every read would balloon the
  table for little value. If a district later demands full read auditing, send view
  events to an append-only/partitioned store, not the transactional `audit_log`.

---

## Conventions

- One Nest module per resource; entities as `*.entity.ts`; DTOs validated with
  `class-validator`. snake_case API DTOs are camelCase.
- **Column naming: snake_case** in the DB (`auth_subject`, `created_at`). Entity
  files keep camelCase properties; `SnakeNamingStrategy` (from
  `typeorm-naming-strategies`, wired in `app.module.ts`) maps them, so the
  generated entity files stay untouched. API DTOs are camelCase.
- All PKs are `uuid` (`@PrimaryGeneratedColumn('uuid')`).
- Timestamps (`createdAt`/`generatedAt`) use `timestamptz` → JS `Date`. Date-only
  fields (`entryDate`, `periodStart`, `periodEnd`) use Postgres `date` and are
  typed as `string` in TS (correct for TypeORM `date`, not a bug).
- `Class` entity is named `Class` but referenced as `klass` in relation callbacks
  (`class` is reserved); table stays `classes` via `@Entity('classes')`.
- `onDelete`: deleting a `User` cascades to its profile; deleting a `School`
  cascades to students but RESTRICTs teachers/admins; deleting a `Student` cascades
  through behaviors/entries/reports. (See open item #2 re: soft deletes.)
- Entities assume `strictPropertyInitialization: false` (current tsconfig is fine —
  `strict` is off). If strict init is ever enabled, columns need `!`.
- Every data-touching endpoint is scoped to the authenticated user; not-owned
  resources return **404**.
- `synchronize: true` only until the migrations follow-up.

### Unique constraints / indexes
- `user`: unique (`auth_provider`, `auth_subject`) — one OAuth identity per user.
- `teacher`: unique (`user_id`). `administrator`: unique (`user_id`).
- `enrollment`: unique (`class_id`, `student_id`).
- `behavior_entry`: unique (`behavior_id`, `class_id`, `entry_date`); index
  (`student_id`, `entry_date`).
- `report`: index (`student_id`, `period_type`, `period_start`).
- `audit_log`: index (`user_id`, `created_at`) and (`target_entity`, `target_id`).

### Entity files (in `generated_entities/`)
`enums.ts` (UserType, AuthProvider, GoalType, ReportPeriodType, AuditAction),
`user`, `school`, `administrator`, `teacher`, `class`, `student`, `enrollment`,
`behavior`, `behavior-entry`, `report`, `audit-log`.

---

## Build chunks

### Chunk 1 — Local dev setup ✅
docker-compose (postgres:16, named `pgdata` volume, healthcheck); justfile;
`.env`/`.env.example`; ConfigModule + TypeOrmModule wired; global ValidationPipe;
`GET /health` checks DB. **Commit:** `chore: local dev setup`

### Chunk 2 — Identity table + config validation (this PR)
- **Config validation:** Joi `validationSchema` on `ConfigModule.forRoot` so the
  app fails fast at boot. `JWT_SECRET`/`GOOGLE_CLIENT_IDS` strict in prod, relaxed
  when `AUTH_DEV_MODE=true`; `DB_PORT` coerced to `number()`; inline DB defaults in
  `app.module.ts` removed (defaults live in the schema). Dep: `joi`. ✅
- **Identity:** `src/common/enums.ts` (all enums) + `User` entity (`users` table,
  unique `(auth_provider, auth_subject)`). Replaces the old `teacher` entity, which
  is removed. Profile/audit inverse relations deferred. `UserModule` registers +
  exports the repo.
- **Verify:** boot creates `users` table + the `users_usertype_enum` /
  `users_authprovider_enum` Postgres enum types; old `teacher` table dropped.
- **Commit:** `feat: user identity entity + fail-fast env validation`

### Chunk 3 — Auth (login → API JWT + global guard)
Deps `@nestjs/jwt`, `google-auth-library` (Google first; Apple stubbed behind a
provider-agnostic `TokenVerifier`). `AuthService`: `verifyProviderToken` →
`{provider, subject, email?}`; `loginOrCreate` (find-or-create `User` by
`(auth_provider, auth_subject)`); `issueJwt`. `POST /auth/login {provider, idToken}`
→ `{accessToken, user}` (`@Public()`). Global `JwtAuthGuard` (APP_GUARD) reads
Bearer, verifies, loads the user onto `request.user`; `@Public()` bypass;
`@CurrentUser()` param decorator. `GET /me`. **Enable CORS** for the web origin.
- **Frontend:** web uses `@react-oauth/google`; its `GoogleLogin` returns a
  `credential` (Google ID token) sent as `idToken` to `/auth/login`. The verifier
  checks the token `aud` against `GOOGLE_CLIENT_IDS` — must include the web client.
- **Dev hatch:** `AUTH_DEV_MODE=true` → a dev verifier treats `idToken` as the raw
  subject so you can curl `/auth/login` without a real Google token.
- **New-user default (decided):** a first-time login auto-creates the `User` with
  `user_type = teacher` (the lower-privilege role). Promotion to administrator is a
  later admin-driven action, not part of login. School assignment for the new
  teacher is handled in Chunk 4 onboarding.
- **Commit:** `feat: provider id-token exchange for api jwt + global guard`

### Chunk 4 — School + role profiles
`School` entity; `Teacher` + `Administrator` profile entities (one-to-one to
`User`, `school_id` FK, onDelete rules). Re-add the deferred inverse relations on
`User`. Onboarding endpoint(s) to create a profile (teacher belongs-to / admin
manages a school). `@CurrentUser()` resolves to the role profile for scoping.
**Commit:** `feat: schools and teacher/administrator profiles`

### Chunk 5 — Classes CRUD (teacher-scoped)
`Class` entity + module/service/controller + DTOs. `POST/GET/GET:id/PATCH/DELETE
/classes`, scoped to the authenticated teacher profile; 404 if not theirs.
**Commit:** `feat: class crud scoped to authenticated teacher`

### Chunk 6 — Students + Enrollment
`Student` entity (school-scoped) + `Enrollment` join (unique `class_id,student_id`).
`POST /classes/:id/students` (create-on-school + enroll),
`DELETE /classes/:id/students/:studentId` (unenroll), `GET /classes/:id/students`.
Teacher access via enrollment; admin access via school. **Commit:** `feat: students
and class enrollment`

### Chunk 7 — Behaviors (per-student goals)
`Behavior` entity (`goal_type` default `yes_no`). `POST /students/:id/behaviors`,
`GET /students/:id/behaviors`, `PATCH /behaviors/:id`, `DELETE /behaviors/:id`.
Access via the owning student (enrollment/school). **Commit:** `feat: per-student
behavior goals`

### Chunk 8 — Behavior entries (daily yes/no)
`BehaviorEntry` entity (unique `behavior_id,class_id,entry_date`; denormalized
`student_id` from the behavior). `POST /behaviors/:id/entries`,
`GET /behaviors/:id/entries?from=&to=` and/or `GET /students/:id/entries?from=&to=`.
**Open:** duplicate handling — 409 vs upsert. **Commit:** `feat: daily behavior
entries with per-class/day uniqueness`

### Chunk 9 — Reports (computed snapshots)
`Report` entity (`jsonb data`, `ReportData` interface). `POST /students/:id/reports
{periodType, periodStart, periodEnd}` → compute per-subject % (yes/total grouped by
class over range) + overall, store snapshot, return it. `GET /students/:id/reports`,
`GET /reports/:id`. Verify editing an entry afterward does NOT change a stored
snapshot. **Commit:** `feat: generate and store student report snapshots`

### Chunk 10 — Audit log
`AuditLog` entity. Always-log writes (create/update/delete/generate_report) via an
interceptor; conditional view logging (boundary-crossing access only). **Commit:**
`feat: audit log with conditional view logging`

### Follow-up — Migrations
Switch `synchronize: false`, generate the initial migration from the entities, add
`db-migrate` / `db-generate` justfile recipes. Do before any shared/real data.

---

## Open items still to decide
1. **Behavior scope** — currently student-scoped (tracked across all classes). If a
   behavior should be scoped to a single subject/class, move `class_id` onto
   `behavior`.
2. **Soft deletes** — current `onDelete` rules hard-cascade. For a system of record
   holding student SPED data, a `deleted_at` soft-delete column may be safer. Decide
   before launch.
3. **Audit `view` guard** — the conditional-view-logging trigger needs to live in a
   guard/interceptor (enum already supports it).
4. ~~New-user onboarding role~~ **Decided:** first login auto-creates a `teacher`;
   admin promotion is a separate admin action. (School assignment still handled in
   Chunk 4.)

## Verification (per chunk)
`just deps-start`, `just dev`, exercise new endpoints with curl using a Bearer token
from `/auth/login`, confirm rows via `just db-shell`. Restart the Postgres container
to confirm volume persistence. Create a second user to confirm no cross-tenant leaks.
