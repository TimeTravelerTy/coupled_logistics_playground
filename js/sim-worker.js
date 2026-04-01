// sim-worker.js — Coupled Logistic Map simulation engine
// Runs off the main thread. Driven by requestFrame messages from main.js.

'use strict';

// ─── State ──────────────────────────────────────────────────────────────────

const H = 160, W = 160, N = H * W;

let gridA   = new Float32Array(N); // authoritative state
let gridB   = new Float32Array(N); // step target (double buffer)
let fxBuf   = new Float32Array(N); // scratch: logistic(gridA)
let freezeMask  = new Uint8Array(N);
let corruptMask = new Uint8Array(N);
let t = 0;

// Simulation parameters
let r             = 3.8;
let eps           = 0.20;
let corruptSigma  = 0.03;
let corruptProb   = 0.25;
let topology      = 'moore';   // 'moore' | 'vonneumann' | 'extended'
let nbRadius      = 1;         // used when topology === 'extended'
let boundary      = 'periodic'; // 'periodic' | 'fixed' | 'reflecting'
let aggregate     = 'mean';    // 'mean' | 'median' | 'max' | 'min'
let updateOrder   = 'sync';    // 'sync' | 'async'
let initMode      = 'random';  // 'random' | 'gradient' | 'striped' | 'checkerboard' | 'spike'
let stepsPerFrame = 2;
let paused        = false;

// Precomputed neighbor offsets [[dr, dc], ...]
let nbOffsets = [];

// ─── Seeded RNG (Mulberry32) ─────────────────────────────────────────────────

