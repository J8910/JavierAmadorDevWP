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
- **Working toolset the site may claim:** Unity, Unreal Engine (5), Houdini, Substance Painter
  and Designer, Blender, Maya. ArtStation projects also show Arnold and Marmoset Toolbag
  (rendering).
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
- **ArtStation:** https://www.artstation.com/j8910 is Javier's own portfolio. Everything on it
  is his and may be used on this site (confirmed 2026-11-26). ArtStation blocks automated
  fetching (HTTP 403), so files come from Javier's originals or a manual download, not a
  scraper. The project listing Javier exported is saved locally (gitignored) at
  `references/artstation-projects.json`. Its 10 projects, newest first:
  - **Cloudlines: Lookdev & Shaders** (2026 post). Freelance for **Manada** (2024): the game's
    look, shaders and their optimization, plus an asset workflow for fast iteration.
  - **Dark Moon Greatsword** (2026). Elden Ring **fan art** in Unreal Engine 5, VFX included.
  - **DE-EXIT: Eternal Matters** (2021). At **Sandbloom Studio**: environment and prop modeling,
    rigging and animating props and creatures, VFX, some hero-asset concepts. Includes video.
  - **Firebuds Season 2** (2022). At **ICON Creative Studio**, 2022–2023.
  - **The Club's ROCKing New Year 2024**: rock sculpts from a community challenge.
  - **Wind House** (2024). Stylized environment in Unreal Engine; wind is the main element.
    Based on another artist's concept. 123 likes, his most liked piece.
  - **Overwatch Submarine** (2022). Maya, Substance Painter and Designer, Arnold. Based on a
    concept by Andrew Menjivar.
  - **Versailles Parquet Floor Tiles** (2022). Substance Designer, rendered in Marmoset.
  - **Mossy Cliff Layered Material** (2022). Substance Designer, rendered in Marmoset.
  - **Pirate Cabin Environment** (2022). Maya and Arnold.
- **Images in the repo (2026-11-26):** the first 4 images (ArtStation "large", ~1920px) of
  Cloudlines, Wind House, Mossy Cliff and Pirate Cabin, in `src/assets/images/<project>/`.
  DE-EXIT and Dark Moon Greatsword images could not be pulled and still need Javier's files.
  DE-EXIT's video is a YouTube embed on ArtStation (link it rather than host it).
- **Credit rule:** fan art and pieces built from someone else's concept must say so and credit
  the original (concept artist or IP holder), as Javier does on ArtStation.
- **Posts:** most of `src/posts/` are **mockups** used to test features (post-3 to post-7 and
  post-9 are marked "safe to delete"). Posts 1–2 are short starter content. Don't present
  mockup posts as real work.
- **Live demos:** the `/resources/` pages are real, working examples of the shader runtime.
- **Studios and productions (from ArtStation):** Sandbloom Studio (DE-EXIT: Eternal Matters,
  2021), ICON Creative Studio (Firebuds Season 2, 2022–2023), Manada (Cloudlines, freelance
  2024). Name them only as worded there; add nothing about scope or outcomes beyond it.
- **None on hand:** no testimonials, awards, or press. Never invent any of these.

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
