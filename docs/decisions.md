# Architecture Decisions Log — pranishadhikari.com

Owner of this log: Software Architect agent. Scope: repo structure, content collection
schemas, and any decision that shapes how the site is built, hosted, or edited.

Format per entry: **Decision — Rationale (one line) — Trade-off (one line)**.

Status markers used throughout: `[VERIFY]` = real-world fact pending from Pranish.
`[P1]` = deferred past v1 per PRD Section 5. `[NEEDS APPROVAL]` = dependency requiring
Pranish's explicit sign-off before any dev agent installs it (per CLAUDE.md "ask before
adding dependencies").

This log reflects Pranish's resolved answers to the PRD's 10 open questions (2026-10-15).
Those answers are treated as final decisions, not open items, per the brief that produced
this log.

---

## 1. Repo structure

**Decision:** Single Astro project at repo root, static output, GitHub Pages deploy from
the `main` branch (or a `gh-pages` output branch via Actions — qa-devops owns the exact
CI mechanics). Proposed top-level layout:

```
/
├── astro.config.mjs
├── package.json
├── public/                  # static assets (favicon, robots.txt, images not processed by Astro)
├── src/
│   ├── content.config.ts    # content collection schema definitions (Zod) — see Decision 13; this
│   │                        # sketch's `content/config.ts` path is superseded, kept for history only
│   ├── content/
│   │   ├── profile/         # single-entry "about/bio" collection (see content-schema.md)
│   │   ├── projects/        # one .md file per project
│   │   ├── blog/            # one .md file per post
│   │   ├── skills/          # one .md file per skill (or single data file — see schema doc)
│   │   ├── certifications/  # one .md file per certification
│   │   └── socials/         # one .md file per social/contact link
│   ├── layouts/
│   ├── components/
│   └── pages/
│       ├── index.astro
│       ├── about.astro
│       ├── projects/
│       │   ├── index.astro
│       │   └── [slug].astro
│       └── blog/
│           ├── index.astro
│           └── [slug].astro
├── public/admin/             # Sveltia CMS static bundle + config.yml (cms-dev owns)
└── docs/
    ├── PRD.md
    ├── decisions.md
    └── content-schema.md
```

- Rationale: Astro's default convention (`src/content/*`) is what Astro Content
  Collections expects out of the box; deviating would add config complexity for no gain.
- Trade-off: `src/content/<collection>/` per-file-per-entry is slightly more files to
  manage than one big JSON/YAML data file per collection, but it's what Sveltia CMS and
  Astro collections are both designed around, and it keeps diffs small and reviewable in
  the public repo.
- No `settings` collection/folder is created in v1 (see Decision 9 below) — not listed
  above on purpose.
- There is deliberately no `ctf/`, `hackme/`, or similarly named folder, route, or
  collection anywhere in this structure. This is a direct requirement from PRD Section 3,
  not an oversight.

## 2. Why Astro + Markdown content collections

**Decision:** Use Astro's built-in Content Collections feature (schema-validated
frontmatter via Zod) as the sole content layer; no headless CMS API, no database.

