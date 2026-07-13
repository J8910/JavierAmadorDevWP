---
title: Building a stylised forest floor
date: 2026-06-02
category: environment
emoji: 🌲
description: Layered materials and a scatter workflow for a believable, stylised forest floor.
---

A quick breakdown of how I approach a stylised forest floor — from the base material
layers to the scatter pass that ties everything together.

## Starting with the ground material

The base is three blended layers: soil, moss, and scattered leaf litter. Keeping each
layer independent means I can tune coverage without repainting.

- **Soil** — the darkest value, does most of the shadow work.
- **Moss** — a cooler mid-tone that reads as "damp".
- **Leaf litter** — warm accents, used sparingly.

> The trick with stylised work is restraint: let a few strong shapes carry the read.

## The scatter pass

Once the material reads well up close, I scatter meshes across it — small rocks, ferns,
and fallen branches — using vertex colours to mask density.

That's the whole loop: material first, scatter second, lighting last.
