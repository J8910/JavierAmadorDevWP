---
title: "Scene kinds: SDF vs. rasterized mesh, one G-buffer"
date: 2026-07-14
category: shaders
emoji: 🧊
shaders: true
description: A mockup post exercising the postfx scene selector — the same post-process over a raymarched SDF and over rasterized manifold meshes.
---

> **Note to self:** mockup to test the `{% raw %}{% shader mode="postfx", scene="…" %}{% endraw %}`
> scene selector (SDF presets + `mesh-*` primitives). Every embed below runs the **same**
> post-process — only the `scene=` value changes. Safe to delete before launch.

The postfx pipeline fills a G-buffer (albedo / normal / depth / mask) and then runs your
`mainImage` over it. How that G-buffer gets *filled* is now selectable, so the identical
effect can be shown on two very different techniques. Drag to orbit, `+ / −` to zoom, and use
the **buffers** switch under each canvas to inspect the raw channels.

## Baseline — the default SDF scene

`scene="sdf"` (the default): a raymarched signed-distance field. This is the original box +
torus. The post-process is a plain albedo passthrough, so **buffers → normal / depth / mask**
shows exactly what the scene wrote.

{% shader mode="postfx", height=320, caption="scene=\"sdf\" — raymarched box + torus. Flip the buffers switch to see the raw channels." %}
void mainImage(out vec4 O, in vec2 uv) {
    O = vec4(sampleAlbedo(uv), sampleMask(uv));
}
{% endshader %}

## The same post-process on a rasterized mesh

`scene="mesh-sphere"` swaps the raymarcher for **real triangle geometry** through the
vertex/rasterizer pipeline (with a depth buffer). The `mainImage` body is byte-for-byte the
same as above — if the normal and depth buffers look right here, the mesh scene is writing the
G-buffer correctly.

{% shader mode="postfx", scene="mesh-sphere", height=320, caption="scene=\"mesh-sphere\" — a rasterized UV sphere + ground, same passthrough post-process." %}
void mainImage(out vec4 O, in vec2 uv) {
    O = vec4(sampleAlbedo(uv), sampleMask(uv));
}
{% endshader %}

`mesh-cube` (flat-shaded faces — a good normal-buffer check) and `mesh-torus`:

{% shader mode="postfx", scene="mesh-cube", height=300, caption="scene=\"mesh-cube\" — flat normals; the normal buffer should show three flat colours." %}
void mainImage(out vec4 O, in vec2 uv) {
    O = vec4(sampleAlbedo(uv), sampleMask(uv));
}
{% endshader %}

{% shader mode="postfx", scene="mesh-torus", height=300, caption="scene=\"mesh-torus\" — smooth normals sweeping around the tube." %}
void mainImage(out vec4 O, in vec2 uv) {
    O = vec4(sampleAlbedo(uv), sampleMask(uv));
}
{% endshader %}

## An effect that reads normal + depth (SDF preset)

`scene="sdf-spheres"` is the depth-testbed preset. Here the post-process is a live-editable
depth+normal edge detector, so you can confirm derivative effects behave (and don't band)
regardless of which scene feeds them. Edit the kernel and watch it recompile.

{% shader mode="postfx", scene="sdf-spheres", editable=true, height=360, caption="scene=\"sdf-spheres\" with a live Laplacian edge pass — try scene=\"mesh-torus\" mentally: the same edit works there too." %}
void mainImage(out vec4 O, in vec2 uv) {
    // Laplacian of depth + normals -> outline, over the beauty pass.
    float c  = sampleDepth(uv);
    float l  = sampleDepth(uv - vec2(iTexel.x, 0.0));
    float r  = sampleDepth(uv + vec2(iTexel.x, 0.0));
    float u  = sampleDepth(uv + vec2(0.0, iTexel.y));
    float dn = sampleDepth(uv - vec2(0.0, iTexel.y));
    float depthLap = abs(l + r + u + dn - 4.0 * c);

    vec3 nc = sampleNormal(uv);
    vec3 nl = sampleNormal(uv - vec2(iTexel.x, 0.0));
    vec3 nr = sampleNormal(uv + vec2(iTexel.x, 0.0));
    vec3 nu = sampleNormal(uv + vec2(0.0, iTexel.y));
    vec3 nd = sampleNormal(uv - vec2(0.0, iTexel.y));
    float normalLap = length(nl + nr + nu + nd - 4.0 * nc);

    float edge = smoothstep(0.02, 0.20, depthLap * 12.0 + normalLap * 1.5);
    vec3 col = mix(sampleAlbedo(uv), vec3(0.04, 0.05, 0.05), edge);
    O = vec4(col, edge);
}
{% endshader %}

## What to check

- **All four channels populate on every scene** — flip *beauty / normal / depth / mask* under
  each canvas. Background = far depth (white), mask 0; object = mask 1.
- **Framing matches** between the SDF and mesh embeds (same orbit target, FOV, and zoom).
- **No banding** in the edge pass — the G-buffer is `RGBA16F` where supported.
- **Editing still works** on the last embed, with last-good-kept-on-error behaviour.
