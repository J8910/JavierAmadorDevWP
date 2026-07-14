/* ------------------------------------------------------------------ *
 *  shaders.js — tiny WebGL runtime for {% shader %} embeds.
 *
 *  Only loaded on pages with `shaders: true` in their front matter. For each
 *  <figure class="shader"> it reads the GLSL from data-shader, compiles it, and
 *  animates it in the figure's <canvas>. Two modes share one lifecycle:
 *
 *   - CLASSIC (default): WebGL1, one full-screen triangle. The author writes a
 *     Shadertoy-style `void mainImage(out vec4, in vec2)` and gets iResolution /
 *     iTime / iMouse. `I` is pixel coordinates (gl_FragCoord.xy).
 *
 *   - POSTFX (`{% shader mode="postfx" %}`): WebGL2, a two-pass G-buffer pipeline.
 *     A scene pass writes albedo / normal / depth to three buffers (via MRT); the
 *     author's `mainImage(out vec4 O, in vec2 uv)` is the POST-PROCESS pass that
 *     reads them with sampleAlbedo/sampleNormal/sampleDepth(uv). `uv` is normalised
 *     [0,1]; `iTexel` = 1/resolution for neighbour taps. A per-figure "buffers"
 *     switch shows each raw channel. The scene pass is pluggable (`scene="…"`):
 *     an SDF raymarch (default) or a rasterized manifold mesh — both fill the SAME
 *     G-buffer, so the post-process is identical for either. See makeScene().
 *
 *  Design notes for future edits:
 *   - Each renderer (classic / postfx) exposes the same little interface —
 *     ready() / resize(w,h) / compile(src) -> {ok,error} / draw(elapsed,mouse) —
 *     so the shared setup() below handles play/pause, the IntersectionObserver,
 *     the live editor and error display once, for both.
 *   - Shaders compile lazily (IntersectionObserver) and only animate while on
 *     screen — a page of demos stays light.
 *   - prefers-reduced-motion starts paused on the first frame; the play button
 *     still works.
 *   - Compile/link errors are shown in .shader__err (the GPU's own log), which
 *     is what you actually want while writing shaders.
 *   - Editable embeds ({% shader editable=true %}) get a live editor: typing
 *     recompiles (debounced) and swaps the program; if an edit doesn't compile
 *     the LAST WORKING shader keeps running and the error is shown. A tiny
 *     GLSL highlighter keeps the code coloured while you type (no Prism in the
 *     browser — same .token classes the build-time theme in global.css styles).
 * ------------------------------------------------------------------ */
