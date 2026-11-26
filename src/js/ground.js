/* ground.js: the live survey map behind every page.
 *
 *  - Draws src/js/ground.frag (fetched, so the editor shows the real file) on a fixed
 *    full-viewport canvas. The page stays fully usable without WebGL: body has a paper
 *    background and every surface is opaque.
 *  - Night is a flood: the theme button pours water out of itself; each `.surface`
 *    turns dark when the waterline reaches it (class `wet`), then <html data-theme>
 *    settles. The choice is saved in localStorage like before (basehead.html reads it).
 *  - Map interaction: the cursor raises a soft hill; clicking open map raises a peak;
 *    fast cursor moves leave small ripples.
 *  - "ground.frag" (bottom-left) opens a live editor: type GLSL, the page recompiles;
 *    a broken edit keeps the last good shader running and shows the error.
 *  - prefers-reduced-motion: the map draws still frames only (on scroll/resize/theme),
 *    no flood animation, no clicks or ripples.
 */
(function () {
    'use strict';
    var root = document.documentElement;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var toggle = document.querySelector('.night');
    var SPAN = 2.4, SLOPE = 0.33, LO = -0.25, HI = 2.7, MIDLAND = 0.5;
    var night = root.getAttribute('data-theme') === 'dark' ? 1 : 0;
    var origin = [0, 0];

    function toMap(x, y) { return [(x - innerWidth / 2) / innerHeight * SPAN, (innerHeight / 2 - y) / innerHeight * SPAN]; }
    function centre(el) { var b = el.getBoundingClientRect(); return toMap(b.left + b.width / 2, b.top + b.height / 2); }
    function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

    // ---------------------------------------------------------------- the flood
    // When does the water reach a surface? Solve level(e) - SLOPE*d = MIDLAND for e.
    function arrival(el) {
        var c = centre(el), d = Math.hypot(c[0] - origin[0], c[1] - origin[1]);
        return Math.min(1, Math.max(0, (MIDLAND + SLOPE * d - LO) / (HI - LO)));
    }
    function setTheme(dark) {
        var from = night, to = dark ? 1 : 0, start = performance.now(), dur = reduce || !gl ? 0 : 2300;
        // Everything opaque that sits on the map floods with it.
        var surfaces = Array.prototype.slice.call(document.querySelectorAll('.surface, .card, .article, .page-head, .reading__item, .lib-heading, .res-group .section-label, .pills button, .tag'));
        origin = toggle ? centre(toggle) : [0, 0];
        surfaces.forEach(function (el) { el._at = arrival(el); });
        root.setAttribute('data-theme', dark ? 'dark' : 'light');
        try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
        if (toggle) {
            toggle.setAttribute('aria-pressed', String(dark));
            toggle.setAttribute('aria-label', dark ? 'Switch to the day sheet' : 'Switch to the night sheet');
        }
        if (!dur) { night = to; draw(); return; }
        root.classList.add('flooding');
        (function step(now) {
            var k = Math.min(1, (now - start) / dur);
            night = from + (to - from) * ease(k);
            surfaces.forEach(function (el) { el.classList.toggle('wet', night >= el._at); });
            draw();
            if (k < 1) requestAnimationFrame(step);
            else { root.classList.remove('flooding'); surfaces.forEach(function (el) { el.classList.remove('wet'); }); }
        })(start);
    }
    if (toggle) {
        toggle.setAttribute('aria-pressed', String(night === 1));
        toggle.setAttribute('aria-label', night ? 'Switch to the day sheet' : 'Switch to the night sheet');
        toggle.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') !== 'dark'); });
    }

    // ---------------------------------------------------------------- WebGL
    var cv = document.querySelector('canvas.ground');
    var gl = cv && cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { if (cv) cv.remove(); return; }

    var VERT = '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    var NAMES = ['uRes', 'uTime', 'uScroll', 'uMouse', 'uLift', 'uNight', 'uOrigin', 'uClicks',
                 'uPaper', 'uInk', 'uIndex', 'uPaperN', 'uInkN', 'uIndexN'];
    var prog = null, U = {}, SOURCE = '';
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    function hex(name) {
        var c = getComputedStyle(root).getPropertyValue(name).trim().replace('#', '');
        return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16) / 255; });
    }
    function build(src) {
        function sh(type, s) {
            var o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o);
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { var e = gl.getShaderInfoLog(o); gl.deleteShader(o); throw new Error(e); }
            return o;
        }
        var p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
        gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        if (prog) gl.deleteProgram(prog);
        prog = p; gl.useProgram(p);
        var loc = gl.getAttribLocation(p, 'a');
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        NAMES.forEach(function (n) { U[n] = gl.getUniformLocation(p, n); });
        gl.uniform3fv(U.uPaper, hex('--day-paper')); gl.uniform3fv(U.uInk, hex('--day-ink')); gl.uniform3fv(U.uIndex, hex('--day-index'));
        gl.uniform3fv(U.uPaperN, hex('--night-paper')); gl.uniform3fv(U.uInkN, hex('--night-ink')); gl.uniform3fv(U.uIndexN, hex('--night-index'));
    }

    var t0 = performance.now(), CLICKS = new Float32Array(32), clickN = 0;
    var mx = 9, my = 9, tx = 9, ty = 9, lift = 0, liftT = 0, running = false;
    function now() { return (performance.now() - t0) / 1000; }
    function size() {
        var d = Math.min(devicePixelRatio || 1, 1.25);
        cv.width = Math.max(1, innerWidth * d | 0); cv.height = Math.max(1, innerHeight * d | 0);
        gl.viewport(0, 0, cv.width, cv.height);
    }
    function draw() {
        if (!prog) return;
        mx += (tx - mx) * 0.08; my += (ty - my) * 0.08; lift += (liftT - lift) * 0.05;
        gl.uniform2f(U.uRes, cv.width, cv.height);
        gl.uniform1f(U.uTime, reduce ? 0 : now());
        gl.uniform1f(U.uScroll, scrollY);
        gl.uniform2f(U.uMouse, mx, my); gl.uniform1f(U.uLift, reduce ? 0 : lift);
        gl.uniform1f(U.uNight, night); gl.uniform2f(U.uOrigin, origin[0], origin[1]);
        gl.uniform4fv(U.uClicks, CLICKS);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop() { if (!running) return; draw(); requestAnimationFrame(loop); }
    function start() { if (running || reduce) return; running = true; requestAnimationFrame(loop); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else start(); });
    addEventListener('resize', function () { size(); draw(); });
    if (reduce) addEventListener('scroll', draw, { passive: true });

    // ---------------------------------------------------------------- the map responds
    var OPEN = 'a,button,input,textarea,select,label,summary,img,picture,video,iframe,pre,code,.surface,.slide,.shader,.src-panel,[contenteditable]';
    function addClick(x, y, kind) {
        var i = (clickN++ % 8) * 4;
        CLICKS[i] = x; CLICKS[i + 1] = y; CLICKS[i + 2] = now(); CLICKS[i + 3] = kind;
    }
    var lastX = 0, lastY = 0, lastT = 0, lastWake = 0;
    addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var m = toMap(e.clientX, e.clientY); tx = m[0]; ty = m[1]; liftT = 1;
        if (reduce) return;
        var t = performance.now(), dt = t - lastT, v = dt > 0 ? Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt : 0;
        lastX = e.clientX; lastY = e.clientY; lastT = t;
        if (v > 2.2 && t - lastWake > 140 && !e.target.closest(OPEN)) { lastWake = t; addClick(m[0], m[1], 0.35); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { liftT = 0; });
    document.addEventListener('click', function (e) {
        if (reduce || e.target.closest(OPEN) || (getSelection && String(getSelection()).length)) return;
        var m = toMap(e.clientX, e.clientY); addClick(m[0], m[1], 1);
    });

    // ---------------------------------------------------------------- ground.frag editor
    var link = document.querySelector('.frag'), panel = document.querySelector('.src-panel');
    function wireEditor() {
        if (!link || !panel) return;
        var ta = panel.querySelector('textarea'), status = panel.querySelector('.src-status'), timer = 0;
        var count = panel.querySelector('.src-count');
        function setCount(s) { if (count) count.textContent = s.split('\n').length + ' lines · ' + s.length + ' chars'; }
        ta.value = SOURCE; setCount(SOURCE);
        link.hidden = false;
        link.addEventListener('click', function () {
            var open = panel.hidden; panel.hidden = !open; link.setAttribute('aria-expanded', String(open));
            if (open) ta.focus();
        });
        panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { panel.hidden = true; link.setAttribute('aria-expanded', 'false'); link.focus(); } });
        function attempt(src) {
            try { build(src); status.textContent = 'compiled'; status.classList.remove('is-bad'); draw(); }
            catch (err) {
                status.textContent = String(err.message).split('\n')[0]; status.classList.add('is-bad');
                if (prog) gl.useProgram(prog);
            }
        }
        ta.addEventListener('input', function () { setCount(ta.value); clearTimeout(timer); timer = setTimeout(function () { attempt(ta.value); }, 350); });
        ta.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
        });
        panel.querySelector('.src-revert').addEventListener('click', function () { ta.value = SOURCE; setCount(SOURCE); attempt(SOURCE); });
    }

    // ---------------------------------------------------------------- go
    fetch('/js/ground.frag').then(function (r) { return r.text(); }).then(function (src) {
        SOURCE = src; size();
        try { build(src); } catch (e) { console.error('ground.frag:', e.message); cv.remove(); return; }
        root.classList.add('has-ground');
        draw(); start(); wireEditor();
    }).catch(function () { cv.remove(); });
})();
