# Where Order Comes From

**25,600 chaotic agents. One rule. Endless structure.**

A browser-based interactive simulation of a [coupled logistic map](https://en.wikipedia.org/wiki/Logistic_map) on a 160×160 grid. Pure vanilla JS, a Web Worker, and a canvas — nothing else.

[**→ Live demo**](https://logisticplatonic.space)

![Dashboard screenshot](assets/screenshot-dashboard.png)

---

## What is this?

Each cell on the grid follows the **logistic map** — one of the simplest equations that produces chaos:

$$x_{t+1} = r \cdot x_t \cdot (1 - x_t)$$

Cells are then **coupled** to their neighbors: each step blends its own next value with the average of its neighbors' next values, weighted by coupling strength ε:

$$x_{t+1} = (1 - \varepsilon)\, f(x_t) \;+\; \varepsilon \cdot \text{mean}\bigl(f(x_{\text{neighbors}})\bigr)$$

Individually, each cell is chaotic. Collectively, they form **spatial domains, synchrony, target waves, and frozen memory** — structure that no single cell planned or knows about.


This is the question the simulation is built to make visceral: *where does order come from?*

---

## Gallery

| Labyrinthine domains | Target waves |
|:---:|:---:|
| ![Labyrinth pattern](assets/screenshot-labyrinth.png) | ![Target waves pattern](assets/screenshot-target-waves.png) |

Both emerge from the same rule. Only `r` and `ε` differ.

---

## Guided Tour

Ten chapters walk you from the simplest behavior to the strange:

| # | Chapter | What you see |
|---|---------|-------------|
| 1 | **The Fixed Point** | All cells converge to the same value — silence |
| 2 | **Period Doubling** | The system oscillates between two values, forever |
| 3 | **Coupled Chaos** | Individual chaos, collective coherence |
| 4 | **Spatial Domains** | Regions lock into phase, borders emerge |
| 5 | **Target Waves** | Expanding rings of synchrony, self-organized |
| 6 | **Emergent Synchrony** | The whole grid breathes as one |
| 7 | **Cognitive Light Cone** | How far does influence reach? |
| 8 | **Damage and Recovery** | Lesion the grid — watch it heal |
| 9 | **Asynchronous Update** | Break the global clock, order persists |
| 10 | **Frozen Memory** | A stripe is frozen; the field routes around it |

---

## Controls

### Sliders
| Control | Range | Key |
|---------|-------|-----|
| Growth rate `r` | 2.5 – 4.0 | `T` / `G` |
| Coupling `ε` | 0 – 0.5 | `E` / `D` |
| Noise σ | 0 – 0.5 | `M` / `N` |
| Noise prob | 0 – 1 | `O` / `P` |
| Speed | 1 – 10 steps/frame | `+` / `-` |

### Tools (keys `1`–`7`)
| Key | Tool |
|-----|------|
| `1` | Paint — set cells to a fixed value |
| `2` | Noise — randomize a region |
| `3` | Freeze — lock cells in place |
| `4` | Corrupt — add per-step noise |
| `5` | Erase freeze / corruption |
| `6` | Reset region to random |
| `7` | Smooth — local average |

### Other shortcuts
`Space` pause/resume · `R` reset · `C` clear damage · `S` cycle brush shape · `[` `]` brush size · `?` help overlay

---

## Simulation options

- **Topology:** Moore (8-neighbor), Von Neumann (4-neighbor), Extended (radius 1–4)
- **Boundary:** Periodic (wraps), Fixed, Reflecting
- **Coupling function:** Mean, Median, Max, Min
- **Update order:** Synchronous, Asynchronous
- **Init state:** Random, Gradient, Striped, Checkerboard, Spike
- **Colormaps:** Inferno, Viridis, Magma, Plasma, Turbo, Grayscale, Custom

---

## Inspiration

Directly inspired by Michael Levin's concept of [platonic space](https://thoughtforms.life/platonic-space-where-cognitive-and-morphological-patterns-come-from-besides-genetics-and-environment/): the idea that simple local rules give rise to collective agency, goal-directedness, and resilience that no individual component possesses. The coupled logistic map is a minimal toy model for asking that question mathematically.

---

## Running locally

ES modules + Web Workers require HTTP — opening `index.html` directly won't work:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

That's it. No npm, no build step.

---

## File structure

```
index.html          # layout — two-column, collapsible panels
style.css           # dark theme, CSS custom properties
js/
  main.js           # entry point, rAF loop, worker messaging
  sim-worker.js     # WebWorker: full simulation (classic worker, no imports)
  renderer.js       # ImageData LUT rendering, colormap definitions
  bifurcation.js    # period-doubling bifurcation diagram
  presets.js        # PRESETS array + guided tour CHAPTERS
  controls.js       # DOM bindings, brush mask, keyboard shortcuts
sim.py              # Python original (reference implementation)
```

---

## License

[MIT](LICENSE) — Tyrone White, 2026
