// presets.js — Named presets and guided chapter definitions
'use strict';

// ─── Quick Presets ───────────────────────────────────────────────────────────
// Applied instantly; no narrative text, just parameter sets.

export const PRESETS = [
  {
    id: 'fixed-point',
    label: 'Fixed Point',
    params: { r: 2.8, eps: 0.15, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
  {
    id: 'period2',
    label: 'Period-2',
    params: { r: 3.2, eps: 0.15, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
  {
    id: 'period4',
    label: 'Period-4',
    params: { r: 3.5, eps: 0.10, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
  {
    id: 'edge',
    label: 'Edge of Chaos',
    params: { r: 3.57, eps: 0.15, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
  {
    id: 'chaos',
    label: 'Chaos',
    params: { r: 3.8, eps: 0.05, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
  {
    id: 'sync-chaos',
    label: 'Sync Chaos',
    params: { r: 3.8, eps: 0.30, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
  {
    id: 'turbulence',
    label: 'Turbulence',
    params: { r: 3.95, eps: 0.08, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true },
  },
];

// ─── Guided Chapters ─────────────────────────────────────────────────────────
// Each chapter sets params, optionally applies a damage mask (via `autoTool`),
// and displays narrative HTML in the tour panel.

export const CHAPTERS = [
  {
    id: 1,
    title: 'The Fixed Point',
    params: { r: 2.8, eps: 0.10, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>Set the growth rate low enough — here <em>r = 2.8</em> — and the whole field
      converges to a single value: the <strong>fixed point</strong> <code>x* = 1 − 1/r ≈ 0.64</code>.</p>
      <p>No matter what the starting state, every cell finds its way there.
      Watch the grid settle into a single flat colour. Synchrony will climb toward 1.</p>
      <p class="aside">The logistic map has only one stable attractor here. The coupled grid
      inherits this: 25,600 agents independently converge to the same answer.</p>
    `,
  },
  {
    id: 2,
    title: 'Period Doubling',
    params: { r: 3.2, eps: 0.10, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>Increase <em>r</em> past 3 and the fixed point <strong>bifurcates</strong>:
      the system now oscillates between <em>two</em> values, cycling forever.</p>
      <p>This is the first step in the <strong>period-doubling cascade</strong> —
      a universal route to chaos discovered by Mitchell Feigenbaum.
      Open the Bifurcation Diagram below to see where we are on that road.</p>
      <p class="aside">The ratio between successive bifurcation intervals converges to
      <em>δ ≈ 4.669</em>, the Feigenbaum constant — the same for every smooth map
      with a single hump. Mathematics asserting a hidden universal structure.</p>
    `,
  },
  {
    id: 3,
    title: 'Coupled Chaos',
    params: { r: 3.8, eps: 0.05, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>At <em>r = 3.8</em> the logistic map is fully chaotic — nearby starting values
      diverge exponentially fast. With coupling nearly off (<em>ε = 0.05</em>) each cell
      is essentially on its own.</p>
      <p>25,600 chaotic agents, each following identical rules, producing uncorrelated noise.
      Low synchrony, high disagreement.</p>
      <p class="aside">Michael Levin asks: how does a collection of locally-dumb cells
      produce globally-coherent behaviour — in development, regeneration, and cognition?
      This is the baseline: <em>no</em> collective behaviour yet.</p>
    `,
  },
  {
    id: 4,
    title: 'Emergent Synchrony',
    params: { r: 3.8, eps: 0.30, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>Turn coupling up to <em>ε = 0.30</em>. Watch what happens: despite local chaos,
      <strong>travelling waves and spiral patterns</strong> emerge from nothing.</p>
      <p>No cell was instructed to join a wave. No central coordinator exists.
      The pattern lives in the <em>coupling</em> — a collective state that no single cell
      "knows" about, yet every cell participates in.</p>
      <p class="aside">Levin calls such states "platonic attractors" — they exist in an
      abstract space of possible configurations, and the system navigates toward them
      through local interactions alone. This is what agency without a self looks like.</p>
    `,
  },
  {
    id: 5,
    title: 'Damage and Recovery',
    params: { r: 3.8, eps: 0.20, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: { tool: 'lesion_random', shape: 'square', cx: 80, cy: 80, size: 28 },
    narrative: `
      <p>A large region of the grid has been randomly reset — a wound.
      Watch whether the surrounding wave structure <strong>reorganises to fill the void</strong>,
      or whether it is permanently disrupted.</p>
      <p>Try lesioning again. Try a smaller or larger brush. Does the system recover
      faster from smaller damage? Is there a threshold beyond which it cannot?</p>
      <p class="aside">Planarians regenerate their entire head from a tail fragment.
      Embryos cut in half can still produce whole organisms. Levin's insight is that
      this robustness is not a special biological trick — it falls out of the geometry
      of the underlying state space. A basin of attraction is hard to leave permanently.</p>
    `,
  },
  {
    id: 6,
    title: 'Frozen Memory',
    params: { r: 3.8, eps: 0.20, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: { tool: 'freeze', stripeMode: true, rowStart: 72, rowEnd: 88 },
    narrative: `
      <p>A horizontal stripe of cells has been <strong>frozen</strong> — locked at their
      current values, refusing to update. They persist as a kind of memory, while the
      rest of the system adapts around them.</p>
      <p>Watch how the dynamics route around the obstacle. The frozen region shapes the
      flow like a scar in tissue, or a long-held habit in a mind.</p>
      <p class="aside">"What does it mean for a system to have a past?" Levin argues that
      biological memory is not stored in neurons alone but in the persistent states of
      cells, tissues, and their coupling topology — exactly what you see here.</p>
    `,
  },
];
