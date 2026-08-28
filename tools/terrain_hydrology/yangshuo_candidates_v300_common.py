"""Shared fail-closed helpers for Yangshuo Lijiang candidate extraction v3.0."""
from __future__ import annotations

import hashlib, json, math
from pathlib import Path
from typing import Any

SCHEMA = "guilin-yangshuo-candidate-windows/v3.0.0"
GRID = [2048, 2048]
SPACING = 12.5
EXTENT = 25_600.0
AREA = 655.36
IDS = {"A", "B", "C", "D"}

class ValidationError(RuntimeError):
    pass

def load(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"Cannot read valid JSON: {path}: {exc}") from exc

def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()

def need(ok: bool, message: str) -> None:
    if not ok:
        raise ValidationError(message)

def close(actual: Any, expected: float, label: str) -> None:
    need(math.isclose(float(actual), expected, rel_tol=0, abs_tol=1e-6), f"{label}: expected {expected}, got {actual}")

def raster_bounds(transform: list[float], grid: list[int]) -> list[float]:
    need(len(transform) == 6 and len(grid) == 2, "Invalid source transform or grid")
    x0, dx, rx, y0, ry, dy = map(float, transform); width, height = map(int, grid)
    need(abs(rx) < 1e-9 and abs(ry) < 1e-9 and dx > 0 and dy < 0, "Source must be north-up and unrotated")
    return [x0, y0 + height * dy, x0 + width * dx, y0]

def window_bounds(transform: list[float], pixel_window: list[int]) -> list[float]:
    need(len(pixel_window) == 4, "pixelWindow must contain x, y, width and height")
    x, y, width, height = map(int, pixel_window); x0, dx, rx, y0, ry, dy = map(float, transform)
    need(abs(rx) < 1e-9 and abs(ry) < 1e-9, "Rotated source is prohibited")
    min_x, max_y = x0 + x * dx, y0 + y * dy
    return [min_x, max_y + height * dy, min_x + width * dx, max_y]

def bounds_center(bounds: list[float]) -> list[float]:
    min_x, min_y, max_x, max_y = map(float, bounds)
    return [(min_x + max_x) / 2, (min_y + max_y) / 2]

def same_numbers(actual: list[Any], expected: list[Any], label: str) -> None:
    need(len(actual) == len(expected), f"{label}: length mismatch")
    for index, value in enumerate(expected):
        close(actual[index], float(value), f"{label}[{index}]")
