---
title: "Shaders, live: GLSL in the browser (and HLSL alongside)"
date: 2026-07-13
category: shaders
emoji: 🧪
shaders: true
description: A mockup post for the live shader system — a running WebGL demo, its GLSL source, and an HLSL snippet shown side-by-side.
---

> **Note to self:** mockup post to test the `{% raw %}{% shader %}{% endraw %}` embed and
> `glsl` / `hlsl` highlighting. Safe to delete before launch.

Half of technical-art writing is "here's the code, here's what it *does*." A static
screenshot loses the motion; a wall of code loses the intuition. So on this site a shader
can **run right in the page**, with its source shown directly beneath it.

## A live one — edit it yourself

The code below the canvas *is* the shader driving it, and it's **editable**: change a number,
tweak the colours, and the canvas recompiles as you type. Try bumping the `0.4` in the ramp
or swapping the `green`/`amber` values. Broke it? The last working version keeps running and
the compile error shows over the canvas; hit **revert** to restore the original.

{% shader caption="Domain-warped flow — five cheap sine folds over a green→amber ramp. Editable: type to recompile.", height=300, editable=true %}
void mainImage(out vec4 O, in vec2 I)
{
    // Centre the coords and keep them square regardless of canvas size.
    vec2 uv = (2.0 * I - iResolution.xy) / iResolution.y;

    // Domain warping: fold the space back on itself a few times.
    float t = iTime * 0.15;
    for (float i = 1.0; i < 6.0; i++) {
        uv.x += 0.32 / i * sin(i * 2.4 * uv.y + t * 2.0 + i);
        uv.y += 0.30 / i * cos(i * 1.9 * uv.x + t * 1.7 + i);
    }

    // Ramp between a mossy green and a warm amber.
    float v = 0.5 + 0.5 * sin(uv.x * 2.0 + uv.y * 2.0 + iTime * 0.4);
    vec3 green = vec3(0.30, 0.48, 0.32);
    vec3 amber = vec3(0.93, 0.78, 0.42);
    vec3 col = mix(green, amber, v) * (0.7 + 0.3 * v);

    O = vec4(col, 1.0);
}
{% endshader %}

The embed follows the **Shadertoy convention**, so anything you prototype there drops
straight in: write `mainImage(out vec4, in vec2)` and you get `iResolution`, `iTime`, and
`iMouse` for free.

## It reads the pointer, too

`iMouse.xy` is the cursor in pixels — hover the canvas below and the glow follows you.

{% shader caption="Move your cursor over me — a soft light tracking iMouse.", height=220 %}
void mainImage(out vec4 O, in vec2 I)
{
    vec2 uv = I / iResolution.xy;
    vec2 m  = iMouse.xy / iResolution.xy;

    // Fall off from the cursor; drift to centre before it's ever touched.
    if (iMouse.xy == vec2(0.0)) m = vec2(0.5);
    float d = distance(uv, m);
    float glow = smoothstep(0.45, 0.0, d);

    vec3 col = mix(vec3(0.11, 0.12, 0.10), vec3(0.47, 0.68, 0.51), glow);
    O = vec4(col, 1.0);
}
{% endshader %}

## The HLSL side

WebGL only speaks GLSL, so HLSL can't *run* here — but it still gets first-class
highlighting, which is what you want when the source of truth is an Unreal **Custom** node
or a Unity surface function. Here's a rim-light term I reach for constantly:

```hlsl
// Unreal "Custom" node — Fresnel rim term.
// In:  N (float3 world normal), V (float3 view dir), power, scale, tint
// Out: float3 additive rim colour
float3 RimLight(float3 N, float3 V, float power, float scale, float3 tint)
{
    float fresnel = pow(saturate(1.0 - dot(normalize(N), normalize(V))), power);
    return tint * (fresnel * scale);
}
```

When a preview actually helps, I port the effect to a GLSL `mainImage` and drop it in a
live canvas next to the HLSL — same maths, running proof. The HLSL stays the reference; the
GLSL is the demo.

That's the whole system: **GLSL runs, HLSL is shown, and the source is never a screenshot.**
