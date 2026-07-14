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
 *     A FIXED scene pass raymarches an SDF and writes albedo / normal / depth to
 *     three buffers (via MRT); the author's `mainImage(out vec4 O, in vec2 uv)` is
 *     the POST-PROCESS pass that reads them with sampleAlbedo/sampleNormal/
 *     sampleDepth(uv). `uv` is normalised [0,1]; `iTexel` = 1/resolution for
 *     neighbour taps. A per-figure "buffers" switch shows each raw channel.
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

    var P_SCENE = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec3 iResolution;',
        'uniform float iTime;',
        'uniform vec4 iMouse;',
        'uniform vec3 iCam;',                                // yaw, pitch, distance (orbit)',
        'layout(location = 0) out vec4 oAlbedo;',
        'layout(location = 1) out vec4 oNormal;',
        'layout(location = 2) out vec4 oDepth;',
        '',
        'float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }',
        'float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }',
        'vec2 closer(vec2 a, vec2 b){ return a.x < b.x ? a : b; }',
        '',
        '// returns vec2(distance, materialId)',
        'vec2 map(vec3 p){',
        '    vec2 res = vec2(p.y + 1.0, 1.0);              // ground plane, id 1',
        '    res = closer(res, vec2(sdRoundBox(p - vec3(0.0, -0.1, 0.0), vec3(0.55), 0.06), 2.0));',
        '    res = closer(res, vec2(sdTorus(p - vec3(0.0, 0.75, 0.0), vec2(0.5, 0.14)), 3.0));',
        '    return res;',
        '}',
        '',
        'vec3 calcNormal(vec3 p){',
        '    vec2 e = vec2(0.0012, 0.0);',
        '    return normalize(vec3(',
        '        map(p + e.xyy).x - map(p - e.xyy).x,',
        '        map(p + e.yxy).x - map(p - e.yxy).x,',
        '        map(p + e.yyx).x - map(p - e.yyx).x));',
        '}',
        '',
        'vec3 material(float id){',
        '    if (id < 1.5) return vec3(0.42, 0.46, 0.40);   // ground',
        '    if (id < 2.5) return vec3(0.83, 0.45, 0.32);   // box (terracotta)',
        '    return vec3(0.33, 0.52, 0.63);                 // torus (slate)',
        '}',
        '',
        'vec3 sky(vec3 rd){',
        '    float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);',
        '    vec3 col = mix(vec3(0.80, 0.86, 0.92), vec3(0.32, 0.52, 0.82), h);  // horizon -> zenith',
        '    vec3 L = normalize(vec3(0.7, 0.85, 0.5));',
        '    col += vec3(1.0, 0.92, 0.72) * pow(clamp(dot(rd, L), 0.0, 1.0), 200.0) * 0.6;  // soft sun glow',
        '    return col;',
        '}',
        '',
        'void main(){',
        '    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;',
        '    vec3 ta = vec3(0.0, 0.15, 0.0);                // orbit target',
        '    float cp = cos(iCam.y);',
        '    vec3 dir = vec3(cp * sin(iCam.x), sin(iCam.y), cp * cos(iCam.x));',
        '    vec3 ro = ta + dir * iCam.z;                   // yaw / pitch / distance',
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

    function makePostfxRenderer(gl, canvas) {
        // Half-float G-buffers when the GPU can render them (kills banding in
        // derivative post-effects); RGBA8 fallback keeps the [0,1] layout intact.
        var floatRT = !!gl.getExtension('EXT_color_buffer_float');

        var vsh = compile(gl, gl.VERTEX_SHADER, P_VERT);
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, TRI, gl.STATIC_DRAW);

        // Link a fragment source against the shared vertex shader.
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

        // Fixed programs (scene + channel blit). A failure here is a runtime bug,
        // not an author mistake — surface it via compile() so it's seen in dev.
        var sceneR = link(P_SCENE);
        var sceneProg = sceneR.program || null;
        var sceneErr = sceneR.error || null;
        var sceneU = sceneProg ? {
            res: gl.getUniformLocation(sceneProg, 'iResolution'),
            time: gl.getUniformLocation(sceneProg, 'iTime'),
            mouse: gl.getUniformLocation(sceneProg, 'iMouse'),
            cam: gl.getUniformLocation(sceneProg, 'iCam')
        } : null;

        var blitR = link(P_BLIT);
        var blitProg = blitR.program || null;
        var blitU = blitProg ? {
            res: gl.getUniformLocation(blitProg, 'iResolution'),
            tex: gl.getUniformLocation(blitProg, 'uTex'),
            mode: gl.getUniformLocation(blitProg, 'uMode')
        } : null;

        var userProg = null, userU = null;

        // G-buffer: one FBO with three colour attachments, resized with the canvas.
        var fbo = gl.createFramebuffer();
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
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
            gl.viewport(0, 0, w, h);
        }

        function compileUser(userSrc) {
            if (sceneErr) { return { ok: false, error: 'scene pass failed to compile:\n' + sceneErr }; }
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

        function drawScene(elapsed, mouse, cam) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.drawBuffers(DRAWBUFS);
            gl.viewport(0, 0, fbW, fbH);
            gl.useProgram(sceneProg);
            bindGeom(sceneProg);
            gl.uniform3f(sceneU.res, fbW, fbH, 1);
            gl.uniform1f(sceneU.time, elapsed);
            gl.uniform4f(sceneU.mouse, mouse[0], mouse[1], mouse[2], mouse[3]);
            gl.uniform3f(sceneU.cam, cam[0], cam[1], cam[2]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        function draw(elapsed, mouse, cam) {
            if (!userProg || !sceneProg) { return; }
            drawScene(elapsed, mouse, cam);            // fill the G-buffer

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
            ready: function () { return !!(userProg && sceneProg); },
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
                renderer = makePostfxRenderer(gl, canvas);
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
