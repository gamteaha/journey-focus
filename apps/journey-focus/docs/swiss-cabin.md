# Separate Swiss cabin · 2026-11-07

Start at `/?destination=swiss`. The Swiss edition now reuses Seoul's ticket composition and card/ticket boarding gestures. After issuing a pass, `/alpine-pilot/?boarding=swiss&ticket=<id>` opens the full-window cabin. Direct cabin entry without a valid pass returns to the Swiss ticket. The supplied monorail is a temporary vehicle, not a faithful Bernina Express interior. See `public/models/swiss/SOURCE.md` and the in-app settings.

## Scope

- `alpine-pilot/swiss-cabin.mjs` owns Swiss seat coordinates, movement, camera and model loading. It reuses `avatar.mjs` and the existing rigged blue-flame GLB, but does not change Seoul cabin geometry or state.
- Thirteen right window seats come from actual cushion geometry, exported into `models/swiss/seats.json`. Clicking a right seat highlights it, then the character-side sit button walks along the aisle and into the seat. WASD/arrows and a touch movement pad are supported.
- Departure requires both scenery and cabin to load and the avatar to be seated. Standing pauses the trip. Tab hiding pauses study time. Reset clears elapsed time and route distance.
- Two views: cabin/character and right window. No left-window control. Both window sides have matching reveals measured from the source glass bounds, continuous upper/lower rails and end caps. The following camera stays inside the rear wall. Three.js camera position, direction and vertical FOV are mapped into Cesium's local east/north/up frame; floor height remains a terrain +1.5m trial value, not a surveyed railway height.
- The ticket carries departure endpoint, duration (1–120 minutes or unlimited), character and medium through same-tab session storage. Invalid or mismatched passes return to booking. Seoul pass validation still defaults to Seoul's station list. Swiss endpoint names are explicitly marked as segment points, not real stations.
- As requested, the existing 1.588km segment takes 300 active seconds each way. It reverses continuously every five minutes, without rotating the cabin or moving the lake to the opposite window. Finite focus sessions stop at the selected time; unlimited repeats until paused. No additional rail geometry or fictitious stations are implied.
- Study time counts actual playing seconds, above the avatar/in the window HUD. Route time is separate: seeking pauses and changes position without awarding study time. Settings contain the selected ticket, reset, route seek, attribution and limitations. Loading stays visible until cabin and scenery are ready (tiles may continue after the existing 25-second tile wait).

## Asset preparation

Run Blender in background with `--python apps/journey-focus/scripts/prepare-swiss-cabin.py -- <download-folder>`. It safely extracts the supplied texture archive inside repository tmp, retains the source files untouched, and exports the GLB plus right-seat positions. No external texture URLs or original absolute file paths are used by the browser.

## Verification

Current QA: world selection → shared Swiss ticket; 25-minute mint pass reaches cabin; actual pointer card drag and paper cutting; south-origin unlimited amber pass; five-minute reversal without a camera flip; pause; front/rear/table seats; mobile viewport; Seoul ticket regression. Twelve interaction checks passed without console errors. Pure tests cover both origins, repeated endpoint continuity, constant speed, finite completion and unlimited mode. Captures: ignored `tmp/swiss-ticket-qa/`. Cloudflare build and eight worker checks pass. Earlier movement/seat checks are retained under `tmp/swiss-cabin-qa/`.
