# Откуда взяты видео-скиллы (установлено 04.10.2026)

Скопированы вручную из официальных репозиториев, без запуска их установщиков.
Чтобы обновить — склонировать репозиторий заново и заменить папки.

| Скиллы | Репозиторий | Коммит | Лицензия |
|---|---|---|---|
| `remotion-*` (11 шт., без `remotion-saas`) | github.com/remotion-dev/skills (официальный, Remotion) | `0b5db9d` (01.10.2026) | лицензия Remotion (бесплатно для компаний до 3 человек) |
| `hyperframes`, `hyperframes-*`, `media-use`, `general-video`, `motion-graphics`, `music-to-video`, `embedded-captions`, `talking-head-recut`, `faceless-explainer` | github.com/heygen-com/hyperframes (HeyGen) | `a4a7cbe` (04.10.2026) | Apache-2.0 |
| `video-use` (+ вложенный `skills/manim-video`) | github.com/browser-use/video-use (Browser Use) | `b877063` (23.09.2026) | MIT |
| `ffmpeg` | github.com/digitalsamba/claude-code-video-toolkit | `2c99460` (02.10.2026) | MIT |

## Что важно знать

- **Телеметрия HyperFrames** (анонимная статистика в PostHog) отключена для проекта через
  `.claude/settings.json` (`DO_NOT_TRACK=1`, `HYPERFRAMES_NO_TELEMETRY=1`).
- **Платные/внешние сервисы — только по желанию:** `video-use` использует ElevenLabs для
  расшифровки речи; `media-use` может использовать HeyGen, Gemini, ElevenLabs для генерации
  озвучки/музыки/картинок. Без ключей скиллы работают в локальном режиме.
- **Нужны программы:** `ffmpeg` (в облачной сессии ставится через `apt-get install ffmpeg`),
  Node.js 22+ (HyperFrames/Remotion подтягиваются через `npx` при первом использовании),
  Python 3 для `video-use` (`pip install requests librosa matplotlib pillow numpy`).
- **Не установлено сознательно:** OpenMontage (лицензия AGPL-3.0 — обязывает раскрывать код
  при использовании в сервисе, плюс 100+ инструментов с множеством платных API),
  Tella-скиллы (cut-video, clipify — требуют аккаунт Tella), `remotion-saas` (не нужен студии),
  `pr-to-video`, `product-launch-video`, `slideshow`, `figma`, `remotion-to-hyperframes`
  (не профильные; `hyperframes` сам доустановит любой сценарий по запросу).
