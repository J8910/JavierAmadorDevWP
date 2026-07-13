---
title: "Scroll test: building a modular rock kit"
date: 2026-07-13
category: environment
emoji: 🪨
description: A deliberately long post used to test the back-to-top button and long-form prose styling. Safe to delete.
---

> **Note to self:** this is a throwaway post to test the back-to-top button and how a long
> article reads. Delete it before launch.

Modular kits are the backbone of any large environment. Instead of sculpting a whole cliff
face as one giant mesh, you build a small set of reusable pieces and assemble them like
LEGO. Done well, a kit of eight rocks can dress an entire canyon and still tile cleanly at
every seam. This post walks through how I approach one.

## Why modular

The temptation early on is to sculpt everything bespoke. It looks great in isolation, but it
does not scale: memory balloons, iteration slows to a crawl, and the moment a level designer
wants the cliff two metres taller you are back in ZBrush for an afternoon.

A kit flips that trade. You spend more time up front on a handful of pieces, and in return
you get:

- **Fast blockouts** — designers grey-box with the real assets from day one.
- **Consistent silhouette** — every rock shares the same material and wear language.
- **Cheap memory** — a few textures and meshes, instanced hundreds of times.
- **Painless changes** — retexture once, and the whole canyon updates.

## The base set

I usually start with the smallest set that still reads as varied. Eight shapes is my
comfort zone:

1. A large hero boulder with a strong directional silhouette.
2. Two medium blockers that hide seams between larger pieces.
3. Three small scatter rocks for breaking up flat ground.
4. A wide, flat "shelf" piece for ledges and steps.
5. A tall spire for verticality and reading distance.

The trick is that none of these should look finished on their own. A modular piece that
looks perfect in isolation is usually too distinctive to repeat.

### A note on scale

Model everything to real-world scale from the start. If your engine treats one unit as one
metre, a hero boulder around three metres tall feels right next to a human character. Getting
this wrong early means refitting every texture density later.

## Sculpting for tiling

The seams are where modular kits live or die. Two habits keep them invisible:

- Keep the **contact edges flat and consistent** in height, so pieces butt together without
  gaps or intersections poking through.
- Push the interesting detail toward the **centre of each piece**, away from the seam, so the
  eye is drawn to the silhouette rather than the join.

Here is the rough density I aim for when I retopologise:

```
hero boulder     ~4,000 tris
medium blocker   ~1,500 tris
small scatter     ~600 tris
shelf             ~1,200 tris
spire            ~2,000 tris
```

Those are starting points, not rules. A rock read from thirty metres away can shed half its
triangles and nobody will notice.

## Texturing the set

I bake a single trim-friendly material and drive variation with vertex colours rather than
unique textures per rock. A three-channel mask goes a long way:

- **Red** — moss and lichen in the crevices.
- **Green** — sand and dust accumulation on upward faces.
- **Blue** — wet, darkened rock near the base.

Blending those in the shader means one material serves a mossy forest floor and a dry desert
mesa, just by changing the mask weights per instance.

### Wear and edges

Edge wear is the cheapest way to sell "rock". A curvature map driving a lighter, chipped
colour along convex edges reads as chunks that have broken away over time. Keep it subtle —
the moment every edge is bright, the illusion collapses into a cartoon.

## Placing the kit

With the pieces built, dressing a scene becomes a composition problem rather than a modelling
one. A few habits that help:

- **Rotate and scale aggressively.** The same boulder at 0.8x and rotated 140 degrees reads as
  a different rock. Non-uniform scale within reason is your friend.
- **Bury the seams.** Sink scatter rocks slightly into the ground and let smaller pieces hide
  the joins between big ones.
- **Vary the spacing.** Nature clumps. Tight clusters with open gaps look far more believable
  than an even scatter.

> The goal is that a player never counts eight rocks. They see a canyon.

## Lighting and final read

None of this matters if the lighting flattens it. I always dress and light in tandem: a
grazing key light rakes across the silhouettes and makes the sculpted detail earn its
triangles. Ambient occlusion in the crevices ties the pieces to the ground and hides the
last of the seams.

## A quick checklist

Before I call a kit done, I run through this:

- Do the pieces tile at every rotation without gaps?
- Does the silhouette read from the intended viewing distance?
- Is the triangle budget justified by what the camera actually sees?
- Can I redress the kit into a *different* biome with only mask changes?
- Would a level designer be able to build with it without asking me anything?

If the answer to all five is yes, the kit is ready to ship — and I never have to open ZBrush
just because someone wanted the cliff a little taller.

## Wrapping up

Modular kits are less about modelling skill and more about restraint and planning. Build the
smallest set that reads as varied, keep the seams boring, and let placement and lighting do
the heavy lifting. Your future self — and every designer on the team — will thank you.

Scroll back up with the little arrow in the corner. That is what it is here to test.
