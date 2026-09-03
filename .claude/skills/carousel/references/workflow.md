# Technical workflow: build, verify, publish, export

This is the mechanical recipe. Do the creative work (Step 1 in SKILL.md) before any of this —
these commands don't help you if the copy isn't right yet.

## 0. Scratch directory

Do all of this in a scratch working directory outside the repo (e.g. under whatever this
session's scratchpad root is) — the generated `.dc.html` files each embed ~400KB of base64 font
data, there's no reason to commit that churn into the repo's git history. Only the *reusable*
outputs (character PNGs, this skill itself) belong in the repo.

## 1. Generate the slide files

Copy `scripts/generate_slides.py` into the scratch directory and edit its per-slide content for
this carousel's actual copy. It already handles font embedding and the shared CSS — see the
comments inside it for what to change vs. what to leave alone. Any photo assets for this run
(cover/proof images, freshly cropped character poses) go in the same scratch directory,
referenced by filename.

Run it: `python3 generate_slides.py` — it writes `Main.dc.html`, `Slide2.dc.html` …
`Slide8.dc.html` into the scratch directory. Also write a `canvas.json` laying the 8 artboards
out in a row (1080-wide frames, ~80px gutters) — see the `design` skill for the exact schema if
you haven't got a copy from a previous run to crib the shape from.

## 2. Seed the canvas

Load the `design` skill now if you haven't — it owns the exact `seed-canvas.mjs` CLI flags, the
capability declaration for first publish (`contract: "0.1.31"`,
`capabilities: {self:{}, downloads:{}}`), and the republish/conflict rules. Follow it exactly;
don't guess the invocation from memory, the flags are order-sensitive and version-pinned for a
reason.

## 3. Render and look at every slide before publishing

The canvas editor is heavy (~2MB of runtime JS); don't try to screenshot the whole multi-artboard
page and eyeball thumbnails — extract each artboard's real rendered content and view it at true
size instead. This is the check that has caught every real layout bug so far (text overflowing
its box, a character image overlapping a text block, a logo colliding with a bled character).

```python
from playwright.sync_api import sync_playwright

CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.goto("file://" + "/path/to/seeded-canvas.html")
    page.wait_for_timeout(7000)  # let every artboard iframe finish mounting

    frames = [f for f in page.frames if f != page.main_frame]  # one per artboard, in order
    viewer = browser.new_page(viewport={"width": 1080, "height": 1350})
    for i, fr in enumerate(frames, start=1):
        viewer.set_content(fr.content())   # NOT page.content() — that's the editor chrome
        viewer.wait_for_timeout(400)
        viewer.screenshot(path=f"check-{i}.png")
    browser.close()
```

Read each `check-N.png` with the Read tool at full resolution. Look specifically for: text
running past its box or off the bottom of the canvas, a character image overlapping text it
shouldn't, the corner logo colliding with a bled character, doodle accents sitting on the wrong
side of a lime/dark boundary. Fix the source `.dc.html`, re-run `generate_slides.py` if you
edited the generator (or hand-edit the `.dc.html` directly for a one-off tweak), reseed, and
re-render just the changed slide(s) to confirm before moving on — no need to re-check slides you
didn't touch.

A blank first screenshot usually just means the artboard iframe hadn't finished mounting yet;
retake it rather than assuming something's broken.

## 4. Publish

`Artifact` tool, `file_path` = the seeded canvas HTML, per the `design` skill's publish rules.
New carousel → new artifact (don't pass `url`). Updating one that already exists → pass its
`url`, and if you get a "newer version was saved from inside the page" conflict, that means
someone (possibly the user, in the WYSIWYG editor) edited it since you last looked — follow the
`design` skill's stale-version recipe (`Artifact action:"read"` on that `url`, then
`seed-canvas.mjs --extract` the file it points you to into a fresh directory, redo your edit
there, reseed, republish) rather than overwriting their changes.

## 5. Export JPEGs

Same rendering approach as Step 3, but save with `type="jpeg", quality=92` instead of PNG, and
do it against the *final* published/seeded version (re-extract first if the user edited it in
the canvas since your last render — see Step 4). Name the files so their order is obvious
(`slide-01-cover.jpg` … `slide-08-cta.jpg`), send all 8 in one `SendUserFile` call.

## Cropping a new character pose (only if you need one that doesn't exist yet)

```python
from playwright.sync_api import sync_playwright
from PIL import Image

CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
svg_path = "assets/Group 60.svg"          # or one of the На_Экспорт-*.svg sheets
view_box_w, view_box_h = 4096, 2888        # read from the file's own viewBox attribute

svg = open(svg_path, encoding="utf-8").read()
scale = min(2400 / view_box_w, 2)
render_w, render_h = int(view_box_w * scale), int(view_box_h * scale)
html = (
    '<html><body style="margin:0;background:transparent">'
    + svg.replace("<svg ", f'<svg style="width:{render_w}px;height:{render_h}px;display:block" ', 1)
    + "</body></html>"
)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROMIUM, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": render_w, "height": render_h})
    page.set_content(html)
    page.wait_for_timeout(200)
    page.screenshot(path="raw.png", omit_background=True)   # transparent background
    browser.close()

im = Image.open("raw.png")
bbox = im.getbbox()                        # bounding box of the non-transparent content
pad = 4
l, t, r, b = bbox
im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad))) \
  .save("raw.png")

im = Image.open("raw.png")
longest = max(im.size)
if longest > 900:
    scale = 900 / longest
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
im.save("assets/carousel-characters/char-<descriptive-name>.png", optimize=True)
```

The `viewBox` for these sheets isn't `0 0 W H` in a way you can guess — read the actual
`viewBox="..."` attribute from the top of the SVG file first. A single sheet often contains
several poses at different coordinates; if `getbbox()` picks up more than one because they're
close together, crop the raw render to roughly the pose you want *before* calling `getbbox()`,
or accept a wider crop if the poses are meant to be used together.
