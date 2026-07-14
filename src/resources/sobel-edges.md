---
title: Sobel edge detection
description: Real-time outlines from a G-buffer — run a Sobel filter over depth and normals, and edit the post-process live.
family: Edge detection
difficulty: Intermediate
emoji: 🔲
shaders: true
---

Edge detection is the backbone of a lot of stylised rendering — outlines, toon
shading, "blueprint" looks, selection highlights. The naïve version runs a filter over
the **final image's brightness**, which works but smears: it fires on textures and
lighting as much as on real shape. The game-ready version runs the same filter over the
**geometry buffers** instead — *depth* and *normals* — so you get clean lines that follow
the actual silhouette and creases of the mesh, and nothing else.

This page is a small **deferred-style playground**. A fixed scene pass raymarches an SDF
and writes three buffers; the shader below is the **post-process** that reads them. Use
the **buffers** switch under the canvas to see the raw channels the filter reads — or
**mask** to isolate the edge it produces — and **drag to orbit** the camera, with the
**+ / −** buttons (or pinch) to zoom.

## The buffers you get

The scene is rendered once into a compact G-buffer, then handed to your post-process pass:

```glsl
// available in the post-process (uv is 0..1, iTexel = 1.0 / resolution):
vec3  sampleAlbedo(vec2 uv);  // the lit "beauty" render
vec3  sampleNormal(vec2 uv);  // surface normal, decoded to -1..1
float sampleDepth (vec2 uv);  // linear depth, 0 (near) .. 1 (far)
float sampleMask  (vec2 uv);  // 1.0 on the object, 0.0 on the background
```

You only write the read-and-process step — the same split a real engine uses, where the
lighting pass fills the G-buffer and post-process shaders just consume it.

## Sobel, live

The [Sobel operator](https://en.wikipedia.org/wiki/Sobel_operator) estimates the gradient
of a field with two 3×3 kernels (one horizontal, one vertical); the length of that
gradient is your edge strength. Here it runs over **depth** (which catches silhouettes)
and over **normals** (which catch creases where depth barely changes). Edit the thresholds
and watch it recompile:

{% shader mode="postfx", editable=true, height=340, caption="Sobel over depth + normals, inked onto the lit render. Try the buffers switch, then push the numbers around." %}
void mainImage(out vec4 O, in vec2 uv) {
    // --- Sobel over depth: catches silhouettes (big depth jumps) ---
    // Sample a 3x3 neighbourhood: index 0 1 2 / 3 4 5 / 6 7 8
    float d[9];
    int k = 0;
    for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++)
            d[k++] = sampleDepth(uv + vec2(float(x), float(y)) * iTexel);

    float gx = (d[2] + 2.0 * d[5] + d[8]) - (d[0] + 2.0 * d[3] + d[6]);
    float gy = (d[6] + 2.0 * d[7] + d[8]) - (d[0] + 2.0 * d[1] + d[2]);
    float depthEdge = length(vec2(gx, gy));

    // --- Normal differences: catch creases the depth filter misses ---
    vec3 n  = sampleNormal(uv);
    vec3 nx = sampleNormal(uv + vec2(iTexel.x, 0.0));
    vec3 ny = sampleNormal(uv + vec2(0.0, iTexel.y));
    float normalEdge = (1.0 - dot(n, nx)) + (1.0 - dot(n, ny));

    // Blend the two cues, then threshold into a crisp line.
    float edge = smoothstep(0.10, 0.60, depthEdge * 6.0 + normalEdge * 4.0);

    // Ink the edges over the beauty pass. Alpha carries the edge strength, so the
    // "mask" button under the canvas can show it isolated.
    vec3 col = sampleAlbedo(uv);
    col = mix(col, vec3(0.04, 0.05, 0.05), edge);
    O = vec4(col, edge);
}
{% endshader %}

## Things to try

- **See the mask on its own:** replace the last three lines with `O = vec4(vec3(edge), 1.0);`.
- **Depth only vs. normals only:** drop the `normalEdge` term (set its weight to `0.0`) and
  flip to the **depth** buffer — you'll see silhouettes stay but interior creases vanish.
  Then do the opposite. That contrast *is* the lesson.
- **Line weight:** widen the taps by scaling `iTexel` (e.g. `* 2.0`) for chunkier outlines.
- **Coloured lines:** change the ink colour, or `mix` toward a hue instead of near-black.

## Why depth *and* normals

Depth catches **silhouette** edges — where the surface drops away to something much
further back — because those are large jumps in the depth buffer. But two faces of the
same box meeting at a corner are at almost the same depth, so a depth-only filter slides
right over them. **Normals** change sharply there even when depth doesn't, so adding a
normal-difference term recovers those interior creases. Real outline shaders (from *Guilty
Gear* to countless toon pipelines) combine both for exactly this reason.

The same kernel in HLSL, for reference — the maths is identical, only the sampling API
differs:

```hlsl
float SobelDepth(Texture2D depthTex, SamplerState s, float2 uv, float2 texel)
{
    float d[9];
    [unroll] for (int i = 0; i < 9; i++) {
        int2 o = int2(i % 3 - 1, i / 3 - 1);
        d[i] = depthTex.Sample(s, uv + o * texel).r;
    }
    float gx = (d[2] + 2 * d[5] + d[8]) - (d[0] + 2 * d[3] + d[6]);
    float gy = (d[6] + 2 * d[7] + d[8]) - (d[0] + 2 * d[1] + d[2]);
    return length(float2(gx, gy));
}
```

Next in this family: the **Laplacian** (a single-kernel edge detector), and using edges as
a *mask* to drive a toon ramp rather than just inking lines.
