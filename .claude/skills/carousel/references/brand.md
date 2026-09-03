# Brand system for carousel slides

All paths below are relative to the repo root (`/home/user/neurootlichnik-game`).

## Canvas

Each slide is `1080×1350` px (4:5, Instagram's standard feed-carousel ratio — matches the
studio's own reference carousel, don't switch to 9:16 or square without being asked).

## Colors

Exactly three, straight out of `src/style.css` (`:root` block) — don't introduce a fourth:

- `--bg-primary: #ffffff` (white, "paper")
- `--ink: #2a2a2a` (near-black, all text/outlines)
- `--accent: #dbfc3b` (lime, buttons/highlights/accents)

Every slide's background is one of: white, lime, or dark (`#2a2a2a`, sometimes written as
`#141412` for a photo slide's near-black backdrop — either reads as "the dark one" in this
palette). Don't gradient the background itself; gradients are reserved for legibility scrims
over photos (see "Photo slides" below).

## Fonts

Two families, both custom TTFs at `assets/fonts/`:

- `KicaBold.ttf` → headlines, big numbers, anything that needs to shout. `font-weight: 700`.
- `InterTightSemiBold.ttf` → everything else (body copy, captions, tags, eyebrows).
  `font-weight: 600`.

**Every artboard is a separate sandboxed iframe with no shared state**, so both fonts must be
embedded as base64 `@font-face` data URIs inside every single slide's `<style>` block — there
is no way to load a font file by reference across slides. `scripts/generate_slides.py` already
does this (reads the two TTFs once, base64-encodes them, and interpolates the same
`FONT_FACES` block into every slide via its `wrap()` helper) — reuse that pattern rather than
re-deriving it, and don't try to skip embedding on slides that "don't really need" the headline
font; a slide can still pick it up later if you're iterating.

## Logo

- `assets/logo-full.svg` — lime wordmark. Use on dark or white backgrounds.
- `assets/logo-full-dark.svg` — ink wordmark. Use on lime or light backgrounds.

Place small (roughly 26px tall) in a bottom corner of every slide, consistently positioned, so
the carousel reads as one branded set even out of context.

## Doodle accents

`assets/doodles/*.svg` — hand-drawn squiggles, arrows, checks, spirals, hashtags, dots, etc.
Each file has a hardcoded `fill="#dbfc3b"` (lime) baked into its paths.

- On white or dark backgrounds: use as-is.
- On lime backgrounds: they'd be invisible at full lime-on-lime, so apply
  `filter: brightness(0)` to the `<img>` tag to render them ink-colored instead.

Scatter 2–4 per slide for texture, varied size/rotation/opacity — this is what keeps the set
from feeling like a plain slide deck. Don't overdo it to the point of competing with the text.

## Character illustrations

`assets/carousel-characters/*.png` — a recurring "architect" mascot, already cropped to tight
transparent PNGs from the studio's raw illustration sheets, reusable across any carousel:

- `char-thinking.png` — pondering, holding a lime clipboard.
- `char-waving.png` — standing, waving, holding the clipboard. Good for upbeat/CTA slides.
- `char-running.png` — dynamic motion, speed lines baked in. Good for "rushing/haste" beats.
- `char-tablet.png` — two hands holding a tablet with a **black** screen — the black area is
  meant to be overlaid with a small graphic (see "Tablet screen overlay" below).
- `char-recline.png` — lying down, propped on elbows, wide/short crop. Good for a relaxed
  closing beat.
- `char-headshot.png` — profile close-up.
- `hand-point.png`, `hand-rock.png` — isolated hand gestures for small accents.

**Always place at least one character so it visually bleeds off a slide edge** — oversized,
positioned so part of it sits outside the 1080×1350 frame, with the slide's own
`overflow: hidden` doing the cropping (e.g. `right: -60px; bottom: -20px; width: 500px`). A
character fully contained inside the frame looks static and flat by comparison; cropped-by-the-
edge is the effect that reads as "designed," and it's what the client specifically asked for
when this skill was built. Leave clear space around any text block it might overlap — check
this in the render-and-look pass (references/workflow.md), it's the single most common layout
bug.

