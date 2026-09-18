# -*- coding: utf-8 -*-
"""Готовит блок @font-face с вшитыми шрифтами для просмотрщика.

Kica Light берётся из локального TTF (файл лицензионный, в репозиторий
не кладётся), Inter Tight Semibold — с Google Fonts. Оба подмножества
режутся до латиницы, кириллицы и нужной пунктуации и кодируются в base64,
поэтому странице не нужен интернет.

    python3 make_fonts.py /путь/к/KicaLight.ttf > fonts_block.css

Полученный блок вставляется в начало <style> в viewer_template.html
и в начало CSS-строки в build_embed.py.
"""
import base64, os, re, sys, tempfile, urllib.request
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

CHARS = (''.join(chr(c) for c in range(0x20, 0x7F)) +
         'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя'
         '«»—–…·×²³°№ ')
GF = ('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600'
      '&display=swap&subset=latin,cyrillic')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120'}
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,'
         'U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215')
CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'


def subset(src, out):
    f = TTFont(src)
    o = Options()
    o.layout_features = ['*']
    o.notdef_outline = True
    o.drop_tables += ['DSIG']
    s = Subsetter(options=o)
    s.populate(text=CHARS)
    s.subset(f)
    f.flavor = 'woff2'
    f.save(out)
    return out


def data_uri(path):
    return 'data:font/woff2;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def google_parts(tmp):
    css = urllib.request.urlopen(urllib.request.Request(GF, headers=UA), timeout=60).read().decode()
    out = {}
    for m in re.finditer(r"/\* (\S+) \*/\s*@font-face \{.*?src: url\((\S+?)\) format", css, re.S):
        if m.group(1) not in ('latin', 'cyrillic'):
            continue
        raw = urllib.request.urlopen(urllib.request.Request(m.group(2), headers=UA), timeout=60).read()
        p = os.path.join(tmp, 'it-%s.woff2' % m.group(1))
        open(p, 'wb').write(raw)
        f = TTFont(p)            # распаковываем, чтобы пересобрать своё подмножество
        f.flavor = None
        q = p.replace('.woff2', '.ttf')
        f.save(q)
        out[m.group(1)] = subset(q, p.replace('.woff2', '-sub.woff2'))
    return out


def main(kica_ttf):
    tmp = tempfile.mkdtemp()
    kica = subset(kica_ttf, os.path.join(tmp, 'kica-light.woff2'))
    it = google_parts(tmp)
    sys.stdout.write(
        "  /* Шрифты вшиты в страницу: файл открывается и без интернета.\n"
        "     Kica Light — заголовки, Inter Tight Semibold — весь остальной текст. */\n"
        "  @font-face{font-family:'Kica';font-style:normal;font-weight:300;\n"
        "    font-display:swap;src:url(%s) format('woff2');}\n"
        "  @font-face{font-family:'Inter Tight';font-style:normal;font-weight:600;\n"
        "    font-display:swap;src:url(%s) format('woff2');\n"
        "    unicode-range:%s;}\n"
        "  @font-face{font-family:'Inter Tight';font-style:normal;font-weight:600;\n"
        "    font-display:swap;src:url(%s) format('woff2');\n"
        "    unicode-range:%s;}\n"
        % (data_uri(kica), data_uri(it['latin']), LATIN, data_uri(it['cyrillic']), CYR))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
