"""
Template generator for a Нейро Отличник carousel — 8 vertical (1080x1350) .dc.html slides.

HOW TO USE THIS FILE:
1. Copy it into a scratch working directory (don't run it from inside the skill folder).
2. Edit REPO_ROOT below to point at the actual repo checkout.
3. Edit the eight `slideN = wrap(...)` triple-quoted blocks with THIS carousel's real copy —
   they currently hold placeholder structure/comments, not real content. Everything above them
   (FONT_FACES, BASE_CSS, wrap()) is shared machinery — leave it alone unless the brand system
   itself needs to change (see references/brand.md first).
4. If this carousel has real photo assets for the cover/proof slides, copy them into the same
   scratch directory and reference them by filename (see brand.md's "Photo slides" section).
5. Run: python3 generate_slides.py
   It writes Main.dc.html, Slide2.dc.html ... Slide8.dc.html into the same directory.
6. Also write a canvas.json laying the 8 artboards in a row before seeding — see
   references/workflow.md.

Read references/brand.md and references/captions-style.md before touching the placeholder
copy — the layout patterns and factual constraints documented there are what keep this
consistent across carousels.
"""

import base64, pathlib

ROOT = pathlib.Path(__file__).parent           # scratch dir this script was copied into
REPO_ROOT = pathlib.Path('/home/user/neurootlichnik-game')  # <-- adjust if the repo lives elsewhere
FONTDIR = REPO_ROOT / 'assets' / 'fonts'
CHARDIR = REPO_ROOT / 'assets' / 'carousel-characters'

kica_b64 = base64.b64encode((FONTDIR / 'KicaBold.ttf').read_bytes()).decode()
inter_b64 = base64.b64encode((FONTDIR / 'InterTightSemiBold.ttf').read_bytes()).decode()

# Embedded fresh into every slide — each artboard is its own sandboxed iframe with no shared
# state, so there is no way to load a font "once" for the whole carousel. See brand.md.
FONT_FACES = f"""
@font-face {{
  font-family: 'KicaBold';
  src: url(data:font/ttf;base64,{kica_b64}) format('truetype');
  font-weight: 700;
  font-display: block;
}}
@font-face {{
  font-family: 'InterTight';
  src: url(data:font/ttf;base64,{inter_b64}) format('truetype');
  font-weight: 600;
  font-display: block;
}}
"""

