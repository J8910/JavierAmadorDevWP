---
title: Depth of field
description: Read the depth buffer to blur what's out of focus — a live, adjustable lens effect.
family: Depth of field
difficulty: Advanced
emoji: 📷
shaders: true
---

Edge detection *inks* the depth buffer; depth of field *blurs* by it. A real lens only
holds one plane in sharp focus — everything nearer or farther spreads into a **circle of
confusion (CoC)** that grows with distance from that plane. As a post effect this is
wonderfully direct: read the depth buffer, turn `|depth − focus|` into a blur radius, and
gather the beauty pass over a disk that size.

Same G-buffer as the [edge](/resources/sobel-edges/) pages. Drag to orbit, `+ / −` to zoom,
and use the **buffers** switch — the **depth** channel *is* the control signal here, so it's
worth watching alongside the result — and the **mask** view shows the circle-of-confusion
map the blur is driven by.

## Focus, aperture, confusion

Three knobs do the work: the **focus** distance (which depth is sharp), the **aperture**
(how fast blur grows away from it), and a **max radius** (so the far plane doesn't smear
forever). The shader below pulls focus back and forth on its own so you can see the effect
breathe — pin `focus` to a constant to park it on the object or the ground:

{% shader mode="postfx", editable=true, height=360, caption="Depth-driven blur with an animated focus pull. Set `focus` to a constant, then push the aperture." %}
void mainImage(out vec4 O, in vec2 uv) {
    float focus    = 0.24 + 0.12 * sin(iTime * 0.6);   // animated pull; pin to hold
    float aperture = 40.0;                             // how fast blur grows off-focus
    float maxCoC   = 24.0;                             // max blur radius, in pixels

    // Circle of confusion for this pixel from its depth.
    float depth = sampleDepth(uv);
    float coc   = clamp(abs(depth - focus) * aperture, 0.0, maxCoC);

    // Gather the beauty pass over a disk of that radius, using a golden-angle
    // spiral so a handful of taps still covers the disk evenly.
    const int   TAPS = 24;
    const float GA   = 2.399963;                       // golden angle (radians)
    vec3  sum  = sampleAlbedo(uv);
    float wsum = 1.0;
    for (int i = 1; i <= TAPS; i++) {
        float t   = float(i) / float(TAPS);
        float ang = float(i) * GA;
        vec2  off = vec2(cos(ang), sin(ang)) * sqrt(t) * coc * iTexel;
        sum  += sampleAlbedo(uv + off);
        wsum += 1.0;
    }
    // Alpha carries the normalised CoC, so the "mask" button shows the blur map.
    O = vec4(sum / wsum, coc / maxCoC);
}
{% endshader %}

## Things to try

- **Park the focus:** replace the `focus` line with `float focus = 0.24;` (object) or a
  larger value like `0.5` (ground) to hold the plane still.
- **Open the aperture:** push `aperture` up for a dreamy, shallow look; drop it toward `0`
  and everything snaps sharp.
- **Fewer taps:** lower `TAPS` to see the spiral break into visible bokeh dots — sometimes
  a feature, not a bug.
- **Tilt-shift:** make `focus` depend on `uv.y` instead of depth for a fake-miniature band.

## The honest caveat

This is a **gather** blur: each pixel blurs itself using *its own* CoC. It's fast and reads
well, but it can't let a blurry foreground object bleed over a sharp background — that needs
a scatter pass or per-layer separation. It's the right first version to understand the idea;
the buffers are already here when you want to build the fancier one.
