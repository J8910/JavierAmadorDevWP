/* ------------------------------------------------------------------ *
 *  shaders.js — tiny WebGL runtime for {% shader %} embeds.
 *
 *  Only loaded on posts with `shaders: true` in their front matter. For each
 *  <figure class="shader"> it reads the GLSL from data-shader, wraps it in a
 *  Shadertoy-style header (iResolution / iTime / iMouse + a mainImage call),
 *  compiles it, and animates it in the figure's <canvas>.
 *
 *  Design notes for future edits:
 *   - No dependencies, WebGL1 (broad support), one full-screen triangle.
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

    // Shadertoy-style wrapper. Authors write `void mainImage(out vec4, in vec2)`;
    // we supply the uniforms and the main() that drives it.
    var HEADER =
        'precision highp float;\n' +
        'uniform vec3 iResolution;\n' +   // viewport in pixels (z unused, kept for parity)
        'uniform float iTime;\n' +        // seconds since start
        'uniform vec4 iMouse;\n';         // xy = current, zw = last click (pixels)
    var FOOTER =
        '\nvoid main(){ vec4 c = vec4(0.0, 0.0, 0.0, 1.0);' +
        ' mainImage(c, gl_FragCoord.xy); gl_FragColor = vec4(c.rgb, 1.0); }';
    var VERT =
        'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
    var HEADER_LINES = 4;   // lines HEADER adds before the author's code (for error offset)

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
    // code the reader actually sees.
    function fmtError(log) {
        return String(log).replace(/ERROR:\s*0:(\d+)/g, function (_, n) {
            return 'ERROR: line ' + Math.max(1, (+n) - HEADER_LINES);
        }).trim();
    }

    /* --- Minimal GLSL highlighter (editable embeds only) --------------
       Emits the same .token classes the build-time Prism theme colours, so
       typed code matches the server-rendered code exactly. */
    var KEYWORD = /^(?:attribute|const|uniform|varying|break|continue|do|for|while|if|else|return|discard|struct|in|out|inout|void|true|false|precision|highp|mediump|lowp|layout|switch|case|default)$/;
    var TYPE = /^(?:float|int|uint|bool|vec[234]|ivec[234]|uvec[234]|bvec[234]|mat[234]|mat[234]x[234]|sampler2D|sampler3D|samplerCube)$/;
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
                else if (/^i(?:Resolution|Time|Mouse)$/.test(w)) { cls = 'constant'; }
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

    function setup(fig) {
        var canvas = fig.querySelector('.shader__canvas');
        var errEl = fig.querySelector('.shader__err');
        var clock = fig.querySelector('.shader__clock');
        var toggleBtn = fig.querySelector('[data-act="toggle"]');
        var resetBtn = fig.querySelector('[data-act="reset"]');
        var input = fig.querySelector('.shader__input');            // present only if editable
        var codePre = fig.querySelector('.shader__editor code');
        var revertBtn = fig.querySelector('[data-act="revert"]');
        var original = fig.getAttribute('data-shader') || '';

        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) { showError('WebGL is not available in this browser.'); return; }

        // Vertex shader + geometry are constant across recompiles; make them once.
        var vsh;
        try { vsh = compile(gl, gl.VERTEX_SHADER, VERT); }
        catch (e) { showError(e.message); return; }

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        var program = null, uRes = null, uTime = null, uMouse = null;
        var mouse = [0, 0, 0, 0];

        // Build a program from the author's mainImage source. On success it becomes
        // the live program; on failure we keep whatever was running and show the log.
        function useProgram(userSrc) {
            var fs;
            try { fs = compile(gl, gl.FRAGMENT_SHADER, HEADER + userSrc + FOOTER); }
            catch (e) { showError(fmtError(e.message)); return false; }

            var prog = gl.createProgram();
            gl.attachShader(prog, vsh);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            gl.deleteShader(fs);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                var log = gl.getProgramInfoLog(prog);
                gl.deleteProgram(prog);
                showError(fmtError(log || 'link failed'));
                return false;
            }

            if (program) { gl.deleteProgram(program); }
            program = prog;
            gl.useProgram(program);
            uRes = gl.getUniformLocation(program, 'iResolution');
            uTime = gl.getUniformLocation(program, 'iTime');
            uMouse = gl.getUniformLocation(program, 'iMouse');
            var loc = gl.getAttribLocation(program, 'p');
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            clearError();
            if (!running) { draw(performance.now()); }   // repaint if currently paused
            return true;
        }

        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = Math.round(canvas.clientWidth * dpr);
            var h = Math.round(canvas.clientHeight * dpr);
            if (w && h && (canvas.width !== w || canvas.height !== h)) {
                canvas.width = w; canvas.height = h;
            }
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        // Pointer -> iMouse (pixels, y flipped to match gl_FragCoord).
        canvas.addEventListener('pointermove', function (e) {
            var r = canvas.getBoundingClientRect();
            var dpr = canvas.width / r.width;
            mouse[0] = (e.clientX - r.left) * dpr;
            mouse[1] = (r.height - (e.clientY - r.top)) * dpr;
        });
        canvas.addEventListener('pointerdown', function () { mouse[2] = mouse[0]; mouse[3] = mouse[1]; });

        var t0 = performance.now(), elapsed = 0, running = false, raf = 0;

        function draw(now) {
            if (running) { elapsed = (now - t0) / 1000; }
            if (!program) { return; }
            resize();
            gl.uniform3f(uRes, canvas.width, canvas.height, 1);
            gl.uniform1f(uTime, elapsed);
            gl.uniform4f(uMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (clock) { clock.textContent = elapsed.toFixed(1) + 's'; }
            if (running) { raf = requestAnimationFrame(draw); }
        }

        function play() {
            if (running || !program) { return; }
            running = true;
            t0 = performance.now() - elapsed * 1000;   // resume where we paused
            toggleBtn.textContent = '❚❚';
            toggleBtn.setAttribute('aria-label', 'Pause');
            raf = requestAnimationFrame(draw);
        }
        function pause() {
            running = false;
            cancelAnimationFrame(raf);
            toggleBtn.textContent = '▶';
            toggleBtn.setAttribute('aria-label', 'Play');
        }
        function reset() { elapsed = 0; t0 = performance.now(); draw(performance.now()); }

        toggleBtn.addEventListener('click', function () { running ? pause() : play(); });
        resetBtn.addEventListener('click', reset);

        // Pause when scrolled out of view so off-screen demos cost nothing.
        var autoplay = !reduceMotion;
        new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { if (autoplay) play(); }
                else if (running) { pause(); }
            });
        }, { threshold: 0.05 }).observe(fig);

        // --- Live editor wiring (editable embeds only) ---------------
        if (input) {
            var autosize = function () { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };
            var syncCode = function () { codePre.innerHTML = highlight(input.value); };
            var recompile;
            var scheduleCompile = (function () {
                var timer;
                return function () { clearTimeout(timer); timer = setTimeout(recompile, 220); };
            })();
            recompile = function () { useProgram(input.value); };

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
                    syncCode(); autosize(); useProgram(original);
                });
            }
            syncCode(); autosize();
        }

        function showError(msg) {
            if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
            fig.classList.add('is-error');
        }
        function clearError() {
            if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
            fig.classList.remove('is-error');
        }

        resize();
        useProgram(original);           // compile + paint the first frame
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
