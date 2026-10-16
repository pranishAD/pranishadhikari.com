# Portfolio v2 Plan: pranishadhikari.com

Date: 2026-10-16
Status: Draft. Needs Pranish's decisions in Section 2 before build work starts.
Repo: local scaffold at `pranish-portfolio/` (one commit, "Initial portfolio scaffold"). Builds with Astro. Existing docs: `CLAUDE.md`, `docs/PRD.md`, `docs/decisions.md`, `docs/content-schema.md`.

---

## 1. Your asks vs. what is already decided

| Ask | Current state in repo | Status |
|---|---|---|
| Admin panel to edit content | Sveltia CMS at `/admin`, GitHub login via Cloudflare Worker, Cloudflare Access in front | Already planned. Pranish's manual setup still pending |
| Upload and edit blog posts | `blog` collection | Already planned |
| Edit thumbnails for projects and blogs | No image field on projects or blog | Schema change needed (small) |
| Add hobby website links (mostly Vercel) | No hobby collection. Decision 7 caps CMS at 3 collections | **Conflict. Needs a new decision** |
| "Use a free database" | CLAUDE.md says "no servers, no databases" | **Conflict. Needs a decision** (see Section 2) |
| CTF / Hack Me practice page later | Parked. PRD Section 3 says separate project, no stubs | Deferred. Not in this build |
| Separate agents for design, backend, etc. | Agents exist for PM, architect, frontend, cms, copywriter, qa-devops, security. **No designer. No backend** | Add designer now. Add backend only if database approved |

---

## 2. Decisions needed from Pranish (Phase 0)

**D1. Static (git-backed) or database-backed?**

- **Option A: stay static (recommended for v1).** Sveltia writes Markdown and images straight to the GitHub repo. GitHub Pages rebuilds on each save.
  - Pros: $0, no server, already built and partly configured. Matches CLAUDE.md.
  - Cons: publish takes a few minutes. Images live in git, so keep them small. Cannot hold per-visitor state.
- **Option B: free database (Supabase or Neon free tier) plus a Vercel or Cloudflare function, with a custom admin UI.**
  - Pros: instant edits, richer admin, ready for the CTF page.
  - Cons: free tiers can pause after inactivity and have limits. Adds a backend agent, auth, and a larger security surface. Overrides CLAUDE.md's "no databases" rule.
- **Recommendation:** Option A now. Revisit the database when the CTF project starts, because that is when interactive state is actually needed.

**D2. Approve new CMS collection `hobby` and thumbnail fields?**
Expands CMS from 3 collections to 4. This overrides `decisions.md` Decision 7, so it must be recorded as a new decision.

**D3. Confirm the GitHub repo name and login.**
`public/admin/config.yml` and `worker/wrangler.toml` both guess `pranishAD/pranishadhikari.com`. The folder is `pranish-portfolio`. Both files are marked [VERIFY].

**D4. Publish mode for CMS edits.**
Currently `publish_mode: simple`, meaning every save goes straight to `main` with no review. Options:
- Keep simple (fast, one editor).
- Switch to editorial workflow (saves become pull requests; more steps, but security review can gate content).

**D5. Hobby sites.**
Links only, or also a thumbnail and one-line description per site? Plan assumes thumbnail + description + URL + order.

---

## 3. v1 scope (after Phase 0 approval)

- **Pages:** Home, About, Projects (list + detail), Blog (list + post), Hobby (new, `/hobby`), 404.
- **Projects:** existing fields + `thumbnail` (image) + `thumbnailAlt` (text).
- **Blog:** existing fields + `thumbnail` + `thumbnailAlt`.
- **Hobby (new `hobby` collection):** `name`, `description` (plain text, max 200 chars), `url` (https), `thumbnail`, `thumbnailAlt`, `order`, `featured`, `verified`.
- **Thumbnail rules:** 16:9 (1200×675), WebP or JPEG, under 300 KB. Stored in `public/images/uploads/`. Image handling through Astro's built-in image support (check that no new dependency is needed; ask before adding one).
- **Not in v1:** contact form, analytics, CTF page, comments, newsletter.

