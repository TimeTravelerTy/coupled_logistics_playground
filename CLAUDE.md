# Coupled Logistic Map — Browser Interactive Site

## What this project is

A browser-based interactive simulation of a **coupled logistic map** on a 160×160 grid, built as a static site (no build system, no npm). The user was inspired by Michael Levin's "platonic space" concept — how simple local rules produce collective agency, resilience, and goal-directedness. The site is educational/exploratory and will be linked from the user's personal portfolio.

## Core math

Each cell: `x(t+1) = r·x(t)·(1 - x(t))` (logistic map)
Coupling: `x_next = (1-ε)·f(x) + ε·aggregate(f(neighbors))`

**Critical correctness constraint:** neighbors are aggregated on post-logistic values `f(x)`, not on raw `x`. The worker uses a two-pass step: pass 1 fills `fxBuf` with logistic values, pass 2 couples via neighbor aggregate of `fxBuf`. Deviating from this breaks parity with the Python original in `sim.py`.

## File structure

```
index.html          # layout — two-column grid, collapsible panels
style.css           # dark theme, CSS custom properties in :root
js/
  sim-worker.js     # WebWorker: full simulation, NO imports (classic worker)
  renderer.js       # ES module: ImageData LUT rendering, colormap definitions
  bifurcation.js    # ES module: period-doubling diagram canvas
  presets.js        # ES module: PRESETS array + CHAPTERS array
  controls.js       # ES module: all DOM bindings, brush mask, keyboard shortcuts
  main.js           # ES module: entry point, rAF loop, worker messaging
```

`main.js` is the only `<script type="module">` tag. `sim-worker.js` is a classic Web Worker — never add `import`/`export` to it.

## Running locally

Needs a local server (ES modules + WebWorker require HTTP):
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Architecture

**Worker message protocol** (`main.js` ↔ `sim-worker.js`):
- Main → Worker: `init`, `requestFrame`, `setParam`, `setPreset`, `applyTool`, `reset`, `clearDamage`
- Worker → Main: `frame { grid, freezeMask, corruptMask, synchrony, disagreement, t, params }`
- `grid/freezeMask/corruptMask` are transferred (Transferable) — new copies each frame, zero memcpy on the worker side

**Customisable simulation axes** (all live-adjustable via `setParam`):
- `r` (2.5–4.0), `eps` (0–0.5)
- `topology`: `moore` | `vonneumann` | `extended` (with `radius` 1–4)
- `boundary`: `periodic` | `fixed` | `reflecting`
- `aggregate`: `mean` | `median` | `max` | `min`
- `updateOrder`: `sync` | `async`
- `initMode` (applied on reset): `random` | `gradient` | `striped` | `checkerboard` | `spike`
- `corruptSigma`, `corruptProb`, `stepsPerFrame`

**Colormaps** (`renderer.js`): Inferno (default), Viridis, Magma, Plasma, Turbo, Grayscale, Custom (two color pickers → linear LUT). All defined as control-point arrays; `buildLUT()` interpolates to 256 entries.

**Bifurcation diagram** (`bifurcation.js`): computed in `setTimeout` chunks after the `<details>` panel is first opened; background saved as `ImageData` for fast redraw when the `r` marker updates.

**Guided tour** (`presets.js` `CHAPTERS` array): 6 chapters, each with `params`, optional `autoTool`, and `narrative` HTML. Chapters 5 (lesion) and 6 (freeze stripe) apply damage automatically after a 200ms delay to let the reset settle.

## Key DOM IDs

Controls sync between DOM and worker via these IDs:
`slider-r`, `slider-eps`, `slider-sigma`, `slider-prob`, `slider-speed`, `slider-radius`, `slider-brush` — each has a matching `*-val` span.
`sel-topology`, `sel-boundary`, `sel-aggregate`, `sel-update`, `sel-init`, `sel-colormap`
`btn-pause`, `btn-reset`, `btn-clear`
`sim-canvas`, `overlay-canvas`, `metrics-canvas`, `bifurcation-canvas`, `brush-preview`
`chapter-nav`, `chapter-narrative`, `btn-ch-prev`, `btn-ch-next`
`preset-buttons` (populated dynamically from `PRESETS`)
`help-overlay`, `radius-row` (hidden unless topology = extended)

## Colour palette (CSS custom properties)

```
--bg: #0d0d0f        --surface: #16161a      --surface2: #1e1e24
--border: #2a2a35    --accent: #7c6af7       --accent-dim: #4a3fa0
--warm: #f07040      --green: #4ecb6e        --text: #e8e8f0
--text-muted: #888899  --text-dim: #555566
```

## Keyboard shortcuts (full parity with Python tool)

Space, R, C, 1–7 (tools), S (cycle shape), [ ] (brush size), +/- (speed), T/G (r), E/D (eps), M/N (sigma), O/P (prob), ? (help overlay)

## Git

Working branch: `ai/claude`. Shared base on `master` in `../coupled_logistics`.

