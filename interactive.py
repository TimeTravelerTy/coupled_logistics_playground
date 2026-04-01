# interactive.py
from __future__ import annotations
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

from sim import CoupledLogisticSim, mask_from_shape


# --------------------------
# Controls / Keybind summary
# --------------------------
HELP = """
Controls:
  SPACE  pause/resume
  R      reset world
  C      clear damages (freeze+corrupt masks)

Damage mode:
  1  lesion random
  2  lesion zero
  3  lesion one
  4  freeze (paint frozen cells)
  5  unfreeze (erase frozen cells)
  6  corrupt (paint corrupt cells)
  7  uncorrupt (erase corrupt cells)

Shape:
  S  cycle shape (circle -> square -> triangle)
  [  smaller brush
  ]  larger brush

Speed / params:
  -/+  slower/faster (steps per frame)
  D/E  decrease/increase eps
  T/G  decrease/increase r
  N/M  decrease/increase corrupt sigma
  P/O  decrease/increase corrupt prob

Mouse:
  Left click / drag: apply current tool with brush
"""

# Tool modes
TOOL_LESION_RANDOM = "lesion_random"
TOOL_LESION_ZERO   = "lesion_zero"
TOOL_LESION_ONE    = "lesion_one"
TOOL_FREEZE        = "freeze"
TOOL_UNFREEZE      = "unfreeze"
TOOL_CORRUPT       = "corrupt"
TOOL_UNCORRUPT     = "uncorrupt"

SHAPES = ["circle", "square", "triangle"]


def make_overlay_rgba(freeze_mask: np.ndarray, corrupt_mask: np.ndarray) -> np.ndarray:
    """
    Create an RGBA overlay:
      - frozen = blue
      - corrupt = red
      - overlap = magenta
    """
    H, W = freeze_mask.shape
    overlay = np.zeros((H, W, 4), dtype=np.float32)

    # blue for freeze
    overlay[freeze_mask, 2] = 1.0
    overlay[freeze_mask, 3] = 0.35

    # red for corrupt (additive)
    overlay[corrupt_mask, 0] = 1.0
    overlay[corrupt_mask, 3] = np.maximum(overlay[corrupt_mask, 3], 0.35)

    return overlay


