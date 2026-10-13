# Sizzle Kitchen — restaurant game prototype

English-language browser game with an isometric kitchen, pizza and burger prep,
concurrent oven/griddle, ticket selection, practice and three-minute shifts.

## Run

Serve `dist/` with any static HTTP server. No runtime dependencies or build step.
Run `npm test` for deterministic game-domain tests.

## Architecture

- `dist/js/core.js`: engine-independent recipes, semantic actions, station state,
  timed cooking, patience, exact-recipe validation, revenue and scoring.
- `dist/js/app.js`: desktop/touch/keyboard input adapter, UI and optional sound.
- `dist/js/scene.js`: Canvas isometric renderer; view-only food visualization.
- `dist/index.html`, `dist/style.css`: responsive interface and instructions.
- `tests/core.test.mjs`: both production flows and rule/error/timeout coverage.
- `docs/VR_ROADMAP.md`: concrete migration boundaries and XR implementation steps.

Time enters only through `KitchenGame.tick(seconds)`. Rendering never changes
domain state. A future input adapter calls `dispatch(action)` rather than changing
recipes or scores directly. Starting a new mode clears the current session.
Only the best shift score is saved locally; no accounts, server or cloud saves.

Current release is **2.5D Canvas, not VR**. Headset interaction, 3D physical items,
spatial audio and controller tracking remain future work.
