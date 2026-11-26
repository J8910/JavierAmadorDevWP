---
name: javieramador.dev
description: A live survey sheet. The page is a GLSL contour map; a technical and environment artist's work is pinned on it in paper panels.
colors:
  day-paper: "#f4f5f0"
  day-ink: "#1b1d1a"
  day-index: "#b0602a"
  ink-soft: "#555950"
  accent-ink: "#8c4a1d"
  accent-soft: "#eddccb"
  paper-inset: "#ebece5"
  night-paper: "#151b22"
  night-ink: "#7e8a9a"
  night-index: "#e3a63a"
  night-text: "#e9e6dd"
  night-ink-soft: "#a7adb7"
  night-rule: "#4a5466"
  night-accent-ink: "#ecc06a"
  night-accent-soft: "#3a3018"
  night-inset: "#1d242d"
  console-bg: "#16181b"
  console-fg: "#ece8de"
  console-soft: "#9fa3a9"
  console-rule: "#3a3f46"
typography:
  display:
    fontFamily: "Mona Sans, Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 1.5rem + 3vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Mona Sans, Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 1.4rem + 2vw, 2.8rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Mona Sans, Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    fontVariation: "'wdth' 108"
  brand:
    fontFamily: "Mona Sans, Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.22em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1rem, 0.96rem + 0.2vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.6
  nav:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
  label:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  none: "0px"
spacing:
  gutter: "clamp(1rem, 4vw, 3.5rem)"
  step: "clamp(2.5rem, 6vw, 5rem)"
  panel: "clamp(1rem, 2.4vw, 1.5rem)"
  measure: "70ch"
  wide: "1328px"
components:
  panel:
    backgroundColor: "{colors.day-paper}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.panel}"
  card:
    backgroundColor: "{colors.day-paper}"
    textColor: "{colors.day-ink}"
    rounded: "{rounded.none}"
    padding: "1.1rem 1.25rem"
  name-chip:
    backgroundColor: "{colors.day-paper}"
    textColor: "{colors.day-ink}"
    typography: "{typography.brand}"
    rounded: "{rounded.none}"
    padding: "0.6rem 0.8rem 0.6rem 0.75rem"
  legend-link:
    textColor: "{colors.day-ink}"
    typography: "{typography.nav}"
    padding: "0.45rem 0.75rem"
  legend-link-current:
    textColor: "{colors.accent-ink}"
  filter-pill:
    backgroundColor: "{colors.day-paper}"
    textColor: "{colors.day-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.4em 0.85em"
  filter-pill-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.day-ink}"
  text-link:
    textColor: "{colors.accent-ink}"
  night-button:
    textColor: "{colors.day-ink}"
    size: "2.4rem"
  code-console:
    backgroundColor: "{colors.console-bg}"
    textColor: "{colors.console-fg}"
    rounded: "{rounded.none}"
    padding: "1.1em 1.25em"
---

# Design System: javieramador.dev

## Overview

**Creative North Star: "The Survey Sheet"**

The page is a live survey map. A GLSL contour field (`ground.frag`) is drawn full-screen behind everything and slides with the scroll; Javier's renders and writing are pinned on it as opaque paper panels with a single ink rule. The map is not decoration on top of a layout, it is the ground the layout sits on: the cursor raises a soft hill, a click on open map raises a peak, a fast cursor leaves small ripples, and the map's own source opens from a quiet `ground.frag` link and can be edited live. The site reads as one surveyed sheet, not a gallery of thumbnails.

There are two sheets. The day sheet is pale map paper with graphite ink and sienna index contours; the night sheet is slate with grey depth contours and ochre index contours. Switching is a flood: water pours out of the night button, and each paper surface turns dark as the waterline reaches it, with an ochre shoreline on the moving edge. Density is calm. Artwork leads, chrome stays thin, and colour beyond ink and the one index hue comes from the art itself.

Confirmed rejections: the dark ArtStation thumbnail grid, and the earlier cream terminal-zine and "Field Notebook" looks (all-monospace body, rounded cream boxes, pill tab nav, emoji icons, highlighter yellow). None of their tokens carry over.

