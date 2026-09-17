# -*- coding: utf-8 -*-
"""Контуры зданий по визуализациям из презентации.

Каждый объект собирается из частей в локальных координатах (метры, центр в
начале, ось X — вдоль границы участка). Тип части определяет и отрисовку,
и участие в расчётах:

  building  — объём здания: идёт в площадь застройки и в противопожарные разрывы
  canopy    — навес (сцена, порт-кошер, павильон): объём без стен
  terrace   — терраса, настил, крыльцо
  water     — бассейн, купель, пруд
  platform  — площадка с покрытием (кострище, детская, амфитеатр)
  court     — спортивный корт
"""
import math

from shapely.affinity import rotate, scale, translate
from shapely.geometry import Point, Polygon, box


def _box(w, d, cx=0.0, cy=0.0):
    return box(cx - w / 2.0, cy - d / 2.0, cx + w / 2.0, cy + d / 2.0)


def _oval(w, d, cx=0.0, cy=0.0):
    return scale(Point(cx, cy).buffer(1.0, 64), w / 2.0, d / 2.0, origin=(cx, cy))


def _stadium(w, d, r=None):
    """Прямоугольник со скруглёнными торцами."""
    r = min(r if r is not None else d / 2.0, d / 2.0 - 0.01)
    return _box(max(w - 2 * r, 0.1), max(d - 2 * r, 0.1)).buffer(
        r, join_style=1, quad_segs=32)


def _sector(r, a0, a1, cx=0.0, cy=0.0, steps=48):
    pts = [(cx, cy)]
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return Polygon(pts)


# --------------------------------------------------------------------- бани --
def bath_petrovskaya(w, d):
    """Овальный объём с круговой колоннадой, перед ним круглый бассейн."""
    core = _oval(w * 0.72, d * 0.62)
    return [('terrace', _oval(w * 0.72 + 7.0, d * 0.62 + 7.0)),
            ('building', core),
            ('water', Point(0, -d * 0.31 - 6.5).buffer(4.5, 48))]


def bath_bochka(w, d):
    """Центральный объём и две бочки по бокам, купель у крыльца."""
    core = _box(w * 0.46, d * 0.66)
    return [('terrace', _box(w * 0.30, 4.0, 0.0, -d * 0.33 - 2.0)),
            ('building', core),
            ('building', Point(-w * 0.32, 0.6).buffer(4.2, 48)),
            ('building', Point(w * 0.34, -0.4).buffer(4.8, 48)),
            ('water', Point(w * 0.10, -d * 0.33 - 4.2).buffer(1.9, 32))]


def bath_belaya(w, d):
    """Прямоугольный объём с плоской кровлей и овальный бассейн на настиле."""
    return [('building', _box(w * 0.78, d * 0.62)),
            ('terrace', _box(w * 0.86, 9.0, 0.0, -d * 0.31 - 4.5)),
            ('water', _oval(9.0, 5.5, -w * 0.10, -d * 0.31 - 4.5))]


def bath_ohotnichya(w, d):
    """Сруб с открытой верандой и круглой площадкой с кострищем."""
    return [('building', _box(w * 0.74, d * 0.58)),
            ('terrace', _box(w * 0.74, 4.5, 0.0, -d * 0.29 - 2.2)),
            ('platform', Point(0, -d * 0.29 - 9.0).buffer(5.0, 48))]


def bath_rybatskaya(w, d):
    """Объём со скруглённым фасадом и зелёной кровлей, бассейн с водопадом."""
    core = _stadium(w * 0.80, d * 0.60, r=d * 0.30)
    return [('building', core),
            ('terrace', _box(w * 0.80, 8.0, 0.0, -d * 0.30 - 4.0)),
            ('water', _oval(10.0, 6.0, w * 0.08, -d * 0.30 - 4.0))]


# ------------------------------------------------------------ общественные --
def restaurant(w, d):
    """Длинный зал с колоннадой, входной блок с навесом, терраса и пруд."""
    hall = _box(w * 0.78, d * 0.50, w * 0.08, 0.0)
    entry = _box(w * 0.20, d * 0.30, -w * 0.38, d * 0.04)
    return [('building', hall),
            ('building', entry),
            ('canopy', _box(w * 0.16, d * 0.20, -w * 0.40, -d * 0.22)),
            ('terrace', _box(w * 0.78, d * 0.22, w * 0.08, -d * 0.36)),
            ('water', _oval(w * 0.42, d * 0.20, w * 0.12, -d * 0.56))]


def padel(w, d):
    """Крытый корт под изогнутой кровлей, перед входом настил с лестницей."""
    return [('building', _stadium(w * 0.92, d * 0.78, r=d * 0.22)),
            ('court', _box(20.0, 10.0, 0.0, 0.0)),
            ('terrace', _box(w * 0.42, 6.0, -w * 0.10, -d * 0.39 - 3.0))]


def open_court(w, d):
    return [('court', _box(w, d))]


def concert(w, d):
    """Круглый навес сцены и амфитеатр со ступенями."""
    r = min(w, d) / 2.0
    return [('platform', _sector(r, 200, 340)),
            ('canopy', Point(0, 0).buffer(r * 0.46, 48)),
            ('building', Point(0, r * 0.10).buffer(r * 0.30, 48))]


def playground(w, d):
    """Комплекс: покрытие, круглый павильон, башни с горками, качели."""
    return [('platform', _stadium(w, d, r=d * 0.45)),
            ('canopy', Point(w * 0.28, 0.0).buffer(5.5, 48)),
            ('building', _box(6.0, 6.0, -w * 0.34, d * 0.10)),
            ('building', _box(5.0, 5.0, -w * 0.14, -d * 0.12))]


def kpp(w, d):
    """Здание КПП и навес над полосами въезда-выезда."""
    return [('building', _box(w * 0.60, d)),
            ('canopy', _box(w * 0.46, d * 1.25, w * 0.55, 0.0))]


def admin(w, d):
    return [('building', _box(w * 0.80, d * 0.70)),
            ('terrace', _box(w * 0.80, d * 0.22, 0.0, -d * 0.35 - d * 0.11))]


def utility(w, d):
    return [('building', _box(w, d))]


def hotel(w, d):
    """Г-образный корпус с террасой вдоль южного фасада."""
    bar = _box(w * 0.86, d * 0.62, -w * 0.05, 0.0)
    wing = _box(w * 0.22, d * 1.10, w * 0.32, d * 0.24)
    return [('building', bar), ('building', wing),
            ('terrace', _box(w * 0.60, d * 0.22, -w * 0.16, -d * 0.31 - d * 0.11))]


def cottage(w, d):
    return [('building', _box(w, d * 0.75)),
            ('terrace', _box(w * 0.70, d * 0.30, 0.0, -d * 0.37 - d * 0.15))]


BUILDERS = {
    'bath_petrovskaya': bath_petrovskaya, 'bath_bochka': bath_bochka,
    'bath_belaya': bath_belaya, 'bath_ohotnichya': bath_ohotnichya,
    'bath_rybatskaya': bath_rybatskaya, 'restaurant': restaurant,
    'padel': padel, 'court': open_court, 'concert': concert,
    'playground': playground, 'kpp': kpp, 'admin': admin,
    'utility': utility, 'hotel': hotel, 'cottage': cottage,
}


def make(kind, w, d, angle_deg, cx, cy):
    """Собирает части объекта и ставит их на место."""
    parts = BUILDERS.get(kind, utility)(w, d)
    out = []
    for t, g in parts:
        g = rotate(g, angle_deg, origin=(0, 0))
        out.append((t, translate(g, cx, cy)))
    return out
