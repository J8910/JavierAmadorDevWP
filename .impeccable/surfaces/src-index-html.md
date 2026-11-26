---
version: 1
slug: "src-index-html"
primary_target: "src/index.html"
related_targets: ["src/portfolio.html","src/_includes/layouts/project.html"]
---

## Scope
Home (/), portfolio index (/portfolio/) and project pages; the world applies site-wide (blog, posts,
resources, contact, 404). Visitor mode: Experience (home, portfolio), Read (blog, posts, resources).

## Audience and job
Studios/recruiters skim for proof of skill; peers read and play with shaders; clients look for work
and contact. Proof = Javier's own renders (src/assets/images/<project>/) and live shaders.

## Direction contract
THESIS: The site is a live survey sheet: a GLSL contour map is the page itself, and the art is pinned
on it. Refuses the dark ArtStation thumbnail grid and the cream terminal-zine look.
OWN-WORLD: Day sheet = map paper #f4f5f0, graphite ink #1b1d1a, sienna index contours #b0602a; night
sheet = slate #151b22, grey depth contours #7e8a9a, ochre index #e3a63a. Paper panels with 1px ink
rules over the live map; legend symbols (triangle, waves, target, square) as the only icons. Mona Sans
(wide, spaced caps for the name), Schibsted Grotesk text, Martian Mono for code/labels only.
STORY: A visitor sees a real render first, understands "environment + tech artist" from the work
section, plays with the map (cursor hill, fast wake, click raises a peak), floods to night, and can
open ground.frag to edit the shader live.
FIRST VIEWPORT: Name chip top-left, legend nav + night icon button top-right; featured project as a
large two-shot survey slide (~72% width) with caption below; right rail of other projects (names only,
no numerals) and "All work"; ground.frag link bottom-left.
FORM: Live Ground + flood + survey slides (V8) with the ripples/sculpt ground (V9); assigned
direction #3 Survey Sheet, seed:620e50db058ddec6.
SIGNATURE: survey-slide waterline on images; night flood pouring from the button; editable ground.frag.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