(function () {
    'use strict';

    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function lineCount(s) { return (String(s).match(/\n/g) || []).length; }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function compile(gl, type, src) {
        var sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            var log = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error(log || 'shader compile failed');
        }
        return sh;
    }

    // GPU logs number lines against the wrapped source; shift them back onto the
    // code the reader actually sees (offset = lines the wrapper adds on top).
    function fmtError(log, offset) {
        return String(log).replace(/ERROR:\s*0:(\d+)/g, function (_, n) {
            return 'ERROR: line ' + Math.max(1, (+n) - offset);
        }).trim();
    }

    /* --- Minimal GLSL highlighter (editable embeds only) --------------
       Emits the same .token classes the build-time Prism theme colours, so
       typed code matches the server-rendered code exactly. */
    var KEYWORD = /^(?:attribute|const|uniform|varying|break|continue|do|for|while|if|else|return|discard|struct|in|out|inout|void|true|false|precision|highp|mediump|lowp|layout|switch|case|default)$/;
    var TYPE = /^(?:float|int|uint|bool|vec[234]|ivec[234]|uvec[234]|bvec[234]|mat[234]|mat[234]x[234]|sampler2D|sampler3D|samplerCube)$/;
    var CONST = /^i(?:Resolution|Time|Mouse|Texel|Albedo|Normal|Depth)$/;
    var TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b|\.\d+)|([A-Za-z_]\w*)|([{}()\[\];,.])|([+\-*\/%<>=!&|^~?:]+)/g;

    function escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function highlight(src) {
        var out = '', last = 0, m;
        TOKEN.lastIndex = 0;
        while ((m = TOKEN.exec(src))) {
            out += escHtml(src.slice(last, m.index));
            last = TOKEN.lastIndex;
            if (m[1]) { out += span('comment', m[1]); }
            else if (m[2]) { out += span('number', m[2]); }
            else if (m[3]) {
                var w = m[3], cls = null;
                if (KEYWORD.test(w)) { cls = 'keyword'; }
                else if (TYPE.test(w)) { cls = 'builtin'; }
                else if (CONST.test(w)) { cls = 'constant'; }
                else if (/^\s*\(/.test(src.slice(last))) { cls = 'function'; }
                out += cls ? span(cls, w) : escHtml(w);
            }
            else if (m[4]) { out += span('punctuation', m[4]); }
            else if (m[5]) { out += span('operator', m[5]); }
        }
        out += escHtml(src.slice(last));
        // Keep a trailing newline visible in the <pre> so it tracks the textarea.
        if (src.charCodeAt(src.length - 1) === 10) { out += '\n'; }
        return out;
    }
    function span(cls, text) { return '<span class="token ' + cls + '">' + escHtml(text) + '</span>'; }

    // Full-screen triangle geometry, shared by every program in a renderer.
    var TRI = new Float32Array([-1, -1, 3, -1, -1, 3]);

    /* ================================================================ *
     *  Classic renderer — WebGL1, single Shadertoy-style pass.
     * ================================================================ */
    var C_HEADER =
        'precision highp float;\n' +
        'uniform vec3 iResolution;\n' +   // viewport in pixels (z unused, kept for parity)
        'uniform float iTime;\n' +        // seconds since start
        'uniform vec4 iMouse;\n';         // xy = current, zw = last click (pixels)
    var C_FOOTER =
        '\nvoid main(){ vec4 c = vec4(0.0, 0.0, 0.0, 1.0);' +
        ' mainImage(c, gl_FragCoord.xy); gl_FragColor = vec4(c.rgb, 1.0); }';
    var C_VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
    var C_OFFSET = lineCount(C_HEADER);

    function makeClassicRenderer(gl, canvas) {
        var vsh = compile(gl, gl.VERTEX_SHADER, C_VERT);   // may throw -> caught by setup
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, TRI, gl.STATIC_DRAW);

        var program = null, uRes = null, uTime = null, uMouse = null;

        function compileUser(userSrc) {
            var fs;
            try { fs = compile(gl, gl.FRAGMENT_SHADER, C_HEADER + userSrc + C_FOOTER); }
            catch (e) { return { ok: false, error: fmtError(e.message, C_OFFSET) }; }

            var prog = gl.createProgram();
            gl.attachShader(prog, vsh);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            gl.deleteShader(fs);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                var log = gl.getProgramInfoLog(prog);
                gl.deleteProgram(prog);
                return { ok: false, error: fmtError(log || 'link failed', C_OFFSET) };
            }
            if (program) { gl.deleteProgram(program); }
            program = prog;
            gl.useProgram(program);
            uRes = gl.getUniformLocation(program, 'iResolution');
            uTime = gl.getUniformLocation(program, 'iTime');
            uMouse = gl.getUniformLocation(program, 'iMouse');
            var loc = gl.getAttribLocation(program, 'p');
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            return { ok: true };
        }

        return {
            ready: function () { return !!program; },
            resize: function (w, h) { gl.viewport(0, 0, w, h); },
            compile: compileUser,
            draw: function (elapsed, mouse) {
                if (!program) { return; }
                gl.uniform3f(uRes, canvas.width, canvas.height, 1);
                gl.uniform1f(uTime, elapsed);
                gl.uniform4f(uMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
        };
    }

    /* ================================================================ *
     *  Postfx renderer — WebGL2, two-pass G-buffer pipeline.
     *
     *  Pass 1 (fixed SCENE): raymarch an SDF, write three buffers via MRT
     *      0: albedo (lit "beauty")   1: normal (n*0.5+0.5)   2: depth (linear
     *      [0,1], replicated to rgb; alpha = hit mask). Buffers are RGBA16F when
     *      EXT_color_buffer_float is available (half-float precision — needed so
     *      derivative post-effects like Laplacian/Sobel edges or DoF don't band
     *      on the ~1/255 quantization steps of 8-bit), falling back to RGBA8 on
     *      the rare WebGL2 device without it. Half-float is core-linearly-
     *      filterable in WebGL2, so LINEAR sampling works either way, and the
     *      author-facing [0,1] channel layout is identical in both formats.
     *  Pass 2 (author POSTFX or a channel BLIT): reads those buffers -> screen.
     * ================================================================ */
    var P_VERT = '#version 300 es\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

    /* --- SDF scene (raymarched) -------------------------------------- *
     *  Split into three parts so presets — and, later, a live editor — vary only
     *  the map()/material() MIDDLE: HEAD supplies the primitives + uniforms/outputs,
     *  TAIL the shared normal / lighting / orbit-camera. Full source assembled as
     *  HEAD + <map> + '\n' + TAIL, so a GPU error line in <map> maps back by
     *  subtracting SCENE_OFFSET (= HEAD's line count). Every SDF preset writes the
     *  same G-buffer the mesh scene does, so the post-process is identical for both.
     * ---------------------------------------------------------------- */
    var SCENE_HEAD = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec3 iResolution;',
        'uniform float iTime;',
        'uniform vec4 iMouse;',
        'uniform vec3 iCam;',
        'layout(location = 0) out vec4 oAlbedo;',
        'layout(location = 1) out vec4 oNormal;',
        'layout(location = 2) out vec4 oDepth;',
        '',
        'float sdSphere(vec3 p, float r){ return length(p) - r; }',
        'float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }',
        'float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }',
        'vec2 closer(vec2 a, vec2 b){ return a.x < b.x ? a : b; }',
        ''
    ].join('\n');

    // map()/material() presets, keyed by the `scene` front-matter value.
    var SDF_MAPS = {
        'sdf': [
            '// map returns vec2(distance, materialId). Primitives sdSphere / sdRoundBox',
            '// / sdTorus and the closer() combiner come from the header above.',
            'vec2 map(vec3 p){',
            '    vec2 res = vec2(p.y + 1.0, 1.0);              // ground plane, id 1',
            '    res = closer(res, vec2(sdRoundBox(p - vec3(0.0, -0.1, 0.0), vec3(0.55), 0.06), 2.0));',
            '    res = closer(res, vec2(sdTorus(p - vec3(0.0, 0.75, 0.0), vec2(0.5, 0.14)), 3.0));',
            '    return res;',
            '}',
            '',
            'vec3 material(float id){',
            '    if (id < 1.5) return vec3(0.42, 0.46, 0.40);   // ground',
            '    if (id < 2.5) return vec3(0.83, 0.45, 0.32);   // box (terracotta)',
            '    return vec3(0.33, 0.52, 0.63);                 // torus (slate)',
            '}'
        ].join('\n'),
        'sdf-spheres': [
            '// three spheres receding in depth — a clean testbed for depth effects.',
            'vec2 map(vec3 p){',
            '    vec2 res = vec2(p.y + 1.0, 1.0);              // ground plane, id 1',
            '    res = closer(res, vec2(sdSphere(p - vec3(-0.95, -0.4, 0.9), 0.6), 2.0));',
            '    res = closer(res, vec2(sdSphere(p - vec3(0.35, -0.3, -0.1), 0.7), 3.0));',
            '    res = closer(res, vec2(sdSphere(p - vec3(1.5, -0.5, -1.4), 0.5), 2.0));',
            '    return res;',
            '}',
            '',
            'vec3 material(float id){',
            '    if (id < 1.5) return vec3(0.42, 0.46, 0.40);   // ground',
            '    if (id < 2.5) return vec3(0.83, 0.45, 0.32);   // terracotta',
            '    return vec3(0.33, 0.52, 0.63);                 // slate',
            '}'
        ].join('\n')
    };

    var SCENE_TAIL = [
        '',
        'vec3 calcNormal(vec3 p){',
        '    vec2 e = vec2(0.0012, 0.0);',
        '    return normalize(vec3(',
        '        map(p + e.xyy).x - map(p - e.xyy).x,',
        '        map(p + e.yxy).x - map(p - e.yxy).x,',
        '        map(p + e.yyx).x - map(p - e.yyx).x));',
        '}',
        '',
        'vec3 sky(vec3 rd){',
        '    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);',
        '    vec3 col = mix(vec3(0.80, 0.86, 0.92), vec3(0.32, 0.52, 0.82), h);',
        '    vec3 L = normalize(vec3(0.7, 0.85, 0.5));',
        '    col += vec3(1.0, 0.92, 0.72) * pow(clamp(dot(rd, L), 0.0, 1.0), 200.0) * 0.6;',
        '    return col;',
        '}',
        '',
        'void main(){',
        '    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;',
        '    vec3 ta = vec3(0.0, 0.15, 0.0);',
        '    float cp = cos(iCam.y);',
        '    vec3 dir = vec3(cp * sin(iCam.x), sin(iCam.y), cp * cos(iCam.x));',
        '    vec3 ro = ta + dir * iCam.z;',
        '    vec3 fw = normalize(ta - ro);',
        '    vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));',
        '    vec3 up = cross(rt, fw);',
        '    vec3 rd = normalize(uv.x * rt + uv.y * up + 1.5 * fw);',
        '    float t = 0.0, id = 0.0;',
        '    bool hit = false;',
        '    for (int i = 0; i < 90; i++){',
        '        vec3 p = ro + rd * t;',
        '        vec2 m = map(p);',
        '        if (m.x < 0.001){ id = m.y; hit = true; break; }',
        '        t += m.x;',
        '        if (t > 12.0) break;',
        '    }',
        '    vec3 albedo = sky(rd);',
        '    vec3 N = vec3(0.0, 0.0, 1.0);',
        '    float depth = 1.0;',
        '    if (hit){',
        '        vec3 p = ro + rd * t;',
        '        N = calcNormal(p);',
        '        vec3 base = material(id);',
        '        vec3 L = normalize(vec3(0.7, 0.85, 0.5));',
        '        float dif = clamp(dot(N, L), 0.0, 1.0);',
        '        vec3 H = normalize(L - rd);',
        '        float spe = pow(clamp(dot(N, H), 0.0, 1.0), 40.0) * 0.35;',
        '        albedo = base * (0.28 + dif) + spe;',
        '        depth = clamp(t / 12.0, 0.0, 1.0);',
        '    }',
        '    oAlbedo = vec4(albedo, 1.0);',
        '    oNormal = vec4(N * 0.5 + 0.5, 1.0);',
        '    oDepth  = vec4(vec3(depth), hit ? 1.0 : 0.0);',
        '}'
    ].join('\n');
    var SCENE_OFFSET = lineCount(SCENE_HEAD);

    /* --- Mesh scene (rasterized manifold primitives) ----------------- *
     *  The other way to fill the SAME G-buffer: real triangle geometry through the
     *  rasterizer with a depth buffer, so posts can contrast SDF raymarching with a
     *  classic vertex/rasterize pipeline. The vertex shader is fixed for now (making
     *  it reader-editable — vertex displacement etc. — is the natural next step). The
     *  fragment writes the identical albedo / normal / [0,1]-depth / mask layout, so
     *  every post-process effect runs unchanged on a mesh scene.
     * ---------------------------------------------------------------- */
    var MESH_VERT = [
        '#version 300 es',
        'in vec3 aPos;',
        'in vec3 aNormal;',
        'in vec3 aColor;',
        'uniform mat4 uViewProj;',
        'uniform float iTime;',
        'out vec3 vColor;',
        'out vec3 vNormal;',
        'out vec3 vWorld;',
        'void main(){',
        '    vec3 pos = aPos;              // (editable vertex work would displace here)',
        '    vWorld = pos;',
        '    vNormal = aNormal;',
        '    vColor = aColor;',
        '    gl_Position = uViewProj * vec4(pos, 1.0);',
        '}'
    ].join('\n');
    var MESH_FRAG = [
        '#version 300 es',
        'precision highp float;',
        'in vec3 vColor;',
        'in vec3 vNormal;',
        'in vec3 vWorld;',
        'uniform vec3 uCam;',
        'layout(location = 0) out vec4 oAlbedo;',
        'layout(location = 1) out vec4 oNormal;',
        'layout(location = 2) out vec4 oDepth;',
        'void main(){',
        '    vec3 N = normalize(vNormal);',
        '    vec3 L = normalize(vec3(0.7, 0.85, 0.5));',
        '    float dif = clamp(dot(N, L), 0.0, 1.0);',
        '    vec3 V = normalize(uCam - vWorld);',
        '    vec3 H = normalize(L + V);',
        '    float spe = pow(clamp(dot(N, H), 0.0, 1.0), 40.0) * 0.35;',
        '    vec3 albedo = vColor * (0.28 + dif) + spe;',
        '    float depth = clamp(length(vWorld - uCam) / 12.0, 0.0, 1.0);   // matches SDF t/12',
        '    oAlbedo = vec4(albedo, 1.0);',
        '    oNormal = vec4(N * 0.5 + 0.5, 1.0);',
        '    oDepth  = vec4(vec3(depth), 1.0);',
        '}'
    ].join('\n');

    // Tiny column-major mat4 helpers (no gl-matrix dependency — same "vendor
    // nothing to the client" stance as the in-browser highlighter above).
    function perspective(fovy, aspect, near, far) {
        var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), m = new Float32Array(16);
        m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
        return m;
    }
    function lookAt(eye, center, up) {
        var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
        var zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
        var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
        var xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
        var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
        var m = new Float32Array(16);
        m[0] = xx; m[1] = yx; m[2] = zx; m[3] = 0;
        m[4] = xy; m[5] = yy; m[6] = zy; m[7] = 0;
        m[8] = xz; m[9] = yz; m[10] = zz; m[11] = 0;
        m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
        m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
        m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
        m[15] = 1;
        return m;
    }
    function mat4mul(a, b) {                      // a * b, both column-major
        var o = new Float32Array(16);
        for (var c = 0; c < 4; c++) {
            for (var r = 0; r < 4; r++) {
                o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
            }
        }
        return o;
    }

    // Interleaved [pos(3), normal(3), colour(3)] verts + Uint16 indices for a
    // ground plane plus one manifold primitive (sphere / cube / torus).
    function meshData(primitive) {
        var V = [], I = [];
        var GROUND = [0.42, 0.46, 0.40], TERRA = [0.83, 0.45, 0.32], SLATE = [0.33, 0.52, 0.63];
        function vert(px, py, pz, nx, ny, nz, c) { V.push(px, py, pz, nx, ny, nz, c[0], c[1], c[2]); }
        function quad(cx, cy, cz, ux, uy, uz, vx, vy, vz, nx, ny, nz, c) {
            var o = V.length / 9;
            vert(cx - ux - vx, cy - uy - vy, cz - uz - vz, nx, ny, nz, c);
            vert(cx + ux - vx, cy + uy - vy, cz + uz - vz, nx, ny, nz, c);
            vert(cx + ux + vx, cy + uy + vy, cz + uz + vz, nx, ny, nz, c);
            vert(cx - ux + vx, cy - uy + vy, cz - uz + vz, nx, ny, nz, c);
            I.push(o, o + 1, o + 2, o, o + 2, o + 3);
        }

        // Ground plane at y = -1 (matches the SDF `p.y + 1.0` floor).
        quad(0, -1, 0, 6, 0, 0, 0, 0, 6, 0, 1, 0, GROUND);

        if (primitive === 'cube') {
            var h = 0.55, y = -1 + h;
            quad( h, y, 0, 0, h, 0, 0, 0, h,  1, 0, 0, TERRA);
            quad(-h, y, 0, 0, h, 0, 0, 0, h, -1, 0, 0, TERRA);
            quad(0, y + h, 0, h, 0, 0, 0, 0, h, 0,  1, 0, TERRA);
            quad(0, y - h, 0, h, 0, 0, 0, 0, h, 0, -1, 0, TERRA);
            quad(0, y,  h, h, 0, 0, 0, h, 0, 0, 0,  1, TERRA);
            quad(0, y, -h, h, 0, 0, 0, h, 0, 0, 0, -1, TERRA);
        } else if (primitive === 'torus') {
            var Rr = 0.55, rr = 0.20, cyy = -0.25, seg = 48, side = 24, o = V.length / 9;
            for (var i = 0; i <= seg; i++) {
                var u = 2 * Math.PI * i / seg, cu = Math.cos(u), su = Math.sin(u);
                for (var k = 0; k <= side; k++) {
                    var vv = 2 * Math.PI * k / side, cv = Math.cos(vv), sv = Math.sin(vv);
                    vert((Rr + rr * cv) * cu, cyy + rr * sv, (Rr + rr * cv) * su, cv * cu, sv, cv * su, SLATE);
                }
            }
            var ts = side + 1;
            for (i = 0; i < seg; i++) for (k = 0; k < side; k++) {
                var a = o + i * ts + k; I.push(a, a + ts, a + 1, a + 1, a + ts, a + ts + 1);
            }
        } else {                                 // sphere (default)
            var R = 0.62, cy = -1 + R, segS = 48, rings = 32, os = V.length / 9;
            for (var j = 0; j <= rings; j++) {
                var phi = Math.PI * j / rings, sp = Math.sin(phi), cpp = Math.cos(phi);
                for (var m = 0; m <= segS; m++) {
                    var th = 2 * Math.PI * m / segS, nx = sp * Math.cos(th), nz = sp * Math.sin(th);
                    vert(R * nx, cy + R * cpp, R * nz, nx, cpp, nz, TERRA);
                }
            }
            var ss = segS + 1;
            for (j = 0; j < rings; j++) for (m = 0; m < segS; m++) {
                var b = os + j * ss + m; I.push(b, b + ss, b + 1, b + 1, b + ss, b + ss + 1);
            }
        }
        return { data: new Float32Array(V), index: new Uint16Array(I), count: I.length };
    }

    var P_HEAD = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec3 iResolution;',
        'uniform float iTime;',
        'uniform vec4 iMouse;',
        'uniform vec2 iTexel;',                              // 1.0 / resolution
        'uniform sampler2D iAlbedo;',
        'uniform sampler2D iNormal;',
        'uniform sampler2D iDepth;',
        'uniform float iInspect;',                          // 1.0 = show O.a as a grayscale mask',
        'out vec4 fragColor;',
        'vec3 sampleAlbedo(vec2 uv){ return texture(iAlbedo, uv).rgb; }',
        'vec3 sampleNormal(vec2 uv){ return texture(iNormal, uv).xyz * 2.0 - 1.0; }',
        'float sampleDepth(vec2 uv){ return texture(iDepth, uv).r; }',
        'float sampleMask(vec2 uv){ return texture(iDepth, uv).a; }',
        ''
    ].join('\n');
    var P_FOOT =
        '\nvoid main(){ vec4 c = vec4(0.0, 0.0, 0.0, 1.0);' +
        ' vec2 uv = gl_FragCoord.xy / iResolution.xy; mainImage(c, uv);' +
        ' fragColor = (iInspect > 0.5) ? vec4(vec3(c.a), 1.0) : vec4(c.rgb, 1.0); }';
    var P_OFFSET = lineCount(P_HEAD);

    var P_BLIT = [
        '#version 300 es',
        'precision highp float;',
        'uniform sampler2D uTex;',
        'uniform vec3 iResolution;',
        'uniform int uMode;',                               // 0 = rgb, 1 = grayscale (.r)
        'out vec4 o;',
        'void main(){ vec2 uv = gl_FragCoord.xy / iResolution.xy; vec4 c = texture(uTex, uv);',
        '    o = (uMode == 1) ? vec4(c.rrr, 1.0) : vec4(c.rgb, 1.0); }'
    ].join('\n');

    // Link a standalone vertex+fragment program (each scene owns its own vertex
    // stage: fullscreen triangle for SDF, real 3D transform for mesh).
    function linkProgram(gl, vsSrc, fsSrc, offset) {
        var vs, fs;
        try { vs = compile(gl, gl.VERTEX_SHADER, vsSrc); }
        catch (e) { return { error: fmtError(e.message, offset || 0) }; }
        try { fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc); }
        catch (e) { gl.deleteShader(vs); return { error: fmtError(e.message, offset || 0) }; }
        var p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
        gl.deleteShader(vs); gl.deleteShader(fs);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            var log = gl.getProgramInfoLog(p); gl.deleteProgram(p);
            return { error: fmtError(log || 'link failed', offset || 0) };
        }
        return { program: p };
    }

    /* Scene modules — both expose ready() / error() / draw(t, mouse, cam, w, h) and
       fill the currently-bound G-buffer FBO (drawBuffers + viewport already set by
       the caller). makeSdfScene also exposes compile(map) for a future live editor. */
    function makeSdfScene(gl, tri, mapSrc) {
        var prog = null, U = null, err = null;
        function build(map) {
            var r = linkProgram(gl, P_VERT, SCENE_HEAD + map + '\n' + SCENE_TAIL, SCENE_OFFSET);
            if (r.error) { return { ok: false, error: r.error }; }
            if (prog) { gl.deleteProgram(prog); }
            prog = r.program; err = null;
            U = {
                res: gl.getUniformLocation(prog, 'iResolution'),
                time: gl.getUniformLocation(prog, 'iTime'),
                mouse: gl.getUniformLocation(prog, 'iMouse'),
                cam: gl.getUniformLocation(prog, 'iCam')
            };
            return { ok: true };
        }
        var init = build(mapSrc); if (!init.ok) { err = init.error; }
        return {
            ready: function () { return !!prog; },
            error: function () { return err; },
            compile: build,
            draw: function (elapsed, mouse, cam, w, h) {
                if (!prog) { return; }
                gl.disable(gl.DEPTH_TEST);
                gl.useProgram(prog);
                gl.bindBuffer(gl.ARRAY_BUFFER, tri);
                var pl = gl.getAttribLocation(prog, 'p');
                gl.enableVertexAttribArray(pl);
                gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
                gl.uniform3f(U.res, w, h, 1);
                gl.uniform1f(U.time, elapsed);
                gl.uniform4f(U.mouse, mouse[0], mouse[1], mouse[2], mouse[3]);
                gl.uniform3f(U.cam, cam[0], cam[1], cam[2]);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
        };
    }

    function makeMeshScene(gl, primitive) {
        var r = linkProgram(gl, MESH_VERT, MESH_FRAG);
        var prog = r.program || null, err = r.error || null;
        var U = prog ? {
            vp: gl.getUniformLocation(prog, 'uViewProj'),
            time: gl.getUniformLocation(prog, 'iTime'),
            cam: gl.getUniformLocation(prog, 'uCam')
        } : null;
        var aPos = prog ? gl.getAttribLocation(prog, 'aPos') : -1;
        var aNor = prog ? gl.getAttribLocation(prog, 'aNormal') : -1;
        var aCol = prog ? gl.getAttribLocation(prog, 'aColor') : -1;
        var mesh = meshData(primitive);
        var vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
        var ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.index, gl.STATIC_DRAW);
        var STRIDE = 9 * 4;
        return {
            ready: function () { return !!prog; },
            error: function () { return err; },
            draw: function (elapsed, mouse, cam, w, h) {
                if (!prog) { return; }
                var ta = [0.0, 0.05, 0.0], cp = Math.cos(cam[1]);
                var dir = [cp * Math.sin(cam[0]), Math.sin(cam[1]), cp * Math.cos(cam[0])];
                var eye = [ta[0] + dir[0] * cam[2], ta[1] + dir[1] * cam[2], ta[2] + dir[2] * cam[2]];
                var vp = mat4mul(perspective(2 * Math.atan(0.5 / 1.5), w / h, 0.05, 40.0),
                    lookAt(eye, ta, [0, 1, 0]));
                // Clear the G-buffer to background: sky-ish albedo, +Z normal, far depth,
                // mask 0 — the same "miss" values the SDF scene writes for the sky.
                gl.clearBufferfv(gl.COLOR, 0, [0.62, 0.72, 0.86, 1]);
                gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 1.0, 1]);
                gl.clearBufferfv(gl.COLOR, 2, [1, 1, 1, 0]);
                gl.clearDepth(1.0); gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
                gl.useProgram(prog);
                gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
                gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, STRIDE, 0);
                gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, STRIDE, 12);
                gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, STRIDE, 24);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
                gl.uniformMatrix4fv(U.vp, false, vp);
                gl.uniform1f(U.time, elapsed);
                gl.uniform3f(U.cam, eye[0], eye[1], eye[2]);
                gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
                gl.disable(gl.DEPTH_TEST);
            }
        };
    }

    // `scene` front-matter value -> a scene module. "mesh-<prim>" rasterizes;
    // anything else is an SDF preset key (default "sdf").
    function makeScene(gl, tri, name) {
        if (name.indexOf('mesh') === 0) { return makeMeshScene(gl, name.slice(5) || 'sphere'); }
        return makeSdfScene(gl, tri, SDF_MAPS[name] || SDF_MAPS['sdf']);
    }

    function makePostfxRenderer(gl, canvas, sceneName) {
        // Half-float G-buffers when the GPU can render them (kills banding in
        // derivative post-effects); RGBA8 fallback keeps the [0,1] layout intact.
        var floatRT = !!gl.getExtension('EXT_color_buffer_float');

        var vsh = compile(gl, gl.VERTEX_SHADER, P_VERT);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, TRI, gl.STATIC_DRAW);

        // Link a fragment source against the shared full-screen vertex shader
        // (post-process + channel blit; both cover every pixel).
        function link(fsSrc, offset) {
            var fs;
            try { fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc); }
            catch (e) { return { error: fmtError(e.message, offset || 0) }; }
            var prog = gl.createProgram();
            gl.attachShader(prog, vsh);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            gl.deleteShader(fs);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                var log = gl.getProgramInfoLog(prog);
                gl.deleteProgram(prog);
                return { error: fmtError(log || 'link failed', offset || 0) };
            }
            return { program: prog };
        }
        function bindGeom(prog) {
            var loc = gl.getAttribLocation(prog, 'p');
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        }

        // The scene pass (SDF raymarch or rasterized mesh) that fills the G-buffer.
        var scene = makeScene(gl, buf, sceneName || 'sdf');

        var blitR = link(P_BLIT);
        var blitProg = blitR.program || null;
        var blitU = blitProg ? {
            res: gl.getUniformLocation(blitProg, 'iResolution'),
            tex: gl.getUniformLocation(blitProg, 'uTex'),
            mode: gl.getUniformLocation(blitProg, 'uMode')
        } : null;

        var userProg = null, userU = null;

        // G-buffer: one FBO with three colour attachments + a depth renderbuffer
        // (needed for the mesh scene's rasterizer; harmless to the SDF scene, which
        // leaves depth testing off). All resized with the canvas.
        var fbo = gl.createFramebuffer();
        var depthRB = gl.createRenderbuffer();
        var texA = null, texN = null, texD = null, fbW = 0, fbH = 0;
        var DRAWBUFS = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2];
        var view = 'final';

        function makeTex(w, h) {
            var t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            if (floatRT) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
            } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            }
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        }
        function resize(w, h) {
            if (w !== fbW || h !== fbH) {
                fbW = w; fbH = h;
                if (texA) { gl.deleteTexture(texA); gl.deleteTexture(texN); gl.deleteTexture(texD); }
                texA = makeTex(w, h); texN = makeTex(w, h); texD = makeTex(w, h);
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, texN, 0);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, texD, 0);
                gl.bindRenderbuffer(gl.RENDERBUFFER, depthRB);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRB);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
            gl.viewport(0, 0, w, h);
        }

        function compileUser(userSrc) {
            if (scene.error()) { return { ok: false, error: 'scene pass failed to compile:\n' + scene.error() }; }
            var res = link(P_HEAD + userSrc + P_FOOT, P_OFFSET);
            if (res.error) { return { ok: false, error: res.error }; }
            if (userProg) { gl.deleteProgram(userProg); }
            userProg = res.program;
            gl.useProgram(userProg);
            userU = {
                res: gl.getUniformLocation(userProg, 'iResolution'),
                time: gl.getUniformLocation(userProg, 'iTime'),
                mouse: gl.getUniformLocation(userProg, 'iMouse'),
                texel: gl.getUniformLocation(userProg, 'iTexel'),
                inspect: gl.getUniformLocation(userProg, 'iInspect')
            };
            // Samplers live on fixed texture units 0/1/2 (null locations no-op safely
            // when the author's code doesn't reference a given buffer).
            gl.uniform1i(gl.getUniformLocation(userProg, 'iAlbedo'), 0);
            gl.uniform1i(gl.getUniformLocation(userProg, 'iNormal'), 1);
            gl.uniform1i(gl.getUniformLocation(userProg, 'iDepth'), 2);
            return { ok: true };
        }

        function draw(elapsed, mouse, cam) {
            if (!userProg || !scene.ready()) { return; }
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);    // fill the G-buffer
            gl.drawBuffers(DRAWBUFS);
            gl.viewport(0, 0, fbW, fbH);
            scene.draw(elapsed, mouse, cam, fbW, fbH);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // -> screen
            gl.viewport(0, 0, fbW, fbH);
            if (view === 'final' || view === 'mask') {
                // Both run the author's post-process; 'mask' just asks the wrapper to
                // output O.a (the effect's own scalar) as grayscale instead of O.rgb.
                gl.useProgram(userProg);
                bindGeom(userProg);
                gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
                gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texN);
                gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texD);
                gl.uniform3f(userU.res, fbW, fbH, 1);
                gl.uniform1f(userU.time, elapsed);
                gl.uniform4f(userU.mouse, mouse[0], mouse[1], mouse[2], mouse[3]);
                gl.uniform2f(userU.texel, 1 / fbW, 1 / fbH);
                gl.uniform1f(userU.inspect, view === 'mask' ? 1 : 0);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            } else {
                // Inspect one raw G-buffer channel (depth shown as grayscale).
                gl.useProgram(blitProg);
                bindGeom(blitProg);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, view === 'albedo' ? texA : view === 'normal' ? texN : texD);
                gl.uniform1i(blitU.tex, 0);
                gl.uniform1i(blitU.mode, view === 'depth' ? 1 : 0);
                gl.uniform3f(blitU.res, fbW, fbH, 1);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
        }

        return {
            ready: function () { return !!userProg && scene.ready(); },
            resize: resize,
            compile: compileUser,
            draw: draw,
            setView: function (v) { view = v; }
        };
    }

    /* ================================================================ *
     *  Shared lifecycle — controls, editor, autoplay, error display.
     * ================================================================ */
    function setup(fig) {
        var canvas = fig.querySelector('.shader__canvas');
        var errEl = fig.querySelector('.shader__err');
        var clock = fig.querySelector('.shader__clock');
        var toggleBtn = fig.querySelector('[data-act="toggle"]');
        var resetBtn = fig.querySelector('[data-act="reset"]');
        var input = fig.querySelector('.shader__input');            // present only if editable
        var codePre = fig.querySelector('.shader__editor code');
        var revertBtn = fig.querySelector('[data-act="revert"]');
        var viewWrap = fig.querySelector('.shader__views');         // present only if postfx
        var original = fig.getAttribute('data-shader') || '';
        var postfx = fig.getAttribute('data-mode') === 'postfx';

        function showError(msg) {
            if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
            fig.classList.add('is-error');
        }
        function clearError() {
            if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
            fig.classList.remove('is-error');
        }

        var gl, renderer;
        try {
            if (postfx) {
                gl = canvas.getContext('webgl2');
                if (!gl) {
                    showError('This live demo needs WebGL2, which this browser has not enabled. The code below still shows the technique.');
                    return;
                }
                renderer = makePostfxRenderer(gl, canvas, fig.getAttribute('data-scene') || 'sdf');
            } else {
                gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) { showError('WebGL is not available in this browser.'); return; }
                renderer = makeClassicRenderer(gl, canvas);
            }
        } catch (e) { showError(e.message); return; }

        var mouse = [0, 0, 0, 0];

        // Orbit-camera state (postfx only): [yaw, pitch, distance]. The defaults
        // reproduce the original fixed framing. `engaged` flips true on the first
        // interaction and stops the idle auto-drift so the reader has full control
        // (reset restores both). Drag orbits; two fingers pinch to dolly.
        var CAM_DEFAULT = [0.0, 0.132, 3.03];
        var cam = CAM_DEFAULT.slice();
        var engaged = false;
        var PITCH_MIN = -0.30, PITCH_MAX = 1.25, DIST_MIN = 1.7, DIST_MAX = 7.0;
        var pointers = {};                      // active (pressed) pointers, by id
        var pinchDist0 = 0, pinchCam0 = 0;      // pinch start: finger gap + distance

        // Pointer -> iMouse hover (pixels, y flipped to match gl_FragCoord).
        canvas.addEventListener('pointermove', function (e) {
            var r = canvas.getBoundingClientRect();
            var dpr = canvas.width / r.width;
            mouse[0] = (e.clientX - r.left) * dpr;
            mouse[1] = (r.height - (e.clientY - r.top)) * dpr;

            if (!postfx) { return; }
            var p = pointers[e.pointerId];
            if (!p) { return; }                 // only pressed pointers drive the camera
            var ids = Object.keys(pointers);
            if (ids.length >= 2) {              // two fingers -> pinch to dolly
                p.x = e.clientX; p.y = e.clientY;
                var a = pointers[ids[0]], b = pointers[ids[1]];
                var d = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinchDist0 > 0) { cam[2] = clamp(pinchCam0 * (pinchDist0 / d), DIST_MIN, DIST_MAX); }
            } else {                            // one pointer -> orbit
                cam[0] -= (e.clientX - p.x) * 0.008;
                cam[1] = clamp(cam[1] + (e.clientY - p.y) * 0.008, PITCH_MIN, PITCH_MAX);
                p.x = e.clientX; p.y = e.clientY;
            }
            if (!running) { paint(); }          // update the still frame while paused
        });
        canvas.addEventListener('pointerdown', function (e) {
            mouse[2] = mouse[0]; mouse[3] = mouse[1];
            if (!postfx) { return; }
            engaged = true;
            pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
            var ids = Object.keys(pointers);
            if (ids.length === 2) {             // second finger down: seed the pinch
                var a = pointers[ids[0]], b = pointers[ids[1]];
                pinchDist0 = Math.hypot(a.x - b.x, a.y - b.y);
                pinchCam0 = cam[2];
            }
        });
        function endPointer(e) { delete pointers[e.pointerId]; pinchDist0 = 0; }
        canvas.addEventListener('pointerup', endPointer);
        canvas.addEventListener('pointercancel', endPointer);

        function syncSize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = Math.round(canvas.clientWidth * dpr);
            var h = Math.round(canvas.clientHeight * dpr);
            if (w && h && (canvas.width !== w || canvas.height !== h)) {
                canvas.width = w; canvas.height = h;
                renderer.resize(w, h);
            }
        }

        var t0 = performance.now(), elapsed = 0, running = false, raf = 0;

        function frame(now) {
            if (running) {
                var e = (now - t0) / 1000;
                if (postfx && !engaged) { cam[0] += (e - elapsed) * 0.22; }  // idle auto-drift
                elapsed = e;
            }
            if (!renderer.ready()) { return; }
            syncSize();
            renderer.draw(elapsed, mouse, cam);
            if (clock) { clock.textContent = elapsed.toFixed(1) + 's'; }
            if (running) { raf = requestAnimationFrame(frame); }
        }
        function paint() { if (renderer.ready()) { syncSize(); renderer.draw(elapsed, mouse, cam); } }

        // Compile author source; on success swap the program, else keep the last
        // working one running and show the GPU log.
        function apply(userSrc) {
            var res = renderer.compile(userSrc);
            if (res.ok) { clearError(); if (!running) { paint(); } }
            else { showError(res.error); }
            return res.ok;
        }

        function play() {
            if (running || !renderer.ready()) { return; }
            running = true;
            t0 = performance.now() - elapsed * 1000;   // resume where we paused
            toggleBtn.textContent = '❚❚';
            toggleBtn.setAttribute('aria-label', 'Pause');
            raf = requestAnimationFrame(frame);
        }
        function pause() {
            running = false;
            cancelAnimationFrame(raf);
            toggleBtn.textContent = '▶';
            toggleBtn.setAttribute('aria-label', 'Play');
        }
        function reset() {
            elapsed = 0; t0 = performance.now();
            if (postfx) { cam = CAM_DEFAULT.slice(); engaged = false; }   // recenter + resume drift
            paint();
        }

        toggleBtn.addEventListener('click', function () { running ? pause() : play(); });
        resetBtn.addEventListener('click', reset);

        // Zoom (dolly) buttons — postfx only; pinch does the same on touch.
        var zoomIn = fig.querySelector('[data-act="zoom-in"]');
        var zoomOut = fig.querySelector('[data-act="zoom-out"]');
        function zoom(factor) {
            engaged = true;
            cam[2] = clamp(cam[2] * factor, DIST_MIN, DIST_MAX);
            if (!running) { paint(); }
        }
        if (zoomIn) { zoomIn.addEventListener('click', function () { zoom(0.85); }); }
        if (zoomOut) { zoomOut.addEventListener('click', function () { zoom(1 / 0.85); }); }

        // Pause when scrolled out of view so off-screen demos cost nothing.
        var autoplay = !reduceMotion;
        new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { if (autoplay) play(); }
                else if (running) { pause(); }
            });
        }, { threshold: 0.05 }).observe(fig);

        // --- G-buffer channel switch (postfx only) -------------------
        if (viewWrap && renderer.setView) {
            var vbtns = Array.prototype.slice.call(viewWrap.querySelectorAll('button'));
            viewWrap.addEventListener('click', function (e) {
                var b = e.target.closest('button');
                if (!b) { return; }
                renderer.setView(b.getAttribute('data-view'));
                vbtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
                if (!running) { paint(); }   // repaint the still frame in the new channel
            });
        }

        // --- Live editor wiring (editable embeds only) ---------------
        if (input) {
            var autosize = function () { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };
            var syncCode = function () { codePre.innerHTML = highlight(input.value); };
            var recompile;
            var scheduleCompile = (function () {
                var timer;
                return function () { clearTimeout(timer); timer = setTimeout(recompile, 220); };
            })();
            recompile = function () { apply(input.value); };

            input.addEventListener('input', function () { syncCode(); autosize(); scheduleCompile(); });
            // Tab inserts two spaces instead of leaving the field.
            input.addEventListener('keydown', function (e) {
                if (e.key !== 'Tab') { return; }
                e.preventDefault();
                var s = input.selectionStart, end = input.selectionEnd;
                input.value = input.value.slice(0, s) + '  ' + input.value.slice(end);
                input.selectionStart = input.selectionEnd = s + 2;
                syncCode(); autosize(); scheduleCompile();
            });
            if (revertBtn) {
                revertBtn.addEventListener('click', function () {
                    input.value = original;
                    syncCode(); autosize(); apply(original);
                });
            }
            syncCode(); autosize();
        }

        syncSize();
        apply(original);                // compile + paint the first frame
        if (reduceMotion) { pause(); }  // ...but wait for a click before animating
    }

    function init() {
        // Only build a shader once it first scrolls near the viewport.
        var io = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { obs.unobserve(en.target); setup(en.target); }
            });
        }, { rootMargin: '200px' });
        document.querySelectorAll('figure.shader').forEach(function (f) { io.observe(f); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})();