**Key Characteristics:**
- A live contour map is the page background; content sits on opaque paper surfaces over it.
- Square corners everywhere; one 1px ink rule defines every panel, card, image and field.
- One index hue per sheet (sienna by day, ochre by night) for current state, underlines and contours.
- Four legend symbols are the only icons.
- Night is a flood, not a toggle swap.
- Images can carry two shots, compared by a waterline that follows the cursor.

## Colors

A cartographer's palette: near-neutral paper and graphite, one earthy index hue per sheet, and a console that stays dark in both.

### Primary
- **Sienna Index** (day-index): the day sheet's index contours on the map, the current-page underline, link underlines, hover rules on cards and pills, and the focus outline. Used as a line, almost never as a fill.
- **Burnt Sienna Ink** (accent-ink): sienna when it must be read as text (current nav item, text links, project context line, hover text). Holds AA on day paper.
- **Ochre Index** (night-index): the night sheet's index contours, the flood shoreline, the survey-slide waterline, and every role Sienna Index plays by day. Night text uses **Lamp Ochre** (night-accent-ink).

### Secondary
- **Sienna Wash** (accent-soft) / **Ochre Wash** (night-accent-soft): selected filter pills and text selection. The only accent fills in the system.

### Neutral
- **Map Paper** (day-paper): the day map ground and the fill of every surface, panel and card. Surfaces are the paper itself, made opaque over the moving map.
- **Graphite Ink** (day-ink): body text, headings, and every 1px rule on the day sheet.
- **Pencil Grey** (ink-soft): secondary text: leads, summaries, dates, fact labels, footer (6.6:1 on paper).
- **Paper Inset** (paper-inset) / **Night Inset** (night-inset): one step off the paper, for inline code, blockquotes, image wells before they load.
- **Slate** (night-paper): the night map ground and night surface fill.
- **Depth Grey** (night-ink): the night map's depth contours (in the shader only, not text).
- **Lamplight** (night-text), **Night Pencil** (night-ink-soft), **Night Rule** (night-rule): night text, secondary text and rules.
- **Console** (console-bg, console-fg, console-soft, console-rule): the always-dark code block and the ground.frag editor, in both sheets. Its accent is Ochre Index.

### Named Rules
**The One Index Rule.** Each sheet has exactly one accent hue, and it behaves like an index contour: a line, an underline, an outline. Fills of it are limited to the pale wash on selected pills and text selection.

**The Six Hexes Rule.** The two sheets are defined by six 6-digit hexes (`--day-paper`, `--day-ink`, `--day-index`, `--night-paper`, `--night-ink`, `--night-index`) that the CSS and both shaders (ground.js, slides.js) read. Change the sheet there, nowhere else, and keep them 6-digit.

**The Art Brings Colour Rule.** No decorative colour beyond ink and the index hue. Saturation on the page comes from Javier's renders.

## Typography

**Display Font:** Mona Sans (with Schibsted Grotesk, system-ui)
**Body Font:** Schibsted Grotesk (with system-ui, -apple-system, Segoe UI)
**Label/Mono Font:** Martian Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** A wide, sturdy grotesque for titles and the name, a crisp newspaper grotesque for everything read, and a technical mono kept to the margins of the sheet: code, facts, dates, captions, the footer. Mona Sans is used on its width axis (108-125%), which is what makes the name chip read like a map title.

### Hierarchy
- **Display** (700, clamp(2.2rem to 3.6rem), 1.0, width 112%): project page titles.
- **Headline** (700, clamp(1.9rem to 2.8rem), 1.05, width 112%): page heads, article titles, the hero caption title; section heads ("Work", "Writing") step down to clamp(1.6rem to 2.1rem).
- **Title** (700, 1.25rem, 1.2, width 108%): card titles, prose h3; prose h2 at 1.6rem.
- **Brand** (700, 1.05rem, width 125%, 0.22em tracking, uppercase): the name chip only.
- **Body** (400, clamp(1rem to 1.0625rem), 1.6): all reading and UI text; prose column capped at 70ch, leads at 56-62ch.
- **Nav** (500, 1rem): legend entries.
- **Label** (Martian Mono 400, 0.72-0.78rem): facts lists, article metadata, dates, figure captions, filter pills, footer, ground.frag link, code.

