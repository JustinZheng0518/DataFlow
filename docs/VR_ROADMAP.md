# VR migration plan

## What is reusable now

`KitchenGame` contains no browser APIs. Reuse recipe definitions, order generation,
food validation, cooking duration, patience and score. A browser WebXR renderer can
import this module directly. A Unity/OpenXR build would port these rules and share
recipe/action fixtures; Canvas graphics and JS are not drop-in Unity assets.

## Semantic input contract

| Real-world interaction | Domain action |
| --- | --- |
| Select a ticket | `SELECT_ORDER {id}` |
| Use a pizza/burger prep surface | `SELECT_STATION {station}` |
| Place an ingredient on the current prep surface | `ADD {ingredient}` |
| Place pizza inside oven | `BAKE` |
| Put a raw patty on the griddle | `GRILL` |
| Pick up a cooked pizza | `COLLECT_OVEN` |
| Pick up a cooked patty | `COLLECT_GRILL` |
| Put the completed dish in the serving zone | `SERVE` |
| Clear/recycle an unfinished dish | `CLEAR` |
| Pause the session | `PAUSE` |

The current ADD/BAKE/SERVE commands target the selected station/order. Before VR,
extend them with explicit dish/station/order IDs so simultaneous two-hand input
cannot be redirected by a UI selection. Keep backward compatibility for desktop.

## Incremental implementation

1. Choose target headset and engine before production: a WebXR browser prototype
   or a native Unity/OpenXR project. Keep this browser game as the rules reference.
2. Create a meter-scaled 3D kitchen with one stationary player position, reachable
   prep areas and comfortable ticket placement. Begin with primitive meshes.
3. Add XR ray selection and direct grabbing. Map ingredient identity to game IDs;
   accept only released ingredients intersecting a valid prep/heat/serving zone.
4. Add authoritative item IDs, pickup ownership, placement validation and reset
   positions. Separate food progression from physics simulation; prevent double
   add/serve from duplicate overlap callbacks.
5. Add controller/haptic feedback, labels and spatial audio. Keep a desktop input
   fallback and avoid forced camera movement. Verify recipes and tolerances on
   headset, then build physical cutting, dough spreading and patty flipping.

## Current simplifications

- One pizza and burger prep slot, one oven slot and one griddle slot.
- Ingredients are semantic buttons; no chopping, physics, inventories or hands.
- Patty flips are implicit. Any fully cooked patty is valid until used.
- Same cooking time for every recipe. No raw-patty carry or temperature simulation.
- Practice mode has unlimited patience and no burning; shift mode uses 95-second
  patience and burns food ten seconds after cooking finishes.
- Returning to an inactive browser tab requires manually resuming; time freezes.

Before VR release: test on-device frame rate, reach, readability, grabbing and
tracking loss. No VR hardware or browser immersive-session QA has been run yet.
