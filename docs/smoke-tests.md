# Bloom Room API — Manual Smoke Tests

> A living, copy-pasteable checklist of manual API checks, grouped by build chunk.
> Run after `just dev` against the local Dockerized Postgres. **Add cases here as
> each chunk lands an endpoint** (see the convention note in `docs/build-plan.md`).
>
> These are quick manual/curl checks that complement the automated e2e tests
> (`test/*.e2e-spec.ts`, run with `just test-e2e`) — they're the per-chunk "poke
> it by hand" pass. Auth already has full e2e coverage in `test/auth.e2e-spec.ts`.

## Setup

```bash
just deps-start          # start Postgres (skip if already up)
just dev                 # start the API on :8080
BASE=http://localhost:8080
```

Get a dev bearer token (AUTH_DEV_MODE=true lets the idToken be a raw subject):

```bash
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"provider":"google","idToken":"dev-teacher-1"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
```

---

## Chunk 2 — Identity table + config validation

| # | Check | Command | Expect |
|---|-------|---------|--------|
| 2.1 | Health is public + DB up | `curl -s $BASE/health` | `200`, `{"status":"ok","database":"up",...}` |
| 2.2 | Fail-fast on bad env | set `AUTH_DEV_MODE=false` with the short dev `JWT_SECRET`, then `just dev` | boot **fails** with a Joi error naming `JWT_SECRET` (too short) and `GOOGLE_CLIENT_IDS`. Revert after. |
| 2.3 | snake_case schema | `just db-shell` → `\d users` | columns `user_type`, `auth_provider`, `auth_subject`, `created_at`; unique `uq_user_auth_identity` |

---

## Chunk 3 — Auth (login → API JWT + global guard)

| # | Check | Command | Expect |
|---|-------|---------|--------|
| 3.1 | Login (dev subject) | `curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"provider":"google","idToken":"dev-teacher-1"}'` | `200`, `{accessToken, user}`; `user.userType == "teacher"`, `firstName == "Dev"`, `lastName == "dev-teacher-1"` |
| 3.1b | Login with dev name override | same as 3.1 but `"idToken":"dev-teacher-1|Jane|Doe"` | `user.firstName == "Jane"`, `user.lastName == "Doe"` |
| 3.2 | `/me` with token | `curl -s $BASE/me -H "Authorization: Bearer $TOKEN"` | `200`, the same user object |
| 3.3 | `/me` without token | `curl -s -o /dev/null -w '%{http_code}' $BASE/me` | `401` |
| 3.4 | `/me` with garbage token | `curl -s -o /dev/null -w '%{http_code}' $BASE/me -H "Authorization: Bearer not.a.real.token"` | `401` |
| 3.5 | Find-or-create (no dup) | run 3.1 twice, compare `user.id` | identical id; `SELECT count(*) FROM users` unchanged |
| 3.6 | DTO validation | `curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"provider":"google"}'` | `400` (missing `idToken`) |
| 3.7 | Real Google login (web auth-code) | with `GOOGLE_WEB_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set, sign in via the `bloom-room-web` login page (posts `{provider:'google', code}`) | `200`; API exchanges the code, then `user.authSubject` is the Google `sub`, and `user.email`/`firstName`/`lastName` are populated from the token |
| 3.8 | Exactly-one credential | `curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"provider":"google"}'` (neither) and again with both `idToken` and `code` | `400` in both cases |

### Cross-tenant / persistence (run periodically)
- Log in as a second subject (`dev-teacher-2`) → distinct `user.id`; first user's data never leaks.
- Restart the Postgres container (`just deps-stop && just deps-start`) → users still present (volume persistence).

---

## Chunk 5 — Classes CRUD (teacher-scoped)

Assumes `$BASE` and `$TOKEN` from Setup (a `dev-teacher-1` token). A teacher
profile is created lazily on the first `/classes` call — no onboarding needed.

```bash
# 5.1 Create a class (201). teacherId is derived from auth, never the body.
CID=$(curl -s -X POST $BASE/classes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Sunflower Room","gradeLevel":"Grade 2","subject":"Rm 104","period":"Mon-Thu · 9:30 AM","color":"sage"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "created class $CID"
```

| # | Check | Command | Expect |
|---|-------|---------|--------|
| 5.1 | Create class | (above) | `201`, body has `id`, `teacherId`, `color":"sage"` |
| 5.2 | Color defaults to coral | `curl -s -X POST $BASE/classes -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"subject":"Rm 104","period":"Daily"}'` | `201`; `color":"coral"`, `name`/`gradeLevel` null |
| 5.3 | teacherId in body ignored | add `"teacherId":"00000000-0000-0000-0000-000000000000"` to a create body | `201`; returned `teacherId` is **not** the supplied uuid |
| 5.4 | Missing required field | `curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/classes -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"subject":"Rm 104"}'` | `400` (no `period`) |
| 5.5 | Invalid color | create body with `"color":"turquoise"` | `400` |
| 5.6 | List my classes | `curl -s $BASE/classes -H "Authorization: Bearer $TOKEN"` | `200`, array of only this teacher's classes |
| 5.7 | Get one | `curl -s $BASE/classes/$CID -H "Authorization: Bearer $TOKEN"` | `200`, that class |
| 5.8 | Get non-uuid id | `curl -s -o /dev/null -w '%{http_code}' $BASE/classes/not-a-uuid -H "Authorization: Bearer $TOKEN"` | `400` |
| 5.9 | Patch subset | `curl -s -X PATCH $BASE/classes/$CID -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Renamed","color":"plum"}'` | `200`; `name`/`color` updated, `subject` unchanged |
| 5.10 | Delete | `curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/classes/$CID -H "Authorization: Bearer $TOKEN"` | `204`; a follow-up GET returns `404` |
| 5.11 | Auth required | `curl -s -o /dev/null -w '%{http_code}' $BASE/classes` | `401` |

### Cross-tenant (the 404-not-403 rule)
Get a second token `TOKEN2=$(... idToken:"dev-teacher-2" ...)`, then with a `$CID`
owned by `dev-teacher-1`:
- `GET /classes/$CID`, `PATCH /classes/$CID`, `DELETE /classes/$CID` as `TOKEN2` → **404** (never 403, so existence isn't leaked).
- `GET /classes` as `TOKEN2` → does not include `dev-teacher-1`'s classes.
