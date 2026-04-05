// controls.js — All UI bindings, brush mask generation, keyboard shortcuts
'use strict';

import { Renderer, buildCustomLUT } from './renderer.js';

const H = 160, W = 160;

// ─── Brush Mask ──────────────────────────────────────────────────────────────

export function buildBrushMask(cx, cy, size, shape) {
  const mask = new Uint8Array(H * W);
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const dx = col - cx, dy = row - cy;
      let inside = false;
      if (shape === 'circle') {
        inside = dx * dx + dy * dy <= size * size;
      } else if (shape === 'square') {
        inside = Math.abs(dx) <= size && Math.abs(dy) <= size;
      } else if (shape === 'triangle') {
        inside = dy >= -size && dy <= size &&
                 Math.abs(dx) <= (size - (dy + size) / 2);
      }
      if (inside) mask[row * W + col] = 1;
    }
  }
  return mask;
}

// Build a rectangular stripe mask (for chapter 6 frozen stripe)
export function buildStripeMask(rowStart, rowEnd) {
  const mask = new Uint8Array(H * W);
  const r0 = Math.max(0, Math.min(H - 1, rowStart));
  const r1 = Math.max(0, Math.min(H - 1, rowEnd));
  for (let row = r0; row <= r1; row++)
    for (let col = 0; col < W; col++)
      mask[row * W + col] = 1;
  return mask;
}

// ─── Controls Class ──────────────────────────────────────────────────────────

export class Controls {
  constructor({ worker, renderer, bifurcation, onParamChange }) {
    this.worker        = worker;
    this.renderer      = renderer;
    this.bifurcation   = bifurcation;
    this.onParamChange = onParamChange; // callback when any param changes

    // UI state
    this.tool       = 'lesion_random';
    this.shape      = 'circle';
    this.brushSize  = 12;
    this.dragging   = false;

    // Mirror of worker params (for keyboard nudges)
    this.params = {
      r: 3.8, eps: 0.20, corruptSigma: 0.03, corruptProb: 0.25,
      topology: 'moore', radius: 1, boundary: 'periodic',
      aggregate: 'mean', updateOrder: 'sync', stepsPerFrame: 2,
    };

    this._bindSliders();
    this._bindDropdowns();
    this._bindTools();
    this._bindPlayback();
    this._bindPointer();
    this._bindKeyboard();
    this._bindColormap();
    this._bindTabs();
    this._updateBrushPreview();
    this._updateBrushSizeLabel();
  }

  // Called when worker echoes params back (after preset change)
  syncParams(params) {
    Object.assign(this.params, params);
    this._reflectToDOM();
  }

  // ── Sliders ────────────────────────────────────────────────────────────────

