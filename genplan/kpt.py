# -*- coding: utf-8 -*-
"""Загрузка кадастровой границы участка.

Поддерживаются три источника:
  1. XML КПТ / выписки ЕГРН Росреестра  -> load_kpt_xml()
  2. Текстовый список координат          -> load_xy_text()
  3. Заглушка (пока границы нет)         -> см. config.PLACEHOLDER_SITE

ВАЖНО про порядок координат. В документах Росреестра (МСК-50) ось X направлена
на СЕВЕР, ось Y — на ВОСТОК. В Rhino/CAD принято наоборот: X — восток, Y — север.
Поэтому при чтении мы меняем местами: east = Y_егрн, north = X_егрн.
"""
import re
import xml.etree.ElementTree as ET


def _strip_ns(tag):
    return tag.split('}')[-1].lower()


def load_kpt_xml(path, cad_number=None):
    """Читает XML КПТ или выписки ЕГРН, возвращает [(east, north), ...].

    cad_number — кадастровый номер нужного участка (например '50:20:0041009:120').
    Если None — берётся первый найденный контур.
    """
    tree = ET.parse(path)
    root = tree.getroot()

    best = None
    for el in root.iter():
        if _strip_ns(el.tag) not in ('land_record', 'parcel', 'object', 'record'):
            continue
        num = None
        for sub in el.iter():
            if _strip_ns(sub.tag) in ('cadastralnumber', 'cad_number'):
                num = (sub.text or '').strip()
                break
            if 'cadastralnumber' in {k.lower() for k in sub.attrib}:
                for k, v in sub.attrib.items():
                    if k.lower() == 'cadastralnumber':
                        num = v.strip()
        if cad_number and num != cad_number:
            continue
        pts = _ordinates(el)
        if pts:
            best = pts
            break

    if best is None:                       # запасной путь: любые ordinate в файле
        best = _ordinates(root)
    if not best:
        raise ValueError('В файле %s не найдено координат контура' % path)
    return best


def _ordinates(el):
    """Собирает <ordinate x=.. y=..> либо <Ordinate><X>..</X><Y>..</Y>."""
    pts = []
    for o in el.iter():
        if _strip_ns(o.tag) != 'ordinate':
            continue
        ax = {k.lower(): v for k, v in o.attrib.items()}
        x = ax.get('x')
        y = ax.get('y')
        if x is None or y is None:
            for sub in o:
                t = _strip_ns(sub.tag)
                if t == 'x':
                    x = sub.text
                elif t == 'y':
                    y = sub.text
        if x is None or y is None:
            continue
        # ЕГРН: X — север, Y — восток  ->  (east, north)
        pts.append((float(y), float(x)))
    return pts


def load_xy_text(path, swap=True):
    """Читает простой список координат: по паре чисел в строке.

    Форматы, которые поймёт: '1  2233445.67  456789.01', '2233445.67, 456789.01',
    с разделителем табуляцией/пробелом/запятой, номера точек можно оставить.
    swap=True — считать, что в файле порядок ЕГРН (X=север, Y=восток).
    """
    pts = []
    for line in open(path, encoding='utf-8-sig'):
        line = line.split('#')[0].split('//')[0].strip()
        if not line:
            continue
        nums = re.findall(r'-?\d+[.,]?\d*', line.replace(',', '.'))
        nums = [float(n) for n in nums if len(n.replace('.', '')) >= 3]
        if len(nums) < 2:
            continue
        a, b = nums[-2], nums[-1]
        pts.append((b, a) if swap else (a, b))
    if len(pts) < 3:
        raise ValueError('В файле %s меньше трёх точек' % path)
    return pts
