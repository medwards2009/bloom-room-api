# Future Needs

Deferred work we've consciously chosen not to do yet. Not a bug list and not the
build plan — this is "we know we'll need this eventually." Add items here as they
come up; promote to the build plan / an issue when it's time to build them.

## Auth / sessions

**Handle sessions eventually.** Login currently returns a stateless, self-contained
JWT that lives for 7 days (`JWT_EXPIRES_IN`); there is no server-side session. That's
fine for now, but it means:

- **No logout / revocation** — a token can't be invalidated before it expires
  (short of rotating `JWT_SECRET`, which kills every token).
- **No refresh** — after 7 days the user must re-run the Google login; no silent
  refresh / "stay signed in".

When we need real session control, options include a refresh-token flow and/or a
token-version / blocklist mechanism (e.g. a `token_version` column on `user`, bumped
to revoke). Decide the approach when the product actually needs logout or long-lived
sign-in.

## Testing

**Cover `GoogleTokenVerifier` directly.** The e2e suite runs with `AUTH_DEV_MODE=true`
(`.env.test`), so every case goes through `DevTokenVerifier` and the dot-less dev
subjects never reach the real verifier. That leaves the most security-sensitive file
in the auth chunk with no automated coverage: the audience check against
`GOOGLE_CLIENT_IDS`, the auth-code `exchangeCode` path, the `payload.sub` guard, and
the missing-name rejection are all unexercised. A `.spec.ts` injecting a fake
`OAuth2Client` would cover them without network — worth doing before we depend on
Google's payload shape any harder. (Would also give `just test` a reason to exist
again; the recipe is commented out in the justfile until then.)

**Derive the e2e DB connection from the app's config.** `test/utils/e2e.ts` builds its
admin connection from raw `process.env` with its own defaults, and takes the test DB
name from `TEST_DB_NAME ?? 'bloom_room_test'` — while the app under test gets its
connection from `.env.test` via Joi. Two sources of truth: change `DB_NAME` in
`.env.test` and `ensureTestDatabase()` creates the wrong database, and a stray `DB_*`
exported in a developer's shell would be honoured by the harness but overridden by
`.env.test` in the app (the 28P01 shell-leak class of bug). Read both from the same
validated config.

## Deployment / secrets

**Provision real secrets in the deploy namespace.** Config today comes from a local,
gitignored `.env`. When this app is deployed, the following must be supplied as
managed secrets in the target namespace (e.g. Kubernetes Secrets), *not* baked into
an image or committed:

- `JWT_SECRET` — a strong, random value (the Joi schema requires ≥32 chars once
  `AUTH_DEV_MODE` is off).
- `GOOGLE_CLIENT_IDS` — the allowed OAuth client id(s); required when
  `AUTH_DEV_MODE` is off.
- `GOOGLE_WEB_CLIENT_ID` — the web OAuth client id used for the auth-code exchange
  (must be one of `GOOGLE_CLIENT_IDS`).
- `GOOGLE_CLIENT_SECRET` — the web client secret for the code exchange; lives ONLY
  on the API, never in the web app.
- `DB_PASSWORD` (and the rest of `DB_*` as appropriate for the managed database).

Also for production, not dev-only:
- Set `AUTH_DEV_MODE=false` (or unset) so the strict validation + real Google
  verification are enforced — the dev token verifier must never run in prod.
- Lock CORS to an explicit allow-list of the real web origin(s) instead of the
  current `origin: true` (see the note in `src/main.ts`).
