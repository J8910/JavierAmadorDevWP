const markdownItKatex = require('@traptitech/markdown-it-katex');
const rssPlugin = require('@11ty/eleventy-plugin-rss').default;

module.exports = function(eleventyConfig) {
    const Card = require('./src/_includes/components/Card');

    // RSS/Atom feed — adds dateToRfc3339, absoluteUrl, htmlToAbsoluteUrls filters
    // used by src/feed.njk to build /feed.xml at build time.
    eleventyConfig.addPlugin(rssPlugin);

    eleventyConfig.addPassthroughCopy('src/assets');
    eleventyConfig.addPassthroughCopy('src/css');
    eleventyConfig.addPassthroughCopy('src/CNAME');   // custom domain for GitHub Pages

    eleventyConfig.addWatchTarget('src/css');

    eleventyConfig.addShortcode('Card', Card);

    // Current year, e.g. for the footer: {% year %}
    eleventyConfig.addShortcode('year', () => `${new Date().getFullYear()}`);

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
