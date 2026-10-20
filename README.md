# Sizzle Kitchen — restaurant game prototype

English-language browser game with an isometric kitchen, pizza and burger prep,
concurrent oven/griddle, ticket selection, practice and three-minute shifts.

## Run

Serve `dist/` with any static HTTP server. No runtime dependencies or build step.
Run `npm test` for deterministic game-domain tests.

## First-person mode

```
npm install
npm start          # prints http://localhost:8080/fps.html and a same-Wi-Fi link
```

Open `fps.html` (or click **First-person mode** in the header). Play **solo**, or
pick **Play together** and have up to four friends on the same Wi-Fi open the
printed link to cook in one shared kitchen. Solo also works from any static
server; multiplayer needs `npm start`.

Controls: WASD move, mouse look, Shift run, E or click to use, Q put down,
1–3 pick a ticket, Esc menu.

- **By hand:** carry ingredients from the crates to the island boards, pizzas to
  the oven, raw patties from the fridge to the griddle, dishes to the window.
- **Bell and customers:** serving rings the bell; a customer outside walks up,
  takes the plate and leaves. Customers who run out of patience storm off.
- **Random events:** lunch rush, food critic (★ ticket, double pay), oven on the
  fritz, grease fire (use the extinguisher), sold-out crate (restock from the pantry).
- **Animation:** first-person arms, items flying to stations, swinging oven and
  fridge doors, steam, smoke, fire, head bob, animated teammates and customers.

Code:

- `dist/js/session.js`: players, hands and effects around `KitchenGame`; runs in
  the browser for solo and on the server for multiplayer.
- `dist/js/events.js`: the random event director.
- `dist/js/fps/interactions.js`: pure rules for *held item + target + context*.
- `server/server.mjs`: static files + authoritative WebSocket kitchen (`ws`),
  input validation and per-connection rate limits.
- `dist/js/fps/*`: Three.js view (world, stations, people, customers, avatars,
  hands, particles, effects, HUD, sound, menu, net).
- `dist/vendor/three.module.min.js`: Three.js r170 (MIT), vendored.

`?debug` exposes `window.sizzle` for scripted testing; `?record` keeps frames
readable so the canvas can be captured to video.

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

The classic view is 2.5D Canvas; the first-person view is desktop 3D, **not VR**. Headset interaction, 3D physical items,
spatial audio and controller tracking remain future work.
