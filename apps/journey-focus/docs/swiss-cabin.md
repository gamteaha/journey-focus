# Separate Swiss cabin · 2026-11-07

`/alpine-pilot/?boarding=swiss` now opens a full-window cabin experience. The supplied monorail is a temporary vehicle; it is not presented as a faithful Bernina Express interior. See `public/models/swiss/SOURCE.md` and the in-app settings.

## Scope

- `alpine-pilot/swiss-cabin.mjs` owns Swiss seat coordinates, movement, camera and model loading. It reuses `avatar.mjs` and the existing rigged blue-flame GLB, but does not change Seoul cabin geometry or state.
- Thirteen right window seats come from actual cushion geometry, exported into `models/swiss/seats.json`. Clicking a right seat highlights it, then the character-side sit button walks along the aisle and into the seat. WASD/arrows and a touch movement pad are supported.
- Departure requires both scenery and cabin to load and the avatar to be seated. Standing pauses the trip. Tab hiding pauses study time. Reset clears elapsed time and route distance.
- Two views: cabin/character and right window. There is no left-window control. The cabin uses transparent glass over the Cesium scene; its camera direction is passed to the scenery camera. Position/elevation matching remains approximate, not a surveyed alignment.
- Study time counts actual playing seconds independently of the 20/60km/h scenery speed. It appears above the avatar in cabin view and in the HUD in window view. Seeking pauses without awarding study time. The finite 1.588km route starts at zero; destination recommendation and custom focus-duration booking are still outside the Swiss prototype scope.
- Settings contain speed, reset, route seek, attribution and model/scenery limitations. Loading stays visible until both resources are ready (visible map tiles can continue to arrive after the existing 25-second tile wait).

## Asset preparation

Run Blender in background with `--python apps/journey-focus/scripts/prepare-swiss-cabin.py -- <download-folder>`. It safely extracts the supplied texture archive inside repository tmp, retains the source files untouched, and exports the GLB plus right-seat positions. No external texture URLs or original absolute file paths are used by the browser.

## Verification

Browser QA: actual chair click/selection, walking and seating, departure gating, elapsed time, pause, standing, keyboard and touch movement, right-window switching, seek/reset, desktop and mobile viewport fit. Normal flow had no JavaScript errors; a mobile run reported 26 FPS in the test environment. Seat camera screenshots cover both facing directions, the table area and the first/last rows. Results/captures are local under ignored `tmp/swiss-cabin-qa/`. Cloudflare build and all eight worker checks passed.
