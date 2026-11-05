# Graph Report - neurootlichnik-game  (2026-09-03)

## Corpus Check
- Corpus is ~17,966 words - fits in a single context window. You may not need a graph.

## Summary
- 114 nodes · 154 edges · 18 communities (10 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 3% INFERRED · 2% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Level Generation CLI
- Game Bootstrap & MCP Tooling
- Package Manifest
- Game UI Setup & Telegram Bridge
- Level Compositing CLI
- Level Play & Viewport Fitting
- Level Asset Pipeline (MCP-adjacent)
- MCP Server Config
- Difference-Tap Interactions
- Game Timer
- Screen & Intro Flow
- Meta-Skills (graphify + llm-council)
- Meta-Skills (grilling)
- Audio Module
- Config Module
- Levels Data Module
- Results Module
- Settings Module

## God Nodes (most connected - your core abstractions)
1. `main()` - 12 edges
2. `Game Logic (game.js IIFE)` - 11 edges
3. `index.html Page` - 9 edges
4. `showScreen()` - 6 edges
5. `markFound()` - 5 edges
6. `finishLevel()` - 5 edges
7. `main()` - 5 edges
8. `GameResults Module` - 5 edges
9. `generate-level.js Tool` - 5 edges
10. `fitGameImages()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Playwright MCP Server` --conceptually_related_to--> `index.html Page`  [AMBIGUOUS]
  .mcp.json → index.html
- `Chrome DevTools MCP Server` --conceptually_related_to--> `index.html Page`  [AMBIGUOUS]
  .mcp.json → index.html
- `Glif MCP Server` --conceptually_related_to--> `generate-level.js Tool`  [AMBIGUOUS]
  .mcp.json → tools/generate-level.js
- `index.html Page` --references--> `CONFIG Object`  [EXTRACTED]
  index.html → src/config.js
- `index.html Page` --references--> `MASCOT_FACTS List`  [EXTRACTED]
  index.html → src/facts.js

## Import Cycles
- None detected.

## Communities (18 total, 8 thin omitted)

### Community 0 - "Level Generation CLI"
Cohesion: 0.16
Nodes (20): ASSETS_DIR, boxDilate(), buildDiffMask(), clamp(), clusterize(), clustersToDifferences(), fs, LEVELS_PATH (+12 more)

### Community 1 - "Game Bootstrap & MCP Tooling"
Cohesion: 0.17
Nodes (17): index.html Page, Chrome DevTools MCP Server, Playwright MCP Server, GameAudio Module, perceptualVolume Function, CONFIG Object, MASCOT_FACTS List, MASCOT_INTRO Text (+9 more)

### Community 2 - "Package Manifest"
Cohesion: 0.18
Nodes (10): description, devDependencies, sharp, name, private, scripts, dev, generate-level (+2 more)

### Community 4 - "Level Compositing CLI"
Cohesion: 0.46
Nodes (7): fs, loadMaskGray(), loadRGBA(), main(), parseArgs(), path, sharp

### Community 5 - "Level Play & Viewport Fitting"
Cohesion: 0.29
Nodes (6): applyViewportHeight(), beginGame(), fitGameImages(), loadLevel(), startLevel(), startTimer()

### Community 6 - "Level Asset Pipeline (MCP-adjacent)"
Cohesion: 0.47
Nodes (6): composite-level.js Tool, generate-level.js Tool, Glif MCP Server, generate-level npm Script, neurootlichnik-game Package, sharp Dependency

### Community 7 - "MCP Server Config"
Cohesion: 0.40
Nodes (5): npx, chrome-devtools, glif, playwright, @playwright/mcp

### Community 8 - "Difference-Tap Interactions"
Cohesion: 0.33
Nodes (6): addMarker(), handleTap(), hapticCorrect(), hapticWrong(), markFound(), shake()

### Community 9 - "Game Timer"
Cohesion: 0.50
Nodes (4): finishLevel(), formatTime(), stopTimer(), updateTimer()

### Community 10 - "Screen & Intro Flow"
Cohesion: 0.50
Nodes (4): maybeShowIntro(), showScreen(), updatePlayButtonLabel(), updateProgressLine()

## Ambiguous Edges - Review These
- `Playwright MCP Server` → `index.html Page`  [AMBIGUOUS]
  .mcp.json · relation: conceptually_related_to
- `Glif MCP Server` → `generate-level.js Tool`  [AMBIGUOUS]
  .mcp.json · relation: conceptually_related_to
- `Chrome DevTools MCP Server` → `index.html Page`  [AMBIGUOUS]
  .mcp.json · relation: conceptually_related_to

## Knowledge Gaps
- **35 isolated node(s):** `@playwright/mcp`, `glif`, `name`, `version`, `private` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 48 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Playwright MCP Server` and `index.html Page`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Glif MCP Server` and `generate-level.js Tool`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Chrome DevTools MCP Server` and `index.html Page`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `LEVELS Data Array` connect `Game Bootstrap & MCP Tooling` to `Level Asset Pipeline (MCP-adjacent)`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `generate-level.js Tool` connect `Level Asset Pipeline (MCP-adjacent)` to `Game Bootstrap & MCP Tooling`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `@playwright/mcp`, `glif`, `name` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._