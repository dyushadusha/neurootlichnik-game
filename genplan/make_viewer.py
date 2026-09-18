# -*- coding: utf-8 -*-
"""Собирает HTML-просмотрщик 3D-генплана: сцена зашивается в страницу."""
import json
import os

import fallback

ART = '/tmp/claude-0/-home-user-neurootlichnik-game/aed36ca8-5b0f-52e9-ba85-441dd269831d/scratchpad/art'
HTML = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         'viewer_template.html'), encoding='utf-8').read()
scene = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'scene.json'), encoding='utf-8').read()
out = fallback.strip(HTML.replace('/*__SCENE__*/', scene))
os.makedirs(ART, exist_ok=True)
path = os.path.join(ART, 'bor495.html')
open(path, 'w', encoding='utf-8').write(out)
print('%s — %.0f КБ' % (path, os.path.getsize(path) / 1024.0))
