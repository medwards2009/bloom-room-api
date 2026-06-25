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
| 3.1 | Login (dev subject) | `curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"provider":"google","idToken":"dev-teacher-1"}'` | `200`, `{accessToken, user}`; `user.userType == "teacher"` |
| 3.2 | `/me` with token | `curl -s $BASE/me -H "Authorization: Bearer $TOKEN"` | `200`, the same user object |
| 3.3 | `/me` without token | `curl -s -o /dev/null -w '%{http_code}' $BASE/me` | `401` |
| 3.4 | `/me` with garbage token | `curl -s -o /dev/null -w '%{http_code}' $BASE/me -H "Authorization: Bearer not.a.real.token"` | `401` |
| 3.5 | Find-or-create (no dup) | run 3.1 twice, compare `user.id` | identical id; `SELECT count(*) FROM users` unchanged |
| 3.6 | DTO validation | `curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"provider":"google"}'` | `400` (missing `idToken`) |
| 3.7 | Real Google token (web) | sign in via the `bloom-room-web` login page | `200`; `user.authSubject` is the Google `sub`, `user.email` populated |

### Cross-tenant / persistence (run periodically)
- Log in as a second subject (`dev-teacher-2`) → distinct `user.id`; first user's data never leaks.
- Restart the Postgres container (`just deps-stop && just deps-start`) → users still present (volume persistence).
