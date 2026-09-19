---
type: community
cohesion: 0.50
members: 4
---

# Game Timer

**Cohesion:** 0.50 - moderately connected
**Members:** 4 nodes

## Members
- [[finishLevel()]] - code - src/game.js
- [[formatTime()]] - code - src/game.js
- [[stopTimer()]] - code - src/game.js
- [[updateTimer()]] - code - src/game.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Game_Timer
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Game UI Setup & Telegram Bridge]]
- 1 edge to [[_COMMUNITY_Screen & Intro Flow]]
- 1 edge to [[_COMMUNITY_Level Play & Viewport Fitting]]
- 1 edge to [[_COMMUNITY_Difference-Tap Interactions]]

## Top bridge nodes
- [[finishLevel()]] - degree 5, connects to 3 communities
- [[updateTimer()]] - degree 3, connects to 2 communities
- [[formatTime()]] - degree 3, connects to 1 community
- [[stopTimer()]] - degree 2, connects to 1 community