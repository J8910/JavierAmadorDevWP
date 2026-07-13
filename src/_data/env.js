// Eleventy run mode: "serve" / "watch" during local dev, "build" for `npm run build`
// (i.e. CI / production). Used to keep analytics off local dev.
module.exports = () => process.env.ELEVENTY_RUN_MODE || 'build';
