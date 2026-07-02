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
