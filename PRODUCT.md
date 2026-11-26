# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences, all confirmed as primary (2026-11-26):

- **Studios and recruiters** hiring a technical or environment artist. They skim fast and
  need clear proof of skill, range, and how Javier thinks.
- **Fellow technical artists and learners** who come for the shader and environment-art
  write-ups and the live, runnable demos.
- **Freelance or contract clients** deciding whether to commission environment or tech-art
  work. They need to see finished work and know how to get in touch.

## Product Purpose

javieramador.dev is Javier Amador's personal blog and portfolio. It shows his work, records
what he learns building real-time worlds, and gives each audience a direct way to reach him.
It is a success when a studio or client can quickly judge his skill and contact him, and when
a peer finds a technique explained clearly enough to use.

Two maintenance goals, in priority order: **easy to read** and **easy to maintain**. Adding a
post or portfolio piece means adding one content file, never editing templates. Javier is an
artist, not a full-time web developer.

## Positioning

Javier's identity combines two roles **on purpose**: he is a technical and environment artist
who also writes real software. The site treats "Technical & Environment Artist" and "software
and game developer specialized in technical & environment art" as one identity, not two
competing titles.

Tech-art education is a **work in progress**. The live, editable WebGL demos in `/resources/`
exist and Javier plans to extend them, but they are not yet confirmed as the main
differentiator. *Open:* whether the runnable explainers or the artwork becomes the site's main
claim.

## Operating Context

- Readers arrive from job applications, social shares, RSS (`/feed.xml`), and search.
- Recruiters usually skim on a desktop. Peers often read long-form posts and play with live
  shader demos.
- Content is written in Markdown with front matter and deployed by pushing to `main`/`master`.

## Capabilities and Constraints

- **Stack (existing):** Eleventy v3 static site on GitHub Pages at the custom domain
  javieramador.dev, deployed by GitHub Actions. Analytics: goatcounter, build only. Comments:
  giscus. Math: KaTeX at build time. Code: Prism highlighting.
- **Live shader runtime** (`src/js/shaders.js`): Shadertoy-style GLSL embeds, an optional
  in-browser editor, and a WebGL2 post-process G-buffer pipeline (SDF and mesh scenes).
  HLSL is shown as code only; browsers can't run it.
- **Sections:** Home, Showcase (`/showcase/`, a Three.js/GSAP interactive splash, in
  progress), Blog, Resources, Contact, Colophon (`/colophon/`).
- **Working toolset the site may claim:** Unity, Unreal Engine, Houdini, Substance, Blender,
  Maya.
- **Roadmap:** a data-driven portfolio ("projects" collection) built on `@11ty/eleventy-img`.
  Also draft support and optional JSON-LD.
- **Terminology:** "post" (blog entry), "resource" (live technique explainer), "showcase"
  (interactive splash), "portfolio" (project grid, not built yet).

## Brand Commitments

- Name: **Javier Amador**. Domain: **javieramador.dev**.
- The site already has a visual direction, chosen by Javier from his own reference sites and
  recorded in CLAUDE.md. He explicitly rejected generic or default "AI-slop" styling, so future
  work must not drift back to conventional defaults.
- Brand art is **placeholder**: the "JA" monogram favicon (`src/assets/favicon.svg`) and the
  default OG card (`src/assets/og-default.svg`). Javier will replace them with real art.
- Sole authorship: commits carry no Claude co-author trailer.

## Evidence on Hand

- **Real work:** some finished pieces plus work in progress and breakdowns. Most of it is not
  in the repo yet. The only project image committed is `src/assets/images/WoodPigeon.jpg`.
- **Posts:** most of `src/posts/` are **mockups** used to test features (post-3 to post-7 and
  post-9 are marked "safe to delete"). Posts 1–2 are short starter content. Don't present
  mockup posts as real work.
- **Live demos:** the `/resources/` pages are real, working examples of the shader runtime.
- **None on hand:** no testimonials, clients, employers, shipped titles, awards, or press. Never
  invent any of these.

## Product Principles

1. **Proof over claims.** Show the work and the technique running live; don't describe skill
   with adjectives.
2. **Serve the skimmer and the reader.** A recruiter should get the gist in seconds, and a peer
   should find depth worth staying for.
3. **One file per piece.** New content must never require editing templates.
4. **Artist who codes, as one identity.** Art and engineering are shown together, never as two
   separate halves.
5. **Restraint over promotion.** No monetization callouts or promo density. Contact is easy to
   find but never pushy.

## Accessibility & Inclusion

- Interactive and WebGL pieces enhance real HTML content and never replace it. The showcase
  menu works as a plain menu without JS or WebGL.
- Respect `prefers-reduced-motion`: shaders start paused and animation stays opt-in.
- Write `alt` text for every content image.
