// main.js — Top-level orchestrator: worker lifecycle, rAF loop, chapter system
'use strict';

import { Renderer }        from './renderer.js';
import { BifurcationDiagram } from './bifurcation.js';
import { Controls }        from './controls.js';
import { PRESETS, CHAPTERS } from './presets.js';

// ─── Worker ──────────────────────────────────────────────────────────────────

const worker = new Worker('./js/sim-worker.js');

// ─── Renderer + Canvases ─────────────────────────────────────────────────────

const simCanvas     = document.getElementById('sim-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const renderer = new Renderer(simCanvas, overlayCanvas);

// ─── Bifurcation Diagram ─────────────────────────────────────────────────────

const bifCanvas = document.getElementById('bifurcation-canvas');
const bifurcation = new BifurcationDiagram(bifCanvas, (r) => {
  // User clicked diagram — sync slider, worker, and controls mirror
  const rClamped = parseFloat(r.toFixed(2));
  worker.postMessage({ type: 'setParam', key: 'r', value: rClamped });
  const slR = document.getElementById('slider-r');
  if (slR) {
    slR.value = rClamped;
    const lbl = document.getElementById('slider-r-val');
    if (lbl) lbl.textContent = rClamped.toFixed(2);
  }
  // controls is always defined by the time a user can click (module finishes loading first)
  controls.params.r = rClamped;
  bifurcation.setR(rClamped);
});

// Start computing diagram (non-blocking) once details is first opened
const bifDetails = document.getElementById('details-bifurcation');
if (bifDetails) {
  let computed = false;
  bifDetails.addEventListener('toggle', () => {
    if (bifDetails.open && !computed) {
      computed = true;
      bifurcation.compute();
    }
  });
}

// ─── Metrics Scrolling Chart ─────────────────────────────────────────────────

const metricsCanvas = document.getElementById('metrics-canvas');
const metricsCtx    = metricsCanvas?.getContext('2d');
const METRICS_BUF   = 300; // samples stored
const syncBuf  = new Float32Array(METRICS_BUF);
const disagBuf = new Float32Array(METRICS_BUF);
let metricHead = 0;

function pushMetrics(synchrony, disagreement) {
  syncBuf[metricHead % METRICS_BUF]  = synchrony;
  disagBuf[metricHead % METRICS_BUF] = disagreement;
  metricHead++;
}

function drawMetrics() {
  if (!metricsCtx) return;
  const W = metricsCanvas.width, H = metricsCanvas.height;
  const half = H / 2;

  metricsCtx.clearRect(0, 0, W, H);

  // Divider line
  metricsCtx.strokeStyle = '#2a2a35';
  metricsCtx.lineWidth = 1;
  metricsCtx.beginPath(); metricsCtx.moveTo(0, half); metricsCtx.lineTo(W, half); metricsCtx.stroke();

  const count = Math.min(metricHead, METRICS_BUF);
  if (count < 2) return;

  // Synchrony — zoomed to [0.75, 1.0] so variation is visible
  const syncFloor = 0.75;
  const syncRange = 1 - syncFloor;
  function syncY(v) {
    const norm = Math.max(0, Math.min(1, (v - syncFloor) / syncRange));
    return half - norm * (half - 4) - 2;
  }

  // fill
  metricsCtx.fillStyle = 'rgba(78,203,110,0.18)';
  metricsCtx.beginPath();
  metricsCtx.moveTo(0, half - 2);
  for (let k = 0; k < count; k++) {
    const i = (metricHead - count + k) % METRICS_BUF;
    const x = (k / (METRICS_BUF - 1)) * W;
    metricsCtx.lineTo(x, syncY(syncBuf[i]));
  }
  metricsCtx.lineTo(W, half - 2);
  metricsCtx.closePath();
  metricsCtx.fill();

  // line
  metricsCtx.strokeStyle = '#4ecb6e';
  metricsCtx.lineWidth = 2;
  metricsCtx.beginPath();
  for (let k = 0; k < count; k++) {
    const i = (metricHead - count + k) % METRICS_BUF;
    const x = (k / (METRICS_BUF - 1)) * W;
    k === 0 ? metricsCtx.moveTo(x, syncY(syncBuf[i])) : metricsCtx.lineTo(x, syncY(syncBuf[i]));
  }
  metricsCtx.stroke();

  // Disagreement (bottom half, orange — scale 0–0.25)
  // High disagreement → line rises toward the divider (mirrors synchrony convention)
  function disagY(v) {
    return H - 2 - Math.max(0, Math.min(0.25, v)) * (half - 4) / 0.25;
  }

  // fill (from line down to canvas bottom)
  metricsCtx.fillStyle = 'rgba(240,112,64,0.15)';
  metricsCtx.beginPath();
  metricsCtx.moveTo(0, H - 2);
  for (let k = 0; k < count; k++) {
    const i = (metricHead - count + k) % METRICS_BUF;
    const x = (k / (METRICS_BUF - 1)) * W;
    metricsCtx.lineTo(x, disagY(disagBuf[i]));
  }
  metricsCtx.lineTo(W, H - 2);
  metricsCtx.closePath();
  metricsCtx.fill();

  // line
  metricsCtx.strokeStyle = '#f07040';
  metricsCtx.lineWidth = 2;
  metricsCtx.beginPath();
  for (let k = 0; k < count; k++) {
    const i = (metricHead - count + k) % METRICS_BUF;
    const x = (k / (METRICS_BUF - 1)) * W;
    k === 0 ? metricsCtx.moveTo(x, disagY(disagBuf[i])) : metricsCtx.lineTo(x, disagY(disagBuf[i]));
  }
  metricsCtx.stroke();
}

// ─── Status Line ─────────────────────────────────────────────────────────────

const statusEl = document.getElementById('status-line');
const timestepEl = document.getElementById('hud-t');

function updateStatus(frame) {
  const { synchrony, disagreement, freezeMask, corruptMask, t } = frame;
  if (timestepEl) timestepEl.textContent = `t=${t}`;

  const hasFrozen  = freezeMask.some(v => v > 0);
  const hasCorrupt = corruptMask.some(v => v > 0);

  let msg = '';
  if (hasFrozen && hasCorrupt) {
    msg = 'Cells are frozen and corrupted — competing constraints on the system.';
  } else if (hasFrozen) {
    msg = 'Frozen cells are holding their position, shaping the flow around them.';
  } else if (hasCorrupt) {
    msg = 'Noise is being injected — watch for resilience or disintegration.';
  } else if (synchrony > 0.97) {
    msg = 'Fully synchronized — all cells moving as one.';
  } else if (synchrony > 0.85) {
    msg = 'Clusters forming — islands of agreement in a turbulent sea.';
  } else if (synchrony > 0.65) {
    msg = 'Partial coherence — waves and structures are emerging.';
  } else if (disagreement > 0.15) {
    msg = 'Pure chaos — 25,600 independent trajectories.';
  } else {
    msg = 'Low disagreement — the system is relatively smooth.';
  }
  if (statusEl) statusEl.textContent = msg;
}

// ─── Controls ────────────────────────────────────────────────────────────────

const controls = new Controls({
  worker,
  renderer,
  bifurcation,
  onParamChange: (key, val) => {
    if (key === 'r') bifurcation.setR(val);
  },
});

// ─── Preset Buttons ───────────────────────────────────────────────────────────

function buildPresetButtons() {
  const container = document.getElementById('preset-buttons');
  if (!container) return;
  PRESETS.forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      worker.postMessage({ type: 'setPreset', params: preset.params });
      // UI will sync when next frame arrives with echoed params
    });
    container.appendChild(btn);
  });
}

