---
name: javieramador.dev
description: A technical and environment artist's field notebook. Graphite ink, field-book paper, one highlighter.
colors:
  field-paper: "#f6f4ec"
  field-page: "#efece0"
  graphite-rule: "#2a2822"
  graphite-ink: "#1f1e19"
  pencil-grey: "#66625a"
  ochre: "#9a7300"
  ochre-ink: "#5c4500"
  highlighter: "#f5d95e"
  highlighter-stroke: "#e8c228"
  night-console: "#23221c"
  console-text: "#f2efe6"
  field-paper-dark: "#16150f"
  field-page-dark: "#201e16"
  tan-rule-dark: "#78715b"
  lamp-ink-dark: "#ede8d6"
  pencil-grey-dark: "#a39d8a"
  highlighter-dark: "#e2bd3a"
  highlighter-ink-dark: "#f0d46a"
  highlighter-wash-dark: "#3b3214"
  night-console-dark: "#100f0a"
typography:
  display:
    fontFamily: "Bricolage Grotesque, IBM Plex Mono, sans-serif"
    fontSize: "clamp(1.9rem, 1.4rem + 2.4vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque, IBM Plex Mono, sans-serif"
    fontSize: "clamp(1.6rem, 1.3rem + 1.5vw, 2.2rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, IBM Plex Mono, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(0.9rem, 0.86rem + 0.2vw, 0.98rem)"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.7rem"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  hard: "3px"
  chip: "5px"
  card: "10px"
  pill: "999px"
spacing:
  gutter: "clamp(1.1rem, 4vw, 2.5rem)"
  step: "clamp(2.75rem, 7vw, 4.5rem)"
  box: "1.1rem 1.25rem"
  card: "1.05rem 1.2rem"
components:
  panel:
    backgroundColor: "{colors.field-page}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.hard}"
    padding: "{spacing.box}"
  card:
    backgroundColor: "{colors.field-page}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  nav-pill:
    textColor: "{colors.pencil-grey}"
    rounded: "{rounded.pill}"
    padding: "0.3em 0.75em"
  nav-pill-active:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.pill}"
    padding: "0.3em 0.75em"
  filter-pill:
    backgroundColor: "{colors.field-page}"
    textColor: "{colors.pencil-grey}"
    rounded: "{rounded.pill}"
    padding: "0.45em 1em"
  filter-pill-active:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.pill}"
    padding: "0.45em 1em"
  text-link:
    textColor: "{colors.ochre-ink}"
  code-block:
    backgroundColor: "{colors.night-console}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.card}"
    padding: "1.1em 1.25em"
  inline-code:
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.chip}"
    padding: "0.12em 0.4em"
---

# Design System: javieramador.dev

## Overview

**Creative North Star: "The Field Notebook"**

The site is a technical and environment artist's working notebook: notes typed in graphite on survey-book paper, framed panels pinned into the pages, and a single highlighter used to mark where you are. It's monospace for reading and interface, with chunky grotesque headings for titles. The site should feel like a code editor that someone has been taking field notes in, technical but hand-kept.

The UI deliberately stays close to monochrome. Colour comes from the artwork (renders, photos, live shader canvases), and the interface only frames it. The one accent is **highlighter yellow**, which behaves like a real highlighter: it fills or underlines, and is never ink. Content sits in crisp graphite-ruled boxes on warm paper. Things you can click have rounded corners and lift when touched. Static panels are squared off. There's a full dark theme ("the same field book after dark"), and code blocks are always dark.

Confirmed rejections: generic web defaults ("AI slop": serif and sans with a terracotta accent, conventional template layouts) and commercial density (monetization callouts, promo blocks). Javier chose the look from his own reference sites, ameye.dev (primary) and charlesboury.fr for the coming portfolio, and it must not drift back toward conventional defaults.

**Key Characteristics:**
- IBM Plex Mono for body and UI; Bricolage Grotesque (700–800) for headings, card titles and the brand.
- One accent, highlighter yellow, used as a fill or underline and never as text.
- Graphite-ruled boxes on warm paper. Squared means static, rounded means clickable, pill means a toggle.
- Flat at rest; a hard, unblurred offset shadow appears only on hover.
- Emoji as inline icons on post cards and titles.
- Code blocks are always dark, in a warm syntax palette.
- A narrow centred column (82ch) with a top pill nav.

## Colors

Graphite on field-book paper, with a single highlighter. The palette is called "Survey Book", after all-weather surveyors' field books.

### Primary
- **Highlighter** (light `highlighter` / dark `highlighter-wash-dark`): the "you are here" fill for the active nav tab, the active filter pill, the active shader-inspector channel, and text selection. Text on it is always the ink colour, never yellow.
- **Highlighter Stroke** (light `highlighter-stroke` / dark `highlighter-dark`): a 3px underline on every link and the rule beside blockquotes.
- **Ochre** (light `ochre` / dark `highlighter-dark`): hover text on links and focus rings. It's the only place the accent family appears as a line or text above 3:1 on paper.
- **Ochre Ink** (light `ochre-ink` / dark `highlighter-ink-dark`): coloured link text (`.text-link`, intro links). This is the readable, text-safe member of the yellow family.

