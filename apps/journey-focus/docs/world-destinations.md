# World destination entrance

The root page now opens a rotatable globe before booking. Seoul and Switzerland are independent destinations; no cross-country connecting route is implied.

- `/`: local globe, location pins and matching destination details. Drag with mouse/touch, use arrow keys or the left/right buttons. The two text buttons also select destinations, including when WebGL or map data fails.
- `/?destination=seoul`: lazy-load the existing app and Seoul ticket. Existing route, time, card, character and cabin behavior remains in the app. A return link opens the world selection.
- `/?destination=swiss`: uses the shared Seoul ticket layout, duration controls, character selection and card/ticket gestures with independent Swiss artwork and route data. Select either endpoint of the supported 1.588km segment and 1–120 minutes or unlimited. The train travels the same segment back and forth, five minutes each way.
- Confirmed Swiss tickets open `/alpine-pilot/?boarding=swiss&ticket=<id>`; settings are retained in same-tab session storage. Missing/invalid passes return to booking. The user chooses a right window seat, then starts after loading. See `swiss-cabin.md` for the current integration.

## Rendering and data

The globe reuses bundled Three.js r170, generates a local 2048×1024 map texture and caps device pixel ratio at 1.5. It redraws while rotating/resizing and stops when the destination screen or browser tab is hidden. Seoul application/API requests are deferred until Seoul is chosen. This entrance uses no paid generation or external map API.

`public/world-land.json` contains geometries only from Natural Earth's 1:110m land dataset, retrieved 2026-11-06:

- Source: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
- License: public domain, https://www.naturalearthdata.com/about/terms-of-use/

Land outlines are a small-scale overview, not detailed borders. Seoul's marker is near Seongsu; Switzerland's marker is at the supported Bernina route, not the national capital. The Swiss illustration is a decorative vector drawing, not evidence of current snow cover. Existing Seoul stickers and ticket palette are preserved.

## Verification

Browser QA covered mouse/touch rotation, hemisphere marker visibility, pin selection, Seoul booking with station loading and ticket issuing enabled, return navigation, Swiss ticket-to-scenery navigation and initial 0m position. Keyboard rotation and blocked-map fallback were checked separately. Desktop 1366×768 and mobile 390×844 captures are in ignored `tmp/atlas-qa/`. No console errors occurred in the normal end-to-end flow. The Cloudflare build and eight worker checks passed; import graph validation includes the new entry module.