### Tablet screen overlay

`char-tablet.png`'s screen occupies roughly the rectangle
`left: 22.8%, top: 2.8%, width: 53.3%, height: 62.5%` of the image's own box (as fractions of
its rendered width/height). Wrap the `<img>` in a `position: relative` container sized to match
its displayed box, then absolutely position a small `<div>` over that rectangle with a dark
background and whatever mini-graphic sells the beat (e.g. a tiny skewed "glitchy building" made
of plain CSS divs — see `scripts/generate_slides.py`'s Slide 2 for a worked example).

## Sticker-shadow language

Chips, tags, and badges get a hard offset shadow and a thick border — the "cut out and stuck
on" look that matches the doodle accents:

```css
.tag-chip {
  background: #ffffff; color: #2a2a2a;
  border: 3px solid #2a2a2a; border-radius: 999px;
  padding: 10px 22px; font-weight: 600;
  box-shadow: 6px 6px 0 #2a2a2a;
}
/* dark-background variant: swap the shadow color to lime so it still reads as offset */
.tag-chip--dark { background: #2a2a2a; color: #f5f2e8; border-color: #f5f2e8; box-shadow: 6px 6px 0 #dbfc3b; }
.tag-chip--lime { background: #dbfc3b; color: #2a2a2a; border-color: #2a2a2a; }
```

Rotate these slightly (`-1deg` to `-4deg`) rather than leaving them perfectly axis-aligned —
it's a small touch but it's what makes the set feel hand-set instead of templated. Don't rotate
*everything*, though; a headline block or two staying straight gives the rotated pieces
somewhere to stand out against.

Highlighted key phrases inside a headline use the same idea inline:

```css
.chip { background: #dbfc3b; color: #2a2a2a; padding: 2px 10px 6px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
```

(`box-decoration-break: clone` is what makes a phrase that wraps onto two lines get its own
highlight box per line, instead of one box stretching across the gap.)

## Slide counter

A small `N / 8` pill, top-right corner, every slide — background flips to whatever reads on
that slide's own background (dark pill on light slides, lime pill on dark slides). Cheap to add,
gives the carousel a "designed as a set" feel and doubles as a swipe-progress cue.

## Photo slides

When the user has supplied real portfolio/render images for this run, use 1–2 as full-bleed
backgrounds — typically the cover and one "proof" slide, bookending the illustrated middle:

```css
.photo-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scrim-top { position: absolute; top: 0; left: 0; right: 0; height: 58%; background: linear-gradient(to bottom, rgba(20,20,18,0.82), rgba(20,20,18,0)); }
.scrim-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 56%; background: linear-gradient(to top, rgba(20,20,18,0.88), rgba(20,20,18,0)); }
```

Put the scrim on whichever side the headline sits, white KicaBold text with a soft
`text-shadow` for extra legibility over busy image detail. Never fabricate a render to fill this
slot — ask for real images (Step 2 in SKILL.md) and fall back to the illustrated style if none
are available.

Compress source photos before embedding — `PIL`, `quality=78, optimize=True` brought a pair of
~400KB JPEGs down to ~230KB each with no visible loss, and the seed-canvas helper's own warning
threshold (~70KB/image) is a soft guideline, not a hard cap; a few photos in the few-hundred-KB
range are fine against the 16MB total document budget.

## Growing this library

If a future carousel needs a pose that doesn't exist yet, the studio's raw illustration sheets
(`assets/Group *.svg`, `assets/На_Экспорт-*.svg`) hold more than what's been extracted so far —
they're large shared-canvas sprite sheets (viewBoxes like `0 0 4096 2888`) with multiple poses
positioned at different coordinates within one file. To pull a new one out cleanly: render the
SVG at a few thousand px wide via a headless browser, screenshot with a transparent background,
then auto-crop to the drawn content's bounding box on the alpha channel (Pillow's
`Image.getbbox()` on the loaded RGBA image does this in a couple of lines). Resize the result
down to a sane max dimension (~900px on the long side was plenty for how these render in a
slide) before saving. Drop the finished PNG into `assets/carousel-characters/` and add a line
about it to this file so the next run knows it exists.
