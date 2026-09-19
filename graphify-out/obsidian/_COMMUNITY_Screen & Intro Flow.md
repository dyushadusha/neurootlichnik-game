---
type: community
cohesion: 0.50
members: 4
---

# Screen & Intro Flow

**Cohesion:** 0.50 - moderately connected
**Members:** 4 nodes

## Members
- [[maybeShowIntro()]] - code - src/game.js
- [[showScreen()]] - code - src/game.js
- [[updatePlayButtonLabel()]] - code - src/game.js
- [[updateProgressLine()]] - code - src/game.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Screen__Intro_Flow
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Game UI Setup & Telegram Bridge]]
- 1 edge to [[_COMMUNITY_Level Play & Viewport Fitting]]
- 1 edge to [[_COMMUNITY_Game Timer]]

## Top bridge nodes
- [[showScreen()]] - degree 6, connects to 3 communities
- [[maybeShowIntro()]] - degree 2, connects to 1 community
- [[updatePlayButtonLabel()]] - degree 2, connects to 1 community
- [[updateProgressLine()]] - degree 2, connects to 1 community