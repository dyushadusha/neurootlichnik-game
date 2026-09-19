# -*- coding: utf-8 -*-
import os, pathlib
from playwright.sync_api import sync_playwright

D = pathlib.Path('/tmp/claude-0/-home-user-neurootlichnik-game/518cd21a-79ba-5637-9ea0-1bbba0ce716f/scratchpad/kp')
body = (D/'kp.html').read_text(encoding='utf-8')

print_css = """
<style>
  :root{ color-scheme:light; }
  html,body{ background:#ffffff; }
  *{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @page{ size:105mm 186mm; margin:0; }
  body{ font-size:14px; line-height:1.5; overflow-x:visible; }
  .wrap{ padding-inline:17px; max-width:none; }
  section{ break-before:page; page-break-before:always; padding-block:20px 24px; }
  section.hero{ break-before:auto; page-break-before:auto; padding-block:14px 18px; }
  .sec-head{ margin-bottom:16px; }
  h1{ font-size:26px; }
  h2{ font-size:21px; }
  h3{ font-size:18px; }
  .lead{ font-size:14px; }
  .kicker{ flex-wrap:wrap; font-size:9.5px; padding:5px 12px; }
  .hero h1{ margin-top:14px; }
  .hero-sub{ margin-top:14px; max-width:none; }
  .chips{ margin-top:14px; }
  .chip{ font-size:11px; padding:4px 10px; }
  .hero-card img{ aspect-ratio:16/9; }
  .hero-card .cap{ padding:9px 14px; font-size:10px; }
  .hero-sub{ font-size:13.5px; }
  .flag{ top:10px; right:12px; }
  .caveat{ break-inside:avoid; page-break-inside:avoid; }
  .shot-item, .step, .mkt, .promise, .talk, .ask, .verdict, .hero-card, .shot,
  .finding, .factor, .brief-item, .rec-card, .calc, .cmp-block, .opt-top, .tier{
    break-inside:avoid; page-break-inside:avoid;
  }
  .opt{ break-inside:auto; page-break-inside:auto; overflow:visible; }
  /* flex/grid контейнеры плохо переносятся между страницами — в печати делаем блоками */
  .opt, .opt-body, .tier, .ul, .findings{ display:block; }
  .opt-body > * + *{ margin-top:13px; }
  .tier > * + *{ margin-top:11px; }
  .ul li{ margin-bottom:8px; }
  .ul li:last-child{ margin-bottom:0; }
  .findings .finding{ margin-bottom:12px; }
  .opt-top{ border-radius:15px 15px 0 0; }
  .hero-grid{ display:block; }
  .hero-card{ margin-top:18px; }
  h2, h3{ break-after:avoid; page-break-after:avoid; }
  .opts, .tiers, .shots, .steps, .market, .factors, .brief{ gap:13px; }
  .hero-grid{ gap:18px; }
  .tablewrap{ display:none; }
  .cmp-print{ display:flex; }
  .price{ font-size:26px; }
  .topbar-in{ padding-block:10px; }
  .logo{ width:126px; }
  .topbar .tag{ font-size:8.5px; }
  .foot-in{ padding-block:16px; }
  .foot-logo{ width:145px; }
  .cta{ box-shadow:none; font-size:14px; padding:11px 20px; }
  .ul li{ font-size:13.5px; }
  .promise{ grid-template-columns:48px 1fr; }
  .promise-mark{ width:48px; height:48px; font-size:21px; }
</style>
"""
doc = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8" />\n</head>\n<body>\n'
       + body + print_css + '\n</body>\n</html>\n')
(D/'kp-print.html').write_text(doc, encoding='utf-8')

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                           args=['--no-sandbox','--allow-file-access-from-files'])
    pg = b.new_page(viewport={'width':397,'height':703})
    pg.goto('file://' + str(D/'kp-print.html'), wait_until='networkidle')
    pg.emulate_media(media='print')
    pg.wait_for_timeout(1200)
    pg.pdf(path=str(D/'KP-Aeris.pdf'), width='105mm', height='186mm', print_background=True,
           margin={'top':'0','right':'0','bottom':'0','left':'0'}, prefer_css_page_size=True)
    b.close()
print('pdf ok', (D/'KP-Aeris.pdf').stat().st_size)