---

## 4. Phases

**Phase 0. Decisions.** Pranish answers D1–D5. Output: decisions logged in `docs/decisions.md`. *Owner: product-manager, architect.*

**Phase 1. Foundation check.** Confirm `npm run build` passes on a clean clone. Reconcile where the content config lives: `decisions.md` says `src/content/config.ts`, but the repo has `src/content.config.ts`. Set the real repo name in both config files. *Owner: architect, qa-devops.*

**Phase 2. Admin wiring.** Finish `config.yml` for the 3 current collections. Deploy the Worker. Add Access on `/admin`. Test one edit that round-trips to the live site. Pranish does the GitHub OAuth app, Worker secret and Access setup (see `worker/README.md`). *Owner: cms-dev, security-reviewer. Manual: Pranish.*

**Phase 3. Content model additions.** Add `thumbnail` and `thumbnailAlt` to projects and blog. Add the `hobby` collection (if D2 approved). Update `content-schema.md` and the CMS config. Build must fail on malformed content. *Owner: architect → cms-dev + frontend-dev (in parallel, separate folders).*

**Phase 4. Design.** Define colour and type tokens as CSS variables. Lay out Home, Projects, Blog, Hobby and mobile nav. Mobile-first, no horizontal scroll, WCAG 2.2 AA. Placeholder palette from `decisions.md` Section 6 until a brand is chosen. *Owner: designer → frontend-dev.*

**Phase 5. Copy.** Write bio, project write-ups and hobby descriptions **only from facts Pranish has confirmed**. Anything unconfirmed stays [VERIFY]. *Owner: copywriter. Input: Pranish.*

**Phase 6. Launch checks.** CI for build, link check, axe, Lighthouse, a `[VERIFY]` lint that blocks production, and a secrets scan. Test HTTPS and DNS on the domain. Test that a non-Pranish login cannot reach `/admin`. *Owner: qa-devops, security-reviewer (must pass before every merge to `main`).*

**Later (separate project). CTF practice page.** Needs its own PRD, the D1 database decision, a security review, and a sandbox plan for any challenge content. Nothing for it goes into v1, not even a nav link.

---

## 5. Agent roster

| Agent | Status | Job in this build |
|---|---|---|
| product-manager | exists | Stories, priorities, done criteria |
| architect | exists | Schemas, decisions log, D1–D5 |
| designer | **add** | Tokens, layouts, thumbnail look, mobile |
| frontend-dev | exists | Astro pages and components |
| cms-dev | exists | Sveltia config, Worker, Access notes |
| copywriter | exists | Bio and write-ups from confirmed facts only |
| qa-devops | exists | CI, link check, a11y, Lighthouse, `[VERIFY]` lint |
| security-reviewer | exists | Reviews before every merge; `/admin`, uploads, secrets |
| backend-dev | **only if D1 = Option B** | Database, functions, auth |

**Order of work:** PM → architect → designer → (cms-dev ∥ frontend-dev) → copywriter → qa-devops → security-reviewer → merge.

---

## 6. Risks

- **Image bloat in git.** Enforce the 300 KB limit in the CMS widget and in CI. Consider a media host later.
- **Public repo.** Anything uploaded or committed is public. Never upload private files.
- **Simple publish mode.** Unreviewed saves go to `main`. See D4.
- **Hobby links can break** when Vercel projects change. Check links on a schedule, not only at build time.
- **Unverified facts** reaching production. Covered by the `[VERIFY]` lint in Phase 6.

---

## 7. Next steps

1. Pranish answers D1–D5 (Section 2).
2. Product-manager writes v2 user stories into `docs/PRD.md`.
3. Architect logs the new decisions and approves the schema changes.
4. Build starts at Phase 1.
