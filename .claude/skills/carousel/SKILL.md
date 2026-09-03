---
name: carousel
description: Produces a full Instagram-carousel marketing post for the "Нейро Отличник" studio (AI architectural visualization) — an 8-slide branded design canvas plus JPEG exports plus three ready-to-post captions (Instagram, Telegram, Threads). Use this whenever the user asks to "сделай карусель", "carousel про X", "пост-карусель на тему X", or otherwise wants a trendy multi-slide social post for this studio — even if they only give a topic and don't spell out the full pipeline. Also use it when they ask to update/tweak an existing carousel, or just want captions for a carousel that already exists.
---

# Carousel: Нейро Отличник social post generator

This skill turns a topic into a complete, ready-to-publish package: an 8-slide vertical
Instagram carousel built in the studio's exact brand system, exported as JPEGs, plus three
platform-native captions. It exists because a single trendy-carousel job in this repo
(2026-09-03) took a long back-and-forth to get right — this captures what was learned so the
next request is fast and consistent, not a from-scratch reinvention.

Read `references/brand.md` before writing any HTML — it has the exact colors, fonts, asset
paths, and CSS patterns already proven to render correctly in this canvas runtime. Read
`references/captions-style.md` before writing copy — it has the three approved example
captions to calibrate tone against, plus the ICP facts you're allowed to cite. Both are short;
read them in full, don't skim.

## Vary the design every time

