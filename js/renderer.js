// renderer.js — Canvas rendering with colormap LUTs and overlay
'use strict';

// ─── Colormap LUT Builder ────────────────────────────────────────────────────

// Each colormap is defined as control points: [t, r, g, b] where t ∈ [0, 255]
// We build a 256-entry Uint8ClampedArray LUT by linear interpolation.

function buildLUT(points) {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 255; i++) {
    // Find surrounding control points
    let lo = points[0], hi = points[points.length - 1];
    for (let k = 0; k < points.length - 1; k++) {
      if (i >= points[k][0] && i <= points[k + 1][0]) {
        lo = points[k]; hi = points[k + 1]; break;
      }
    }
    const span = hi[0] - lo[0] || 1;
    const alpha = (i - lo[0]) / span;
    lut[i * 3]     = (lo[1] + alpha * (hi[1] - lo[1])) | 0;
    lut[i * 3 + 1] = (lo[2] + alpha * (hi[2] - lo[2])) | 0;
    lut[i * 3 + 2] = (lo[3] + alpha * (hi[3] - lo[3])) | 0;
  }
  // Last entry
  const last = points[points.length - 1];
  lut[255 * 3]     = last[1];
  lut[255 * 3 + 1] = last[2];
  lut[255 * 3 + 2] = last[3];
  return lut;
}

// Control points: [index_0_255, R, G, B]
const COLORMAPS = {
  inferno: buildLUT([
    [0,   0,   0,   4],
    [32,  51,   8,  94],
    [64,  115,  17, 109],
    [96,  170,  38,  97],
    [128, 209,  75,  73],
    [160, 236, 121,  42],
    [192, 248, 168,  14],
    [224, 253, 215,  81],
    [255, 252, 255, 164],
  ]),
  viridis: buildLUT([
    [0,   68,   1,  84],
    [32,  71,  44, 122],
    [64,  59,  81, 139],
    [96,  44, 113, 142],
    [128, 33, 144, 141],
    [160, 39, 173, 129],
    [192, 92, 200,  99],
    [224, 170, 220,  50],
    [255, 253, 231,  37],
  ]),
  magma: buildLUT([
    [0,   0,   0,   4],
    [32,  43,   9, 101],
    [64,  101,  14, 133],
    [96,  151,  31, 122],
    [128, 194,  60, 107],
    [160, 229, 104,  99],
    [192, 249, 152, 107],
    [224, 254, 204, 163],
    [255, 252, 253, 191],
  ]),
  plasma: buildLUT([
    [0,   13,   8, 135],
    [32,  84,   2, 163],
    [64,  139,  10, 165],
    [96,  185,  50, 137],
    [128, 219,  92, 104],
    [160, 244, 136,  73],
    [192, 254, 188,  43],
    [224, 240, 237,  33],
    [255, 240, 249,  33],
  ]),
  turbo: buildLUT([
    [0,   48,  18,  59],
    [32,  60,  92, 210],
    [64,  53, 186, 243],
    [96,  54, 232, 143],
    [128, 144, 251,  60],
    [160, 229, 228,  34],
    [192, 249, 150,  31],
    [224, 208,  56,   8],
    [255, 122,   4,   3],
  ]),
  grayscale: buildLUT([
    [0,   0,   0,   0],
    [255, 255, 255, 255],
  ]),
};

// Build a custom gradient LUT from two hex color strings
export function buildCustomLUT(hexA, hexB) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return buildLUT([
    [0,   a[0], a[1], a[2]],
    [255, b[0], b[1], b[2]],
  ]);
}

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// ─── Renderer Class ──────────────────────────────────────────────────────────

export class Renderer {
  constructor(simCanvas, overlayCanvas) {
    this.simCanvas     = simCanvas;
    this.overlayCanvas = overlayCanvas;
    this.simCtx        = simCanvas.getContext('2d');
    this.overlayCtx    = overlayCanvas.getContext('2d');

    this.W = 160; this.H = 160;
    simCanvas.width     = this.W; simCanvas.height     = this.H;
    overlayCanvas.width = this.W; overlayCanvas.height = this.H;

    this.imageData   = this.simCtx.createImageData(this.W, this.H);
    this.overlayData = this.overlayCtx.createImageData(this.W, this.H);

    this.lut = COLORMAPS.inferno;
    this.currentColormap = 'inferno';
  }

  setColormap(name, customLUT) {
    if (name === 'custom' && customLUT) {
      this.lut = customLUT;
    } else {
      this.lut = COLORMAPS[name] || COLORMAPS.inferno;
    }
    this.currentColormap = name;
  }

  draw(grid, freezeMask, corruptMask) {
    this._drawGrid(grid);
    this._drawOverlay(freezeMask, corruptMask);
  }

  _drawGrid(grid) {
    const px  = this.imageData.data;
    const lut = this.lut;
    const N   = this.W * this.H;
    for (let i = 0; i < N; i++) {
      const li = (grid[i] * 255 + 0.5) | 0;
      const p  = i << 2; // i * 4
      px[p]     = lut[li * 3];
      px[p + 1] = lut[li * 3 + 1];
      px[p + 2] = lut[li * 3 + 2];
      px[p + 3] = 255;
    }
    this.simCtx.putImageData(this.imageData, 0, 0);
  }

  _drawOverlay(freezeMask, corruptMask) {
    const px = this.overlayData.data;
    const N  = this.W * this.H;
    for (let i = 0; i < N; i++) {
      const p = i << 2;
      const fr = freezeMask[i];
      const co = corruptMask[i];
      if (fr && co) {
        // magenta overlap
        px[p] = 180; px[p+1] = 40; px[p+2] = 220; px[p+3] = 110;
      } else if (fr) {
        // blue
        px[p] = 60; px[p+1] = 120; px[p+2] = 255; px[p+3] = 90;
      } else if (co) {
        // red-orange
        px[p] = 255; px[p+1] = 80; px[p+2] = 40; px[p+3] = 90;
      } else {
        px[p] = px[p+1] = px[p+2] = px[p+3] = 0;
      }
    }
    this.overlayCtx.putImageData(this.overlayData, 0, 0);
  }

  // Draw a brush preview circle on a small canvas
  static drawBrushPreview(canvas, size, shape) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    // Scale size to fit canvas (max radius = ~20px)
    const scale = Math.min(W, H) / 2 / Math.max(size, 1);
    const r = size * scale * 0.85;

    ctx.strokeStyle = '#7c6af7';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(124, 106, 247, 0.15)';

    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (shape === 'square') {
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }
}

export { COLORMAPS };
