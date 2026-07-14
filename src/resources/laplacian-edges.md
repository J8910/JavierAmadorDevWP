---
title: Laplacian edge detection
description: A one-kernel edge detector — the second derivative of depth and normals, live and editable.
family: Edge detection
difficulty: Beginner
emoji: 🔳
shaders: true
---

Where [Sobel](/resources/sobel-edges/) estimates the **first derivative** of an image (the
slope, from two directional kernels) and takes its magnitude, the **Laplacian** goes
straight for the **second derivative** — the change *in* the slope — with a single kernel.
It's cheaper (one convolution, no `gx`/`gy` to combine), rotationally symmetric, and tends
to draw **thinner** lines. The trade is that a second derivative amplifies noise, so it
usually wants a clean signal — which is exactly what a depth/normal buffer gives us.

This runs on the same G-buffer as the Sobel page (see there for the full pipeline write-up
and the `sampleAlbedo/Normal/Depth` API). Drag to orbit, `+ / −` to zoom, and use the
**buffers** switch to watch which channel the operator fires on — including a **mask**
view of the edge it draws.

## The kernel

The classic 4-neighbour Laplacian is a single 3×3 stencil:

```
 0  1  0
 1 -4  1
 0  1  0
```

It sums a pixel's neighbours and subtracts the centre four times: **zero on flat regions,
and a sharp spike (positive or negative) right at an edge.** Take the absolute value and
you have your edge strength. Edit it live:

{% shader mode="postfx", editable=true, height=340, caption="A single Laplacian kernel over depth + normals. Compare the line weight against the Sobel page." %}
void mainImage(out vec4 O, in vec2 uv) {
    // 4-neighbour Laplacian of depth:  (up + down + left + right) - 4 * centre
    float c  = sampleDepth(uv);
    float l  = sampleDepth(uv - vec2(iTexel.x, 0.0));
    float r  = sampleDepth(uv + vec2(iTexel.x, 0.0));
    float u  = sampleDepth(uv + vec2(0.0, iTexel.y));
    float dn = sampleDepth(uv - vec2(0.0, iTexel.y));
    float depthLap = abs(l + r + u + dn - 4.0 * c);

    // The same operator on the normal buffer catches creases depth barely sees.
    vec3 nc = sampleNormal(uv);
    vec3 nl = sampleNormal(uv - vec2(iTexel.x, 0.0));
    vec3 nr = sampleNormal(uv + vec2(iTexel.x, 0.0));
    vec3 nu = sampleNormal(uv + vec2(0.0, iTexel.y));
    vec3 nd = sampleNormal(uv - vec2(0.0, iTexel.y));
    float normalLap = length(nl + nr + nu + nd - 4.0 * nc);

    float edge = smoothstep(0.02, 0.20, depthLap * 12.0 + normalLap * 1.5);

    // Ink the edges; alpha carries the edge so the "mask" button can isolate it.
    vec3 col = sampleAlbedo(uv);
    col = mix(col, vec3(0.04, 0.05, 0.05), edge);
    O = vec4(col, edge);
}
{% endshader %}

## Things to try

- **The raw response:** `O = vec4(vec3(edge), 1.0);` — notice the lines are crisper and
  thinner than Sobel's.
- **The 8-neighbour version:** add the four diagonals and change the centre weight to `-8`
  for a stronger, slightly thicker result.
- **Depth vs. normals:** zero the `normalLap` term and flip to the **depth** buffer — the
  Laplacian misses same-depth creases just like Sobel does, which is why we add normals.

## Sobel or Laplacian?

Both find edges from the same buffers; they differ in *character*. **Sobel** (gradient
magnitude) gives thicker, more forgiving lines and a direction you can reuse (for flow,
hatching, anisotropic effects). **Laplacian** (single kernel) is cheaper and thinner but
more sensitive — great when the input is clean, like a depth buffer. For stylised outlines,
try both on the same scene and pick the line weight you like.
