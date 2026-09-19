# -*- coding: utf-8 -*-
import re, sys, pathlib
sys.path.insert(0, '/tmp/claude-0/-home-user-neurootlichnik-game/518cd21a-79ba-5637-9ea0-1bbba0ce716f/scratchpad/kp')
from playwright.sync_api import sync_playwright
import slides_content as sc

D = pathlib.Path('/tmp/claude-0/-home-user-neurootlichnik-game/518cd21a-79ba-5637-9ea0-1bbba0ce716f/scratchpad/kp')
base_css = re.search(r'<style>(.*?)</style>', (D/'kp.html').read_text(encoding='utf-8'), re.S).group(1)

SLIDE_CSS = """
/* ===== альбом: один лист — одна мысль ===== */
:root{ color-scheme:light; }
*{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
@page{ size:105mm 186mm; margin:0; }
html,body{ background:#ffffff; margin:0; }
body{ font-size:13px; line-height:1.5; }

.slide{
  width:105mm; height:186mm; padding:11mm 8mm 9mm;
  display:flex; flex-direction:column; overflow:hidden; position:relative;
  background:var(--paper); color:var(--ink);
  break-after:page; page-break-after:always; break-inside:avoid;
}
.slide:last-child{ break-after:auto; page-break-after:auto; }
.slide--dark{
  --paper:#232321; --paper-2:#2f2f2c; --paper-3:#3c3c37;
  --ink:#f5f5f0; --ink-70:#bdbdb4; --ink-45:#8b8b83; --line:#f5f5f0; --lime-soft:#4b5a12;
}
.slide--lime{
  --paper:#dbfc3b; --paper-2:#d2f52a; --paper-3:#c3e625;
  --ink:#2a2a2a; --ink-70:#494934; --ink-45:#6d6d52; --line:#2a2a2a; --lime-soft:#eaffa0;
}
.slide--lime .hl{ background-image:none; color:inherit; box-shadow:inset 0 -0.16em 0 var(--ink); padding-inline:0; }

.slide__top{
  display:flex; justify-content:space-between; align-items:center; gap:10px;
  font-family:var(--font-num); font-size:8.5px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--ink-45); padding-bottom:9px; border-bottom:2px solid var(--line); flex:none;
}
.slide__top .num{ color:var(--ink-45); font-variant-numeric:tabular-nums; letter-spacing:.06em; }
.slide__body{ flex:1; display:flex; flex-direction:column; gap:12px; padding-top:16px; min-height:0; justify-content:center; }
.slide--center .slide__body{ gap:14px; }
.big-quote{ font-size:19px; }
.slide__bot{
  flex:none; display:flex; justify-content:space-between; align-items:flex-end; gap:10px;
  padding-top:9px; border-top:2px solid var(--line);
}
.slide__bot .mark{ width:34px; color:var(--ink); opacity:.85; }
.slide__bot .mark svg{ width:100%; height:auto; display:block; }
.slide__bot .where{ font-family:var(--font-num); font-size:8px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-45); text-align:right; }

.slide h2{ font-size:23px; }
.slide h3{ font-size:17px; }
.slide .eyebrow{ font-size:9.5px; }
.slide .lead{ font-size:13px; line-height:1.45; }
.slide .tiny{ font-size:11px; line-height:1.4; }

/* обложка и финал */
.cover{ flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:16px; }
.cover-logo{ display:block; width:150px; color:var(--lime); }
.cover-logo svg{ width:100%; height:auto; display:block; }
.cover-mid h1{ font-size:40px; margin-top:14px; }
.cover-sub{ font-size:15px; color:var(--ink-70); margin-top:12px; max-width:30ch; }
.cover-foot{ display:flex; flex-direction:column; gap:14px; }
.cover-to{ font-size:11.5px; color:var(--ink-70); line-height:1.45; }
.cover-to b{ color:var(--ink); }

.final-h{ font-size:31px; }
.site{ font-family:var(--font-num); font-size:19px; color:var(--lime); }
.slide--dark .kicker{ background:transparent; color:var(--ink); }
.slide--dark .chip{ background:transparent; }
.slide--dark .chip--lime{ background:var(--lime); }

/* содержание */
.toc{ display:flex; flex-direction:column; gap:9px; }
.toc-item{ display:grid; grid-template-columns:34px 1fr; gap:10px; align-items:start;
  border-top:2px solid var(--line); padding-top:8px; font-size:12.5px; }
.toc-n{ font-family:var(--font-num); font-size:12px; color:var(--ink-45); }

/* меню вариантов */
.menu{ display:flex; flex-direction:column; gap:10px; }
.menu-row{
  display:flex; justify-content:space-between; align-items:center; gap:12px;
  border:2.5px solid var(--line); border-radius:var(--r-sm); padding:12px 14px; background:var(--paper);
}
.menu-row--pick{ background:var(--lime); color:var(--on-lime); border-color:#2a2a2a; }
.menu-row--pick .menu-n, .menu-row--pick .menu-d{ color:#3c3c2a; }
.menu-n{ display:block; font-family:var(--font-num); font-size:9.5px; letter-spacing:.11em; text-transform:uppercase; color:var(--ink-45); }
.menu-row b{ display:block; font-family:var(--font-display); font-weight:400; font-size:19px; line-height:1.15; margin-top:2px; }
.menu-d{ display:block; font-size:11.5px; color:var(--ink-70); margin-top:3px; }
.menu-p{ font-family:var(--font-num); font-size:17px; white-space:nowrap; }

/* слайды-утверждения */
.statement{ display:flex; flex-direction:column; gap:14px; }
.big-quote{ font-size:18px; line-height:1.4; color:var(--ink); }
.statement .sign{ font-family:var(--font-display); font-size:25px; }
.promise-mark.big{ width:64px; height:64px; font-size:28px; background:var(--paper); border-color:var(--ink); color:var(--ink); }

/* список вопросов */
.ask-list{ display:flex; flex-direction:column; gap:9px; }
.ask-item{ display:grid; grid-template-columns:26px 1fr; gap:11px; align-items:start; font-size:12.5px; }
.ask-n{ width:24px; height:24px; border-radius:50%; background:var(--lime); color:#2a2a2a;
  border:2.5px solid #2a2a2a; font-family:var(--font-num); font-size:12px; display:grid; place-items:center; }

/* плотная посадка готовых блоков */
.shot.big img{ width:100%; }
.opt{ box-shadow:var(--shadow-sm); }
.opt-top{ padding:14px 15px 13px; }
.opt .price{ font-size:26px; margin-top:10px; }
.opt .price small{ font-size:11.5px; margin-top:4px; }
.opt-body{ padding:13px 15px 15px; gap:11px; }
.ul li{ font-size:12.5px; padding-left:20px; }
.ul li::before{ width:10px; height:10px; }
.calc div{ font-size:11.5px; padding-block:2px; }
.calc .tot{ font-size:12.5px; }
.caveat{ font-size:11.5px; }
.tier{ box-shadow:var(--shadow-sm); padding:17px; gap:11px; }
.tier .price{ font-size:31px; }
.shots{ display:flex; flex-direction:column; gap:7px; }
.shot-item{ padding:10px 12px; gap:4px; }
.shot-item .idx{ font-size:16px; }
.shot-item .ttl{ font-size:13.5px; }
.shot-item p{ font-size:11.5px; }
.shot-item .tagrow{ padding-top:3px; }
.tag{ font-size:9.5px; }
.cmp-print{ display:flex; flex-direction:column; gap:8px; }
.cmp-label{ font-size:10px; padding:6px 11px; }
.cmp-row{ grid-template-columns:76px 1fr; padding:5px 11px; font-size:11.5px; }
.cmp-v{ font-size:9.5px; white-space:nowrap; }
.cmp-val{ font-size:11.5px; }
.steps{ display:flex; flex-direction:column; gap:10px; }
.step{ padding:13px 14px; }
.step b{ font-size:15px; }
.step p{ font-size:12px; }
.factors{ display:flex; flex-direction:column; gap:10px; margin-top:0; }
.factor{ padding-top:9px; }
.factor b{ font-size:13.5px; }
.factor span{ font-size:11.5px; }
.market{ display:flex; flex-direction:column; gap:10px; margin-bottom:0; }
.mkt{ padding:12px 14px; }
.mkt .v{ font-size:22px; }
.mkt .k{ font-size:11.5px; }
.brief{ display:flex; flex-direction:column; gap:10px; }
.brief-item{ padding-top:9px; }
.brief-item p{ font-size:12.5px; margin-top:4px; }
.brief-item .n{ font-size:10px; }
.findings{ gap:10px; }
.finding b{ font-size:13.5px; }
.finding span{ font-size:11.5px; }
.chip{ font-size:11px; padding:4px 11px; }
.kicker{ font-size:9.5px; padding:5px 13px 5px 10px; box-shadow:none; }
.flag{ top:-11px; right:12px; font-size:10px; padding:5px 11px; }
.price-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.price-row > div{ border:2.5px solid var(--line); border-radius:var(--r-sm); padding:9px 8px; background:var(--paper); text-align:center; min-width:0; }
.price-row .pick{ background:var(--lime); color:var(--on-lime); border-color:#2a2a2a; }
.price-row span{ display:block; font-family:var(--font-num); font-size:8.5px; letter-spacing:.09em;
  text-transform:uppercase; color:var(--ink-45); }
.price-row .pick span{ color:#3c3c2a; }
.price-row b{ display:block; font-family:var(--font-num); font-size:12px; margin-top:3px; white-space:nowrap; }
"""