// ─── Guided Tour ─────────────────────────────────────────────────────────────

let activeChapter = -1;
let pendingSequence = [];

function cancelPendingSequence() {
  pendingSequence.forEach(id => clearTimeout(id));
  pendingSequence = [];
}

function scheduleParamUpdate(key, value, delay) {
  const id = setTimeout(() => {
    worker.postMessage({ type: 'setParam', key, value });
    const sl = document.getElementById(`slider-${key}`);
    if (sl) sl.value = value;
    const lbl = document.getElementById(`slider-${key}-val`);
    if (lbl) {
      const dec = parseInt(sl?.dataset.decimals ?? '2', 10);
      lbl.textContent = value.toFixed(dec);
    }
    controls.params[key] = value;
    if (key === 'r') bifurcation.setR(value);
  }, delay);
  pendingSequence.push(id);
}

function buildChapterNav() {
  const nav = document.getElementById('chapter-nav');
  const narrative = document.getElementById('chapter-narrative');
  if (!nav || !narrative) return;

  CHAPTERS.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.className = 'chapter-btn';
    btn.dataset.idx = idx;
    btn.innerHTML = `<span class="ch-num">${ch.id}</span><span class="ch-title">${ch.title}</span>`;
    btn.addEventListener('click', () => activateChapter(idx));
    nav.appendChild(btn);
  });

  document.getElementById('btn-ch-prev')?.addEventListener('click', () => {
    if (activeChapter > 0) activateChapter(activeChapter - 1);
  });
  document.getElementById('btn-ch-next')?.addEventListener('click', () => {
    if (activeChapter < CHAPTERS.length - 1) activateChapter(activeChapter + 1);
  });
}

