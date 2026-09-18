# -*- coding: utf-8 -*-
"""Статичный план внутрь страницы: показывается, если браузер не выполнил
скрипты (просмотрщик файлов на iOS, вложение в мессенджере)."""
import base64
import io
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def data_uri(png='BOR495_genplan_A.png', width=1600, quality=78):
    from PIL import Image
    im = Image.open(os.path.join(HERE, png)).convert('RGB')
    w, h = im.size
    im = im.resize((width, int(h * width / float(w))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def inject(html, png='BOR495_genplan_A.png'):
    """Вставляет план в заглушку. Без вызова комментарий просто исчезает."""
    img = '<img src="%s" alt="Генеральный план, вариант 1">' % data_uri(png)
    return html.replace('<!--__FALLBACK__-->', img)


def strip(html):
    return html.replace('<!--__FALLBACK__-->', '')
