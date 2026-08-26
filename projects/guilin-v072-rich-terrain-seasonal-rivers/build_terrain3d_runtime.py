from __future__ import annotations

import math

import numpy as np

import build_terrain3d as core


def box_blur(field: np.ndarray, radius: int) -> np.ndarray:
    radius = max(1, int(radius))
    kernel = radius * 2 + 1
    padded = np.pad(field.astype(np.float32), ((radius, radius), (radius, radius)), mode="edge")
    integral = np.pad(padded, ((1, 0), (1, 0)), mode="constant").cumsum(axis=0).cumsum(axis=1)
    total = (
        integral[kernel:, kernel:]
        - integral[:-kernel, kernel:]
        - integral[kernel:, :-kernel]
        + integral[:-kernel, :-kernel]
    )
    return (total / float(kernel * kernel)).astype(np.float32)


def gaussian_blur(field: np.ndarray, radius: float) -> np.ndarray:
    pass_radius = max(1, int(round(radius / math.sqrt(3.0))))
    result = field.astype(np.float32)
    for _ in range(3):
        result = box_blur(result, pass_radius)
    return result


core.gaussian_blur = gaussian_blur

if __name__ == "__main__":
    raise SystemExit(core.main())
