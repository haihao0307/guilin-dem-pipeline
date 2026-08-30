from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

import numpy as np


class CanonicalElevationStore:
    """Read pixel-exact Guilin elevation values from the uncompressed canonical shard store."""

    def __init__(self, manifest_path: Path):
        self.manifest_path = Path(manifest_path)
        self.root = self.manifest_path.parent
        self.manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        if self.manifest.get("schema") != "guilin-canonical-elevation-store/v1":
            raise ValueError("unsupported canonical elevation store")
        self.aoi_column, self.aoi_row, self.width, self.height = [int(value) for value in self.manifest["aoi"]["source_window"]]
        self.chunk_size = int(self.manifest["logical_chunks"]["chunk_grid_nominal"][0])
        self.chunk_rows = int(self.manifest["logical_chunks"]["matrix_rows"])
        self.chunk_columns = int(self.manifest["logical_chunks"]["matrix_columns"])
        self.nodata = int(self.manifest["spatial_reference"]["nodata"])
        self.spacing = float(self.manifest["spatial_reference"]["native_spacing_m"][0])
        bounds = [float(value) for value in self.manifest["aoi"]["source_sample_center_bounds_epsg32649"]]
        self.west_center, self.south_center, self.east_center, self.north_center = bounds
        self._chunks = {
            tuple(int(value) for value in chunk["matrix_index"]): chunk
            for chunk in self.manifest["chunks"]
        }
        self._memmaps: dict[str, np.memmap] = {}

    def close(self) -> None:
        self._memmaps.clear()

    def _shard(self, relative_path: str) -> np.memmap:
        result = self._memmaps.get(relative_path)
        if result is None:
            result = np.memmap(self.root / relative_path, dtype=np.uint8, mode="r")
            self._memmaps[relative_path] = result
        return result

    def _chunk_array(self, chunk: dict) -> np.ndarray:
        width, height = [int(value) for value in chunk["grid"]]
        offset = int(chunk["shard_byte_offset"])
        byte_count = int(chunk["bytes"])
        shard = self._shard(chunk["shard"])
        raw = shard[offset:offset + byte_count]
        return np.frombuffer(raw, dtype="<i2", count=width * height).reshape((height, width))

    def read_aoi_window(self, column: int, row: int, width: int, height: int) -> np.ndarray:
        column = int(column)
        row = int(row)
        width = int(width)
        height = int(height)
        if width <= 0 or height <= 0:
            raise ValueError("window dimensions must be positive")
        output = np.full((height, width), self.nodata, dtype="<i2")
        left = max(0, column)
        top = max(0, row)
        right = min(self.width, column + width)
        bottom = min(self.height, row + height)
        if left >= right or top >= bottom:
            return output
        first_chunk_column = left // self.chunk_size
        last_chunk_column = (right - 1) // self.chunk_size
        first_chunk_row = top // self.chunk_size
        last_chunk_row = (bottom - 1) // self.chunk_size
        for chunk_row in range(first_chunk_row, last_chunk_row + 1):
            for chunk_column in range(first_chunk_column, last_chunk_column + 1):
                chunk = self._chunks[(chunk_row, chunk_column)]
                chunk_values = self._chunk_array(chunk)
                chunk_left = chunk_column * self.chunk_size
                chunk_top = chunk_row * self.chunk_size
                source_left = max(left, chunk_left)
                source_top = max(top, chunk_top)
                source_right = min(right, chunk_left + chunk_values.shape[1])
                source_bottom = min(bottom, chunk_top + chunk_values.shape[0])
                output[
                    source_top - row:source_bottom - row,
                    source_left - column:source_right - column,
                ] = chunk_values[
                    source_top - chunk_top:source_bottom - chunk_top,
                    source_left - chunk_left:source_right - chunk_left,
                ]
        return output

    def read_source_window(self, column: int, row: int, width: int, height: int) -> np.ndarray:
        return self.read_aoi_window(column - self.aoi_column, row - self.aoi_row, width, height)

    def index(self, easting: float, northing: float) -> tuple[int, int]:
        column = int(math.floor((float(easting) - (self.west_center - self.spacing * 0.5)) / self.spacing))
        row = int(math.floor(((self.north_center + self.spacing * 0.5) - float(northing)) / self.spacing))
        return row + self.aoi_row, column + self.aoi_column

    def sample(self, coordinates: Iterable[tuple[float, float]], indexes: int = 1, masked: bool = True):
        if indexes != 1:
            raise ValueError("canonical store has one band")
        for easting, northing in coordinates:
            global_row, global_column = self.index(easting, northing)
            value = self.read_source_window(global_column, global_row, 1, 1)[0, 0]
            invalid = int(value) == self.nodata
            if masked:
                yield np.ma.array([value], mask=[invalid])
            else:
                yield np.asarray([value], dtype="<i2")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
        return False
