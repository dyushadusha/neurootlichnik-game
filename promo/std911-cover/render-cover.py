#!/usr/bin/env python3
"""Рендерит promo/std911-cover/cover.html в PNG размером 1080×1350.

Запуск из корня репозитория:  python3 promo/std911-cover/render-cover.py

Страница поднимается на локальном http-сервере (через file:// браузер
не грузит шрифты бренда), открывается в Chromium и снимается скриншотом.
Нужны: pip install playwright + локальный Chromium.
"""
import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "promo" / "std911-cover" / "cover.png"
W, H = 1080, 1350
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def serve(root: pathlib.Path):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main():
    httpd, port = serve(ROOT)
    url = f"http://127.0.0.1:{port}/promo/std911-cover/cover.html"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(400)
        page.locator(".cover").screenshot(path=str(OUT))
        browser.close()
    httpd.shutdown()
    print(f"готово: {OUT}")


if __name__ == "__main__":
    main()