def main():
    sim = CoupledLogisticSim(H=160, W=160, r=3.4, eps=0.20, seed=0)

    # UI state
    tool = TOOL_LESION_RANDOM
    shape_idx = 0
    brush_size = 12

    paused = False
    steps_per_frame = 2
    dragging = False

    # Matplotlib setup
    fig, ax = plt.subplots(figsize=(7, 7))
    fig.canvas.manager.set_window_title("Coupled Logistic Map - Interactive Damage Lab")

    im = ax.imshow(sim.x, vmin=0, vmax=1, interpolation="nearest")
    ax.set_title("Coupled Logistic Map")
    ax.axis("off")

    overlay = make_overlay_rgba(sim.freeze_mask, sim.corrupt_mask)
    im_overlay = ax.imshow(overlay, interpolation="nearest")

    # HUD text
    hud = fig.text(0.01, 0.01, "", ha="left", va="bottom", fontsize=9)

    print(HELP)

    def update_hud():
        shape = SHAPES[shape_idx]
        hud.set_text(
            f"t={sim.t} | tool={tool} | shape={shape} | size={brush_size} | "
            f"r={sim.r:.3f} eps={sim.eps:.3f} | "
            f"steps/frame={steps_per_frame} | paused={paused}\n"
            f"sync={sim.synchrony():.4f}  neighΔ={sim.neighbour_disagreement():.4f} | "
            f"corrupt_mode={sim.corrupt_mode} sigma={sim.corrupt_sigma:.3f} prob={sim.corrupt_prob:.2f}"
        )

    def apply_tool_at(xdata: float, ydata: float):
        nonlocal tool, brush_size, shape_idx

        if xdata is None or ydata is None:
            return

        cx = int(round(xdata))
        cy = int(round(ydata))

        if cx < 0 or cx >= sim.W or cy < 0 or cy >= sim.H:
            return

        shape = SHAPES[shape_idx]
        m = mask_from_shape(sim.H, sim.W, cx, cy, brush_size, shape=shape)

        if tool == TOOL_LESION_RANDOM:
            sim.lesion(m, mode="random")
        elif tool == TOOL_LESION_ZERO:
            sim.lesion(m, mode="zero")
        elif tool == TOOL_LESION_ONE:
            sim.lesion(m, mode="one")
        elif tool == TOOL_FREEZE:
            sim.freeze(m, on=True)
        elif tool == TOOL_UNFREEZE:
            sim.freeze(m, on=False)
        elif tool == TOOL_CORRUPT:
            sim.corrupt(m, on=True)
        elif tool == TOOL_UNCORRUPT:
            sim.corrupt(m, on=False)

    def on_press(event):
        nonlocal dragging
        if event.button == 1:
            dragging = True
            apply_tool_at(event.xdata, event.ydata)
            redraw()

    def on_release(event):
        nonlocal dragging
        if event.button == 1:
            dragging = False

    def on_motion(event):
        # drag paint
        if dragging:
            apply_tool_at(event.xdata, event.ydata)
            redraw()

    def on_key(event):
        nonlocal tool, shape_idx, brush_size, paused, steps_per_frame

        k = event.key.lower() if event.key else ""

        if k == " ":
            paused = not paused

        elif k == "r":
            sim.reset()

        elif k == "c":
            sim.freeze_mask[:] = False
            sim.corrupt_mask[:] = False

        # tools
        elif k == "1":
            tool = TOOL_LESION_RANDOM
        elif k == "2":
            tool = TOOL_LESION_ZERO
        elif k == "3":
            tool = TOOL_LESION_ONE
        elif k == "4":
            tool = TOOL_FREEZE
        elif k == "5":
            tool = TOOL_UNFREEZE
        elif k == "6":
            tool = TOOL_CORRUPT
        elif k == "7":
            tool = TOOL_UNCORRUPT

        # shape
        elif k == "s":
            shape_idx = (shape_idx + 1) % len(SHAPES)

        # brush size
        elif k == "[":
            brush_size = max(1, brush_size - 1)
        elif k == "]":
            brush_size = min(80, brush_size + 1)

        # speed
        elif k == "+" or k == "=":
            steps_per_frame = min(50, steps_per_frame + 1)
        elif k == "-" or k == "_":
            steps_per_frame = max(1, steps_per_frame - 1)

        # eps adjust
        elif k == "d":
            sim.eps = max(0.0, sim.eps - 0.01)
        elif k == "e":
            sim.eps = min(1.0, sim.eps + 0.01)

        # r adjust
        elif k == "g":
            sim.r = max(0.0, sim.r - 0.02)
        elif k == "t":
            sim.r = min(4.0, sim.r + 0.02)

        # corruption knobs
        elif k == "n":
            sim.corrupt_sigma = max(0.0, sim.corrupt_sigma - 0.005)
        elif k == "m":
            sim.corrupt_sigma = min(0.5, sim.corrupt_sigma + 0.005)
        elif k == "p":
            sim.corrupt_prob = max(0.0, sim.corrupt_prob - 0.05)
        elif k == "o":
            sim.corrupt_prob = min(1.0, sim.corrupt_prob + 0.05)

        redraw()

    def redraw():
        # update main texture
        im.set_data(sim.x)

        # update overlays
        overlay = make_overlay_rgba(sim.freeze_mask, sim.corrupt_mask)
        im_overlay.set_data(overlay)

        update_hud()
        fig.canvas.draw_idle()

    # Hook events
    fig.canvas.mpl_connect("button_press_event", on_press)
    fig.canvas.mpl_connect("button_release_event", on_release)
    fig.canvas.mpl_connect("motion_notify_event", on_motion)
    fig.canvas.mpl_connect("key_press_event", on_key)

    # Main loop: use a timer so it runs "forever"
    timer = fig.canvas.new_timer(interval=30)

    def tick():
        if not paused:
            sim.step(n=steps_per_frame)
        redraw()

    timer.add_callback(tick)
    timer.start()

    redraw()
    plt.show()


if __name__ == "__main__":
    main()