- Rationale: Astro ships static HTML to GitHub Pages (satisfies "free tier only, no
  servers, no databases"), and Content Collections give build-time schema validation —
  a malformed CMS edit fails the build loudly instead of shipping broken content (PRD
  US-8, AC2).
- Trade-off: Content changes require a git commit + a full static rebuild (via GitHub
  Pages/Actions) rather than an instant database write — publishing a CMS edit takes
  roughly the length of a CI build (seconds to low minutes), not real-time. Acceptable
  for a portfolio/blog cadence.

## 3. Why Sveltia CMS + Cloudflare Worker OAuth + Cloudflare Access at `/admin`

**Decision:** Sveltia CMS (a static, client-side, git-backed CMS) served at `/admin`,
authenticating to GitHub via a Cloudflare Worker that performs the OAuth code exchange,
with Cloudflare Access gating the `/admin` route before Sveltia even loads.

- Rationale: Sveltia CMS writes Markdown files directly to the GitHub repo via the
  GitHub API — no custom backend, no database, satisfying CLAUDE.md's "no servers, no
  databases" while still giving Pranish a non-technical editing UI (PRD US-6, US-7).
- Trade-off: The OAuth client secret must live *somewhere* server-side to complete the
  GitHub OAuth code exchange (GitHub's OAuth flow requires a confidential client for the
  token exchange step) — a static site alone cannot do this. A Cloudflare Worker is the
  minimal-footprint way to hold that secret outside the repo (as a Worker secret, never
  committed) while staying on Cloudflare's free tier. This is the one place the
  architecture needs more than "pure static files + GitHub Pages," and it's called out
  explicitly in Section 7 below as a flag, even though it's already named in CLAUDE.md
  and therefore pre-approved by Pranish.
- Cloudflare Access in front of `/admin` is a second, independent gate (PRD US-6, AC1):
  even if someone reached the Sveltia bundle, Access blocks the request before OAuth is
  ever attempted. This is defense in depth, not redundant — the Worker secret protects
  the OAuth exchange; Access protects the route itself.
- No raw HTML permitted: Sveltia's field widgets (markdown, string, select, list,
  datetime, etc.) are configured to exclude any "raw HTML" or iframe-style widget, and
  Astro's Markdown renderer is configured without `dangerouslySetInnerHTML`/raw passthrough.
  This is enforced in two places (CMS config.yml field types + content collection schema)
  so a bypass at one layer is still caught at the other.

## 4. Why no contact form / no Turnstile in v1

**Decision:** v1 ships with `mailto:` and social profile links only. No backend contact
form, no Turnstile widget, no serverless function to receive submissions.

- Rationale: Pranish's decision (resolved open question #4) — a Turnstile-protected form
  needs a destination (an email to forward to, or a form-processing endpoint), which
  Pranish hasn't specified yet; shipping a form with nowhere for submissions to go is
  worse than no form. `mailto:`/social links need zero new infrastructure and work today.
- Trade-off: Slightly higher friction for a visitor who doesn't have a local mail client
  configured (a known mailto: weakness), versus an in-page form. Deferred to P1 and
  explicitly **not** to be built or stubbed now — including no placeholder Turnstile
  site key, no hidden form route, no unused `socials`-adjacent "contact form" schema
  fields. When Pranish supplies a destination address, this becomes a scoped P1 task of
  its own.

## 5. Why no analytics in v1

**Decision:** Zero analytics dependency — no Plausible/Fathom/GoatCounter/GA, no
beacon script, no analytics config anywhere in the codebase for v1.

- Rationale: Pranish's decision (resolved open question #8) — explicitly skip analytics
  entirely for v1. Every analytics option considered either costs money past a free
  tier at scale, requires a third-party script (a "paid service" risk per CLAUDE.md even
  if free-tier today), or adds a privacy/consent surface not worth it for a v1 portfolio.
- Trade-off: Pranish has no visibility into traffic/referrers at launch. Explicitly
  listed as PRD P1 item #11 ("if Pranish wants visibility into traffic") — can be revisited
  post-launch as its own decision, not assumed now.

## 6. Branding / design direction