Don't default to the same layout carousel after carousel — that's the fastest way for a
studio's feed to start feeling like a template mill instead of a design shop, and it's exactly
the feedback that shaped this note (2026-09-03: three carousels in a row all used the same
lime sticker-card look, and the client called it out). The brand tokens in `references/brand.md`
(the lime/ink/white palette, the two fonts, the logo, the character library) are load-bearing —
keep those. Everything else — the layout language, how bold the type gets, how photos are
treated, how playful the copy is — should genuinely differ carousel to carousel, chasing
whatever reads as current in social design right now rather than reusing the last invocation's
choices wholesale. Five directions that have worked so far, described so you don't just
recreate them: sticker cards (chip-and-badge elements with an offset hard shadow, thick
borders, a recurring illustrated mascot), editorial poster (huge oversized type bleeding toward
the frame edges, flat highlight bars instead of shadowed chips, big flat color blocks, a
duotone photo treatment), editorial grid (a warm paper neutral instead of the brand white,
left-aligned ragged-right headlines instead of centered blocks, photos inset in a thin frame
with real margin instead of full-bleed, a giant translucent quotation mark as a recurring
graphic device, lime reduced to hairline rules and small marks rather than a field anything
sits on), and maximalist bento glass (mismatched bento-grid card sizes instead of one box per
slide, frosted glassmorphism panels with `backdrop-filter: blur()` floating over photos and
blurred ambient lime blobs, a chrome/liquid-metal gradient-clipped headline as a recurring
signature move, procedural SVG-noise grain overlay for tactile texture, stacked-paper depth
behind photos via offset rotated duplicate layers, doodle stickers with hard drop shadows —
busy on purpose, the opposite failure mode from editorial grid's quiet minimalism, reached for
when the client explicitly asks for "complex," "human," maximalist design; see brand.md's
"Maximalist bento glass" section for the CSS patterns and the bugs this direction is prone to),
and technical blueprint (ink as the dominant background rather than white or lime, thin 1-2px
rules instead of card borders, a faint dot grid across every slide, corner registration
brackets as the recurring signature device, dimension-line callouts — a rule with tick-mark
ends and a centered tracked-caps label — standing in for chips, "sheet number" styling on the
slide counter; lime and cream appear only as line/label color, never a filled panel, which
sidesteps the invisible-text bug class entirely. Reached for when the topic itself is about a
plan, a promise, or something not yet built — see brand.md's "Technical blueprint" section for
the CSS patterns and the layout pitfalls it's prone to). Treat those as five points on a
spectrum, not the only options — collage/cutout layering, kinetic-looking diagonal grids,
brutalist anti-design are all fair game too if they fit the topic and still read as this studio
when someone glances at the corner logo. If the last one or
two carousels used full-bleed color-block slides, lean the next one toward quieter and vice
versa — the swing itself is part of what keeps the feed from feeling templated. But read what
the client is actually asking for before picking a direction: "too simple/plain" is a request to
swing toward maximalist bento glass, not toward another quiet direction — a client who explicitly
rejects minimalism as underwhelming won't be won back by a different flavor of quiet.

The cover slide is the one place this matters most: it is the only slide a scrolling stranger
sees before deciding whether to stop, so its type should be the biggest, boldest element in the
whole carousel — sized and placed to read instantly, not squeezed in among other elements. When
you have a strong photo for the cover (see Step 2), let the type interact with it directly
(overlapping, bleeding off an edge, sized to the image's own negative space) rather than parking
safely inside a card on top of it.

Playfulness is welcome and was explicitly asked for — a joke, a self-aware wink, a slightly
absurd premise (an oversized cat draped over a tower block turned into a whole carousel about
photorealism) can outperform another straight pain-point-to-reframe post, as long as it still
lands on something true about the studio and doesn't misrepresent what it actually does. Match
the humor to the topic; not every carousel needs to be a bit.

## Why the process looks the way it does

The design canvas renders each slide as its own sandboxed iframe with no shared state, so
things like fonts have to be embedded fresh in every single slide file — skipping this is the
single most common way a first draft comes out with the wrong typeface. And because you won't
get to see the canvas the way the user will, every slide needs to be rendered and actually
looked at before publishing — text overflow and element collisions are easy to introduce and
easy to miss without that check.

## Step 1 — Write the copy first, grounded in the ICP

Before touching any HTML, draft the 8-slide narrative and the 3 captions as text. This is the
part that actually determines whether the carousel works — get it right before spending effort
on layout.

Use this arc (it's the one that tested well — vary the specific beats to fit the topic, but
keep the shape):

1. **Cover / hook** — one bold, scroll-stopping claim tied to the topic.
2. **Relatable scene** — a concrete, specific moment the audience recognizes as their own pain.
3. **Thesis / reframe** — the insight that recontextualizes slide 2, with the key phrase
   highlighted (lime chip on white/dark, or a wrap in a `.chip` span — see brand.md).
4. **Visual proof** — a break from text-heavy slides: a real photo if the user supplied one, or
   a graphic that demonstrates the claim (don't just repeat slide 3 in different words).
5. **Tension** — two stacked statements, each ending in a highlighted chip phrase, that sharpen
   the stakes.
6. **Resolution** — reframes the tension: "we're not saying X, the point is Y." Split dark-top /
   lime-bottom panel with a pull-quote.
7. **Positive reframe** — the payoff: what the reader gets if they act on the insight.
8. **Final CTA** — the takeaway line, the site URL, and (if you have real, sourced facts —
   never invented ones) a couple of proof chips.

Ground every factual claim in `references/captions-style.md`'s ICP section. If a stat isn't
there and the user hasn't given you one for this run, don't invent a number — use a qualitative
comparison instead ("часы, а не недели" beats a made-up "30 минут"). This bit burned the first
run of this skill: a specific but fabricated turnaround time made it into a slide and had to be
walked back after publishing.

Write the 3 captions now too (Instagram / Telegram / Threads), following
`references/captions-style.md`'s structure and voice exactly. Do this while the copy is fresh —
don't leave it as an afterthought after the visual build.

## Step 2 — Ask about real photos, once, then move on

Check `assets/portfolio/` first — it holds real (studio-generated) render photos already
pulled from past client uploads, filenames descriptive of what's in each one. If something
there fits the topic, use it; no need to ask. Only if nothing there fits, and the user hasn't
already supplied images for this specific carousel, ask once whether they have any to use for
the cover and/or the "visual proof" slide (full-bleed photo background + bold white headline
overlay — see brand.md for the pattern). If they say no or don't answer, proceed with all 8
slides in the illustrated brand style — don't block the whole task on this. Never fabricate an
architectural render to stand in for a real one; that's exactly the "AI slop" this studio's
whole positioning pushes back against.

If they paste images directly into the chat, they will NOT be reachable as files in this
environment — only actual file attachments (or images embedded in a PDF/DOCX they upload) land
on disk. If a direct paste doesn't produce a readable path, ask them to send the images as a
file attachment, or wrapped in a PDF, or committed to this repo (e.g. under
`assets/portfolio/`) which you can then read straight from the working tree.

## Step 3 — Build the canvas

Read `references/brand.md` now (not before — you want the copy locked first) and follow it to:

1. Generate each slide as a `.dc.html` file using `scripts/generate_slides.py` as your starting
   point — copy it to a scratch working directory, edit the per-slide `slideN = wrap("""...""")`
   blocks with this carousel's real copy and layout, keep the shared `BASE_CSS` / `wrap()`
   machinery as-is unless the topic genuinely needs a new pattern.
2. Seed the canvas with the `design` skill's `seed-canvas.mjs` helper (load the `design` skill
   itself for the exact CLI invocation, capability declaration, and publish/republish rules —
   don't try to re-derive that from memory).
3. Render every slide standalone and look at it before publishing — see
   `references/workflow.md` for the exact Playwright recipe (viewport, chromium path, how to
   pull each artboard's real content out of the canvas page). Fix anything that overflows,
   collides, or misaligns and re-render before moving on. This step is not optional — every
   real run of this skill has caught at least one layout bug this way.
4. Publish as a new Artifact (new carousel = new artifact, unless the user is asking to update
   one that already exists — see "Updating an existing carousel" below).

## Step 4 — Export and deliver

1. Export each of the 8 slides as an individual JPEG at true 1080×1350 resolution (same
   Playwright approach as the verification pass, `type="jpeg"`, quality ~92).
2. Send all 8 in one `SendUserFile` call, in slide order, with a short caption like "8 слайдов
   карусели, JPEG, по порядку 1→8".
3. Hand back the 3 captions from Step 1 as plain text in your reply, each clearly labeled
   (Instagram / Telegram / Threads), ready to copy-paste.
4. If you produced new reusable character art or other brand assets this session, save the
   final cropped files into `assets/carousel-characters/` before finishing (see brand.md's
   "growing the library" note) — otherwise this run's work is lost to the next session.

## Updating an existing carousel

If the user references a carousel that already exists (a link, "the last one," "поправь
слайд 3"), don't rebuild from scratch:

- For copy/layout tweaks: read the artifact fresh (`Artifact` tool, `action: "read"`), extract
  it with `seed-canvas.mjs --extract` into a clean scratch directory, edit the extracted
  `.dc.html` files, reseed, and republish to the same URL. The `design` skill's stale-version
  handling covers the "someone edited it since you last looked" case — follow it exactly, it
  exists because this exact situation came up.
- For "just re-export the JPEGs" or "just give me new captions" requests: you don't need to
  touch the canvas at all — read the current artifact fresh (per above) and export from that,
  or just write fresh captions if that's literally all that's being asked.

## Growing this skill

This is meant to accumulate, not stay frozen. If a future run produces new character poses
(the studio's raw illustration sheets at `assets/Group *.svg` and `assets/На_Экспорт-*.svg`
hold more usable poses than the ones already extracted — render + auto-crop via PIL bbox-on-
alpha, per `references/workflow.md`), save them into `assets/carousel-characters/` so later
carousels can draw on a bigger set. If a layout pattern or piece of copy guidance proves wrong
or incomplete in practice, fix the reference file rather than silently working around it —
that's the only way the next run benefits from what this one learned.