### Named Rules
**The Wide Name Rule.** The site name is the only text in wide, spaced capitals (Mona Sans at 125% width, 0.22em tracking; 0.16em on phones). No other label is set in tracked caps.

**The Mono Margin Rule.** Martian Mono is for code, data and small labels only. Running text, headings and nav are never monospace.

**The Nothing Above The Title Rule.** No label, kicker or metadata line sits above a heading. Page metadata (date, reading time, family, difficulty) goes below the title and lead.

Mona Sans is flagged by the detector as an overused face. It came with the user-approved prototype and is the chosen display face; do not swap it.

## Layout

The page is one wide sheet: content width `min(100% - 2 × gutter, 1328px)`, gutter clamp(1rem, 4vw, 3.5rem), and a vertical step of clamp(2.5rem, 6vw, 5rem) between major sections. Surfaces sit apart on the map with real gaps between them so the contours show through; the map is never fully covered.

- **Header:** name chip left, legend nav and night button right, both as separate paper surfaces.
- **Home hero:** the featured project as a large survey slide (about 72% of the width) with its caption panel beneath, and a right rail (12-15.5rem) of other projects as image + name, ending in "All work". At 60rem and below the rail collapses under the hero into a wrapping row of project-name chips (thumbnails hidden) plus "All work".
- **Work list:** each project is a 2:1 grid of media and a text panel, alternating sides; under the media, a row of up to three gallery thumbnails that skips any shot the survey slide already shows. The row is 3 wide or 2 wide; a single leftover thumbnail spans the full row as a 21:8 strip. Single column below 60rem.
- **Reading:** an article is one paper sheet up to 52rem wide with a 70ch prose column inside.
- **Phones (36rem and below):** legend spans the full width, symbols hide, name tracking tightens. The ground.frag link hides below 40rem.

## Elevation & Depth

Flat. There are no shadows anywhere in the system. Depth comes from the map: paper surfaces are opaque and sit over a moving contour field, so separation is paper-over-terrain plus a 1px ink rule. Featured images get a detached frame instead of a shadow: a 1px outline offset 8px from the picture (hero plate, project lead shot), like a plate mounted on the sheet.

### Named Rules
**The Paper Over Terrain Rule.** Anything carrying text is an opaque surface on the map. Never put text directly on the live map, and never make a surface translucent.

## Shapes

Square corners throughout (radius 0). Rules are 1px solid ink (Night Rule at night); hover changes the rule to the index hue rather than adding weight. Images are clipped square, 16:9 by default, each with its own 1px outline. The only curves are the legend symbols and the night button's moon and waves, drawn as 1.5px strokes. The focus ring is a 2px index-hue outline offset 3px.

## Components

### Buttons
Quiet and typographic; the system has no filled buttons.
- **Night button:** a 2.4rem icon button (moon over two waves, 20px), ink colour, no border or fill; hover turns it Burnt Sienna Ink. It is where the flood starts.
- **Back to top:** a 2.75rem square paper surface with a 1px rule and an arrow; appears after 600px of scroll, never overlaps the footer; hover turns the rule and arrow to the index hue.
- **Console buttons (revert):** mono 0.72rem, console text, 1px console rule; hover goes Ochre Index.

### Chips
- **Filter pills (/blog/) and tags:** square, paper fill, 1px rule, Martian Mono 0.78rem. Hover turns the rule sienna and the text Burnt Sienna Ink; selected (`aria-pressed`) takes the Sienna Wash fill with a sienna rule.

### Cards / Containers
- **Panel:** an opaque paper surface with a 1px rule and clamp(1rem to 1.5rem) padding. The base unit of the page.
- **Post card:** a ruled panel; title in Title type, description in Pencil Grey, date in mono. Hover turns the rule sienna and underlines the title in sienna. With an image, the picture takes the right 30% behind a 1px divider and scales 1.03 on fine-pointer hover; on phones it moves above the text at 160px.
- **Rail item:** a ruled paper tile with a 16:9.5 shot and the project name (600, 0.98rem). No numbering. At 60rem and below it becomes a name-only chip. The closing "All work" link (mono 0.8rem) carries a drawn SVG down arrow at the legend's 1.5px stroke.
- **Article metadata:** below the title and lead, a Martian Mono 0.78rem Pencil Grey line over a 1px top rule: date (`<time>`) · reading time on posts, family · difficulty on resources.
- **Facts list:** a two-column mono list (Role, Tools, Year, For) with Pencil Grey labels.

