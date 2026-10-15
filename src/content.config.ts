// Content Collection schemas — see docs/content-schema.md for the full spec.
//
// NOTE on file location: docs/decisions.md Section 1 sketches this file as
// `src/content/config.ts` (Astro's older convention). The Astro version
// actually installed here (7.x) removed that legacy format — collections
// must be declared in `src/content.config.ts` with an explicit `loader`
// (see https://docs.astro.build/en/reference/errors/legacy-content-config-error/).
// This file is that build-required equivalent; the schemas and collection
// names below are unchanged from the spec. Flagged for architect/decisions.md.
//
// How this maps to the spec:
// - Every collection uses the `glob()` loader over its own
//   `src/content/<name>/` folder (Markdown-backed), matching
//   docs/decisions.md Section 1's directory layout.
// - Fields documented as "markdown" type that represent a whole entry's
//   write-up (`projects.description`, `blog.body`) are NOT modeled as
//   schema fields here. They are the Markdown body of the file (everything
//   below the frontmatter), rendered on pages via Astro's built-in
//   `render()` + `<Content />` pipeline. This is what lets Shiki syntax
//   highlighting work with zero extra dependencies, and avoids ever
//   needing `set:html` on user content.
// - Fields documented as "markdown" type that live *inside* frontmatter
//   alongside other fields (`profile.bio`, `employment[].description`)
//   can't use that mechanism (a single file only has one body). They're
//   modeled as plain strings and rendered as escaped, paragraph-split text
//   by the page templates — never parsed as HTML, never passed through
//   `set:html`.
// - `[VERIFY]` is a valid literal value for every VERIFY-able string field
//   below; plain `z.string()` (no `.email()`/`.url()` refinements) is used
//   everywhere a VERIFY-able field could hold that sentinel instead of
//   real-looking data.
// - No `settings` collection is defined here — reserved/unwired per
//   Decision 7.
// - No `ctf`/`hackme` collection, field, or enum value exists anywhere
//   below.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const profile = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/profile' }),
  schema: z.object({
    name: z.string(),
    headline: z.string(),
    location: z.string().optional(),
    education: z
      .array(
        z.object({
          institution: z.string(),
          program: z.string(),
          startDate: z.coerce.date(),
          endDate: z.coerce.date().nullable().default(null),
          verified: z.boolean().default(false),
        }),
      )
      .default([]),
    employment: z
      .array(
        z.object({
          employer: z.string(),
          role: z.string(),
          startDate: z.coerce.date(),
          endDate: z.coerce.date().nullable().default(null),
          description: z.string(),
          verified: z.boolean().default(false),
        }),
      )
      .default([]),
    bio: z.string(),
    avatar: z.string().optional(),
    resumeUrl: z.string().optional(),
  }),
});

const projectLink = z.object({
  label: z.string(),
  url: z.string(),
  type: z.enum(['repo', 'writeup', 'demo', 'other']),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(200),
    techStack: z.array(z.string()).default([]),
    role: z.string().optional(),
    links: z.array(projectLink).default([]),
    date: z.coerce.date(),
    featured: z.boolean().default(false),
    verified: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(true),
  }),
});

const skills = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/skills' }),
  schema: z.object({
    name: z.string(),
    category: z.enum(['security', 'programming', 'tools', 'other']),
    proficiency: z.enum(['learning', 'familiar', 'proficient']).optional(),
    verified: z.boolean().default(false),
  }),
});

const certifications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/certifications' }),
  schema: z.object({
    name: z.string(),
    issuer: z.string(),
    issueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    credentialUrl: z.string().optional(),
    verified: z.boolean().default(false),
  }),
});

const socials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/socials' }),
  schema: z.object({
    platform: z.enum(['email', 'github', 'linkedin', 'twitter', 'other']),
    label: z.string(),
    url: z.string(),
    displayOrder: z.number().optional(),
  }),
});

export const collections = {
  profile,
  projects,
  blog,
  skills,
  certifications,
  socials,
};