def build_html():
    n_total = len(sc.SLIDES)
    parts = []
    shown = 0
    for i, s in enumerate(sc.SLIDES):
        shown += 1
        center = 'slide--center' if ('statement' in s['content'] or 'cover' in s['content']) else ''
        top = ('<div class="slide__top"><span>%s</span><span class="num">%02d / %02d</span></div>'
               % (s['label'] or 'Нейро Отличник × ЖилСтрой Девелопмент', shown, n_total))
        bot = ('<div class="slide__bot"><span class="mark">%s</span>'
               '<span class="where">Квартал «Аэрис» · дом 2 · Пенза</span></div>' % sc.MARK)
        if s['nonum']:
            top, bot = '', ''
        parts.append('<section class="slide %s %s">%s<div class="slide__body">%s</div>%s</section>'
                     % (s['cls'], center, top, s['content'], bot))
    return ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8" />'
            '<style>%s</style><style>%s</style></head><body>%s</body></html>'
            % (base_css, SLIDE_CSS, "".join(parts)))

(D/'kp-slides.html').write_text(build_html(), encoding='utf-8')

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                           args=['--no-sandbox', '--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width': 397, 'height': 703})
    pg.goto('file://' + str(D/'kp-slides.html'), wait_until='networkidle')
    pg.wait_for_timeout(900)
    over = pg.evaluate("""() => {
      const out=[];
      document.querySelectorAll('.slide').forEach((s,i)=>{
        const body=s.querySelector('.slide__body');
        let free = body ? Math.round(body.clientHeight - body.scrollHeight) : 0;
        let over = body ? body.scrollHeight>body.clientHeight+1 : false;
        let culprit='';
        if(body && body.scrollWidth>body.clientWidth+1){ over=true; culprit='slide__body (гориз.)'; }
        s.querySelectorAll('*').forEach(el=>{
          const st=getComputedStyle(el);
          if(st.overflow==='hidden'||st.overflowY==='hidden'){
            const d=el.scrollHeight-el.clientHeight;
            if(d>1){ over=true; culprit=el.className+' (верт. '+d+'px)'; free=Math.min(free,-d); }
            const dw=el.scrollWidth-el.clientWidth;
            if(dw>1){ over=true; culprit=el.className+' (гориз. '+dw+'px)'; }
          }
        });
        out.push({i:i+1, free, over, culprit});
      });
      return out;
    }""")
    bad = [o for o in over if o['over']]
    print('ПЕРЕПОЛНЕНИЕ:', bad if bad else 'нет')
    print('запас по высоте (лист: пикс.):', ', '.join('%d:%d' % (o['i'], o['free']) for o in over))
    pg.emulate_media(media='print')
    pg.pdf(path=str(D/'KP-Aeris.pdf'), width='105mm', height='186mm', print_background=True,
           margin={'top':'0','right':'0','bottom':'0','left':'0'}, prefer_css_page_size=True)
    b.close()
print('PDF собран')
