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
      <p>Set the growth rate low enough (here <em>r = 2.8</em>) and the whole field
      converges to a single value: the <strong>fixed point</strong> <code>x* = 1 − 1/r ≈ 0.64</code>.</p>
      <p>No matter what the starting state, every cell finds its way there.
      Watch the grid settle into a single flat color. Synchrony will climb toward 1.</p>
      <p class="aside">The logistic map has only one stable attractor here. The coupled grid
      inherits this: 25,600 agents independently converging to the same answer.</p>
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
      <p>This is the first step in the <strong>period-doubling cascade</strong>, the
      universal route to chaos discovered by Mitchell Feigenbaum.
      Open the Bifurcation Diagram below to see where we are on that road.</p>
      <p class="aside">The ratio between successive bifurcation intervals converges to
      <em>δ ≈ 4.669</em>, the Feigenbaum constant. Same for every smooth single-humped map,
      regardless of the details. Mathematics asserting a hidden universal structure.</p>
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
      produce globally-coherent behavior in development, regeneration, and cognition?
      This is the baseline. <em>No</em> collective behavior yet.</p>
    `,
  },
  {
    id: 4,
    title: 'Spatial Domains',
    params: { r: 3.8, eps: 0.08, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>Nudge coupling up slightly to <em>ε = 0.08</em> and something unexpected
      crystallizes: the noise <strong>organizes itself into a maze</strong>.
      Winding corridors of agreement trace through a turbulent background.</p>
      <p>Each cell is still chaotic on its own. But now it weakly feels its neighbors,
      creating short-range spatial correlation. Nearby cells tend to fall into similar
      phases; far-apart cells remain independent. The corridor walls are sharp because
      chaos amplifies any difference not averaged out by the coupling.</p>
      <p class="aside">This is the <em>frozen domains</em> phase of coupled map lattices,
      studied by physicist Kunihiko Kaneko in the late 1980s. The maze is meta-stable:
      it persists for thousands of steps, yet no single cell is repeating or predictable.
      Pattern without periodicity. Structure without synchrony.</p>
    `,
  },
  {
    id: 5,
    title: 'Target Waves',
    params: { r: 2.8, eps: 0.25, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    autoSequence: [
      { delay: 2600, type: 'param', key: 'r', value: 3.2 },
      { delay: 3800, type: 'tool', tool: { tool: 'lesion_random', shape: 'circle', cx: 80, cy: 80, size: 6 } },
      { delay: 4400, type: 'param', key: 'r', value: 3.76 },
    ],
    narrative: `
      <p>Watch the sequence: the grid first converges to a single flat color, then
      <em>r</em> rises to period-2, then a small random patch drops in the center, then
      <em>r</em> jumps to chaos. Concentric rings start radiating outward from that spot.</p>
      <p>The trick is the uniform background. When all cells converge and then start
      oscillating together, they are perfectly in phase: every cell does exactly the same
      thing at exactly the same time, so coupling between them has no effect. The random
      patch breaks that: those cells are now out of phase with everything around them. As
      the patch oscillates, the coupling carries that phase difference outward at finite
      speed. Each time the patch completes an approximate cycle, a new ring emits. The
      result is a repeating wave source in a quiet, uniform medium.</p>
      <p>To see two ring systems interact: click this chapter again to restart the
      sequence, then during the brief window after the lesion appears use <em>Lesion rand</em>
      to drop a second patch somewhere off-center. Each patch seeds its own rings. When they
      meet they don't pass through — they block and merge, the outer rings continuing as if
      from a single combined source.</p>
      <p class="aside">The same mechanism drives the Belousov-Zhabotinsky reaction and
      re-entry circuits in cardiac tissue. The source doesn't know it's emitting.
      It's just out of phase, and the coupling does the rest.</p>
    `,
  },
  {
    id: 6,
    title: 'Emergent Synchrony',
    params: { r: 3.8, eps: 0.30, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>Turn coupling up to <em>ε = 0.30</em>. Watch what happens: despite local chaos,
      <strong>travelling waves and spiral patterns</strong> emerge from nothing.</p>
      <p>No cell was instructed to join a wave. No central coordinator exists.
      The pattern lives in the <em>coupling</em>, a collective state that no single cell
      "knows" about, yet every cell participates in.</p>
      <p class="aside">These are something like what Levin calls "platonic attractors":
      configurations that exist in an abstract space of possibilities, and that the system
      navigates toward through local interactions alone — no coordinator, no blueprint.
      Something akin to agency without a self.</p>
    `,
  },
  {
    id: 7,
    title: 'Cognitive Light Cone',
    params: { r: 3.5, eps: 0.20, topology: 'extended', radius: 1, boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: null,
    narrative: `
      <p>The <strong>Radius</strong> slider is now visible in the Dynamics panel. Try
      dragging it from 1 up to 3 or 4 while the simulation runs.</p>
      <p>At radius 1, you'll see spatial domains: islands of one phase sitting in a sea
      of another, with relatively stable boundaries. As you increase the radius, small
      islands start to shrink. They're being outvoted by a wider neighborhood. Push far
      enough and they collapse entirely into the surrounding sea.</p>
      <p>At large radius the surviving structures are coarser and fewer. The fine-grained
      complexity that was possible at radius 1 simply can't be maintained when every cell
      sees so far that local minority pockets get averaged away.</p>
      <p class="aside">This is something like what Michael Levin calls the <em>cognitive light cone</em>:
      the spatial boundary of what an agent can sense and be pulled by. A wider cone isn't
      just "more information" — it changes which collective states are even possible. The
      scale of sensing seems inseparable from the scale of the resulting cognition.</p>
    `,
  },
  {
    id: 8,
    title: 'Damage and Recovery',
    params: { r: 3.45, eps: 0.24, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: { tool: 'lesion_random', shape: 'square', cx: 80, cy: 80, size: 24 },
    narrative: `
      <p>A large region of the grid has been randomly reset, a wound.
      Watch whether the surrounding wave structure <strong>reorganizes to fill the void</strong>,
      or whether it is permanently disrupted.</p>
      <p>Try lesioning again. Try a smaller or larger brush. Does the system recover
      faster from smaller damage? Is there a threshold beyond which it cannot?</p>
      <p class="aside">The coupled system lives in a high-dimensional state space with
      strong attractors. Small perturbations are absorbed; large ones may push the system
      into a different basin entirely. The geometry of that space, not the damage itself,
      determines whether recovery is possible.</p>
    `,
  },
  {
    id: 9,
    title: 'Asynchronous Update',
    params: { r: 2.8, eps: 0.20, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'async', reset: true, initMode: 'random' },
    autoTool: null,
    autoSequence: [
      { delay: 3000, type: 'param', key: 'r', value: 3.8 },
    ],
    narrative: `
      <p>The grid converges, then <em>r</em> jumps to chaos. Watch what happens: spatial
      patterns and speckled domains emerge from what looked like a settled, uniform state.</p>
      <p>Try the same thing in synchronous mode (switch Update order to Synchronous, then
      reset). With sync, if all cells converge to the same value, they all receive the same
      r-jump and evolve identically thereafter. The grid just blinks in unison. No structure.</p>
      <p>Async breaks that symmetry. Because cells update one at a time in random order,
      a cell that updates early in a step is already at a new value when its neighbor
      updates later in the same step. Over time this accumulates: even an apparently
      converged grid has tiny phase differences baked in by the random scheduling. Jump r
      into chaos and those small differences get amplified into the visible patterns you see.</p>
      <p class="aside">Real biological systems are almost certainly asynchronous. Neurons
      fire when they fire; cells divide when they divide. The fact that structure still
      emerges from apparent order being disrupted suggests these dynamics are robust to the
      timing assumptions we impose on them.</p>
    `,
  },
  {
    id: 10,
    title: 'Frozen Memory',
    params: { r: 3.5, eps: 0.22, topology: 'moore', boundary: 'periodic',
              aggregate: 'mean', updateOrder: 'sync', reset: true, initMode: 'random' },
    autoTool: { tool: 'freeze', stripeMode: true, rowStart: 72, rowEnd: 88 },
    narrative: `
      <p>A horizontal stripe of cells has been <strong>frozen</strong>, locked at their
      current values, refusing to update. They persist as a kind of memory, while the
      rest of the system adapts around them.</p>
      <p>Watch how the dynamics route around the obstacle. The frozen region shapes the
      flow like a scar in tissue, or a persistent boundary condition in a physical system.</p>
      <p class="aside">Fixing part of a coupled system's state is equivalent to imposing
      a boundary condition mid-field. The unfrozen cells must satisfy both the local
      update rule and the constraint from their frozen neighbors. That competition
      reshapes every downstream pattern.</p>
    `,
  },
];
