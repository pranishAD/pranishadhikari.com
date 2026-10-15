# CMS OAuth Worker

Cloudflare Worker that performs the GitHub OAuth "authorization code" token
exchange for Sveltia CMS at `/admin`. It is a stateless relay: no database,
no persistent storage, nothing beyond the token-exchange request/response.
See `oauth-worker.js` for the full protocol and inline documentation.

## Why this exists

A static site can't hold a GitHub OAuth App's client secret, but GitHub's
OAuth flow requires a confidential server-side step to trade a one-time
`code` for an access token. This Worker is that one step. It's named
explicitly in `CLAUDE.md` ("Sveltia CMS at /admin, GitHub OAuth via a
Cloudflare Worker") and in `docs/decisions.md` Section 3 as pre-approved
infrastructure — it is not a new dependency.

## Files

- `oauth-worker.js` — the Worker script (routes: `GET /auth`, `GET /callback`).
- `wrangler.toml` — deploy config. Contains only non-secret variables.

## One-time setup (Pranish's manual tasks)

These steps happen outside this repo and cannot be done by a coding agent.
Treat every item below as **[VERIFY] / Pranish's manual task**.

1. **Create a GitHub OAuth App** at
   https://github.com/settings/developers → "New OAuth App", on the
   account that owns `pranishAD/pranish-portfolio` (confirm exact
   owner/repo — see the `[VERIFY]` note in `public/admin/config.yml`).
   - Homepage URL: `https://pranishadhikari.com`
   - Authorization callback URL: `https://<your-worker-subdomain>.workers.dev/callback`
     (get the real Worker subdomain after your first `wrangler deploy`,
     then update the OAuth App's callback URL to match exactly).
   - Copy the generated **Client ID** and **Client Secret**.

2. **Deploy the Worker:**
   ```sh
   cd worker
   wrangler deploy
   ```
   This creates the Worker at `https://pranishadhikari-cms-oauth.<your-subdomain>.workers.dev`.

3. **Set the OAuth App's Client ID** in `wrangler.toml` under `[vars]`
   (`GITHUB_CLIENT_ID`) — this is a public identifier, not a secret, so it
   is fine to commit. Redeploy after changing it.

4. **Set the Client Secret as an encrypted Worker secret** — never in any
   file in this repo:
   ```sh
   cd worker
   wrangler secret put GITHUB_CLIENT_SECRET
   ```
   Paste the secret from step 1 when prompted. Wrangler stores it
   encrypted in Cloudflare; it never touches git.

5. **Confirm `ALLOWED_GITHUB_USERNAME` in `wrangler.toml`** matches
   Pranish's actual GitHub login. The current value (`pranishAD`) was
   inferred from this repo's local git noreply address and must be
   confirmed, not trusted blindly.

6. **Set `backend.base_url` in `public/admin/config.yml`** to the deployed
   Worker URL from step 2.

7. **Set up Cloudflare Access on `/admin`** (Pranish's own Cloudflare
   dashboard config — not something committed to this repo, and not
   something a coding agent can configure from code):
   - In the Cloudflare dashboard for `pranishadhikari.com`: Zero Trust →
     Access → Applications → add an application covering
     `pranishadhikari.com/admin*`.
   - Add a policy that allows **only Pranish's own identity** (e.g. his
     GitHub login, or whichever identity provider Pranish signs in with —
     email OTP, Google, GitHub, etc., all free-tier for a single user) —
     "Allow" rule scoped to his specific email/identity, not "Allow
     everyone" or a broad domain rule.
   - This is a second, independent gate in front of the whole `/admin`
     route (per `docs/decisions.md` Section 3): even if someone reached
     `index.html`/`sveltia-cms.js`, Access blocks the HTTP request before
     Sveltia CMS or this Worker is ever reached.

## How "only Pranish can edit" is enforced

Three independent layers (defense in depth — any one of them failing
doesn't expose editing):

1. **Cloudflare Access** in front of `/admin` (step 7 above) — blocks the
   request before the CMS even loads. This is Pranish's manual dashboard
   task; it cannot be verified or configured from this codebase.
2. **This Worker's `/callback` handler** (`oauth-worker.js`) checks the
   authenticated GitHub user's `login` against `env.ALLOWED_GITHUB_USERNAME`
   and refuses to hand back a token — i.e. refuses to let the CMS UI ever
   reach a "signed in" state — for any other GitHub account, even one
   that completed GitHub's own OAuth consent screen.
3. **GitHub repo permissions** — Sveltia CMS's actual commit/write calls go
   through the GitHub REST API using the returned token, scoped to the
   `repo` OAuth scope. Only accounts with write/admin access to
   `pranishAD/pranish-portfolio` can successfully commit regardless of
   whether they got a token, so even a misconfiguration in (2) would still
   be caught here by GitHub itself.

## Secret-safety self-check

No client secret, access token, or credential literal value appears in
`oauth-worker.js`, `wrangler.toml`, or this README. `GITHUB_CLIENT_SECRET`
is referenced only by name (`env.GITHUB_CLIENT_SECRET`) and is documented
as a `wrangler secret put` value, never a literal in any file.
