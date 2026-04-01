from __future__ import annotations
import numpy as np


def logistic(x: np.ndarray, r: float) -> np.ndarray:
    return r * x * (1.0 - x)


def neighbor_mean_moore(x: np.ndarray) -> np.ndarray:
    """
    8-neighbour mean (Moore neighbourhood), periodic boundary conditions.
    """
    return (
        np.roll(np.roll(x,  1, axis=0),  1, axis=1) +
        np.roll(np.roll(x,  1, axis=0),  0, axis=1) +
        np.roll(np.roll(x,  1, axis=0), -1, axis=1) +
        np.roll(np.roll(x,  0, axis=0),  1, axis=1) +
        np.roll(np.roll(x,  0, axis=0), -1, axis=1) +
        np.roll(np.roll(x, -1, axis=0),  1, axis=1) +
        np.roll(np.roll(x, -1, axis=0),  0, axis=1) +
        np.roll(np.roll(x, -1, axis=0), -1, axis=1)
    ) / 8.0


def mask_from_shape(
    H: int,
    W: int,
    cx: int,
    cy: int,
    size: int,
    shape: str = "circle",
) -> np.ndarray:
    """
    Returns a boolean mask of the selected shape centered at (cx, cy).
    shape in {"circle","square","triangle"}.
    Periodic wrap not applied here; mask is clipped to array bounds.
    """
    yy, xx = np.ogrid[:H, :W]
    dx = xx - cx
    dy = yy - cy

    if shape == "circle":
        m = (dx * dx + dy * dy) <= (size * size)

    elif shape == "square":
        m = (np.abs(dx) <= size) & (np.abs(dy) <= size)

    elif shape == "triangle":
        # Simple isosceles triangle pointing up
        # Region: dy in [-size, size], and |dx| <= (size - (dy + size)/2)
        # (cheap and cheerful, but works visually)
        m = (dy >= -size) & (dy <= size)
        width = (size - (dy + size) / 2.0)  # narrows with dy
        m = m & (np.abs(dx) <= width)

    else:
        raise ValueError(f"Unknown shape: {shape}")

    # Clip is automatic since we use full-grid expressions.
    return m


class CoupledLogisticSim:
    """
    Vanilla coupled logistic map + damage layers.

    Damage layers:
      - lesion: immediate overwrite x in region (random / 0 / 1)
      - freeze_mask: frozen cells don't update (keep previous x)
      - corrupt_mask: cells get noisy / randomized each step
    """

    def __init__(
        self,
        H: int = 140,
        W: int = 140,
        r: float = 3.8,
        eps: float = 0.12,
        seed: int = 0,
    ):
        self.H = H
        self.W = W
        self.r = r
        self.eps = eps

        self.rng = np.random.default_rng(seed)
        self.x = self.rng.random((H, W)).astype(np.float32)

        self.freeze_mask = np.zeros((H, W), dtype=bool)
        self.corrupt_mask = np.zeros((H, W), dtype=bool)

        # Corruption parameters
        self.corrupt_mode = "noise"     # "noise" or "random"
        self.corrupt_sigma = 0.03
        self.corrupt_prob = 0.25        # applied per-step only on corrupt cells

        self.t = 0

    def reset(self) -> None:
        self.x[:] = self.rng.random((self.H, self.W)).astype(np.float32)
        self.freeze_mask[:] = False
        self.corrupt_mask[:] = False
        self.t = 0

    def step(self, n: int = 1) -> None:
        for _ in range(n):
            x_prev = self.x

            fx = logistic(x_prev, self.r)
            nb = neighbor_mean_moore(fx)

            x_next = (1.0 - self.eps) * fx + self.eps * nb

            # Apply freeze: frozen cells stay at previous value
            if self.freeze_mask.any():
                x_next = x_next.copy()
                x_next[self.freeze_mask] = x_prev[self.freeze_mask]

            # Apply corruption
            if self.corrupt_mask.any():
                x_next = x_next.copy()

                cm = self.corrupt_mask
                # probabilistic corruption per step on corrupt cells
                p = self.corrupt_prob
                apply_now = self.rng.random(x_next.shape) < p
                apply_now &= cm

                if apply_now.any():
                    if self.corrupt_mode == "noise":
                        noise = self.rng.normal(0.0, self.corrupt_sigma, size=x_next.shape).astype(np.float32)
                        x_next[apply_now] = x_next[apply_now] + noise[apply_now]
                    elif self.corrupt_mode == "random":
                        randvals = self.rng.random(x_next.shape).astype(np.float32)
                        x_next[apply_now] = randvals[apply_now]

            # clip
            np.clip(x_next, 0.0, 1.0, out=x_next)

            self.x = x_next.astype(np.float32)
            self.t += 1

    # ---- damage operations ----

    def lesion(self, mask: np.ndarray, mode: str = "random") -> None:
        if mode == "random":
            self.x[mask] = self.rng.random(np.count_nonzero(mask)).astype(np.float32)
        elif mode == "zero":
            self.x[mask] = 0.0
        elif mode == "one":
            self.x[mask] = 1.0
        else:
            raise ValueError("lesion mode must be {'random','zero','one'}")

    def freeze(self, mask: np.ndarray, on: bool = True) -> None:
        if on:
            self.freeze_mask |= mask
        else:
            self.freeze_mask &= ~mask

    def corrupt(self, mask: np.ndarray, on: bool = True) -> None:
        if on:
            self.corrupt_mask |= mask
        else:
            self.corrupt_mask &= ~mask

    # ---- quick metrics ----

    def synchrony(self) -> float:
        return float(1.0 - np.var(self.x))

    def neighbour_disagreement(self) -> float:
        right = np.abs(self.x - np.roll(self.x, -1, axis=1)).mean()
        down = np.abs(self.x - np.roll(self.x, -1, axis=0)).mean()
        return float(0.5 * (right + down))
