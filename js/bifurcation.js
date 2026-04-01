// bifurcation.js — Pre-computed bifurcation diagram with live r-marker
'use strict';

export class BifurcationDiagram {
  constructor(canvas, onRChange) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.onRChange = onRChange; // callback(r) when user clicks

    this.R_MIN    = 2.5;
    this.R_MAX    = 4.0;
    this.TRANSIENT = 300;
    this.SAMPLES   = 120;
    this.R_STEPS   = 600;

    // Stores pre-rendered background ImageData
    this.bgImageData = null;
    this.currentR    = 3.8;
    this.ready       = false;

    this._bindEvents();
  }

  // Compute and render — call once (non-blocking via chunked setTimeout)
  compute() {
    const { R_MIN, R_MAX, R_STEPS, TRANSIENT, SAMPLES } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, W, H);

    // Draw axes labels
    ctx.fillStyle = '#555566';
    ctx.font = '10px Inter, monospace';
    ctx.fillText('x', 4, 12);
    ctx.fillText('1.0', 4, 14);
    ctx.fillText('0.0', 4, H - 4);
    ctx.fillText('r →', W - 28, H - 4);

    // Draw r tick labels
    for (let rv = 2.5; rv <= 4.0; rv += 0.5) {
      const x = ((rv - R_MIN) / (R_MAX - R_MIN)) * W;
      ctx.fillText(rv.toFixed(1), x - 8, H - 4);
      ctx.strokeStyle = '#222230';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, H - 15); ctx.lineTo(x, H - 20); ctx.stroke();
    }

    // Chunked computation: ~50 r-values per chunk to stay responsive
    const CHUNK = 50;
    let ri = 0;

    const chunk = () => {
      const end = Math.min(ri + CHUNK, R_STEPS);
      for (; ri < end; ri++) {
        const r = R_MIN + (ri / (R_STEPS - 1)) * (R_MAX - R_MIN);
        const px = (ri / (R_STEPS - 1)) * W;
        let x = 0.5;
        for (let i = 0; i < TRANSIENT; i++) x = r * x * (1 - x);
        for (let i = 0; i < SAMPLES; i++) {
          x = r * x * (1 - x);
          const py = H - x * (H - 20) - 10;
          ctx.fillStyle = ri < R_STEPS * 0.55
            ? 'rgba(170, 160, 255, 0.55)'  // sub-chaotic: lavender
            : 'rgba(248, 168, 80, 0.35)';  // chaotic: orange
          ctx.fillRect(px, py, 1, 1);
        }
      }
      if (ri < R_STEPS) {
        setTimeout(chunk, 0);
      } else {
        // Save background for fast redraw with marker
        this.bgImageData = ctx.getImageData(0, 0, W, H);
        this.ready = true;
        this._drawMarker();
      }
    };

    setTimeout(chunk, 0);
  }

  setR(r) {
    this.currentR = r;
    if (this.ready) this._drawMarker();
  }

  _drawMarker() {
    const { canvas, ctx, bgImageData, currentR, R_MIN, R_MAX } = this;
    const W = canvas.width, H = canvas.height;

    // Restore background
    ctx.putImageData(bgImageData, 0, 0);

    // Draw vertical line
    const x = ((currentR - R_MIN) / (R_MAX - R_MIN)) * W;
    ctx.strokeStyle = '#7c6af7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Triangle marker
    ctx.fillStyle = '#7c6af7';
    ctx.beginPath();
    ctx.moveTo(x, H - 20);
    ctx.lineTo(x - 5, H - 12);
    ctx.lineTo(x + 5, H - 12);
    ctx.closePath();
    ctx.fill();

    // r label
    ctx.fillStyle = '#aaa8ff';
    ctx.font = 'bold 10px Inter, monospace';
    const label = `r=${currentR.toFixed(2)}`;
    const lx = Math.min(x + 6, W - 50);
    ctx.fillText(label, lx, H - 14);
  }

  _bindEvents() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const r = this.R_MIN + (px / this.canvas.width) * (this.R_MAX - this.R_MIN);
      const clamped = Math.max(this.R_MIN, Math.min(this.R_MAX, r));
      this.currentR = clamped;
      if (this.ready) this._drawMarker();
      if (this.onRChange) this.onRChange(clamped);
    });

    this.canvas.title = 'Click to set r';
    this.canvas.style.cursor = 'crosshair';
  }
}
