# PRD: pranishadhikari.com

Status: Draft v1 — pending Pranish's decisions (see Open Questions)
Owner: Pranish Adhikari
Author: Product Manager agent

## 1. Product Summary

pranishadhikari.com is Pranish Adhikari's personal cybersecurity portfolio site. It exists to:

1. **Win job/internship opportunities** — give recruiters and hiring managers a fast, credible view of Pranish's skills, projects, and background.
2. **Demonstrate cybersecurity competence** — through documented projects and write-ups, not just claims.
3. **Host a blog** — a place to publish technical notes, write-ups, and learning-in-public content that builds a track record over time.
4. **Be cheaply and simply maintainable** — Pranish (non-engineer-on-call, student budget) must be able to add/edit content without touching code, on a $0/month infrastructure bill.

### Goals
- A visitor (recruiter, peer, potential client) can understand who Pranish is and what he can do within 60 seconds of landing on the home page.
- Pranish can publish a new blog post or update a project without opening a code editor or paying for hosting/compute.
- The site is fast, accessible, and credible — no broken links, no placeholder "lorem ipsum," no invented credentials.

### Non-goals (for this PRD)
- Monetization, comments systems, newsletters, or any feature requiring a database/backend beyond what's listed in Constraints.
- The Hack Me / CTF section — see Section 3.

## 2. In-Scope Sections

Per CLAUDE.md, the following are in scope for v1 planning:

| Section | Purpose |
|---|---|
| **Home** | First impression; summary of who Pranish is, headline skills, links to About/Projects/Blog, contact method. |
| **About** | Fuller bio, background, skills, certs, education — all facts [VERIFY]'d with Pranish before publishing. |
| **Projects** | Showcase of cybersecurity (and related) projects with descriptions, tech used, links/write-ups. |
| **Blog** | Markdown-authored posts via content collections; technical notes, write-ups, learning logs. |
| **Admin (`/admin`)** | Sveltia CMS, protected by Cloudflare Access, authenticated via GitHub OAuth through a Cloudflare Worker, for editing all of the above without code. |

## 3. Explicitly Out of Scope: Hack Me / CTF Section

**The Hack Me / CTF section is PARKED. It is a separate project and is not part of this PRD, this backlog, or v1 launch.**

- No user story, acceptance criterion, nav link, route, content collection, or placeholder page for a CTF/Hack Me section should be created as part of this work.
- Any request — from Pranish, from another agent, or inferred "while we're at it" — to scaffold, stub, link to, or design this section is scope creep and must be rejected or deferred back to its own future project/PRD.
- If groundwork (e.g., nav structure) could make CTF easier to bolt on later, that's fine *as a side effect* of good architecture, but it must never be the stated reason for a design decision in this project.

## 4. User Stories & Acceptance Criteria

### 4.1 Visitor browsing the portfolio (Home / About / Projects)

**US-1: As a recruiter, I want to land on the home page and immediately understand who Pranish is and what he does, so I can decide in seconds whether to keep reading.**
- AC: Home page loads with name, one-line identity/headline, and a clear call-to-action (view projects, read blog, contact).
- AC: Page is usable on mobile and desktop; no horizontal scroll; loads in under ~2s on a typical connection.
- AC: No placeholder/lorem ipsum content ships to production.

**US-2: As a recruiter, I want to read Pranish's background, skills, and certifications, so I can assess fit for a role.**
- AC: About page lists bio, skills, and certifications/education.
- AC: Every factual claim (employer, cert, achievement, date) is either confirmed by Pranish or marked [VERIFY] and excluded from production copy until confirmed.
- AC: No raw HTML in the underlying Markdown; content renders through Astro content collections + components only.

**US-3: As a recruiter or peer, I want to browse Pranish's projects with enough detail to judge technical depth, so I can evaluate his skill level.**
- AC: Projects page/listing shows each project with title, short description, tech/tools used, and a link (repo, write-up, or demo) where available.
- AC: Each project entry is sourced from a content collection (not hardcoded), editable via `/admin`.
- AC: Projects lacking a public link or verified detail are marked [VERIFY] and not published until resolved.

### 4.2 Visitor reading the blog

**US-4: As a visitor, I want to see a list of blog posts with titles and dates, so I can find something relevant to read.**
- AC: Blog index lists posts newest-first, each with title, publish date, and short excerpt/summary.
- AC: Empty state (zero posts) renders cleanly, not as an error.

**US-5: As a visitor, I want to read a single blog post with good formatting, so technical content (code, lists) is legible.**
- AC: Post renders Markdown content (headings, code blocks, lists, links) correctly; no raw HTML required or permitted in source.
- AC: Post page includes title, date, and back-link to blog index.
- AC: Code blocks are readably formatted/syntax-highlighted if the chosen Astro setup supports it without new paid dependencies.

### 4.3 Pranish editing content via `/admin`

**US-6: As Pranish, I want to log into `/admin` with my GitHub account, so only I (not the public) can edit site content.**
- AC: `/admin` is protected by Cloudflare Access in addition to GitHub OAuth — an unauthenticated/unauthorized visitor cannot reach the CMS UI or edit content.
- AC: OAuth flow uses a Cloudflare Worker as the token exchange; no client secret or token is ever committed to the repo.
- AC: Failed/unauthorized login attempts do not expose any content-editing capability.