### Neutral
- **Field Paper** (`field-paper` / `field-paper-dark`): the page ground.
- **Field Page** (`field-page` / `field-page-dark`): fill for boxes, cards and pills, like a page within the page.
- **Graphite Rule** (`graphite-rule` / `tan-rule-dark`): every border and divider. It's near-black on paper; the dark-theme tan is tuned to at least 3:1 against the box fill.
- **Graphite Ink** (`graphite-ink` / `lamp-ink-dark`): body text and headings.
- **Pencil Grey** (`pencil-grey` / `pencil-grey-dark`): meta text, descriptions, dates and inactive nav. It passes 4.5:1 on both paper and box.
- **Night Console** (`night-console` / `night-console-dark`) with **Console Text** (`console-text`): code blocks in both themes.

The syntax palette on the console is fixed in both themes: keywords `#e6b673`, types `#8fcf8a`, functions `#9cd0e0`, numbers `#e39a70`, strings `#cbe0a0`, punctuation `#b7b1a0`, swizzles and defines `#d7c7f0`, directives `#c99bd6`, comments `#8a9577` italic. All are at least 4.5:1 on every console ground.

### Named Rules
**The Highlighter Rule.** Yellow is a fill or a stroke, never text. Full strength is reserved for "you are here" marks (active tab, active filter, inspector channel, selection). Inline code gets a half-strength wash (50% highlighter mixed into the box fill), and links get a 3px stroke. If yellow ever needs to carry words, use Ochre Ink.

**The One Ink Rule.** The interface has exactly one accent family. Every other colour on the page comes from artwork, shader canvases or syntax highlighting. Don't add a second UI hue.

## Typography

**Display Font:** Bricolage Grotesque (fallback: IBM Plex Mono, sans-serif), weights 600–800, loaded from Google Fonts.
**Body Font:** IBM Plex Mono (fallback: ui-monospace, SFMono-Regular, Menlo, monospace), weights 400/500/600 and 400 italic.

**Character:** a chunky, slightly quirky grotesque for titles, over an even, legible monospace for everything you read and click. The pairing makes the site read like a code editor's notebook rather than a magazine.

### Hierarchy
- **Display** (800, `clamp(1.9rem, 1.4rem + 2.4vw, 2.8rem)`, 1.05): article titles, with the post's emoji inline.
- **Headline** (800, `clamp(1.6rem, 1.3rem + 1.5vw, 2.2rem)`, 1.1): page titles (Blog, Resources, Contact). Library section headings use 800 at 1.4rem.
- **Title** (700, 1.15rem, 1.2): card titles, section labels such as "Latest writing", and prose h3 (1.2rem). Prose h2 steps up to 1.5rem.
- **Body** (400, `clamp(0.9rem, 0.86rem + 0.2vw, 0.98rem)`, 1.7): all running text and UI. Lead paragraphs stay under 55–60ch, and the article column is 82ch. Bold is 600, not 700.
- **Label** (400, 0.7–0.72rem, uppercase, 0.08–0.12em tracking): dates, reading time and link sources.
- **Brand** (Bricolage 800, 1.2rem, −0.01em): the "Javier Amador" wordmark in the header.

### Named Rules
**The Mono Voice Rule.** Plex Mono is the voice of the site: body, nav, pills, captions and code. Bricolage is reserved for headings, card titles and the brand, and never sets a paragraph.

## Layout

A single narrow, centred column: `min(100% − 2 × gutter, 82ch)`. A top bar holds the wordmark on the left and the pill nav plus theme toggle on the right, and wraps onto two lines on phones. Sections are separated by one fluid step (`spacing.step`) and dashed graphite rules (the footer, the article foot, library headings). Lists of posts and resources are a single-column stack of cards with a 1rem gap, never a multi-column grid of same-size tiles. The footer is a three-part grid: RSS on the left edge, credits in the centre, colophon on the right.

**Responsive:** below 34rem, an image card stacks its picture as a 150px top banner and the diagonal divider straightens into a horizontal rule. Everything else reflows within the single column. The back-to-top button hugs the column's right margin on wide screens and falls back to the viewport gutter.

**Exception, the Showcase stage (`/showcase/`):** a full-bleed, scroll-pinned WebGL stage that stays dark in both themes and uses its own `--l-*` tokens drawn from the dark palette (highlighter accent included). Its menu still works as a plain HTML menu without JS or WebGL.

## Elevation & Depth

The system is flat. Depth comes from crisp graphite borders and the contrast between the page and the box fill, not from shadows. Nothing casts a shadow at rest.

### Shadow Vocabulary
- **Touched lift, card** (`box-shadow: 3px 3px 0 var(--border)` + `translateY(-2px)`): post and resource cards and the back-to-top button on hover.
- **Touched lift, pill** (`box-shadow: 2px 2px 0 var(--border)` + `translateY(-2px)`): filter pills and tags on hover.