  _bindSliders() {
    const sliders = [
      ['slider-r',           'r',            0.01],
      ['slider-eps',         'eps',          0.005],
      ['slider-sigma',       'corruptSigma', 0.005],
      ['slider-prob',        'corruptProb',  0.05],
      ['slider-speed',       'stepsPerFrame',1],
      ['slider-radius',      'radius',       1],
    ];
    for (const [id, key, _] of sliders) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('input', () => {
        const val = parseFloat(el.value);
        this.params[key] = val;
        const label = document.getElementById(id + '-val');
        if (label) label.textContent = val.toFixed(el.dataset.decimals || 2);
        this.worker.postMessage({ type: 'setParam', key, value: val });
        if (key === 'r' && this.bifurcation) this.bifurcation.setR(val);
        if (this.onParamChange) this.onParamChange(key, val);
      });
    }
  }

  // ── Dropdowns ──────────────────────────────────────────────────────────────

  _bindDropdowns() {
    const dropdowns = [
      ['sel-topology',    'topology'],
      ['sel-boundary',    'boundary'],
      ['sel-aggregate',   'aggregate'],
      ['sel-update',      'updateOrder'],
      ['sel-init',        'initMode'],
    ];
    for (const [id, key] of dropdowns) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('change', () => {
        const val = el.value;
        this.params[key] = val;
        this.worker.postMessage({ type: 'setParam', key, value: val });
        // Show/hide radius slider for extended topology
        if (key === 'topology') {
          const radiusRow = document.getElementById('radius-row');
          if (radiusRow) radiusRow.style.display = val === 'extended' ? '' : 'none';
        }
        if (this.onParamChange) this.onParamChange(key, val);
      });
    }
  }

  // ── Tool Buttons ───────────────────────────────────────────────────────────

  _bindTools() {
    const toolBtns = document.querySelectorAll('[data-tool]');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tool = btn.dataset.tool;
        // Scroll corruption fieldset into view when corrupt tool selected
        if (btn.dataset.tool === 'corrupt') {
          document.querySelector('#tab-tools .field-group:has(#slider-sigma)')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });

    // Shape selector
    const shapeBtns = document.querySelectorAll('[data-shape]');
    shapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.shape = btn.dataset.shape;
        this._updateBrushPreview();
      });
    });

    // Brush size slider
    const sizeSlider = document.getElementById('slider-brush');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', () => {
        this.brushSize = parseInt(sizeSlider.value, 10);
        this._updateBrushSizeLabel();
        this._updateBrushPreview();
      });
    }
  }

  // ── Playback Buttons ───────────────────────────────────────────────────────

  _bindPlayback() {
    document.getElementById('btn-pause')?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      const initMode = document.getElementById('sel-init')?.value || 'random';
      this.worker.postMessage({ type: 'reset', initMode });
    });
    document.getElementById('btn-clear')?.addEventListener('click', () => {
      this.worker.postMessage({ type: 'clearDamage' });
    });
  }

  togglePause(forcePause) {
    const paused = forcePause !== undefined ? forcePause : !this._paused;
    this._paused = paused;
    this.worker.postMessage({ type: 'setParam', key: 'paused', value: paused });
    const btn = document.getElementById('btn-pause');
    if (btn) {
      btn.textContent = paused ? '▶' : '⏸';
      btn.title = paused ? 'Play (Space)' : 'Pause (Space)';
    }
  }

  // ── Pointer / Brush Painting ───────────────────────────────────────────────

  _bindPointer() {
    const container = document.getElementById('canvas-container');
    const simCanvas = document.getElementById('sim-canvas');
    if (!container || !simCanvas) return;

    const getCell = (e) => {
      const rect = simCanvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        cx: Math.round((e.clientX - rect.left) * scaleX),
        cy: Math.round((e.clientY - rect.top)  * scaleY),
      };
    };

    const paint = (e) => {
      const { cx, cy } = getCell(e);
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
      const mask = buildBrushMask(cx, cy, this.brushSize, this.shape);
      this.worker.postMessage({ type: 'applyTool', tool: this.tool, mask }, [mask.buffer]);
    };

    container.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.dragging = true; paint(e); }
    });
    container.addEventListener('mousemove', (e) => {
      if (this.dragging) paint(e);
    });
    window.addEventListener('mouseup',  () => { this.dragging = false; });

    // Touch support
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.dragging = true;
      paint(e.touches[0]);
    }, { passive: false });
    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.dragging) paint(e.touches[0]);
    }, { passive: false });
    container.addEventListener('touchend', () => { this.dragging = false; });
  }

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Don't capture when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const k = e.key;
      switch (k) {
        case ' ':
          e.preventDefault();
          this.togglePause();
          break;
        case 'r': case 'R':
          this.worker.postMessage({ type: 'reset', initMode: document.getElementById('sel-init')?.value || 'random' });
          break;
        case 'c': case 'C':
          this.worker.postMessage({ type: 'clearDamage' });
          break;
        case '1': this._selectTool('lesion_random'); break;
        case '2': this._selectTool('lesion_zero');   break;
        case '3': this._selectTool('lesion_one');    break;
        case '4': this._selectTool('freeze');        break;
        case '5': this._selectTool('unfreeze');      break;
        case '6': this._selectTool('corrupt');       break;
        case '7': this._selectTool('uncorrupt');     break;
        case 's': case 'S':
          this._cycleShape();
          break;
        case '[':
          this.brushSize = Math.max(1, this.brushSize - 1);
          this._updateBrushSizeLabel();
          this._updateBrushPreview();
          this._syncBrushSlider();
          break;
        case ']':
          this.brushSize = Math.min(80, this.brushSize + 1);
          this._updateBrushSizeLabel();
          this._updateBrushPreview();
          this._syncBrushSlider();
          break;
        case '+': case '=':
          this._nudgeParam('stepsPerFrame', 1, 1, 20);
          break;
        case '-': case '_':
          this._nudgeParam('stepsPerFrame', -1, 1, 20);
          break;
        case 'd': case 'D':
          this._nudgeParam('eps', -0.01, 0, 0.5);
          break;
        case 'e': case 'E':
          this._nudgeParam('eps', +0.01, 0, 0.5);
          break;
        case 'g': case 'G':
          this._nudgeParam('r', -0.02, 2.5, 4.0);
          break;
        case 't': case 'T':
          this._nudgeParam('r', +0.02, 2.5, 4.0);
          break;
        case 'n': case 'N':
          this._nudgeParam('corruptSigma', -0.005, 0, 0.5);
          break;
        case 'm': case 'M':
          this._nudgeParam('corruptSigma', +0.005, 0, 0.5);
          break;
        case 'p': case 'P':
          this._nudgeParam('corruptProb', -0.05, 0, 1);
          break;
        case 'o': case 'O':
          this._nudgeParam('corruptProb', +0.05, 0, 1);
          break;
        case '?':
          document.getElementById('help-overlay')?.classList.toggle('hidden');
          break;
        case 'Escape':
          document.getElementById('help-overlay')?.classList.add('hidden');
          break;
      }
    });
  }

  _nudgeParam(key, delta, min, max) {
    const cur = this.params[key] ?? 0;
    const val = Math.max(min, Math.min(max, parseFloat((cur + delta).toFixed(4))));
    this.params[key] = val;
    this.worker.postMessage({ type: 'setParam', key, value: val });
    // Update DOM slider + label
    const id = { r: 'slider-r', eps: 'slider-eps', corruptSigma: 'slider-sigma',
                 corruptProb: 'slider-prob', stepsPerFrame: 'slider-speed' }[key];
    if (id) {
      const el = document.getElementById(id);
      if (el) el.value = val;
      const lbl = document.getElementById(id + '-val');
      const dec = key === 'stepsPerFrame' ? 0 : key === 'r' ? 2 : 3;
      if (lbl) lbl.textContent = val.toFixed(dec);
    }
    if (key === 'r' && this.bifurcation) this.bifurcation.setR(val);
    if (this.onParamChange) this.onParamChange(key, val);
  }

  _selectTool(tool) {
    this.tool = tool;
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  _cycleShape() {
    const shapes = ['circle', 'square', 'triangle'];
    const idx = shapes.indexOf(this.shape);
    this.shape = shapes[(idx + 1) % shapes.length];
    document.querySelectorAll('[data-shape]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.shape === this.shape);
    });
    this._updateBrushPreview();
  }

  // ── Colormap ───────────────────────────────────────────────────────────────

  _bindColormap() {
    const sel = document.getElementById('sel-colormap');
    const customRow = document.getElementById('custom-colors');
    const colorA = document.getElementById('color-a');
    const colorB = document.getElementById('color-b');

    const apply = () => {
      const name = sel?.value || 'inferno';
      if (name === 'custom') {
        const lut = buildCustomLUT(colorA?.value || '#0d0d0f', colorB?.value || '#f07040');
        this.renderer.setColormap('custom', lut);
      } else {
        this.renderer.setColormap(name);
      }
    };

    sel?.addEventListener('change', () => {
      const showCustom = sel.value === 'custom';
      if (customRow) customRow.style.display = showCustom ? '' : 'none';
      apply();
    });
    colorA?.addEventListener('input', apply);
    colorB?.addEventListener('input', apply);
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  _bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== `tab-${target}`));
        btn.classList.add('active');
      });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _updateBrushPreview() {
    const canvas = document.getElementById('brush-preview');
    if (canvas) Renderer.drawBrushPreview(canvas, this.brushSize, this.shape);
  }

  _updateBrushSizeLabel() {
    const lbl = document.getElementById('slider-brush-val');
    if (lbl) lbl.textContent = this.brushSize;
    const slider = document.getElementById('slider-brush');
    if (slider) slider.value = this.brushSize;
  }

  _syncBrushSlider() {
    const slider = document.getElementById('slider-brush');
    if (slider) slider.value = this.brushSize;
  }

  // Reflect worker params back to DOM sliders after a preset change
  _reflectToDOM() {
    const p = this.params;
    const map = {
      'slider-r':     ['r',            2],
      'slider-eps':   ['eps',          3],
      'slider-sigma': ['corruptSigma', 3],
      'slider-prob':  ['corruptProb',  2],
      'slider-speed': ['stepsPerFrame',0],
      'slider-radius':['radius',       0],
    };
    for (const [id, [key, dec]] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el && p[key] !== undefined) el.value = p[key];
      const lbl = document.getElementById(id + '-val');
      if (lbl && p[key] !== undefined) lbl.textContent = Number(p[key]).toFixed(dec);
    }
    const dropMap = {
      'sel-topology':  'topology',
      'sel-boundary':  'boundary',
      'sel-aggregate': 'aggregate',
      'sel-update':    'updateOrder',
    };
    for (const [id, key] of Object.entries(dropMap)) {
      const el = document.getElementById(id);
      if (el && p[key]) el.value = p[key];
    }
    // Show/hide radius row
    const radiusRow = document.getElementById('radius-row');
    if (radiusRow) radiusRow.style.display = p.topology === 'extended' ? '' : 'none';
    // Bifurcation marker
    if (this.bifurcation && p.r !== undefined) this.bifurcation.setR(p.r);
  }

  // Apply a chapter's autoTool (called from main.js)
  applyAutoTool(autoTool) {
    if (!autoTool) return;
    let mask;
    if (autoTool.stripeMode) {
      // Horizontal stripe: freeze a band (rowStart/rowEnd specified directly)
      mask = buildStripeMask(autoTool.rowStart, autoTool.rowEnd);
    } else {
      mask = buildBrushMask(autoTool.cx, autoTool.cy, autoTool.size, autoTool.shape);
    }
    this.worker.postMessage({ type: 'applyTool', tool: autoTool.tool, mask }, [mask.buffer]);
  }
}
