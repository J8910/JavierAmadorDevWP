const markdownItKatex = require('@traptitech/markdown-it-katex');
const rssPlugin = require('@11ty/eleventy-plugin-rss').default;
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');

// Prism, used directly by the {% shader %} shortcode to colour the GLSL it shows.
// (Fenced ```glsl / ```hlsl blocks in Markdown are coloured by the plugin above.)
const Prism = require('prismjs');
require('prismjs/components/prism-c');      // glsl + hlsl both extend C
require('prismjs/components/prism-glsl');
require('prismjs/components/prism-hlsl');

module.exports = function(eleventyConfig) {
    // RSS/Atom feed — adds dateToRfc3339, absoluteUrl, htmlToAbsoluteUrls filters
    // used by src/feed.njk to build /feed.xml at build time.
    eleventyConfig.addPlugin(rssPlugin);

    // Build-time syntax highlighting (Prism). Colours every fenced code block,
    // e.g. ```glsl / ```hlsl. Token colours are themed in css/global.css.
    eleventyConfig.addPlugin(syntaxHighlight);

    eleventyConfig.addPassthroughCopy('src/assets');
    eleventyConfig.addPassthroughCopy('src/css');
    eleventyConfig.addPassthroughCopy('src/js');      // shaders.js runtime
    eleventyConfig.addPassthroughCopy('src/CNAME');   // custom domain for GitHub Pages

    eleventyConfig.addWatchTarget('src/css');
    eleventyConfig.addWatchTarget('src/js');

    // Current year, e.g. for the footer: {% year %}
    eleventyConfig.addShortcode('year', () => `${new Date().getFullYear()}`);

    // Live WebGL shader embed. The body is a Shadertoy-style `mainImage()`; the
    // runtime (src/js/shaders.js, loaded when a post sets `shaders: true`) wraps
    // it, compiles it, and animates it in a <canvas>. The SAME source is shown as
    // highlighted GLSL beneath the canvas — write the shader once, get both.
    //
    //   {% shader caption="Domain-warped flow", height=280, editable=true %}
    //   void mainImage(out vec4 O, in vec2 I){ /* ... */ }
    //   {% endshader %}
    //
    // With `editable=true` the code view becomes a live editor: typing recompiles
    // the shader and updates the canvas (the runtime keeps the last working shader
    // running if an in-progress edit doesn't compile). Everything is emitted on ONE
    // physical line with newlines encoded as &#10; so markdown-it passes the HTML
    // block through untouched (a blank line inside would otherwise split it).
    //
    // With `mode="postfx"` the runtime switches to a two-pass G-buffer pipeline
    // (WebGL2): a fixed scene pass raymarches an SDF and writes albedo/normal/depth
    // buffers, and the body you write is the POST-PROCESS pass that reads them via
    // sampleAlbedo/sampleNormal/sampleDepth(uv) → final image. The author contract is
    // `void mainImage(out vec4 O, in vec2 uv)` with `uv` normalised [0,1] and `iTexel`
    // = 1/resolution for neighbour taps. A "buffers" switch lets readers inspect each
    // G-buffer channel. Pairs naturally with editable=true (see /resources/).
    eleventyConfig.addPairedShortcode('shader', (source, opts = {}) => {
        const src = String(source).trim();
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const enc = (s) => s.replace(/\r?\n/g, '&#10;');           // newlines -> entity
        const code = enc(Prism.highlight(src, Prism.languages.glsl, 'glsl'));  // shown
        const data = enc(esc(src)).replace(/"/g, '&quot;');        // runnable, in attr
        const cap = opts.caption
            ? `<figcaption class="shader__caption">${esc(String(opts.caption))}</figcaption>` : '';
        const h = Number(opts.height) || 280;
        const editable = opts.editable === true || opts.editable === 'true';
        const postfx = opts.mode === 'postfx';
        const file = postfx ? 'postfx.glsl' : 'fragment.glsl';

        // The code view: read-only <pre> by default, or a transparent <textarea>
        // over the highlighted <pre> when editable (runtime keeps them in sync).
        const codeView = editable
            ? `<div class="shader__code shader__code--edit">`
                + `<div class="shader__codehead"><span class="shader__file">${file} · live</span>`
                + `<button type="button" class="shader__revert" data-act="revert">revert</button></div>`
                + `<div class="shader__editor">`
                + `<pre class="language-glsl" aria-hidden="true"><code class="language-glsl">${code}</code></pre>`
                + `<textarea class="shader__input" spellcheck="false" autocapitalize="off"`
                + ` autocomplete="off" autocorrect="off" aria-label="Editable GLSL source">${enc(esc(src))}</textarea>`
                + `</div></div>`
            : `<div class="shader__code"><span class="shader__file">${file}</span>`
                + `<pre class="language-glsl"><code class="language-glsl">${code}</code></pre></div>`;

        // Postfx demos get a channel switch so readers can inspect the raw G-buffer
        // the post-process reads from (final image / beauty / normals / depth).
        const views = postfx
            ? `<div class="shader__views" role="group" aria-label="Show G-buffer channel">`
                + `<span class="shader__viewslabel" aria-hidden="true">buffers</span>`
                + `<button type="button" data-view="final" aria-pressed="true">final</button>`
                + `<button type="button" data-view="mask" aria-pressed="false">mask</button>`
                + `<button type="button" data-view="albedo" aria-pressed="false">beauty</button>`
                + `<button type="button" data-view="normal" aria-pressed="false">normal</button>`
                + `<button type="button" data-view="depth" aria-pressed="false">depth</button>`
                + `</div>`
            : '';

        return `<figure class="shader${editable ? ' is-editable' : ''}${postfx ? ' is-postfx' : ''}"`
            + ` data-shader="${data}"${postfx ? ' data-mode="postfx"' : ''} style="--shader-h:${h}px">`
            + `<div class="shader__stage"><canvas class="shader__canvas"></canvas>`
            + `<div class="shader__bar">`
            + `<button type="button" class="shader__btn" data-act="toggle" aria-label="Play or pause">❚❚</button>`
            + `<button type="button" class="shader__btn" data-act="reset" aria-label="Restart">↺</button>`
            + (postfx
                ? `<button type="button" class="shader__btn" data-act="zoom-out" aria-label="Zoom out">−</button>`
                    + `<button type="button" class="shader__btn" data-act="zoom-in" aria-label="Zoom in">+</button>`
                : '')
            + `<span class="shader__clock" aria-hidden="true">0.0s</span></div>`
            + `<p class="shader__err" role="alert" hidden></p></div>`
            + views
            + cap
            + codeView
            + `</figure>`;
    });

    // Captioned image for post bodies:
    //   {% figure src="/assets/images/x.jpg", alt="Describe it", caption="Shown below",
    //             width=560 %}
    // Plain markdown ![alt](/assets/images/x.jpg) also works (styled by .prose img);
    // reach for this shortcode when you want a caption or to cap the display width.
    // `alt` is for screen readers/SEO — always write it; `caption` is the visible line
    // under the image and is optional. Emitted on ONE line (no blank line) so markdown-it
    // passes the HTML block through untouched.
    eleventyConfig.addShortcode('figure', (opts = {}) => {
        const esc = (s) => String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const src = esc(opts.src || '');
        const alt = esc(opts.alt || '');
        const style = opts.width ? ` style="max-width:${Number(opts.width)}px"` : '';
        const cap = opts.caption
            ? `<figcaption class="figure__caption">${esc(opts.caption)}</figcaption>` : '';
        return `<figure class="figure"${style}>`
            + `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`
            + cap
            + `</figure>`;
    });

    // Human-friendly date, e.g. {{ page.date | readableDate }} -> "June 2, 2026"
    eleventyConfig.addFilter('readableDate', (value) => {
        const date = value instanceof Date ? value : new Date(value);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(date);
    });

    // "1 min read" from rendered HTML, e.g. {{ content | readingTime }}
    eleventyConfig.addFilter('readingTime', (html) => {
        const text = String(html).replace(/<[^>]+>/g, ' ');
        const words = (text.match(/\S+/g) || []).length;
        return `${Math.max(1, Math.round(words / 200))} min read`;
    });

    // Math rendering with KaTeX. Use $inline$ or $$block$$ in Markdown.
    // Pages that use math should set `math: true` in front matter to load the CSS.
    eleventyConfig.amendLibrary('md', (md) => md.use(markdownItKatex));

    return {
        dir: {
            input: 'src',
            includes: '_includes',
            output: '_site'
        },
        templateFormats: ['md', 'njk', 'html'],
        markdownTemplateEngine: 'njk',
        htmlTemplateEngine: 'njk',
        dataTemplateEngine: 'njk'
    }
}
