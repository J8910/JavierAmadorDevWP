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
    const Card = require('./src/_includes/components/Card');

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

    eleventyConfig.addShortcode('Card', Card);

    // Current year, e.g. for the footer: {% year %}
    eleventyConfig.addShortcode('year', () => `${new Date().getFullYear()}`);

    // Live WebGL shader embed. The body is a Shadertoy-style `mainImage()`; the
    // runtime (src/js/shaders.js, loaded when a post sets `shaders: true`) wraps
    // it, compiles it, and animates it in a <canvas>. The SAME source is shown as
    // highlighted GLSL beneath the canvas — write the shader once, get both.
    //
    //   {% shader caption="Domain-warped flow", height=280 %}
    //   void mainImage(out vec4 O, in vec2 I){ /* ... */ }
    //   {% endshader %}
    //
    // Everything is emitted on ONE physical line with newlines encoded as &#10;
    // so markdown-it passes the HTML block through untouched (a blank line inside
    // the shader would otherwise split the block and mangle it).
    eleventyConfig.addPairedShortcode('shader', (source, opts = {}) => {
        const src = String(source).trim();
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const enc = (s) => s.replace(/\r?\n/g, '&#10;');           // newlines -> entity
        const code = enc(Prism.highlight(src, Prism.languages.glsl, 'glsl'));  // shown
        const data = enc(esc(src)).replace(/"/g, '&quot;');        // runnable, in attr
        const cap = opts.caption
            ? `<figcaption class="shader__caption">${esc(String(opts.caption))}</figcaption>` : '';
        const h = Number(opts.height) || 280;
        return `<figure class="shader" data-shader="${data}" style="--shader-h:${h}px">`
            + `<div class="shader__stage"><canvas class="shader__canvas"></canvas>`
            + `<div class="shader__bar">`
            + `<button type="button" class="shader__btn" data-act="toggle" aria-label="Play or pause">❚❚</button>`
            + `<button type="button" class="shader__btn" data-act="reset" aria-label="Restart">↺</button>`
            + `<span class="shader__clock" aria-hidden="true">0.0s</span></div>`
            + `<p class="shader__err" role="alert" hidden></p></div>`
            + cap
            + `<div class="shader__code"><span class="shader__file">fragment.glsl</span>`
            + `<pre class="language-glsl"><code class="language-glsl">${code}</code></pre></div>`
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
        templateFormats: ['md', 'njk', 'html', 'liquid'],
        markdownTemplateEngine: 'njk',
        htmlTemplateEngine: 'njk',
        dataTemplateEngine: 'njk'
    }
}
