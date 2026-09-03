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

Every slide's background is one of: white (or a warm-paper near-white like `#f6f3ec` — a
deliberately chosen neutral for a quieter direction, still reads as "white" in this palette),
lime, or dark (`#2a2a2a`, sometimes written as `#141412` for a photo slide's near-black
backdrop — either reads as "the dark one" in this palette). Don't gradient the background
itself; gradients are reserved for legibility scrims over photos (see "Photo slides" below).

**Never let lime be a field that text sits directly on without deliberately choosing the text
color for it** — a real published carousel shipped with an element whose text inherited the
default ink color while its container's background had been set to lime by a different rule,
so the text simply vanished. Lime reads well as thin rules, small marks, an underline, a tiny
inset circle — anywhere it's backing text, hand-check that specific element's rendered contrast
in the look-once pass (workflow.md), don't assume a color that worked as an accent elsewhere in
the same file is safe as a text background too.

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

Neither custom font covers decorative glyphs outside plain Cyrillic/Latin/digits — a large
typographic quotation mark (`&#8220;` etc.) set in `KicaBold` rendered as two blank tofu boxes
in a real run, not a quote mark. For any purely decorative character like that, set a generic
fallback stack (e.g. `Georgia, 'Times New Roman', serif`) on that element specifically rather
than the brand font — it's a graphic, not brand-carrying text, so it doesn't need to match.

## Logo

- `assets/logo-full.svg` — lime wordmark. Use on dark or white backgrounds.
- `assets/logo-full-dark.svg` — ink wordmark. Use on lime or light backgrounds.

Place small (roughly 26px tall) in a bottom corner of every slide, consistently positioned, so
the carousel reads as one branded set even out of context.

**Picking the wrong variant for a split-color slide is invisible-text bug #3 (after
lime-behind-white-text and a faded gradient stop): a real run put `logo-full.svg` (lime) in the
lime-bottom half of a dark-top/lime-bottom split slide, where it was lime-on-lime and completely
gone** — caught only by cropping and zooming the corner in the render-and-look pass, not visible
at thumbnail scale. A slide's default corner logo isn't automatically safe just because it's
"the logo, it always goes there" — on any slide whose background isn't uniform (a split panel, a
color-blocked layout, a card sitting in that exact corner), check what's actually *behind* the
logo's specific pixel position, same as any other lime-colored element, and pick
`logo-full.svg` vs `logo-full-dark.svg` per-slide accordingly rather than defaulting to one
choice for the whole carousel.

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

A bleeding character parked in a bottom corner competes with the corner logo mark for the same
real estate — a real run put a waving mascot at `left:-30px; bottom:-10px` and its raised leg
crossed straight through the default bottom-left logo position, garbling the wordmark. When a
character occupies a bottom corner, either move it to the opposite corner from the logo, or
override the logo's position for that one slide (e.g. `style="left:auto; right:48px;"`) rather
than letting them collide — check this specifically, not just the headline/character overlap.

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

A small `N / 8` pill, top-right corner, every slide. **Give it default `top`/`right` in the
shared CSS class** (e.g. `.pill { position: absolute; top: 56px; right: 56px; ... }`) rather
than repeating those coordinates inline on every slide's counter element — a real run of this
skill wrote the counter as `<div class="pill" style="...">N / 8</div>` on seven of eight slides
without an inline position, forgot the CSS default too, and every one of those seven rendered
top-LEFT instead (an absolutely-positioned element with no offsets keeps its in-flow position,
which is the top-left corner here). Only the one slide that happened to set `top`/`right`
inline came out right. Set the default once in the shared class and every slide inherits it
correctly; override inline only on the rare slide that genuinely needs the counter somewhere
else. Background flips to whatever reads on that slide's own background (dark pill on light
slides, lime pill on dark slides) — that part does need a per-slide inline override, since it's
content-dependent, not a layout default.

## Photo slides