### Named Rules
**The Touched-Lift Rule.** Surfaces are flat until the pointer reaches them. Then they rise 2px and cast a hard shadow in the rule colour, with no blur. Never use soft, blurred or coloured ambient shadows. Under `prefers-reduced-motion` the lift is dropped.

## Shapes

Corner radius encodes how something behaves:
- **Hard (3px):** static framed panels, such as the home intro.
- **Chip (5px):** inline code.
- **Card (10px):** anything clickable or embedded: post and resource cards, code blocks, shader embeds, images in prose, the back-to-top button.
- **Pill (999px):** nav tabs, filter pills, tags, the theme toggle and shader controls.

Borders are 1px for framed panels and prose images, and 2px for clickable cards, pills and shader embeds, so interactive edges read a little heavier. Image cards cut the boundary between text and picture on a diagonal (a `clip-path` set by `--card-slant`, 2.75rem by default), and the picture bleeds off the card's right edge.

**The Square-Means-Static Rule.** If it doesn't do anything when clicked, its corners are 3px. If it does, they're 10px or a pill.

## Components

### Navigation (pill tabs)
- **Style:** Plex Mono at 0.8rem in Pencil Grey, 0.3em × 0.75em, fully round, with no border.
- **Hover:** text turns to ink on a Field Page fill (0.12s).
- **Active (`aria-current="page"`):** Highlighter fill with ink text at weight 500.
- **Theme toggle:** a 2rem round icon button beside the tabs, showing a moon in light mode and a sun in dark mode. The theme switch cross-fades with a 0.35s View Transition.

### Filter pills (category filter on /blog/)
- **Style:** a Field Page fill, a 2px graphite border, Pencil Grey text at 0.78rem, padded 0.45em × 1em.
- **Hover:** ink text and the touched lift.
- **Active (`aria-pressed="true"`):** Highlighter fill with ink text. They're multi-select, and each pill is its own toggle.
- **Tags** in the post footer share this exact form as links.

### Cards
- **Corner Style:** 10px with a 2px graphite border on a Field Page fill. Text cards have no image; media cards add a right-edge image on a diagonal cut.
- **Content:** emoji plus a Bricolage title, a Pencil Grey description at 0.88rem, and an uppercase date label.
- **Hover:** the touched lift. Cards rise in (0.5s, `cubic-bezier(.2,.7,.2,1)`) as they scroll into view; without JS, or under reduced motion, they're simply visible.

### Framed panel (intro box)
- A squared (3px) Field Page box with a 1px rule, used for static framing such as the home introduction.

### Links
- **Text links:** Ochre Ink text with a 3px Highlighter Stroke underline offset by 3px. On hover they turn Ochre.
- **Prose links:** ink text with the same yellow underline, so long-form reading stays graphite.
- **Further reading rows:** plain annotated rows rather than cards. On hover they gain the box fill and a 1px rule, and an ↗ marks off-site links.

### Code
- **Blocks:** Night Console with Console Text, 10px radius, a 1px rule, 0.85rem type at 1.6 line height, scrolling sideways.
- **Inline:** a 0.88em monospace chip with a half-strength highlighter wash and a 5px radius.

### Live shader embed (signature component)
A canvas stage, a code view and an optional live editor, bound into one 2px-bordered 10px box. The controls are a floating pill bar (play, pause, clock) on a translucent box fill. Postfx demos add a pill switch for the G-buffer channels; its active channel uses the Highlighter like the filter pills. The code view sits on Night Console. Compile errors overlay the canvas in monospace and never blank it.

## Do's and Don'ts

### Do:
- **Do** keep every colour as a token in `src/css/global.css` `:root` and `:root[data-theme="dark"]`. Components read tokens only.
- **Do** use the Highlighter at full strength only for "you are here" marks, with ink text on top.
- **Do** put any coloured text in Ochre Ink (`#5c4500` light, `#f0d46a` dark), which is AA-safe on paper and box.
- **Do** use 3px corners for static panels and 10px or pills for anything clickable or embedded.
- **Do** keep surfaces flat and lift them only on hover, with a 3px 3px 0 graphite shadow (2px for pills) and −2px translate.
- **Do** set titles in Bricolage Grotesque 700–800 and everything else in IBM Plex Mono.
- **Do** let artwork carry the colour. Image cards bleed the picture off the right edge on a diagonal cut.
- **Do** respect `prefers-reduced-motion`: no load-in, no lift, no wave, shaders paused.

### Don't:
- **Don't** set text in highlighter yellow (`#f5d95e` / `#e8c228`). It fails contrast on paper and stops reading as a highlighter.
- **Don't** add a second accent hue to the UI, or bring back the old forest green.
- **Don't** use soft, blurred or coloured drop shadows.
- **Don't** drift toward generic defaults: no serif and sans with a terracotta accent, no gradient heroes, no grids of same-size icon cards, no promo or monetization blocks.
- **Don't** put long-form text in Bricolage, or headings in a system sans.
- **Don't** make code blocks follow the light theme. The console stays dark.
