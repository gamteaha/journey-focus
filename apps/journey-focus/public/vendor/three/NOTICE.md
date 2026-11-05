# Three.js

Pinned version: 0.170.0. Downloaded from the npm distribution via jsDelivr on 2026-11-04.

Source: https://github.com/mrdoob/three.js/tree/r170

License: MIT, preserved in `LICENSE`. Included loader dependencies retain their source license comments (including fflate).

The FBX loader and NURBS imports from `three` were rewritten to the relative local `build/three.module.js` path. No runtime CDN or npm install is required.

GLTFLoader and BufferGeometryUtils were added from the official `mrdoob/three.js` r170 tag on 2026-11-05. Their bare `three` imports use the same local pinned module. Original source comments and the MIT license are retained.