`assets/portfolio/` holds real studio render photos, filenames descriptive of content (e.g.
`giant-cat-tower.jpg`, `villa-modern-dark.jpg`, `office-reception-green.jpg`) — check there
before asking the user for images (see Step 2 in SKILL.md). Use 1–2 as full-bleed
backgrounds per carousel — typically the cover and one "proof" slide, bookending an illustrated
middle, though a strong photo can carry more slides if the topic calls for it (a whole carousel
can be photo-led if that's the right choice for the topic).

Two treatments, pick whichever the photo actually needs:

```css
.photo-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scrim-top { position: absolute; top: 0; left: 0; right: 0; height: 58%; background: linear-gradient(to bottom, rgba(20,20,18,0.82), rgba(20,20,18,0)); }
.scrim-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 56%; background: linear-gradient(to top, rgba(20,20,18,0.88), rgba(20,20,18,0)); }

/* duotone alternative — a current, more editorial look; skip the scrim, tint the whole image instead */
.duotone-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) contrast(1.15) brightness(0.9); }
.duotone-tint { position: absolute; inset: 0; background: #dbfc3b; mix-blend-mode: multiply; }
```

With a scrim: put it on whichever side the headline sits, white KicaBold text with a soft
`text-shadow` for extra legibility over busy image detail. Without one (bright, graphic photos
with real negative space — open sky, a plain wall): ink-colored text can sit directly on the
image with no scrim at all, which reads bolder and more current than defaulting to a scrim
every time — check the actual photo's tonal areas before reaching for a gradient. Either way,
double-check every text block against the specific photo you're using: a caption that's legible
over one image's sky can vanish over another's, so verify in the render-and-look pass
(workflow.md), don't assume the pattern that worked last time still fits this photo. Never
fabricate a render to fill this slot — ask for real images (Step 2 in SKILL.md) and fall back
to the illustrated style if none are available.

Compress source photos before embedding — `PIL`, `quality=78, optimize=True` brought a pair of
~400KB JPEGs down to ~230KB each with no visible loss, and the seed-canvas helper's own warning
threshold (~70KB/image) is a soft guideline, not a hard cap; a few photos in the few-hundred-KB
range are fine against the 16MB total document budget.

## Maximalist bento glass

A fourth layout direction (see SKILL.md's "Vary the design every time") for when the client
explicitly wants dense, "complex," current-2026 design rather than something quiet — reached for
after a real run where a client rejected an editorial-grid carousel as too plain and asked for
"сложный человеческий дизайн, в котором отображаются все тренды веб-дизайна 2026 года." Busy on
purpose: bento-grid card sizes (mismatched, not one box per slide), frosted glass panels,
blurred ambient color blobs, a chrome-gradient headline, procedural grain, stacked-paper photo
depth, and doodle stickers all layered in the same carousel.

```css
/* procedural grain — no image asset needed, needs the matching <filter> defs below */
.grain { position: absolute; inset: 0; z-index: 40; pointer-events: none; filter: url(#grainFilter); opacity: 0.5; mix-blend-mode: overlay; }
/* put this once per slide, right after opening .root's content: */
/* <svg width="0" height="0" style="position:absolute"><filter id="grainFilter">
     <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n"/>
     <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.5 0.5 0.5 0 0"/>
   </filter></svg> */

/* ambient blurred lime blob — the glow, never a text background */
.blob { position: absolute; z-index: 0; pointer-events: none; filter: blur(46px); }

/* frosted glass card — three variants for light/dark/lime slides */
.glass {
  position: absolute; background: rgba(255,255,255,0.62);
  backdrop-filter: blur(20px) saturate(1.2); -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1.5px solid rgba(255,255,255,0.9); border-radius: 28px;
  box-shadow: 0 24px 60px rgba(20,20,18,0.18), 0 2px 8px rgba(20,20,18,0.08);
  color: #2a2a2a; z-index: 10;
}
.glass--dark { background: rgba(20,20,18,0.5); border-color: rgba(255,255,255,0.14); color: #f5f2e8; box-shadow: 0 24px 60px rgba(0,0,0,0.35); }
.glass--lime { background: rgba(219,252,59,0.82); border-color: rgba(42,42,42,0.25); color: #2a2a2a; box-shadow: 0 24px 60px rgba(20,20,18,0.2); }

/* stacked-paper depth behind a photo — offset rotated duplicate layers underneath the real image */
.stack-under { position: absolute; background: #f5f2e8; border: 2px solid #2a2a2a; border-radius: 20px; z-index: 1; }
```

**A glass panel with a busy or warm-toned photo directly behind it can still wash out the text
inside it** — a real cover slide put a `.glass` panel over a ginger cat's face, and the
`backdrop-filter: blur()` let enough orange bleed through to smudge the last few letters of the
headline sitting on top. Fixed by narrowing/repositioning the panel so it sits over plainer
photo area (sky, wall) rather than the photo's busiest/brightest region, and bumping the panel's
own background opacity (`rgba(255,255,255,0.62)` → `~0.86`) so less of the photo shows through
the blur. Check this specifically for any glass panel placed over a photo, not just over a flat
background.

**A slide meant to be dark needs its background set explicitly — `wrap()`'s default `.root`
background is white, and nothing here inherits "dark" from a class name.** A real run wrote a
whole slide using `.chrome-text--onDark`, `.glass--dark`, and the lime logo variant — all
correctly chosen for a dark slide — but never actually set `.root`'s background to dark, so it
rendered on white and `chrome-text--onDark`'s pale gradient became nearly invisible against it
(the same invisible-text failure mode as lime-behind-white-text, just triggered by a missing
background instead of a wrong one). `wrap(body_html, extra_css)` takes an `extra_css` argument
for exactly this — pass `".root { background: #2a2a2a; color: #f5f2e8; }"` for that one slide
rather than trying to set it inline on a div, since the body HTML no longer creates its own
`.root` wrapper in this template shape (`wrap()` does). Whenever a slide uses any `--onDark` or
`--dark` variant class, double check in the render-and-look pass that the slide's actual
background is dark, not just that the class names say so.

**A gradient-clipped "chrome text" headline needs stops that stay dark relative to whatever
background it sits on — a stop that gets too close to the background color makes part of the
word disappear, exactly like solid invisible text, just harder to spot because most of the word
still reads fine.** The first version of `.chrome-text` included a near-white/cream stop
(`#f5f2e8`) meant to read as a metallic highlight; on a white or light-glass background, the
letters landing on that stop nearly vanished (verified by cropping and zooming the render — the
tail end of a word was legible in the thumbnail but essentially blank up close). Fixed by
keeping every stop in the on-light variant clearly darker than the background — an ink → olive →
bright-lime → ink progression with no near-white stop — and adding a faint
`-webkit-text-stroke: 1.5px rgba(42,42,42,0.16)` as a safety margin regardless of exactly where
the gradient lands:

```css
.chrome-text {
  background: linear-gradient(115deg, #2a2a2a 0%, #55661f 22%, #a8c93a 42%, #2a2a2a 64%, #55661f 82%, #2a2a2a 100%);
  -webkit-background-clip: text; background-clip: text; color: #2a2a2a; -webkit-text-fill-color: transparent;
  -webkit-text-stroke: 1.5px rgba(42,42,42,0.16);
}
/* onDark variant is fine keeping a cream/lime-heavy gradient — those stops are always light-on-dark, high contrast either way */
.chrome-text--onDark {
  background: linear-gradient(115deg, #dbfc3b 0%, #f5f2e8 35%, #dbfc3b 55%, #8a9a4a 75%, #f5f2e8 100%);
  -webkit-background-clip: text; background-clip: text; color: #f5f2e8; -webkit-text-fill-color: transparent;
}
```

Whenever you write a gradient-clipped text effect, zoom into a screenshot crop of it in the
render-and-look pass rather than eyeballing the thumbnail — a partial fade is exactly the kind
of thing that reads fine at a glance and disappears on closer inspection (which is how a
scrolling stranger actually reads a cover slide).

## Technical blueprint

A fifth layout direction (see SKILL.md's "Vary the design every time") for a topic that's
itself about a plan, a promise, or something not yet built — first reached for on a carousel
about developers selling pre-construction real estate, where the metaphor (a blueprint stands
for the object that doesn't exist yet) fit the topic directly. Ink is the dominant background
here rather than white or lime; lime and cream appear only as thin line/label color, never a
filled panel behind text — which structurally rules out the lime-behind-text bug class this
direction would otherwise be prone to (there's no filled lime field to accidentally put text on
in the first place).

```css
/* faint drafting-paper dot grid, laid under everything */
.grid-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(rgba(219,252,59,0.16) 1px, transparent 1px); background-size: 36px 36px; }
.grid-bg--onLight { background-image: radial-gradient(rgba(42,42,42,0.12) 1px, transparent 1px); }

/* corner registration brackets — the recurring signature device, one per corner */
.reg-mark { position: absolute; width: 28px; height: 28px; z-index: 30; }
/* each corner's <svg><path> draws a 2-px L-shape rotated to point into that corner — see
   scripts from the run that built this for the four path variants */

/* dimension-line callout — a rule with tick-mark ends, standing in for a chip */
.dim-line { position: absolute; height: 1.5px; background: rgba(219,252,59,0.7); z-index: 6; }
.dim-line::before, .dim-line::after {
  content: ""; position: absolute; top: -6px; width: 1.5px; height: 13px; background: rgba(219,252,59,0.7);
}
.dim-line::before { left: 0; }
.dim-line::after { right: 0; }

/* "sheet number" slide counter, framed instead of pill-shaped */
.sheet-tag { position: absolute; top: 48px; right: 48px; z-index: 30; border: 1.5px solid rgba(245,242,232,0.5); padding: 8px 16px; }
.tech-label { font-family: 'InterTight', sans-serif; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; font-size: 15px; }
```

**A split-background slide (ink top half / light bottom half, like a page break) needs the
light half to actually establish its own positioning context, or its background silently
collapses to zero height.** A real run wrapped a light-half slide's content in a `<div
class="root--light">` sitting *inside* the outer `.root`, expecting it to fill the bottom
portion — but `.root--light` had no `position` of its own, so it stayed a normal in-flow block
with only absolutely-positioned children inside it (which don't contribute to a parent's
height), collapsing to zero height and hiding the light background entirely behind `.root`'s own
ink background. Fixed by giving any such wrapper `position: absolute; inset: 0;` explicitly so
it actually spans the slide instead of relying on its children to give it size.

**A headline's line count is unpredictable at a chosen font-size until you actually render it —
don't eyeball a Cyrillic character count and guess.** Two slides in the same run wrapped to one
more line than planned (a 2-line headline came out as 4, a 3-line one printed 4), pushing text
down into a technical-annotation label positioned below where the shorter version would have
ended, producing a visible overlap. Cyrillic KicaBold caps run wide, so a headline that looks
short by character count can still wrap further than expected at a large size. Treat any
element positioned *below* a large headline (a dimension-line label, a caption, anything with a
fixed `top`) as at risk until the actual render confirms the headline's real line count —
either give it enough vertical clearance for one extra line, or check and adjust font-size/
position together in the render-and-look pass rather than trusting the draft numbers.

## Growing this library

Two separate libraries grow the same way — use real material when it exists, generate only
when it doesn't, and always save what you make back into the repo:

- **Real photos** (`assets/portfolio/`): when the user shares new render photos (directly as
  file attachments, or wrapped in a PDF — see Step 2 in SKILL.md for why direct chat pastes
  don't work), save the good ones here with a descriptive filename before the session ends,
  the same way the existing set got there.
- **Illustrated character poses** (`assets/carousel-characters/`): if a future carousel needs a
  pose that doesn't exist yet, the studio's raw illustration sheets (`assets/Group *.svg`,
  `assets/На_Экспорт-*.svg`) hold more than what's been extracted so far — they're large
  shared-canvas sprite sheets (viewBoxes like `0 0 4096 2888`) with multiple poses positioned at
  different coordinates within one file. To pull a new one out cleanly: render the SVG at a few
  thousand px wide via a headless browser, screenshot with a transparent background, then
  auto-crop to the drawn content's bounding box on the alpha channel (Pillow's
  `Image.getbbox()` on the loaded RGBA image does this in a couple of lines). Resize the result
  down to a sane max dimension (~900px on the long side was plenty for how these render in a
  slide) before saving.

Either way, add a line to this file describing what you added so the next run knows it exists
without having to `ls` blind.
