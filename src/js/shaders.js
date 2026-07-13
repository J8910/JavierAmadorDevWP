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

    function setup(fig) {
        var canvas = fig.querySelector('.shader__canvas');
        var errEl = fig.querySelector('.shader__err');
        var clock = fig.querySelector('.shader__clock');
        var toggleBtn = fig.querySelector('[data-act="toggle"]');
        var resetBtn = fig.querySelector('[data-act="reset"]');
        var source = fig.getAttribute('data-shader') || '';

        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) { return fail('WebGL is not available in this browser.'); }

        var program;
        try {
            var vs = compile(gl, gl.VERTEX_SHADER, VERT);
            var fs = compile(gl, gl.FRAGMENT_SHADER, HEADER + source + FOOTER);
            program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) || 'link failed');
            }
        } catch (e) {
            // Prism header spans lines 1..4; subtract so line numbers match the code shown.
            return fail(String(e.message).replace(/ERROR: 0:(\d+)/g, function (_, n) {
                return 'ERROR: line ' + Math.max(1, (+n) - 4);
            }));
        }
        gl.useProgram(program);

        // One big triangle covering the clip-space square.
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(program, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        var uRes = gl.getUniformLocation(program, 'iResolution');
        var uTime = gl.getUniformLocation(program, 'iTime');
        var uMouse = gl.getUniformLocation(program, 'iMouse');
        var mouse = [0, 0, 0, 0];

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
            resize();
            gl.uniform3f(uRes, canvas.width, canvas.height, 1);
            gl.uniform1f(uTime, elapsed);
            gl.uniform4f(uMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (clock) { clock.textContent = elapsed.toFixed(1) + 's'; }
            if (running) { raf = requestAnimationFrame(draw); }
        }

        function play() {
            if (running) return;
            running = true;
            t0 = performance.now() - elapsed * 1000;   // resume where we paused
            toggleBtn.textContent = '❚❚';     // ❚❚
            toggleBtn.setAttribute('aria-label', 'Pause');
            raf = requestAnimationFrame(draw);
        }
        function pause() {
            running = false;
            cancelAnimationFrame(raf);
            toggleBtn.textContent = '▶';           // ▶
            toggleBtn.setAttribute('aria-label', 'Play');
        }
        function reset() { elapsed = 0; t0 = performance.now(); draw(performance.now()); }

        toggleBtn.addEventListener('click', function () { running ? pause() : play(); });
        resetBtn.addEventListener('click', reset);

        // Pause when scrolled out of view so off-screen demos cost nothing.
        var vis = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { if (autoplay) play(); }
                else { if (running) pause(); }
            });
        }, { threshold: 0.05 });
        vis.observe(fig);

        var autoplay = !reduceMotion;
        resize();
        draw(performance.now());        // paint the first frame immediately
        if (reduceMotion) { pause(); }  // ...but wait for a click before animating

        function fail(msg) {
            if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
            fig.classList.add('is-error');
        }
    }

    function init() {
        var figs = document.querySelectorAll('figure.shader');
        // Only build a shader once it first scrolls near the viewport.
        var io = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { obs.unobserve(en.target); setup(en.target); }
            });
        }, { rootMargin: '200px' });
        figs.forEach(function (f) { io.observe(f); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})();
