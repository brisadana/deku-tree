# Task: build the HERO (beat 1) of "The Great Deku Tree"

Read `BRIEF.md` for overall context, but **this file wins wherever they differ**. Scope is ONLY the hero: the first screen the visitor sees, before any scrolling. Leave the other beats as they are (or disable them behind a flag); do not delete their code.

The hero is almost pure 3D: a painted sky, the forest clearing, the Deku Tree. Almost no UI. Everything should feel alive, slow and natural — never "tech".

## Workflow

1. **Plan first**: list the files you will create/change, the scene graph and the state machine for the eyes. Wait for my OK.
2. Build in this order and show me each step running (screenshots at 1440×900 and 390×844):
   1. Scene + sky + both models + lighting + framing
   2. Cursor parallax
   3. Grass + cursor interaction + flying blades
   4. Eyes (sleep / blink / wake)
   5. Overlay (type), post-processing, polish, performance pass
3. Verify each step yourself in a browser before reporting. For the interactive steps, use Playwright to move the pointer and capture before/after screenshots (and a short screen recording if you can).
4. Put **every tunable number** (angles, speeds, radii, timings, colors) in one file, `src/hero/hero.config.ts`, so I can tweak without touching logic. Add a `?debug=1` mode with a small GUI (leva or lil-gui) bound to that config.

## Assets (already in the repo)

| File | What it is | Placement |
|---|---|---|
| `public/models/deku-forest.glb` | Clearing + forest + cliff ring + path. Already in metres. Meshes: `Ground`, `Foliage`, `Trunks`, `Cliffs`. Foliage already uses alpha MASK. | Load at origin, no transform. The path runs from the tree's mouth toward **+Z** (camera side). |
| `public/models/deku-tree.glb` | The Deku Tree (single mesh, no rig, no morph targets). | Scale so its bounding-box height = **24 m**; centre its bbox on X/Z at the origin; bbox min Y = 0. Its face/mouth must point to **+Z**, so the mouth lines up with the path. Verify visually; if the mouth is off-axis, rotate the tree, not the forest. |

Credits for both are required (CC BY 4.0) — put them in `content.ts`:
- Tree: "Great Deku Tree | Hyrule Warriors" by Lumhax (Sketchfab)
- Forest: "a forest (3) with a road at night for game" by dasy444 (Sketchfab), modified

## Framing

- Camera: perspective, FOV ≈ 35°, position ≈ `(0, 6, 34)`, looking at ≈ `(0, 9, 0)`. The tree is centred, slightly above the middle; the path leads the eye from the bottom edge into the mouth; the canopy can touch the top edge.
- Mobile (< 768px): FOV ≈ 50°, camera a bit further back so the whole trunk + face fit.
- The camera itself never moves in the hero except for the parallax below.

## 1. Sky (background)

- A large inverted sphere (or fullscreen shader behind everything) with a **painted gradient**: warm golden haze at the horizon `#F5DFA6` → soft sage `#CFE3C4` → muted teal at the zenith `#7FB6C2`. Add a soft, large sun glow behind/above the canopy (not a hard disc).
- Two layers of very soft clouds made from fbm noise, drifting slowly sideways at different speeds (parallax depth). Painterly, low contrast, no sharp edges.
- Scene fog with the horizon colour so the far forest dissolves into the sky (no visible edge of the forest patch — tune fog near/far until the square border of the terrain is never visible from the camera).

## 2. Lighting & look

- Warm directional sun from behind-left-above (rim light on the canopy and the trunk edges), colour `#FFE2A0`. Cool hemisphere fill (sky `#CFE3C4`, ground `#2F5D4A`). Soft shadows from the tree onto the meadow only (tight shadow camera frustum around the clearing).
- Tone mapping ACES or AgX, slightly warm grade. Keep greens lush but not neon.
- `Foliage` gets a gentle wind sway in the vertex shader (amplitude grows with height). Same for the tree canopy (very subtle).
- The trunk "breathes": tiny vertex displacement on the trunk only (below the canopy), period ~6 s. Barely perceptible.

## 3. Cursor parallax (the scene turns slightly with the cursor)

- Put forest + tree + grass in a `world` group. Rotate that group (not the camera) from the normalised pointer position:
  - yaw: up to **±3°**, pitch: up to **±1.2°**.
  - Damped with a critically-damped spring (or lerp ≈ 0.04 per frame at 60 fps, framerate-independent).
- The sky rotates only ~30 % as much (depth). Clouds keep drifting regardless.
- When the pointer leaves the window, ease back to centre over ~1.5 s.
- Touch: use device orientation if available (with permission), otherwise a very slow idle drift.

## 4. Grass

- Instanced grass blades covering the meadow (inside the cliff ring), avoiding the path strip and a radius around the trunk base. Density high near the camera, lower far away. Desktop ~25–35k blades, mobile ~8k.
- Blade colour: dark base → warm light-green tip, with per-blade variation. Wind: layered noise, slow gusts travelling across the meadow.
- **Cursor interaction**: raycast the pointer onto the ground (use the `Ground` mesh or a plane at y ≈ 0). Blades within a radius (~2.5 m) bend away from the cursor, proportional to distance and cursor speed, then spring back with slight overshoot. Keep a short trail of the last positions so a fast swipe leaves a parting that closes again (like hand through grass). Do it on the GPU (uniform array of trail points in the vertex shader).
- **Blades flying off**: when the cursor moves fast over the grass, a few loose blades and small leaves lift off.
  - Pool of ~120 instanced quads, textured with grass/leaf cutouts (reuse the foliage atlas from `deku-forest.glb` or draw simple blade shapes).
  - Spawn rate scales with cursor speed, capped (max ~3 per 100 ms). Nothing spawns when the cursor is still.
  - Physics: initial impulse up + along the cursor direction, gravity, air drag, curl-noise wind, tumbling rotation. They drift away and settle or fade out after 2–4 s.
  - Must read as natural and subtle. **No glow, no sparkles, no fireflies.**