# Shared design-system CSS — the sticker-shadow chips, progress counter, photo scrims, etc.
# documented in references/brand.md. Extend this only if a new pattern is genuinely needed for
# more than one slide; one-off styling belongs inline on the element in question.
BASE_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1350px; }
.root {
  position: relative;
  width: 1080px;
  height: 1350px;
  overflow: hidden;
  font-family: 'InterTight', -apple-system, sans-serif;
  color: #2a2a2a;
}
a { color: #2a2a2a; text-decoration: underline wavy #dbfc3b; text-underline-offset: 3px; }
a:hover { color: #000000; }
.headline {
  font-family: 'KicaBold', 'InterTight', sans-serif;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.eyebrow {
  font-family: 'InterTight', sans-serif;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.logo-mark { position: absolute; left: 64px; bottom: 56px; height: 26px; width: auto; opacity: 0.95; z-index: 5; }
.doodle { position: absolute; }
.chip {
  display: inline;
  background: #dbfc3b;
  color: #2a2a2a;
  padding: 2px 10px 6px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.chip--dark {
  display: inline;
  background: #2a2a2a;
  color: #f5f2e8;
  padding: 2px 10px 6px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.tag-chip {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  color: #2a2a2a;
  border: 3px solid #2a2a2a;
  border-radius: 999px;
  padding: 10px 22px;
  font-family: 'InterTight', sans-serif;
  font-weight: 600;
  font-size: 22px;
  box-shadow: 6px 6px 0 #2a2a2a;
  white-space: nowrap;
  z-index: 4;
}
.tag-chip--dark { background: #2a2a2a; color: #f5f2e8; border-color: #f5f2e8; box-shadow: 6px 6px 0 #dbfc3b; }
.tag-chip--lime { background: #dbfc3b; color: #2a2a2a; border-color: #2a2a2a; box-shadow: 6px 6px 0 #2a2a2a; }
.progress-chip {
  position: absolute;
  top: 56px;
  right: 56px;
  padding: 8px 18px;
  border-radius: 999px;
  font-family: 'InterTight', sans-serif;
  font-weight: 600;
  font-size: 22px;
  z-index: 5;
}
.photo-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scrim-top { position: absolute; top: 0; left: 0; right: 0; height: 58%; background: linear-gradient(to bottom, rgba(20,20,18,0.82), rgba(20,20,18,0)); }
.scrim-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 56%; background: linear-gradient(to top, rgba(20,20,18,0.88), rgba(20,20,18,0)); }
.char { position: absolute; z-index: 3; }
"""

def wrap(body_html: str, extra_css: str = "") -> str:
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    {FONT_FACES}
    {BASE_CSS}
    {extra_css}
  </style>
</helmet>
{body_html}
</x-dc>
</body>
</html>
"""

# ---------------------------------------------------------------------------
# SLIDE 1 — Main.dc.html — COVER / HOOK
# EDIT: headline copy, background (lime card, or a real photo per brand.md's "Photo slides"),
# which character bleeds off which edge, doodle placement.
# ---------------------------------------------------------------------------
slide1 = wrap("""
<div class="root" style="background:#dbfc3b;">
  <img class="doodle" src="cross-a.svg" style="top:64px; left:56px; width:64px; filter:brightness(0); opacity:0.85; transform:rotate(-6deg);" />
  <img class="doodle" src="spiral-a.svg" style="top:70px; right:64px; width:78px; filter:brightness(0); opacity:0.85;" />

  <div class="progress-chip" style="background:#2a2a2a; color:#f5f2e8;">1 / 8</div>

  <div class="headline" style="position:absolute; top:150px; left:64px; right:420px; font-size:56px; line-height:1.14;">
    [ЗАМЕНИТЬ: одна жирная, узнаваемая фраза-хук, привязанная к теме]
  </div>

  <img class="char" src="char-thinking.png" style="right:32px; bottom:60px; width:400px; height:auto;" />
  <img class="logo-mark" src="logo-full-dark.svg" />
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 2 — RELATABLE SCENE (white bg)
# EDIT: headline = a concrete moment the ICP recognizes; body paragraph = why it stings.
# ---------------------------------------------------------------------------
slide2 = wrap("""
<div class="root" style="background:#ffffff;">
  <div class="progress-chip" style="background:#2a2a2a; color:#f5f2e8;">2 / 8</div>

  <div class="headline" style="position:absolute; top:150px; left:64px; right:64px; font-size:58px; line-height:1.14;">
    [ЗАМЕНИТЬ: конкретная узнаваемая сцена-боль]
  </div>

  <div style="position:absolute; left:64px; right:64px; bottom:150px; font-size:28px; line-height:1.42; font-weight:600; color:rgba(42,42,42,0.66);">
    [ЗАМЕНИТЬ: короткий абзац — почему это задевает именно ЦА]
  </div>

  <img class="doodle" src="zigzag.svg" style="bottom:280px; right:56px; width:100px; opacity:0.95; z-index:4;" />
  <img class="logo-mark" src="logo-full-dark.svg" />
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 3 — THESIS / REFRAME (white bg)
# EDIT: top paragraph sets up the reframe; headline delivers it with a highlighted phrase
# wrapped in <span class="chip">...</span> (use box-shadow:5px 5px 0 #2a2a2a for the sticker look).
# ---------------------------------------------------------------------------
slide3 = wrap("""
<div class="root" style="background:#ffffff;">
  <div class="progress-chip" style="background:#2a2a2a; color:#f5f2e8;">3 / 8</div>

  <div style="position:absolute; top:150px; left:64px; right:64px; font-size:30px; line-height:1.42; font-weight:600; color:rgba(42,42,42,0.78);">
    [ЗАМЕНИТЬ: сеттинг-абзац перед тезисом]
  </div>

  <img class="doodle" src="hashtag.svg" style="top:390px; left:64px; width:96px; z-index:4;" />

  <div class="headline" style="position:absolute; top:560px; left:64px; right:64px; font-size:64px; line-height:1.14;">
    [ЗАМЕНИТЬ: тезис с <span class="chip" style="box-shadow:5px 5px 0 #2a2a2a;">ключевой фразой</span>]
  </div>

  <img class="logo-mark" src="logo-full-dark.svg" />
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 4 — VISUAL PROOF
# EDIT: if you have a real photo for this run, swap this whole slide for the photo-bg pattern
# in brand.md ("Photo slides"). Otherwise replace this placeholder graphic with something that
# DEMONSTRATES the claim rather than just restating slide 3 in different words.
# ---------------------------------------------------------------------------
slide4 = wrap("""
<div class="root" style="background:#2a2a2a; color:#f5f2e8;">
  <div class="eyebrow" style="position:absolute; top:80px; left:64px; font-size:22px; color:rgba(245,242,232,0.6);">
    [ЗАМЕНИТЬ: короткий эйбрау-лейбл]
  </div>
  <div class="progress-chip" style="background:#dbfc3b; color:#2a2a2a;">4 / 8</div>

  <div class="headline" style="position:absolute; left:64px; right:64px; bottom:150px; font-size:52px; line-height:1.15;">
    [ЗАМЕНИТЬ: подпись к визуальному доказательству]
  </div>

  <img class="logo-mark" src="logo-full.svg" />
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 5 — TENSION (dark bg, two stacked statements each ending in a highlighted chip)
# EDIT: both statement blocks + their chip phrases.
# ---------------------------------------------------------------------------
slide5 = wrap("""
<div class="root" style="background:#2a2a2a; color:#f5f2e8;">
  <div class="progress-chip" style="background:#dbfc3b; color:#2a2a2a;">5 / 8</div>

  <div class="headline" style="position:absolute; top:130px; left:64px; right:64px; font-size:52px; line-height:1.22;">
    [ЗАМЕНИТЬ: первое утверждение, заканчивается <span class="chip">фразой-акцентом</span>]
  </div>

  <div class="headline" style="position:absolute; left:64px; right:64px; bottom:130px; font-size:52px; line-height:1.22;">
    [ЗАМЕНИТЬ: второе утверждение, заканчивается <span class="chip">фразой-акцентом</span>]
  </div>

  <img class="logo-mark" src="logo-full.svg" />
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 6 — RESOLUTION (dark top / lime bottom split, pull-quote)
# EDIT: top reframe ("we're not saying X, the point is Y"); bottom pull-quote.
# Only use a specific number/timeframe in the quote if it's sourced — otherwise keep it
# qualitative (see captions-style.md's ICP note).
# ---------------------------------------------------------------------------
slide6 = wrap("""
<div class="root" style="background:#2a2a2a; color:#f5f2e8;">
  <div class="progress-chip" style="background:#dbfc3b; color:#2a2a2a;">6 / 8</div>

  <div class="headline" style="position:absolute; top:96px; left:64px; right:64px; font-size:50px; line-height:1.22;">
    [ЗАМЕНИТЬ: рефрейм — "мы не говорим X, речь о Y"]
  </div>

  <div style="position:absolute; left:0; right:0; bottom:0; height:430px; background:#dbfc3b;">
    <div style="position:absolute; top:56px; left:64px; right:64px; font-size:30px; line-height:1.4; font-weight:600; color:#2a2a2a;">
      &laquo;&nbsp;[ЗАМЕНИТЬ: цитата-вывод, без выдуманных цифр]&nbsp;&raquo;
    </div>
    <img class="logo-mark" src="logo-full-dark.svg" style="bottom:44px;" />
  </div>
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 7 — POSITIVE REFRAME (lime bg)
# EDIT: headline = the payoff for the reader.
# ---------------------------------------------------------------------------
slide7 = wrap("""
<div class="root" style="background:#dbfc3b;">
  <div class="progress-chip" style="background:#2a2a2a; color:#f5f2e8;">7 / 8</div>

  <div class="headline" style="position:absolute; top:150px; left:64px; right:340px; font-size:48px; line-height:1.2;">
    [ЗАМЕНИТЬ: позитивный рефрейм / что получает читатель]
  </div>

  <img class="char" src="char-waving.png" style="right:-60px; bottom:-30px; width:420px;" />
  <img class="logo-mark" src="logo-full-dark.svg" />
</div>
""")

# ---------------------------------------------------------------------------
# SLIDE 8 — FINAL CTA (lime bg)
# EDIT: two-column setup, headline takeaway, site line. Proof chips are OPTIONAL and must use
# only sourced facts (see captions-style.md) — delete the row if you don't have any for this run.
# ---------------------------------------------------------------------------
slide8 = wrap("""
<div class="root" style="background:#dbfc3b;">
  <div class="progress-chip" style="background:#2a2a2a; color:#f5f2e8;">8 / 8</div>

  <div style="position:absolute; top:104px; left:64px; right:64px; display:grid; grid-template-columns:1fr 1fr; gap:48px; font-size:25px; line-height:1.4; font-weight:600; color:rgba(42,42,42,0.82);">
    <div>[ЗАМЕНИТЬ: левая колонка]</div>
    <div>[ЗАМЕНИТЬ: правая колонка]</div>
  </div>

  <!-- OPTIONAL proof-chip row — only sourced facts, delete if none apply this run
  <div style="position:absolute; top:322px; left:64px; right:64px; display:flex; flex-wrap:wrap; gap:16px;">
    <div class="tag-chip" style="position:static; transform:rotate(-2deg); font-size:20px; padding:9px 18px;">[факт]</div>
  </div>
  -->

  <div class="headline" style="position:absolute; top:452px; left:64px; right:64px; font-size:62px; line-height:1.16;">
    [ЗАМЕНИТЬ: финальный вывод-фраза]
  </div>

  <div style="position:absolute; left:64px; right:64px; top:910px; font-size:28px; font-weight:600; letter-spacing:0.01em; z-index:5;">
    neurootlichnik.ru — [ЗАМЕНИТЬ: короткий слоган-подпись]
  </div>

  <img class="char" src="char-recline.png" style="left:220px; bottom:-30px; width:720px; z-index:2;" />
  <img class="logo-mark" src="logo-full-dark.svg" style="bottom:64px;" />
</div>
""")

files = {
    'Main.dc.html': slide1,
    'Slide2.dc.html': slide2,
    'Slide3.dc.html': slide3,
    'Slide4.dc.html': slide4,
    'Slide5.dc.html': slide5,
    'Slide6.dc.html': slide6,
    'Slide7.dc.html': slide7,
    'Slide8.dc.html': slide8,
}

for name, content in files.items():
    (ROOT / name).write_text(content, encoding='utf-8')

print("wrote:", ", ".join(files.keys()))
print()
print("Reminder: this still has [ЗАМЕНИТЬ] placeholders in it — edit the slideN blocks above")
print("with this carousel's real copy before running seed-canvas.mjs.")
