/* slides.js: survey slides. A `.slide` holds two images of one project and a canvas;
 * src/js/slide.frag draws both, and the cursor moves a contour-shaped waterline between
 * them: left of the line shows the second shot. Leaving lets the first shot settle back. Touch: drag across, or tap to swap.
 * Keyboard: focus the slide and use the arrow keys. `.slide--reveal` also develops the
 * first shot from its contour survey on load. Without WebGL (or before it starts) the
 * first <img> simply shows.
 */
(function () {
    'use strict';
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var slides = document.querySelectorAll('.slide');
    if (!slides.length || !('IntersectionObserver' in window)) return;
    var SOURCE = null;
    var VERT = '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var NAMES = ['uA', 'uB', 'uRes', 'uFitA', 'uFitB', 'uBar', 'uVel', 'uReveal', 'uPaper', 'uInk', 'uIndex'];
    function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
    function hex(name) {
        var c = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace('#', '');
        return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16) / 255; });
    }
    function ready(img) { return img.complete && img.naturalWidth ? Promise.resolve() : new Promise(function (r) { img.addEventListener('load', r, { once: true }); }); }

    function mount(box) {
        var imgs = box.querySelectorAll('img'), canvas = box.querySelector('canvas');
        if (imgs.length < 2 || !canvas) return;
        var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
        if (!gl) return;
        function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
        var p = gl.createProgram();
        try { gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, SOURCE)); }
        catch (e) { console.error('slide.frag:', e.message); return; }
        gl.linkProgram(p); gl.useProgram(p);
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        var U = {}; NAMES.forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
        gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);

        var st = { bar: -0.06, target: -0.06, vel: 0, reveal: box.classList.contains('slide--reveal') && !reduce ? 0 : 1, running: false, dims: [] };
        function tex(img, unit) {
            var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            st.dims[unit] = [img.naturalWidth, img.naturalHeight];
        }
        function fit(d) { var ca = canvas.width / canvas.height, ia = d[0] / d[1]; return ia > ca ? [ca / ia, 1] : [1, ia / ca]; }
        function size() {
            var d = Math.min(devicePixelRatio || 1, 1.5);
            canvas.width = Math.max(1, box.clientWidth * d | 0); canvas.height = Math.max(1, box.clientHeight * d | 0);
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        function draw() {
            var dark = document.documentElement.getAttribute('data-theme') === 'dark';
            gl.uniform3fv(U.uPaper, hex(dark ? '--night-paper' : '--day-paper'));
            gl.uniform3fv(U.uInk, hex(dark ? '--night-ink' : '--day-ink'));
            gl.uniform3fv(U.uIndex, hex(dark ? '--night-index' : '--day-index'));
            gl.uniform2f(U.uRes, canvas.width, canvas.height);
            gl.uniform2fv(U.uFitA, fit(st.dims[0])); gl.uniform2fv(U.uFitB, fit(st.dims[1]));
            gl.uniform1f(U.uBar, st.bar); gl.uniform1f(U.uVel, st.vel); gl.uniform1f(U.uReveal, st.reveal);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        var last = 0;
        function tick(t) {
            var dt = Math.max(1, t - last) / 1000; last = t;
            var prev = st.bar;
            st.bar += (st.target - st.bar) * (reduce ? 1 : Math.min(1, dt * 9));
            st.vel += ((st.bar - prev) / dt - st.vel) * Math.min(1, dt * 12);
            draw();
            if (Math.abs(st.target - st.bar) > 0.0008 || Math.abs(st.vel) > 0.01) requestAnimationFrame(tick);
            else { st.vel = 0; draw(); st.running = false; }
        }
        function kick() { if (!st.running) { st.running = true; last = performance.now(); requestAnimationFrame(tick); } }
        function aim(clientX) { var r = box.getBoundingClientRect(); st.target = (clientX - r.left) / r.width; kick(); }

        Promise.all([ready(imgs[0]), ready(imgs[1])]).then(function () {
            size(); tex(imgs[0], 0); tex(imgs[1], 1); box.classList.add('is-live');
            if (st.reveal < 1) {
                var s = performance.now();
                (function run(t) { var k = Math.min(1, (t - s) / 1900); st.reveal = ease(k); draw(); if (k < 1) requestAnimationFrame(run); })(s);
            } else draw();
        });
        box.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons) aim(e.clientX); });
        box.addEventListener('pointerleave', function () { st.target = -0.06; kick(); });
        box.addEventListener('click', function (e) {
            if (e.pointerType === 'mouse') return;                       // touch/pen: tap swaps the shots
            st.target = st.target < 0.5 ? 1.06 : -0.06; kick();
        });
        box.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            var base = st.target > 1 ? 1 : st.target < 0 ? 0 : st.target;
            st.target = Math.min(1.06, Math.max(-0.06, base + (e.key === 'ArrowLeft' ? -0.1 : 0.1))); kick();
        });
        addEventListener('resize', function () { size(); draw(); });
        new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    fetch('/js/slide.frag').then(function (r) { return r.text(); }).then(function (src) {
        SOURCE = src;
        // Mount slides as they come near the screen, so only a few WebGL contexts exist.
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } });
        }, { rootMargin: '300px' });
        slides.forEach(function (s) { io.observe(s); });
    });
})();