### Inputs / Fields
- **ground.frag editor:** a console-dark dialog (up to 40rem by 38rem) bottom-left, with a head line ("ground.frag · live", line count, revert), a mono textarea with an ochre caret, and a status line. A failing edit keeps the last good shader running and shows the error in the status line.

### Navigation
- **Name chip:** the site name as a paper surface in Brand type, linking home.
- **Legend:** a paper surface holding the nav as a map legend: each entry is a 13x12 symbol plus its name (triangle = Work, waves = Writing, target = Resources, square = Contact). The current page and its section turn Burnt Sienna Ink with a 2px sienna underline offset 5px; hover shows the same underline. Symbols hide on phones.
- **Footer:** one mono paper strip on a three-column grid aligned on the baseline: RSS left, copyright centred (never wraps), Colophon right. A 3rem bottom margin keeps the fixed ground.frag link clear of it at the end of the page. At 30rem and below the gap and size tighten (0.7rem) and the copyright shows only "© year"; the name is dropped because the header chip already carries it.

### Survey Slide (signature)
A project image that holds two shots (for example, final render and clay). It rests on the first shot. A waterline follows the cursor across it; left of the line shows the second shot. The line bends along the image's own contours, bends harder the faster it moves, and trails ripples that fade at rest; leaving lets the first shot settle back. Keyboard: arrow keys when focused. Touch: drag, or tap to swap. A small mono tag names the pair on hover. On the home hero the first shot develops from its own contour survey on load (about 1.9s). Without WebGL the first image simply shows.

### Live Map and Night Flood (signature)
The ground canvas is fixed behind the page and decorative (`aria-hidden`); every page is complete without it. The flood runs about 2.3s from the night button; surfaces join the night sheet as the water reaches them, then the theme settles and is remembered.

### Code Console
Code blocks are always dark (Console tokens) with one warm Prism palette (olive comments, amber keywords, green builtins, sky functions, apricot numbers, pale lime strings, lilac constants). Inline code sits on Paper Inset.

## Do's and Don'ts

### Do:
- **Do** put every piece of text on an opaque paper surface with a 1px ink rule, leaving map visible between surfaces.
- **Do** keep corners square (0px) and rules at 1px; signal hover by turning the rule to the index hue.
- **Do** use Burnt Sienna Ink (#8c4a1d) or Lamp Ochre (#ecc06a) when the accent is text, and keep secondary text on Pencil Grey or Night Pencil so contrast stays at AA or better.
- **Do** use a legend symbol, drawn as a 1.5px stroke SVG, when a nav entry or link needs an icon.
- **Do** skip any thumbnail the survey slide already shows, in work rows and project galleries.
- **Do** keep motion to the one 0.5s page-opening rise on page heads, articles and the hero; nothing reveals on scroll.
- **Do** honour `prefers-reduced-motion`: the map draws still frames only, the theme changes without a flood, clicks and ripples are off, the hero shows without its reveal, and transitions collapse.
- **Do** keep a visible 2px index-hue focus outline (offset 3px) on links, buttons and focusable slides.
- **Do** make WebGL an enhancement: the first image shows without it, the page reads without the map.

### Don't:
- **Don't** use emoji, Unicode arrows or any icon set; the four legend symbols plus the drawn night, back-to-top and down-arrow SVGs are the whole icon vocabulary. Legacy `emoji` front matter is not rendered.
- **Don't** put a label, kicker or metadata line above a heading; metadata goes below the title.
- **Don't** number projects or add counters to the work list or rail.
- **Don't** round corners, add drop shadows, or use translucent glass panels.
- **Don't** set body text, headings or nav in Martian Mono, or track any text in caps except the name chip.
- **Don't** add a second accent hue or decorative colour; colour comes from the artwork.
- **Don't** bring back the cream terminal-zine, Field Notebook highlighter, or dark ArtStation-grid looks.
- **Don't** blank the map or an editor on a shader error; keep the last good program running.