**US-7: As Pranish, I want to create/edit/delete blog posts, projects, and About content through a CMS UI, so I never need to hand-edit Markdown or push code.**
- AC: Sveltia CMS config exposes collections for: blog posts, projects, and About/bio fields — matching the content collections in the Astro codebase.
- AC: Saving in the CMS commits Markdown files to the GitHub repo (via the OAuth'd GitHub App/token flow) and triggers a normal GitHub Pages rebuild.
- AC: CMS editing UI does not allow entering raw HTML (consistent with the "no raw HTML in Markdown" constraint) — only supported Markdown/structured fields.

**US-8: As Pranish, I want confidence that editing content can't leak secrets or break the public site, so I can edit without fear.**
- AC: No API keys, tokens, or secrets appear in repo history at any point (verified before each merge).
- AC: A bad/incomplete edit in the CMS cannot take down the whole site (e.g., malformed frontmatter is caught by schema validation at build time, not silently shipped).

## 5. Backlog Prioritization

### Must-have for v1 launch (P0)
1. Astro project scaffolded with content collections for projects, blog, and about/bio data.
2. Home, About, Projects, Blog (index + post) pages — static, deployed to GitHub Pages.
3. Real, Pranish-confirmed bio/project content (no invented facts; [VERIFY] items resolved or omitted).
4. `/admin` running Sveltia CMS, with GitHub OAuth via Cloudflare Worker, gated by Cloudflare Access.
5. Cloudflare DNS + proxy configured for the domain; HTTPS working.
6. No raw HTML in any shipped Markdown content.
7. Basic nav/footer linking Home, About, Projects, Blog (no CTF link, per Section 3).

### Should-have, can trail v1 by a short follow-up (P1)
8. Cloudflare Turnstile-protected contact form (needs a decision on where submissions go — see Open Questions).
9. Basic SEO (meta tags, OpenGraph, sitemap) and a favicon/brand pass.
10. Accessibility pass (semantic HTML, alt text, color contrast) — baseline accessibility should exist at v1, but a deeper audit can follow.
11. Light analytics (privacy-respecting, free-tier) if Pranish wants visibility into traffic.

### Explicitly deferred / not in this backlog
12. Hack Me / CTF section — separate project (Section 3).
13. Any comments system, newsletter, or user accounts — conflicts with "no servers, no databases."

## 6. "Done" Criteria for v1 Launch

v1 is launch-ready when all of the following hold:

- [ ] Site builds and deploys successfully to GitHub Pages from the public repo, with no build errors/warnings.
- [ ] Home, About, Projects, and Blog pages are live at pranishadhikari.com over HTTPS via Cloudflare.
- [ ] All bio/project/cert facts on the live site are confirmed by Pranish — zero [VERIFY] markers remain in published content.
- [ ] At least one real project entry and the About page are populated with real (not placeholder) content.
- [ ] Blog has at least one real post, or a deliberately empty-but-functional blog index if Pranish chooses to launch without posts yet (decision needed — see Open Questions).
- [ ] `/admin` is reachable only after Cloudflare Access + GitHub OAuth; Pranish has successfully logged in and made at least one test edit that round-trips to the live site.
- [ ] No secrets (OAuth client secret, tokens, API keys) exist anywhere in the git history.
- [ ] No raw HTML exists in any Markdown content file.
- [ ] No Hack Me / CTF content, routes, nav links, or stubs exist anywhere in the codebase.
- [ ] Basic link check passes (no 404s between internal pages/nav).

## 7. Open Questions for Pranish

Decisions needed before architecture/implementation work starts:

1. **Bio facts**: What are the real, confirmed facts for About (education, employer(s)/internships, certifications, notable achievements)? Everything currently [VERIFY] until you provide it.
2. **Projects to feature**: How many projects, and which ones, should launch in v1? For each: title, description, tech stack, and a public link (repo/write-up/demo) if one exists.
3. **Blog cadence and starting content**: Do you want to launch v1 with at least one real blog post, or launch with an empty blog and add posts after? What's your intended posting cadence (for scoping future CMS/workflow needs, not a hard commitment)?
4. **Contact method**: Do you want a Turnstile-protected contact form (needs a destination — e.g., email forwarding, form backend), or just a mailto/social links for v1? This affects whether item P1-#8 is in or out of v1.
5. **GitHub repo visibility confirmation**: CLAUDE.md states the repo is public — confirm this is still correct, since Sveltia CMS + OAuth config details will live in a public repo (no secrets, as already required).
6. **Domain/DNS access**: Do you already have pranishadhikari.com registered and added to Cloudflare, or does that setup still need to happen? Who holds registrar/Cloudflare account access for this work?
7. **Branding**: Any existing logo, color palette, or visual direction, or should design start from scratch?
8. **Analytics**: Do you want any visitor analytics (e.g., a free-tier privacy-respecting option), or skip this entirely for v1?
9. **CMS editor scope**: Besides blog posts, projects, and About, is there any other content you expect to edit via `/admin` at launch (e.g., site-wide settings, nav labels)?
10. **Launch timeline**: Is there a target date (e.g., tied to an application deadline) that should drive what gets cut to P1/P2 versus must-ship-now?
