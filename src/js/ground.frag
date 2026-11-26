#version 300 es
// ground.frag: the map that javieramador.dev is drawn on.
// Open "ground.frag" at the bottom-left of any page to edit it live.
precision highp float;

uniform vec2  uRes;        // canvas size in pixels
uniform float uTime;       // seconds since load
uniform float uScroll;     // page scroll in pixels: the sheet slides with the page
uniform vec2  uMouse;      // survey cursor, in map space
uniform float uLift;       // 0..1 while the cursor is over the page
uniform float uNight;      // 0 = day sheet, 1 = night sheet
uniform vec2  uOrigin;     // where the night flood starts (the button), in map space
uniform vec4  uClicks[8];  // xy = where (map space), z = when (uTime), w = kind: 1 peak, <1 ripple
uniform vec3  uPaper, uInk, uIndex;     // day palette
uniform vec3  uPaperN, uInkN, uIndexN;  // night palette
out vec4 fragColor;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) { s += a * noise(p); p = r * p; a *= 0.5; }
    return s;
}
// Domain-warped terrain: ridges and valleys fold into each other like real land.
float terrain(vec2 p) {
    vec2 q = p * 0.62 + vec2(uTime * 0.010, -uScroll * 0.0010);
    vec2 w = vec2(fbm(q + vec2(1.7, 9.2)), fbm(q + vec2(8.3, 2.8)));
    return fbm(q + 0.55 * w);
}
// An antialiased contour of v at integer spacing, about widthPx pixels wide.
float iso(float v, float widthPx) {
    return 1.0 - smoothstep(0.0, fwidth(v) * widthPx, abs(fract(v + 0.5) - 0.5));
}

void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * 2.4;
    float h = terrain(p);

    // The survey cursor raises a soft hill.
    float dm = length(p - uMouse);
    h += 0.12 * uLift * exp(-dm * dm * 4.0);

    // Clicks raise a peak that grows, then erodes; fast cursor moves leave ripples.
    float ring = 0.0, peak = 0.0;
    for (int i = 0; i < 8; i++) {
        vec4 c = uClicks[i];
        float age = uTime - c.z;
        if (c.w <= 0.0 || age < 0.0) continue;
        float r = length(p - c.xy);
        if (c.w >= 0.99) {
            if (age > 24.0) continue;
            float grow = smoothstep(0.0, 1.2, age) * (1.0 - smoothstep(6.0, 24.0, age));
            float bump = 0.30 * grow * exp(-r * r * 5.0);
            h += bump; peak = max(peak, bump);
        } else {
            if (age > 6.0) continue;
            float front = age * 0.55;
            float env = exp(-pow((r - front) * 2.6, 2.0)) * exp(-age * 0.5) * c.w;
            h += 0.05 * sin((r - front) * 16.0) * env;
            ring = max(ring, env);
        }
    }

    // Night is a flood that pours out of the button and runs downhill.
    float level = mix(-0.25, 2.7, uNight) - 0.33 * length(p - uOrigin);
    float px  = fwidth(h);
    float wet = 1.0 - smoothstep(level - px, level + px, h);

    float f = h * 24.0;                                  // 24 contour levels
    float line  = iso(f, 1.0);
    float index = iso(f / 5.0, 1.6);                     // every 5th is an index contour
    vec3 n = normalize(vec3(-dFdx(h) * 110.0, -dFdy(h) * 110.0, 1.0));
    float shade = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.7))), 0.0, 1.0);

    // A light elevation tint: valleys lean green, uplands lean ochre; water deepens.
    float band = clamp(floor(h * 8.0) / 8.0, 0.0, 1.0);
    vec3 dayTint   = uPaper * mix(vec3(0.965, 0.985, 0.955), vec3(1.0, 0.985, 0.955), band);
    vec3 nightTint = uPaperN * mix(0.88, 1.18, band);

    vec3 paper = mix(dayTint, nightTint, wet);
    vec3 ink   = mix(uInk,   uInkN,   wet);
    vec3 idx   = mix(uIndex, uIndexN, wet);
    vec3 col = paper * (0.94 + 0.06 * mix(shade, 0.6, wet));
    col = mix(col, ink, line * mix(0.16, 0.28, wet));
    col = mix(col, idx, index * 0.55);
    col = mix(col, idx, line * max(ring * 0.8, smoothstep(0.02, 0.2, peak) * 0.7));

    // While the water moves: an ochre shoreline and two ripples behind it.
    float moving = step(0.002, uNight) * step(uNight, 0.998);
    float shore = 1.0 - smoothstep(0.0, px * 1.6, abs(h - level));
    float rip = 0.0;
    for (int i = 1; i <= 2; i++)
        rip += (1.0 - smoothstep(0.0, px * 1.2, abs(h - (level - float(i) * 0.022)))) * (0.55 / float(i));
    col = mix(col, uIndexN, clamp(shore + rip * wet, 0.0, 1.0) * moving);
    fragColor = vec4(col, 1.0);
}
