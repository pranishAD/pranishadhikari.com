# Content Collection Schemas — pranishadhikari.com

Defines the Astro Content Collections schema for every collection in v1, for
implementation by frontend-dev (Astro `src/content/config.ts`, Zod schemas) and cms-dev
(Sveltia `config.yml` field widgets). This document is the spec; it does not contain
Astro config code or CMS YAML (that's frontend-dev's / cms-dev's job to write from this).

## Cross-cutting rules (apply to every collection below)

1. **No raw HTML in Markdown body fields.** Any field typed `markdown` below must be
   authored as plain Markdown only. Enforce this at two layers:
   - **Schema layer:** the Astro collection schema's body field accepts Markdown content
     processed through Astro's default renderer with no `rehype-raw`/HTML-passthrough
     plugin enabled, and no component is allowed to render collection body content via
     `set:html` or equivalent raw-injection.
   - **CMS layer:** Sveltia `config.yml` uses the plain `markdown` widget for these
     fields, with no "raw HTML" toggle/mode enabled in its editor config, so Pranish's
     editing surface can't produce HTML even by accident.
   - A field typed `string` or `text` (not `markdown`) is plain text, not Markdown, and
     also must not contain HTML.
2. **`[VERIFY]` placeholder convention.** Any field marked below as "VERIFY-able" accepts
   the literal string `"[VERIFY]"` (for scalar string fields) as a valid value during
   authoring/build, in addition to its normal content. This is intentional — it lets the
   full site be built and previewed against realistic placeholder data before Pranish
   supplies real facts (per PRD: all bio/project/blog content is currently [VERIFY] or
   TBD). It is **not** a production-readiness check — that check is CI's job (qa-devops),
   not the schema's. The schema's only obligation is: don't reject `"[VERIFY]"`, and
   don't require real-looking data to pass validation.
3. **No Hack Me / CTF collection, field, reference, or enum value anywhere.** None of the
   collections below have a field that links to, categorizes as, or stubs a CTF/Hack Me
   item. No collection in this document is named `ctf` or `hackme`, and none should ever
   be added under this project per PRD Section 3.
4. **Slugs.** Every collection whose entries get their own page (`projects`, `blog`)
   uses the Markdown filename (minus extension) as its slug, e.g.
   `src/content/blog/my-first-writeup.md` → `/blog/my-first-writeup`. Slugs are
   lowercase, hyphen-separated, no spaces — enforced by convention/CI lint, not by the
   Zod schema itself (Zod validates frontmatter fields, not filenames).
5. **Collection type.** Astro's `defineCollection({ type: 'content', schema: ... })` for
   every collection below (Markdown-backed), per CLAUDE.md's "Astro with Markdown content
   collections."
6. **`thumbnail` / `thumbnailAlt` pairing (added Phase 3, 2026-10-16).** Wherever both
   fields appear below (`projects`, `blog`, `hobby`), `thumbnail` is optional — omitting
   it entirely is valid, matching the existing `profile.avatar` convention (never fake a
   placeholder/stock image). But if `thumbnail` **is** set, `thumbnailAlt` is required —
   enforced as a schema-level refinement, not just a hint, so a thumbnail with no alt
   text fails the build rather than shipping an accessibility gap. 16:9 (1200×675), WebP
   or JPEG, under 300 KB — enforced in the CMS widget's `max_file_size` and left to CI to
   double-check (qa-devops), not the Zod schema (Zod validates the stored path string,
   not the uploaded file's dimensions/bytes).

---

## 1. `profile` (About / bio)

Single-entry collection — exactly one Markdown file (e.g.
`src/content/profile/profile.md`) holds the About page's data. Modeled as a collection
(rather than Astro's "data collection"/singleton) so Sveltia can edit it with its
standard file-collection UI per PRD US-7.

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `name` | string | yes | no | "Pranish Adhikari" — not a fact in question. |
| `headline` | string | yes | yes | One-line identity, e.g. "Cybersecurity Student". Shown on Home (PRD US-1) and About. |
| `location` | string | no | yes | City/region only if Pranish wants it public. |
| `education` | array of object `{ institution: string, program: string, startDate: date, endDate: date \| null, verified: boolean }` | no (array may be empty `[]`) | yes, per-item | Each item's string fields may be `"[VERIFY]"`; `endDate: null` means "ongoing." |
| `employment` | array of object `{ employer: string, role: string, startDate: date, endDate: date \| null, description: markdown, verified: boolean }` | no (array may be empty `[]`) | yes, per-item | `description` is a short Markdown blurb per cross-cutting rule 1. |
| `bio` | markdown | yes | yes | Main About-page body copy. May itself be the literal text "[VERIFY]" as a whole-field placeholder. |
| `avatar` | image (string path) | no | no | Optional headshot/avatar asset path under `public/` or Astro image handling; omit entirely rather than fake a path. |
| `resumeUrl` | string (URL) | no | yes | Link to a hosted resume file, if any. |

**Not included:** no "contact form" field set (Decision 4 — v1 has no form), no
site-wide settings bleed-through (e.g. no `siteTitle`/`navLabels` here — see `settings`
below, which is reserved/unwired).

---

## 2. `projects`

One Markdown file per project under `src/content/projects/`. Collection may contain zero
or more entries (PRD: project list is currently [VERIFY]/TBD; schema must not require a
minimum count to build).

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `title` | string | yes | yes | |
| `summary` | string (short, e.g. max ~200 chars — enforced as a Zod `.max()`, not a hard product rule) | yes | yes | Used in project listing cards (PRD US-3 AC1). |
| `description` | markdown | yes | yes | Full write-up body. |
| `techStack` | array of string | yes (may be empty `[]` during drafting) | yes, per-item | e.g. `["Python", "Nmap"]`. |
| `role` | string | no | yes | Pranish's role on the project, if a team project. |
| `links` | array of object `{ label: string, url: string, type: enum("repo","writeup","demo","other") }` | no (array may be empty `[]`) | yes (url may be `"[VERIFY]"`) | PRD US-3 AC1 wants "a link... where available" — empty array is valid when no public link exists yet. |
| `date` | date | yes | yes (may hold a placeholder far-future/null-like sentinel only if truly unknown — prefer requiring real date before publish via CI, not schema) | Used for sort order if projects are ever ordered by recency. |
| `featured` | boolean | no, defaults `false` | no | Lets Home page pull a subset without a separate "featured projects" collection. |
| `verified` | boolean | yes, defaults `false` | no | Explicit flag: true only once Pranish has confirmed every fact in this entry. CI/build tooling (qa-devops) should be able to filter on this rather than re-parsing for the string `[VERIFY]`. |
| `thumbnail` | image (string path) | no | no | Added Phase 3. 16:9, WebP/JPEG, under 300 KB. Omit entirely rather than fake a placeholder image — see cross-cutting rule 6. |
| `thumbnailAlt` | string | required only if `thumbnail` is set | no | Added Phase 3. Enforced via schema refinement — see cross-cutting rule 6. |

**Rationale for `verified: boolean` here but not relying on it alone:** per PRD US-3
AC3, unverified projects must not publish. A boolean is the clean mechanism; the
`[VERIFY]` string convention (rule 2) is the fallback/transitional marker for
in-progress fields *within* an otherwise-drafted entry. Both can coexist: an entry can
have `verified: false` while individual fields are still literally `[VERIFY]`.

---

## 3. `blog`

One Markdown file per post under `src/content/blog/`. **Must support zero entries** —
the blog index renders a clean empty state at launch if no real posts exist yet (PRD
US-4 AC2, resolved open question #3). Nothing in this schema enforces a minimum post
count.

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `title` | string | yes | yes | |
| `pubDate` | date | yes | yes | Used for newest-first sort (PRD US-4 AC1). |
| `updatedDate` | date | no | yes | Optional, if a post is revised after publish. |
| `summary` | string | yes | yes | Short excerpt shown on the blog index (PRD US-4 AC1). |
| `body` | markdown | yes | yes | Post content — headings, code blocks, lists, links only; no raw HTML (PRD US-5 AC1, cross-cutting rule 1). |
| `tags` | array of string | no (may be empty `[]`) | yes, per-item | Free-text tags, e.g. `["writeup", "networking"]`. No tag value may be `"ctf"`/`"hackme"` as a de facto section stub — tags are free text for Pranish's own taxonomy, but this collection carries no CTF *feature* (no CTF-specific field, filter, or route), consistent with PRD Section 3. |
| `draft` | boolean | yes, defaults `true` | no | Build/listing pages should exclude `draft: true` posts from production output — a frontend/build concern, documented here because it's the mechanism that lets an empty-but-functional blog ship (all posts can stay `draft: true` until ready). |
| `thumbnail` | image (string path) | no | no | Added Phase 3. 16:9, WebP/JPEG, under 300 KB. Omit entirely rather than fake a placeholder image — see cross-cutting rule 6. |
| `thumbnailAlt` | string | required only if `thumbnail` is set | no | Added Phase 3. Enforced via schema refinement — see cross-cutting rule 6. |

---

## 4. `hobby` (added Phase 3, 2026-10-16)

One Markdown file per hobby/side-project site under `src/content/hobby/` (mostly Vercel
deploys, per the v2 plan). Added under **Decision 12 / D2**, which supersedes Decision
7's three-collection cap — v1 now exposes four CMS collections, not three. Collection may
contain zero or more entries, same convention as `projects`/`blog`.

Fields are **exactly** Decision 12 / D5's approved scope: a link, a thumbnail, and a
description. There is deliberately **no** `name`, `order`, `featured`, or `verified`
field — the v2 plan's Section 3 sketch proposed those too, but D5's literal answer was
narrower, and the extra fields were explicitly flagged as not approved. Do not add them
without a new decision from Pranish recorded in `docs/decisions.md`.

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `url` | string (URL) | yes | yes | The hobby/Vercel site's link. No `name` field — the CMS list view and slug are keyed off this URL/an opaque ID instead (see `config.yml`'s `hobby` collection: `slug: "hobby-{{ouid}}"`), not a display title. |
| `description` | string, max 200 chars | yes | yes | One-line description per entry (D5). |
| `thumbnail` | image (string path) | no | no | 16:9, WebP/JPEG, under 300 KB. Omit entirely rather than fake a placeholder image — see cross-cutting rule 6. |
| `thumbnailAlt` | string | required only if `thumbnail` is set | no | Enforced via schema refinement — see cross-cutting rule 6. |

---

## 6. `skills`

One Markdown file per skill under `src/content/skills/`, or (frontend-dev's/cms-dev's
implementation choice) entries may be grouped into categories — schema below assumes
one file per skill for CMS-editing simplicity; a category field handles grouping instead
of a nested collection.

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `name` | string | yes | yes | e.g. "Network Security", "Python". |
| `category` | enum(string) e.g. `"security"`, `"programming"`, `"tools"`, `"other"` | yes | no (category is a taxonomy choice, not a fact about Pranish) | Keep this enum small and owned by architect/frontend-dev, extend only with a schema change, not ad hoc from the CMS. |
| `proficiency` | enum(`"learning"`, `"familiar"`, `"proficient"`) | no | yes | Self-assessed; omit rather than overclaim if unsure. |
| `verified` | boolean | yes, defaults `false` | no | Same convention as `projects.verified` — don't publish an overstated skill level. |

---

## 7. `certifications`

One Markdown file per certification/credential under `src/content/certifications/`.
Collection may be empty (PRD: certs are [VERIFY], possibly none exist yet).

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `name` | string | yes | yes | e.g. "CompTIA Security+". |
| `issuer` | string | yes | yes | |
| `issueDate` | date | no | yes | |
| `expiryDate` | date | no | yes | Omit if non-expiring. |
| `credentialUrl` | string (URL) | no | yes | Public verification link, if any. |
| `verified` | boolean | yes, defaults `false` | no | Must be `true` before this cert appears on the live About page, per PRD "every factual claim... confirmed or excluded" (US-2 AC2). |

---

## 8. `socials`

One Markdown file per social/contact link under `src/content/socials/` (e.g. GitHub,
LinkedIn, email). Backs the Home/About "contact method" links for v1 (Decision 4 —
mailto/social links only, no form).

| Field | Type | Required | VERIFY-able | Notes |
|---|---|---|---|---|
| `platform` | enum(`"email"`, `"github"`, `"linkedin"`, `"twitter"`, `"other"`) | yes | no | Extend enum only via schema change. |
| `label` | string | yes | no | Display text, e.g. "Email Pranish". |
| `url` | string (URL, or `mailto:` URI when `platform: "email"`) | yes | yes | For email, this is literally a `mailto:` link per Decision 4 — no form endpoint. |
| `displayOrder` | number | no, defaults by array position | no | Lets Pranish reorder icons/links without renaming files. |

**Not included:** no Turnstile site-key field, no "form submissions go to" field — those
belong to the P1 contact-form task once Pranish supplies a destination (Decision 4), and
must not be pre-stubbed here.

---

## 9. `settings` — reserved shape, NOT built or wired in v1

Per Decision 7 (CMS editor scope), no `settings` collection is registered in Astro's
`src/content/config.ts` or exposed in Sveltia's `config.yml` in v1. This section exists
only so a future expansion has a documented target shape and isn't designed from
scratch under time pressure — it is explicitly **out of v1 scope** and must not be
implemented now.

Illustrative future shape (not to be built): `siteTitle`, `siteDescription`,
`footerText`, `navLabels` (per-route override strings). None of this is approved for v1;
raising it again requires a new decision, the same way the original `settings`-collection
question was explicitly declined by Pranish (resolved open question #9).

---

## Summary: VERIFY-able fields at a glance

Every one of these may legitimately hold `"[VERIFY]"` (or, for arrays, contain items
with `"[VERIFY]"` sub-fields) in the repo today, and none of them may block a build:

- `profile`: `headline`, `location`, education items, employment items, `bio`, `resumeUrl`
- `projects`: `title`, `summary`, `description`, techStack items, `role`, link urls, `date`
- `blog`: `title`, `pubDate`, `updatedDate`, `summary`, `body`, tag items
- `hobby`: `url`, `description`
- `skills`: `name`, `proficiency`
- `certifications`: `name`, `issuer`, `issueDate`, `expiryDate`, `credentialUrl`
- `socials`: `url` (rarely needed, but permitted — e.g. if a profile URL isn't settled yet)

`thumbnail`/`thumbnailAlt` (on `projects`, `blog`, `hobby`) are **not** VERIFY-able —
they're optional and omitted entirely rather than holding a placeholder value (cross-
cutting rule 6).

Blocking `[VERIFY]` content from reaching production (PRD's "zero [VERIFY] markers
remain in published content" Done Criterion) is a CI/lint responsibility (qa-devops),
not a schema responsibility — the schema's job is only to not invent or require fake data.