**Decision:** No existing logo or palette (resolved open question #7) — frontend-dev
should start from a clean, minimal, swappable placeholder direction: a neutral base
(e.g., near-black/near-white with a single accent color suited to a cybersecurity
portfolio — think terminal-green, slate-blue, or similar), system/sans font stack, no
custom logo mark (text wordmark "Pranish Adhikari" is enough for v1).
- Rationale: A placeholder-but-intentional palette avoids shipping literal lorem-ipsum
  visuals (PRD US-1 AC3 forbids placeholder *content*, and sloppy unthemed design reads
  the same way to a recruiter) while not over-investing in brand work Pranish hasn't
  asked for.
- Trade-off: Will likely need a revisit once/if Pranish wants a distinct visual identity;
  by keeping colors as design tokens (CSS custom properties) rather than hardcoded
  values scattered through components, that revisit is a token-swap, not a rebuild. This
  is a recommendation to frontend-dev, not a schema requirement.

## 7. CMS editor scope for v1

> **[SUPERSEDED by Decision 12 / D2, 2026-10-16]** — the "exactly three collections" cap
> below no longer holds. Pranish approved a fourth collection, `hobby`, with thumbnail
> fields. See Decision 12 for the current scope. This entry is left intact for history;
> do not treat the "three collections" language as current.

**Decision:** Sveltia CMS at `/admin` exposes exactly three collections in v1: **blog
posts**, **projects**, and **About/bio fields** (the `profile` collection). No nav-label
editing, no site-wide `settings` collection, in v1.
- Rationale: Pranish's decision (resolved open question #9) — matches PRD US-7 AC1
  exactly ("blog posts, projects, and About/bio fields"); keeping the CMS scope narrow
  reduces the chance of a bad edit breaking something structural (nav, routing) that
  isn't meant to be content-editable.
- Trade-off: Things like nav labels, site title, or footer text are hardcoded in Astro
  components/layouts for v1, meaning a wording change there requires a code edit + PR,
  not a CMS edit. A `settings` collection is designed in content-schema.md as a *reserved,
  not-yet-wired* shape so it's easy to add later without a breaking schema migration, but
  it must not be built, registered in Astro's `config.ts`, or exposed in Sveltia's
  `config.yml` in v1 — that would silently expand CMS scope beyond what Pranish approved.

## 8. [VERIFY] placeholder strategy (bio, projects, blog)

**Decision:** Content schemas for `profile`, `projects`, and `blog` must accept entries
where factual fields are literally the string `"[VERIFY]"` (or an array/object containing
it) at the schema level, without failing Astro's build — but the *site build/deploy
pipeline* (qa-devops's concern, flagged here for visibility) should be able to warn or
block *production* publication of any entry still containing `[VERIFY]`, per PRD's Done
Criteria ("zero [VERIFY] markers remain in published content").
- Rationale: Pranish's bio, projects, and blog content are all still pending (resolved
  open questions #1–#3: real facts, real projects, and real posts are all TBD) — the
  schema must let frontend-dev and cms-dev build and test the full site today against
  realistic-shaped placeholder data, without that placeholder data being mistaken for
  real, ready-to-publish content.
- Trade-off: `[VERIFY]` as a plain string sentinel (rather than a separate `verified:
  boolean` field) is simpler to author in the CMS and to grep for, but relies on
  discipline (a lint/CI check, not a schema constraint) to actually block publish — a
  schema alone cannot enforce "this specific string is forbidden in production" without
  also forbidding it from ever being entered, which would break the placeholder workflow
  entirely. See content-schema.md for the exact mechanism, and qa-devops should own a
  CI grep/lint check for `[VERIFY]` before any production deploy.
- The blog index must also render cleanly with **zero** entries (PRD US-4 AC2) — this is
  a frontend/template concern, not a schema one, but it constrains the schema: `blog`
  must be allowed to be an empty collection, so nothing in the schema (e.g., no "at least
  one post" invariant) may require a minimum entry count.

## 9. Repo visibility

**Decision:** Repo stays public, per CLAUDE.md and Pranish's confirmation (resolved open
question #5).
- Rationale: GitHub Pages' free tier for a custom domain with HTTPS effectively requires
  a public repo (private repo + custom domain + free Pages has historically been
  restricted/paid); public also matches "demonstrate competence" portfolio goals (PRD
  Section 1).
- Trade-off: Nothing content- or secret-related can ever be committed assuming privacy —
  this is already CLAUDE.md's "no secrets in the repo, ever" rule, restated here because
  it directly shapes where the OAuth secret must live (Decision 3: in the Worker, never
  in the repo).

## 10. Domain/DNS

**Decision:** Treated as out of this project's scope to configure or verify. Assumed
state per Pranish (resolved open question #6): `pranishadhikari.com` is already
registered and on Cloudflare.
- Rationale: Pranish explicitly scoped this as his own task, not something architect/dev
  agents need to verify or touch; no architectural decision here depends on *how* the
  zone was configured, only that HTTPS + proxy + Access will be available in front of
  GitHub Pages when it's time to point the domain at it.
- Trade-off: If that assumption turns out to be wrong at deploy time, qa-devops's launch
  checklist will surface it then — not a reason to block schema/structure work now.

## 11. Launch timeline

**Decision:** No fixed deadline (resolved open question #10) — sequencing follows PRD
Section 5 priority (P0 before P1) rather than a date-driven cutline.
- Rationale: Nothing to rush or cut; P0 items ship when genuinely done (including real
  content replacing [VERIFY]), not on a schedule.
- Trade-off: Without a deadline there's no external forcing function — worth the team
  periodically checking in on progress rather than assuming "no deadline" means "no
  urgency" forever.

---

## Flagged: anything that would add a server, database, or paid service

Per CLAUDE.md ("free tier only, no servers, no databases") and this agent's explicit
instruction to stop and flag rather than decide unilaterally, here is every point in this
log that touches infrastructure beyond plain static files, with a verdict:

| Item | Verdict | Why it's not a violation |
|---|---|---|
| Cloudflare Worker for OAuth token exchange | **Not flagged as new** — already named explicitly in CLAUDE.md ("Sveltia CMS at /admin, GitHub OAuth via a Cloudflare Worker"). Noted in Decision 3 for transparency, but this is pre-approved infrastructure, not an architect proposal. | Workers free tier; no persistent data store, purely a stateless token-exchange relay. |
| Cloudflare Access | **Not flagged as new** — already named in CLAUDE.md. | Free tier covers low seat counts (Pranish is the only user). |
| Cloudflare Turnstile | **Not flagged** but currently **unused** — named in CLAUDE.md as a constraint/capability, but Decision 4 explicitly defers any actual contact-form integration to P1, pending a destination address from Pranish. No Turnstile code, key, or stub exists in v1. | N/A — nothing built yet. |
| GitHub Pages | **Not flagged** — free static hosting, explicitly the chosen host in CLAUDE.md. | No server-side compute. |
| Any analytics service (Plausible, GA, etc.) | **Explicitly rejected for v1** (Decision 5) — not added. | N/A |
| A contact-form backend / serverless function to receive submissions | **Explicitly rejected for v1** (Decision 4) — not added, not stubbed. | N/A |
| A `settings`/site-config database or headless-CMS API | **Explicitly rejected** — content lives in Markdown + frontmatter in the repo, not an external store. | N/A |

**No new server, database, or paid service is being introduced by this architecture
beyond what CLAUDE.md already names (Cloudflare Worker, Access, Turnstile — and Turnstile
remains unused in v1).** If any future request pushes toward e.g. a form backend, a
database-backed comments system, or a paid analytics/CMS tier, that must come back to
Pranish as an explicit decision, not be assumed by any dev agent.

---

## Dependency recommendations requiring Pranish's approval

Per CLAUDE.md ("ask before adding dependencies"), this agent has not added any
dependency and has not written any code/config. The following are **recommendations
only**, for frontend-dev/cms-dev to raise with Pranish before installing:

1. **`@astrojs/sitemap`** (or equivalent) — for the P1 "basic SEO" backlog item. Not
   needed for v1 structure/schema work. No decision needed yet.
2. **A syntax-highlighting integration for code blocks in blog posts** (PRD US-5 AC3) —
   Astro ships Shiki built into its Markdown renderer by default, so this likely needs
   **no new dependency at all**; frontend-dev should confirm default Shiki output meets
   the bar before proposing anything additional.
3. **Sveltia CMS itself** — not an npm dependency of the Astro build (it's a static
   bundle served from `/admin` per its own setup method), but cms-dev should confirm with
   Pranish how it's vendored (CDN script tag vs. self-hosted static files in `public/`)
   since that choice affects the repo structure in Section 1 slightly.

None of the above are required to finalize repo structure or content schemas, and none
are assumed or installed by this log.

---

## 12. Phase 0 decisions — v2 plan (2026-10-16)

Source: Pranish's answers to D1–D5 in `docs/portfolio-v2-plan.md` Section 2, given
2026-10-16. Logged here per that plan's Phase 0 output requirement. No code or config
has been changed by this entry — these are decisions to be carried out by the relevant
dev agents in Phases 1–3 of that plan.

**D1 — Static vs. database: Option A (stay static).**
- **Decision:** Confirmed. No database, no Supabase/Neon, no Vercel/Cloudflare function
  for content storage. Sveltia CMS continues writing Markdown/images straight to the
  GitHub repo; GitHub Pages rebuilds on each save.
- Rationale: Matches CLAUDE.md's "no servers, no databases" and the free-tier
  constraint; the static path is already built and partly configured.
- Trade-off: Publishing a CMS edit still takes the length of a build (seconds to low
  minutes), and the site cannot hold per-visitor state. Per the plan, this is to be
  revisited only when the CTF/Hack Me project starts — not before, and not as part of
  this build.

**D2 — New `hobby` CMS collection with thumbnails: approved. Supersedes Decision 7.**
- **Decision:** The CMS scope cap in Decision 7 ("exactly three collections: blog,
  projects, profile") is superseded. Sveltia CMS now exposes **four** collections in v1:
  `blog`, `projects`, `profile`, and the new `hobby` collection. `projects` and `blog`
  also gain thumbnail fields (`thumbnail`, `thumbnailAlt`), per the v2 plan Section 3.
- Rationale: Pranish's explicit answer to D2 ("yes") — hobby sites (mostly Vercel
  projects) and thumbnails for projects/blog are things he wants editable from `/admin`.
- Trade-off: Same risk Decision 7 was originally guarding against — a bad CMS edit can
  now touch one more collection and two more fields on existing ones. No nav-label or
  `settings` collection editing is added; that part of Decision 7 still stands.
- Exact field shape for `hobby` is D5, below, not this entry.

**D3 — Repo name and GitHub login: confirmed.**
- **Decision:** The repo is `pranishAD/pranishadhikari.com`; the GitHub login for OAuth
  and commits is `pranishAD`. This resolves the `[VERIFY]` markers currently in
  `public/admin/config.yml` and `worker/wrangler.toml` on this point.
- Rationale: Direct confirmation from Pranish.
- Trade-off: None — this was a verification gap, not a design choice. The two `[VERIFY]`
  markers in `public/admin/config.yml` and `worker/wrangler.toml` were updated to reflect
  this confirmation in Phase 1 (2026-10-16) — see Decision 14. The `base_url` (Worker URL)
  and `GITHUB_CLIENT_ID` placeholders in those same files are untouched; they depend on
  the Worker deploy and OAuth App creation, not on this decision.

**D4 — CMS publish mode: keep `simple`.**
- **Decision:** Confirmed — Sveltia CMS stays on `publish_mode: simple`. Every save goes
  straight to `main` with no PR/review step. The editorial-workflow alternative (saves
  become pull requests) was offered and declined.
- Rationale: Pranish is the sole editor; a review step would add friction with no second
  reviewer to gate it.
- Trade-off: Unreviewed saves reach production immediately — this was already flagged as
  a risk in the v2 plan (Section 6) and is unchanged by this decision, just confirmed
  rather than left open.

**D5 — Hobby collection fields: links + thumbnail + description.**
- **Decision:** The `hobby` collection (added under D2) holds, per entry: a URL
  (the hobby/Vercel site link), a thumbnail image + alt text, and a one-line description.
  This is Pranish's literal answer and is **narrower** than the field list the v2 plan
  sketched in Section 3 (`name`, `description`, `url`, `thumbnail`, `thumbnailAlt`,
  `order`, `featured`, `verified`).
- Rationale: Confirmed scope should be exactly what was asked, not the plan's superset.
- Trade-off / open point: `name`, `order`, `featured`, and `verified` from the plan's
  Section 3 sketch are **not yet approved** — they are not part of this decision.
  cms-dev/architect should not add them to the `hobby` schema without going back to
  Pranish, the same discipline Decision 7/9 already apply elsewhere in this log. If a
  site needs a display name distinct from its URL, that's a follow-up question, not an
  assumption to make now.

---

## 13. Content config file location: `src/content.config.ts`, not `src/content/config.ts`

**Decision:** The real, build-required location is `src/content.config.ts` (repo root of
`src/`), as the repo already has it. Section 1's tree above is corrected to match. The
`src/content/config.ts` path this log originally sketched is the **older** Astro
convention and is superseded — **no file move was made**, since the correct file already
exists and is already wired up; this entry only reconciles the documentation with it.

- Rationale: The installed Astro version in this repo is 7.3.8 (confirmed via
  `node_modules/astro/package.json` during the Phase 1 foundation check, 2026-10-16).
  Astro removed the legacy `src/content/config.ts` collection-config format; collections
  must be declared in `src/content.config.ts` using an explicit loader (see
  `https://docs.astro.build/en/reference/errors/legacy-content-config-error/`, and the
  in-file comment at the top of `src/content.config.ts` itself, which already flagged
  this exact discrepancy for architect/decisions.md). The file that exists uses
  `glob()` loaders over `src/content/<name>/` per collection, which still matches every
  collection name, folder path, and schema this log and `content-schema.md` specify —
  only the one config file's own location/format changed, not the content layout.
- Trade-off: None identified. This is a correction to stale documentation, not a design
  trade-off — the repo was already right; the docs were describing an Astro version
  older than what's installed.
- Scope note: Per the Phase 1 brief this came from, this is a recommendation only — no
  schema, collection, or dependency was changed to produce it, and nothing was moved.

## 14. Phase 1 foundation check results (2026-10-16)

**Decision:** Phase 1 ("foundation check") from `docs/portfolio-v2-plan.md` is complete
for the three items in scope. Record of what was verified/changed, for anyone picking up
Phase 2:

- **Build status: PASS.** `npm install` (184 packages, 0 vulnerabilities) and
  `npm run build` both completed cleanly on Node v24.21.0 / npm 11.19.0 — 7 pages built in
  ~3s, no warnings or errors emitted by Astro or the content-collection sync step.
- **Content config location:** reconciled, not moved — see Decision 13.
- **`[VERIFY]` repo-name markers:** replaced. `public/admin/config.yml`'s `repo:` field
  and `worker/wrangler.toml`'s `ALLOWED_GITHUB_USERNAME` already held the correct values
  (`pranishAD/pranishadhikari.com` and `pranishAD`) — only the surrounding `[VERIFY]`
  comments, which marked them as unconfirmed inferences, were updated to record Pranish's
  confirmation (D3, Decision 12). The actual `repo:`/`ALLOWED_GITHUB_USERNAME` values were
  not changed, since they were already correct.
- **Explicitly untouched, per this phase's scope:** `base_url` (Worker URL placeholder)
  and `GITHUB_CLIENT_ID` in both files remain `[VERIFY]`/placeholder — they depend on
  deploying the Worker and creating the GitHub OAuth App, which are manual steps for
  Pranish (see `worker/README.md`), not something this phase or decision resolves. No
  schema changed, no collection added, no dependency added.
- Rationale: Matches the Phase 1 brief exactly — confirm the build is healthy and close
  out the two documentation/config discrepancies the v2 plan flagged, without touching
  anything the plan scoped to later phases (schemas → Phase 3, admin wiring/deploy →
  Phase 2).
- Trade-off: None — this phase was verification and doc/comment reconciliation only.

---