## 5. The eyes (sleep, slow blink, wake)

The tree mesh has no rig, so build the eyes as separate meshes:

- Two almond-shaped eye meshes (thin, slightly curved to follow the bark) sitting in the eye grooves under the brows, just in front of the surface (use `polygonOffset` to avoid z-fighting). Approximate location in the tree's normalised frame (height 24 m, base at y = 0, face toward +Z): **left eye ≈ (-1.2, 7.8, 4.2), right eye ≈ (1.6, 7.8, 4.2)**, each ~1.4 m wide, tilted to match the sad slant of the carved brows. These are estimates: confirm by raycasting the face and let me fine-tune in `?debug=1`.
- Eye shader: an eyelid mask driven by `uOpen` (0 closed → 1 open) that opens from the centre line outward; inside, a warm golden core `#F4C95D` with a soft falloff into dark amber, plus a subtle pupil that can shift toward the cursor (max ~15 % of the eye width). Only the eyes go above the bloom threshold.
- **State machine**:
  - `SLEEP` (default, also on load): eyes closed (`uOpen = 0`). Every 6–10 s (random), a **slow drowsy blink**: lids part to ~0.15 over 1.2 s with a faint glow, hold 0.5 s, close over 1.5 s.
  - `WAKING`: triggered by pointer movement (or touch / scroll). Open to 1 over ~700 ms with an ease-out, glow ramps up, maybe a tiny delayed "focus" where the pupils settle on the cursor.
  - `AWAKE`: while the pointer keeps moving; pupils follow the cursor (damped). Occasionally a quick normal blink (150 ms).
  - Back to sleep: after **~1.5 s without pointer movement**, close slowly over **~2.5 s** (ease-in-out) and return to `SLEEP`. Movement mid-close reopens from the current value (never snap).
- Expose all timings in `hero.config.ts`.

## 6. Overlay (minimal type)

The 3D is the hero; type is small and quiet. Everything fades in after the tree is visible.

- Top-left: wordmark **DEKU** — Hylia Serif, 20 px, letter-spacing 0.08em, colour `#F2E6C9`.
- Top-right: `SPOILERS` link and a `SOUND · OFF` toggle — Azeret Mono 11 px, uppercase, letter-spacing 0.06em.
- Bottom-left: H1 **The Great Deku Tree** — Hylia Serif, clamp(56px, 7vw, 112px), line-height 0.92, colour `#F2E6C9`, with a soft dark gradient behind it for legibility (no box).
- Bottom-right: mono hint **MOVE TO WAKE IT** (Azeret Mono 11 px, 70 % opacity). After the tree wakes for the first time, it crossfades to **SCROLL TO ENTER**.
- No other copy in the hero.

**Fonts**
- Display: Hylia Serif from `/public/fonts/` (`@font-face`, `font-display: swap`). Fallback: Cinzel (Google Fonts).
- Mono/UI: Azeret Mono (Google Fonts, 400/500).
- Body (for later sections): Manrope.
- All font families as CSS variables in `tokens.css`.

## 7. Entrance & post-processing

- No loading screen. The overlay type can render immediately; the 3D fades in from black when models are ready (≈ 1.2 s ease-out), sky first, then the scene.
- Post (`@react-three/postprocessing`): Bloom with a high threshold (only the eyes and the sun glow), Vignette (soft), a very light depth-of-field on the far forest, SMAA. No chromatic aberration in the hero.

## 8. Performance & accessibility

- 60 fps on a mid-range laptop. `dpr` capped at 2 (1.5 on mobile). Pause rendering when the tab is hidden.
- Draco-decode the GLBs (they are Draco + WebP compressed).
- `prefers-reduced-motion`: no parallax, no flying blades, grass sways gently but ignores the cursor; eyes just fade open/closed with no pupil tracking.
- Overlay links are real `<a>` / `<button>` elements with visible focus states and 4.5:1 contrast.

## Suggested structure

```
src/hero/
  Hero.tsx              // canvas + overlay
  hero.config.ts        // every tunable
  Sky.tsx               // dome + clouds
  World.tsx             // forest + tree + parallax group
  Grass.tsx             // instanced grass + cursor trail
  FlyingBlades.tsx      // particle pool
  Eyes.tsx              // meshes + shader + state machine
  usePointer.ts         // normalised pointer, speed, idle timer, ground hit
  Overlay.tsx + Overlay.module.css
```

## Done when

- Still pointer: the tree sleeps and does a slow drowsy blink every few seconds; clouds drift; grass sways.
- Moving the pointer: the scene turns slightly, the grass parts and a few blades fly off naturally, the eyes open and follow the cursor.
- Stopping: the eyes close slowly and it falls back asleep.
- The forest edge is never visible, the path leads straight into the mouth, and it runs at 60 fps.