let _seed = 42;
function rand() {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function gaussian() {
  // Box-Muller
  let u;
  do { u = rand(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// ─── Neighborhood Offsets ────────────────────────────────────────────────────

function buildOffsets() {
  nbOffsets = [];
  if (topology === 'vonneumann') {
    nbOffsets = [[-1,0],[1,0],[0,-1],[0,1]];
  } else if (topology === 'moore') {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (dr !== 0 || dc !== 0) nbOffsets.push([dr, dc]);
  } else { // extended
    const rad = nbRadius;
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++)
        if (dr !== 0 || dc !== 0) nbOffsets.push([dr, dc]);
  }
}

// ─── Boundary Index Resolution ───────────────────────────────────────────────

function resolveIdx(row, col) {
  if (boundary === 'periodic') {
    const r = ((row % H) + H) % H;
    const c = ((col % W) + W) % W;
    return r * W + c;
  }
  if (boundary === 'fixed') {
    if (row < 0 || row >= H || col < 0 || col >= W) return -1;
    return row * W + col;
  }
  // reflecting
  let rr = row, cc = col;
  if (rr < 0) rr = -rr - 1;
  else if (rr >= H) rr = 2 * H - rr - 1;
  if (cc < 0) cc = -cc - 1;
  else if (cc >= W) cc = 2 * W - cc - 1;
  rr = Math.max(0, Math.min(H - 1, rr));
  cc = Math.max(0, Math.min(W - 1, cc));
  return rr * W + cc;
}

// ─── Aggregate Functions ─────────────────────────────────────────────────────

// Reusable buffer to avoid per-cell allocations for median
const _nbVals = new Float32Array(128); // max neighbors for radius-4 Moore = 80

function aggregateNeighbors(buf, row, col) {
  const n = nbOffsets.length;
  let count = 0;
  for (let k = 0; k < n; k++) {
    const idx = resolveIdx(row + nbOffsets[k][0], col + nbOffsets[k][1]);
    _nbVals[count++] = idx === -1 ? 0 : buf[idx];
  }
  if (aggregate === 'mean') {
    let sum = 0;
    for (let k = 0; k < count; k++) sum += _nbVals[k];
    return sum / count;
  }
  if (aggregate === 'max') {
    let m = _nbVals[0];
    for (let k = 1; k < count; k++) if (_nbVals[k] > m) m = _nbVals[k];
    return m;
  }
  if (aggregate === 'min') {
    let m = _nbVals[0];
    for (let k = 1; k < count; k++) if (_nbVals[k] < m) m = _nbVals[k];
    return m;
  }
  // median — sort a slice
  const sub = Array.from(_nbVals.subarray(0, count)).sort((a, b) => a - b);
  const mid = count >> 1;
  return count % 2 === 1 ? sub[mid] : (sub[mid - 1] + sub[mid]) / 2;
}

// ─── Synchronous Step ────────────────────────────────────────────────────────

function stepSync() {
  // Pass 1: compute logistic into fxBuf
  for (let i = 0; i < N; i++) {
    fxBuf[i] = r * gridA[i] * (1 - gridA[i]);
  }
  // Pass 2: couple neighbors in fxBuf → gridB
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const i = row * W + col;
      const nb = aggregateNeighbors(fxBuf, row, col);
      gridB[i] = (1 - eps) * fxBuf[i] + eps * nb;
    }
  }
  // Freeze: restore previous values
  for (let i = 0; i < N; i++) {
    if (freezeMask[i]) gridB[i] = gridA[i];
  }
  // Corrupt: probabilistic noise
  for (let i = 0; i < N; i++) {
    if (corruptMask[i] && rand() < corruptProb) {
      gridB[i] += gaussian() * corruptSigma;
    }
  }
  // Clip and swap
  for (let i = 0; i < N; i++) {
    gridB[i] = gridB[i] < 0 ? 0 : gridB[i] > 1 ? 1 : gridB[i];
  }
  const tmp = gridA; gridA = gridB; gridB = tmp;
  t++;
}

// ─── Asynchronous Step ───────────────────────────────────────────────────────

// Reusable permutation buffer
const _perm = new Uint32Array(N);
for (let i = 0; i < N; i++) _perm[i] = i;

function stepAsync() {
  // Fisher-Yates shuffle of _perm
  for (let i = N - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const tmp = _perm[i]; _perm[i] = _perm[j]; _perm[j] = tmp;
  }
  // Update in-place in random order
  for (let k = 0; k < N; k++) {
    const i = _perm[k];
    if (freezeMask[i]) continue;
    const row = (i / W) | 0;
    const col = i % W;
    const fx_i = r * gridA[i] * (1 - gridA[i]);
    // For async: compute neighbor fx from current live gridA values (not fxBuf)
    // This is intentional — "Gauss-Seidel style", cells see already-updated neighbors
    const nb = aggregateNeighbors(gridA, row, col);
    let v = (1 - eps) * fx_i + eps * nb;
    if (corruptMask[i] && rand() < corruptProb) v += gaussian() * corruptSigma;
    gridA[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  t++;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

function computeSynchrony() {
  let sum = 0, sum2 = 0;
  for (let i = 0; i < N; i++) { sum += gridA[i]; sum2 += gridA[i] * gridA[i]; }
  const mean = sum / N;
  const variance = sum2 / N - mean * mean;
  return Math.max(0, 1 - variance);
}

function computeDisagreement() {
  let total = 0;
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const v = gridA[row * W + col];
      const right = gridA[row * W + ((col + 1) % W)];
      const down  = gridA[((row + 1) % H) * W + col];
      total += Math.abs(v - right) + Math.abs(v - down);
    }
  }
  return total / (2 * N);
}

// ─── Initial Conditions ──────────────────────────────────────────────────────

function initGrid(mode) {
  switch (mode) {
    case 'random':
      for (let i = 0; i < N; i++) gridA[i] = rand();
      break;
    case 'gradient':
      for (let row = 0; row < H; row++)
        for (let col = 0; col < W; col++)
          gridA[row * W + col] = col / (W - 1);
      break;
    case 'striped':
      for (let row = 0; row < H; row++)
        for (let col = 0; col < W; col++)
          gridA[row * W + col] = (row % 8 < 4) ? 0.1 : 0.9;
      break;
    case 'checkerboard':
      for (let row = 0; row < H; row++)
        for (let col = 0; col < W; col++)
          gridA[row * W + col] = ((row + col) % 2 === 0) ? 0.1 : 0.9;
      break;
    case 'spike':
      gridA.fill(0);
      gridA[((H >> 1)) * W + (W >> 1)] = 1.0;
      break;
    default:
      for (let i = 0; i < N; i++) gridA[i] = rand();
  }
}

// ─── Damage Tools ────────────────────────────────────────────────────────────

function applyTool(tool, mask) {
  for (let i = 0; i < N; i++) {
    if (!mask[i]) continue;
    switch (tool) {
      case 'lesion_random': gridA[i] = rand(); break;
      case 'lesion_zero':   gridA[i] = 0;      break;
      case 'lesion_one':    gridA[i] = 1;      break;
      case 'freeze':        freezeMask[i] = 1; break;
      case 'unfreeze':      freezeMask[i] = 0; break;
      case 'corrupt':       corruptMask[i] = 1; break;
      case 'uncorrupt':     corruptMask[i] = 0; break;
    }
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

self.onmessage = function(e) {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      _seed = msg.seed || 42;
      topology   = msg.topology    || 'moore';
      nbRadius   = msg.radius      || 1;
      boundary   = msg.boundary    || 'periodic';
      aggregate  = msg.aggregate   || 'mean';
      updateOrder = msg.updateOrder || 'sync';
      r          = msg.r           ?? 3.8;
      eps        = msg.eps         ?? 0.20;
      corruptSigma = msg.corruptSigma ?? 0.03;
      corruptProb  = msg.corruptProb  ?? 0.25;
      stepsPerFrame = msg.stepsPerFrame || 2;
      initMode   = msg.initMode    || 'random';
      buildOffsets();
      initGrid(initMode);
      freezeMask.fill(0);
      corruptMask.fill(0);
      t = 0;
      break;

    case 'requestFrame':
      stepsPerFrame = msg.stepsPerFrame ?? stepsPerFrame;
      if (!paused) {
        const n = msg.n || stepsPerFrame;
        const step = updateOrder === 'async' ? stepAsync : stepSync;
        for (let i = 0; i < n; i++) step();
      }
      sendFrame();
      break;

    case 'setParam':
      switch (msg.key) {
        case 'r':            r = msg.value; break;
        case 'eps':          eps = msg.value; break;
        case 'corruptSigma': corruptSigma = msg.value; break;
        case 'corruptProb':  corruptProb = msg.value; break;
        case 'stepsPerFrame': stepsPerFrame = msg.value; break;
        case 'topology':
          topology = msg.value;
          buildOffsets();
          break;
        case 'radius':
          nbRadius = msg.value;
          buildOffsets();
          break;
        case 'boundary':  boundary = msg.value; break;
        case 'aggregate': aggregate = msg.value; break;
        case 'updateOrder': updateOrder = msg.value; break;
        case 'paused':    paused = msg.value; break;
      }
      break;

    case 'applyTool':
      applyTool(msg.tool, msg.mask);
      break;

    case 'reset': {
      const newMode = msg.initMode || initMode;
      initMode = newMode;
      initGrid(initMode);
      freezeMask.fill(0);
      corruptMask.fill(0);
      t = 0;
      break;
    }

    case 'clearDamage':
      freezeMask.fill(0);
      corruptMask.fill(0);
      break;

    case 'setPreset': {
      const p = msg.params;
      if (p.r           !== undefined) r = p.r;
      if (p.eps         !== undefined) eps = p.eps;
      if (p.topology    !== undefined) { topology = p.topology; buildOffsets(); }
      if (p.radius      !== undefined) { nbRadius = p.radius;   buildOffsets(); }
      if (p.boundary    !== undefined) boundary = p.boundary;
      if (p.aggregate   !== undefined) aggregate = p.aggregate;
      if (p.updateOrder !== undefined) updateOrder = p.updateOrder;
      if (p.reset) {
        if (p.initMode) initMode = p.initMode;
        initGrid(initMode);
        freezeMask.fill(0);
        corruptMask.fill(0);
        t = 0;
      }
      break;
    }
  }
};

function sendFrame() {
  // Send a copy of current state (transfer the copy's buffer)
  const gridCopy   = new Float32Array(gridA);
  const freezeCopy = new Uint8Array(freezeMask);
  const corruptCopy = new Uint8Array(corruptMask);
  self.postMessage({
    type: 'frame',
    grid:        gridCopy,
    freezeMask:  freezeCopy,
    corruptMask: corruptCopy,
    synchrony:   computeSynchrony(),
    disagreement: computeDisagreement(),
    t,
    // Echo current params so UI can stay in sync after preset changes
    params: { r, eps, corruptSigma, corruptProb, topology, nbRadius, boundary, aggregate, updateOrder, stepsPerFrame }
  }, [gridCopy.buffer, freezeCopy.buffer, corruptCopy.buffer]);
}

// Bootstrap
buildOffsets();
initGrid(initMode);