function activateChapter(idx) {
  const ch = CHAPTERS[idx];
  if (!ch) return;
  activeChapter = idx;

  // Highlight active chapter button
  document.querySelectorAll('.chapter-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });

  // Cancel any in-flight sequence from a previous chapter
  cancelPendingSequence();

  // Send preset to worker
  worker.postMessage({ type: 'setPreset', params: ch.params });

  // Single autoTool (existing chapters)
  if (ch.autoTool) {
    const id = setTimeout(() => controls.applyAutoTool(ch.autoTool), 200);
    pendingSequence.push(id);
  }

  // Multi-step autoSequence (e.g. target waves)
  if (ch.autoSequence) {
    for (const step of ch.autoSequence) {
      if (step.type === 'tool') {
        const id = setTimeout(() => controls.applyAutoTool(step.tool), step.delay);
        pendingSequence.push(id);
      } else if (step.type === 'param') {
        scheduleParamUpdate(step.key, step.value, step.delay);
      }
    }
  }

  // Update narrative with fade
  const narrative = document.getElementById('chapter-narrative');
  if (narrative) {
    narrative.style.opacity = '0';
    setTimeout(() => {
      narrative.innerHTML = `<h3>${ch.title}</h3>${ch.narrative}`;
      narrative.style.opacity = '1';
    }, 150);
  }

  // Update prev/next button states
  document.getElementById('btn-ch-prev')?.toggleAttribute('disabled', idx === 0);
  document.getElementById('btn-ch-next')?.toggleAttribute('disabled', idx === CHAPTERS.length - 1);
}

// ─── Worker Message Loop ──────────────────────────────────────────────────────

let pendingFrame = null;
let frameRequested = false;
let frameCount = 0;

worker.onmessage = function(e) {
  if (e.data.type === 'frame') {
    pendingFrame = e.data;
    frameRequested = false;
  }
};

function requestNextFrame() {
  if (!frameRequested) {
    frameRequested = true;
    const n = parseInt(document.getElementById('slider-speed')?.value || '2', 10);
    worker.postMessage({ type: 'requestFrame', n });
  }
}

// ─── rAF Loop ────────────────────────────────────────────────────────────────

function loop() {
  requestAnimationFrame(loop);

  if (pendingFrame) {
    const f = pendingFrame;
    pendingFrame = null;

    renderer.draw(f.grid, f.freezeMask, f.corruptMask);

    // Sync UI params if a preset was applied (worker echoes back)
    if (f.params) controls.syncParams(f.params);

    frameCount++;
    // Push metrics every frame; draw chart every 2 frames
    pushMetrics(f.synchrony, f.disagreement);
    if (frameCount % 2 === 0) drawMetrics();

    // Status line every 15 frames
    if (frameCount % 15 === 0) updateStatus(f);
  }

  requestNextFrame();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

worker.postMessage({
  type: 'init',
  r: 3.8, eps: 0.20,
  topology: 'moore', radius: 1, boundary: 'periodic',
  aggregate: 'mean', updateOrder: 'sync', initMode: 'random',
  corruptSigma: 0.03, corruptProb: 0.25, stepsPerFrame: 2,
  seed: 42,
});

buildPresetButtons();
buildChapterNav();
requestNextFrame();
loop();

// ─── Live Dot (pause toggle) ──────────────────────────────────────────────────
const liveDot = document.getElementById('live-dot');
document.getElementById('btn-pause')?.addEventListener('click', () => {
  liveDot?.classList.toggle('paused');
});

// ─── Sidebar Collapse Toggles ─────────────────────────────────────────────────
(function setupSidebarToggles() {
  const appGrid = document.querySelector('.app-grid');

  document.getElementById('toggle-tour')?.addEventListener('click', () => {
    const col = document.querySelector('.tour-col');
    const btn = document.getElementById('toggle-tour');
    const collapsed = col.classList.toggle('collapsed');
    appGrid.classList.toggle('tour-collapsed', collapsed);
    btn.textContent = collapsed ? '›' : '‹';
    btn.title = collapsed ? 'Expand tour' : 'Collapse tour';
  });

  document.getElementById('toggle-controls')?.addEventListener('click', () => {
    const col = document.querySelector('.controls-col');
    const btn = document.getElementById('toggle-controls');
    const collapsed = col.classList.toggle('collapsed');
    appGrid.classList.toggle('controls-collapsed', collapsed);
    btn.textContent = collapsed ? '‹' : '›';
    btn.title = collapsed ? 'Expand controls' : 'Collapse controls';
  });
})();
