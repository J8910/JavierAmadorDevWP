#version 300 es
// slide.frag: two shots of one project; the cursor moves a waterline between them.
precision highp float;
uniform sampler2D uA, uB;   // first shot, second shot
uniform vec2  uRes;         // canvas size in pixels
uniform vec2  uFitA, uFitB; // object-fit: cover scale per shot (uv scale, centred)
uniform float uBar;         // the waterline's position, 0..1 across the image
uniform float uVel;         // how fast it is moving (signed)
uniform float uReveal;      // 0..1, the first shot develops from its contour survey on load
uniform vec3  uPaper, uInk, uIndex;
out vec4 fragColor;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float iso(float v, float w) { return 1.0 - smoothstep(0.0, fwidth(v) * w, abs(fract(v + 0.5) - 0.5)); }
vec2 cover(vec2 uv, vec2 fit) { return (uv - 0.5) * fit + 0.5; }

void main() {
    vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
    vec2 ua = cover(uv, uFitA), ub = cover(uv, uFitB);
    vec3 a = texture(uA, ua).rgb, b = texture(uB, ub).rgb;
    // Softened brightness of both shots is the terrain the waterline runs over.
    float ha = luma(texture(uA, ua, 3.0).rgb);
    float h = 0.5 * (ha + luma(texture(uB, ub, 3.0).rgb));

    // The waterline bends along the images' contours instead of running straight,
    // and bends harder the faster it moves.
    float speed = min(abs(uVel), 3.0);
    float front = uv.x - uBar + (0.06 + 0.10 * speed) * (h - 0.5);
    float px = fwidth(front);
    vec3 col = mix(b, a, smoothstep(-px, px, front));       // second shot behind the line

    // The ochre line, and ripples trailing it that spread with speed and fade at rest.
    float on = step(0.0, uBar) * step(uBar, 1.0);
    float line = 1.0 - smoothstep(0.0, px * 1.8, abs(front));
    float rip = 0.0;
    for (int i = 1; i <= 3; i++) {
        float off = float(i) * (0.010 + 0.030 * speed) * sign(uVel + 1e-4);
        rip += (1.0 - smoothstep(0.0, px * 1.2, abs(front - off))) * (0.7 / float(i));
    }
    col = mix(col, uPaper, clamp(rip, 0.0, 1.0) * 0.75 * on * smoothstep(0.05, 0.6, speed));
    col = mix(col, uIndex, line * on);

    // Load: the first shot floods in from its darkest values, over its own contour survey.
    float lv = uReveal * 1.15 - 0.05;
    float shown = smoothstep(ha - 0.025, ha + 0.025, lv);
    vec3 drawing = mix(uPaper, uInk, iso(ha * 14.0, 1.0) * 0.55);
    drawing = mix(drawing, uIndex, iso(ha * 14.0 / 5.0, 1.5) * 0.85);
    col = mix(drawing, col, shown);
    col = mix(col, uIndex, (1.0 - smoothstep(0.0, fwidth(ha) * 1.6, abs(ha - lv))) * step(uReveal, 0.999));
    fragColor = vec4(col, 1.0);
}
