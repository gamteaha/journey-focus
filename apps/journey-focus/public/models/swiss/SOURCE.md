# Swiss prototype cabin

Supplied by the user on 2026-11-06: `train_monorail_TS.obj`, matching `.mtl` and `.fbx`, and `textures.zip`. This is a **monorail model**, not an authentic Bernina Express vehicle. Original creator/source URL and license metadata were not included in the supplied files; no authorship or new license is asserted here.

The app uses `monorail-cabin.glb`, generated from the supplied OBJ/MTL and textures with Blender 4.5. The FBX is not additionally loaded. The user's original files remain unchanged. Original file hashes are in `seats.json`.

Preparation script: `apps/journey-focus/scripts/prepare-swiss-cabin.py`. Diffuse textures are embedded, capped at 2048px, and glass is transparent. The source has 48,822 vertices and 47,444 polygons before export triangulation. Result is about 3.0MB. Seat data is calibrated from the source mesh cushion components, with 13 usable right window seats. Display dimensions and camera/seat positions are prototype values.

The PNG supplied alongside these assets is the existing Seoul ticket background and was not used as a cabin texture.
