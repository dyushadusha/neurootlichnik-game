# -*- coding: utf-8 -*-
"""Снимает чистые аксонометрические кадры: без интерфейса и номеров,
оба варианта, с рабочей сцены и со сцены для визуализации."""
import asyncio, sys
from playwright.async_api import async_playwright

HIDE = """() => {['title','tools','legend','compass','readout','hint','boot','editor']
  .forEach(id => {const e = document.getElementById(id); if (e) e.style.display='none';});}"""
SHOW = """() => {const e = document.getElementById('tools'); if (e) e.style.display='';}"""

async def grab(pg, v, out, pull):
    await pg.evaluate(SHOW)
    await pg.click('button[data-v="%s"]' % v); await pg.wait_for_timeout(2500)
    st = await pg.eval_on_selector('button[data-layer="labels"]',
                                   'e=>e.getAttribute("aria-pressed")')
    if st == 'true':
        await pg.click('button[data-layer="labels"]'); await pg.wait_for_timeout(500)
    await pg.click('button[data-view="axo"]'); await pg.wait_for_timeout(3500)
    if pull:
        await pg.mouse.move(900, 560)
        await pg.mouse.wheel(0, pull); await pg.wait_for_timeout(1800)
    await pg.evaluate(HIDE); await pg.wait_for_timeout(900)
    await pg.screenshot(path=out)
    print('  ' + out)

async def main(src, prefix, pull):
    async with async_playwright() as p:
        b = await p.chromium.launch(
            executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
            args=['--use-angle=swiftshader', '--no-sandbox', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 1800, 'height': 1125},
                                  device_scale_factor=2)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
        await pg.goto(src); await pg.wait_for_timeout(17000)
        for v, name in (('A', '1'), ('B', '2')):
            await grab(pg, v, '%s_variant%s.png' % (prefix, name), pull)
        print('  ошибки:', errs or 'нет')
        await b.close()

asyncio.run(main(sys.argv[1], sys.argv[2], int(sys.argv[3])))
