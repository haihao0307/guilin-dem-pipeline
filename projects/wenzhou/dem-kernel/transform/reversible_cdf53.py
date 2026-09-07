#!/usr/bin/env python3
"""Reversible integer CDF 5/3 transform for the Wenzhou DEM kernel R1.

This module is deliberately independent of the existing V0.6.0 pyramid.  It
implements an integer-to-integer lifting transform, a compact lossless container,
and controlled partial-band reconstruction.  It never changes georeferencing or
claims that a mathematical self-test is a real Wenzhou DEM validation.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import struct
import zlib
from typing import Any, Iterable, Sequence

import numpy as np

MAGIC = b"WZDEM53R1\n"
_HEADER_LENGTH = struct.Struct("<I")
_SUPPORTED_SOURCE_DTYPES = {
    np.dtype("int8"),
    np.dtype("int16"),
    np.dtype("int32"),
    np.dtype("int64"),
}
_DTYPE_CODE_TO_NUMPY = {
    "i1": np.dtype("<i1"),
    "i2": np.dtype("<i2"),
    "i4": np.dtype("<i4"),
    "i8": np.dtype("<i8"),
}


class FormatError(ValueError):
    """Raised when a WZDEM53R1 container is malformed or fails integrity checks."""


@dataclass(frozen=True)
class EncodedGrid:
    """In-memory reversible transform state before entropy coding."""

    coefficients: np.ndarray
    nodata_mask: np.ndarray
    level_shapes: tuple[tuple[int, int], ...]
    source_dtype: str
    nodata: int

    @property
    def shape(self) -> tuple[int, int]:
        return tuple(int(value) for value in self.coefficients.shape)


def _require_integer_vector(values: np.ndarray | Sequence[int]) -> np.ndarray:
    vector = np.asarray(values)
    if vector.ndim != 1:
        raise ValueError(f"expected one-dimensional input, got shape={vector.shape}")
    if not np.issubdtype(vector.dtype, np.integer):
        raise TypeError(f"integer input required, got dtype={vector.dtype}")
    return vector.astype(np.int64, copy=True)


def forward_1d(values: np.ndarray | Sequence[int]) -> np.ndarray:
    """Apply one reversible CDF 5/3 lifting step to one integer vector.

    Low-pass coefficients are stored first, followed by high-pass coefficients.
    Symmetric boundary extension follows the JPEG 2000 reversible 5/3 convention.
    Intermediate arithmetic is int64 to avoid int16 overflow.
    """

    source = _require_integer_vector(values)
    length = int(source.size)
    if length < 2:
        return source

    low = source[0::2].copy()
    high = source[1::2].copy()
    low_count = int(low.size)
    high_count = int(high.size)

    # Predict odd samples from their even neighbours.
    right_low = np.empty(high_count, dtype=np.int64)
    if high_count > 1:
        right_low[:-1] = low[1:high_count]
    right_low[-1] = low[high_count] if high_count < low_count else low[-1]
    high -= (low[:high_count] + right_low) // 2

    # Update even samples from adjacent detail coefficients.
    left_detail = np.empty(low_count, dtype=np.int64)
    right_detail = np.empty(low_count, dtype=np.int64)
    left_detail[0] = high[0]
    if low_count > 1:
        left_detail[1:] = high[: low_count - 1]
    right_detail[:high_count] = high
    if low_count > high_count:
        right_detail[high_count:] = high[-1]
    low += (left_detail + right_detail + 2) // 4

    return np.concatenate((low, high))


def inverse_1d(coefficients: np.ndarray | Sequence[int]) -> np.ndarray:
    """Invert :func:`forward_1d` exactly."""

    source = _require_integer_vector(coefficients)
    length = int(source.size)
    if length < 2:
        return source

    low_count = (length + 1) // 2
    high_count = length // 2
    low = source[:low_count].copy()
    high = source[low_count:].copy()

    # Undo update before undoing prediction.
    left_detail = np.empty(low_count, dtype=np.int64)
    right_detail = np.empty(low_count, dtype=np.int64)
    left_detail[0] = high[0]
    if low_count > 1:
        left_detail[1:] = high[: low_count - 1]
    right_detail[:high_count] = high
    if low_count > high_count:
        right_detail[high_count:] = high[-1]
    low -= (left_detail + right_detail + 2) // 4

    right_low = np.empty(high_count, dtype=np.int64)
    if high_count > 1:
        right_low[:-1] = low[1:high_count]
    right_low[-1] = low[high_count] if high_count < low_count else low[-1]
    high += (low[:high_count] + right_low) // 2

    restored = np.empty(length, dtype=np.int64)
    restored[0::2] = low
    restored[1::2] = high
    return restored


def _validate_grid(values: np.ndarray | Sequence[Sequence[int]]) -> np.ndarray:
    grid = np.asarray(values)
    if grid.ndim != 2:
        raise ValueError(f"expected a two-dimensional grid, got shape={grid.shape}")
    if grid.shape[0] < 1 or grid.shape[1] < 1:
        raise ValueError(f"empty dimensions are unsupported: shape={grid.shape}")
    if not np.issubdtype(grid.dtype, np.integer):
        raise TypeError(f"integer DEM input required, got dtype={grid.dtype}")
    if np.dtype(grid.dtype) not in _SUPPORTED_SOURCE_DTYPES:
        raise TypeError(f"unsupported source dtype={grid.dtype}")
    return grid


def forward_2d(
    values: np.ndarray | Sequence[Sequence[int]],
    levels: int | None = None,
) -> tuple[np.ndarray, tuple[tuple[int, int], ...]]:
    """Apply a separable multilevel reversible CDF 5/3 transform.

    The returned ``level_shapes`` records the active rectangle before each
    transform level and is required for exact inverse reconstruction.
    """

    grid = _validate_grid(values).astype(np.int64, copy=True)
    height, width = (int(grid.shape[0]), int(grid.shape[1]))
    if levels is not None and levels < 0:
        raise ValueError("levels must be non-negative or None")

    shapes: list[tuple[int, int]] = []
    level_index = 0
    active_height, active_width = height, width

    while active_height > 1 or active_width > 1:
        if levels is not None and level_index >= levels:
            break
        shapes.append((active_height, active_width))

        if active_width > 1:
            for row in range(active_height):
                grid[row, :active_width] = forward_1d(grid[row, :active_width])

        if active_height > 1:
            for column in range(active_width):
                grid[:active_height, column] = forward_1d(
                    grid[:active_height, column]
                )

        active_height = (active_height + 1) // 2
        active_width = (active_width + 1) // 2
        level_index += 1

    return grid, tuple(shapes)


def inverse_2d(
    coefficients: np.ndarray | Sequence[Sequence[int]],
    level_shapes: Iterable[Sequence[int]],
) -> np.ndarray:
    """Invert :func:`forward_2d` exactly."""

    grid = _validate_grid(coefficients).astype(np.int64, copy=True)
    shapes = tuple((int(shape[0]), int(shape[1])) for shape in level_shapes)

    for active_height, active_width in reversed(shapes):
        if active_height < 1 or active_width < 1:
            raise ValueError(f"invalid level shape {(active_height, active_width)}")
        if active_height > grid.shape[0] or active_width > grid.shape[1]:
            raise ValueError(
                f"level shape {(active_height, active_width)} exceeds grid {grid.shape}"
            )

        # Forward order is rows then columns; inverse order is columns then rows.
        if active_height > 1:
            for column in range(active_width):
                grid[:active_height, column] = inverse_1d(
                    grid[:active_height, column]
                )

        if active_width > 1:
            for row in range(active_height):
                grid[row, :active_width] = inverse_1d(grid[row, :active_width])

    return grid


def encode_grid(
    values: np.ndarray | Sequence[Sequence[int]],
    *,
    nodata: int = -32768,
    levels: int | None = None,
) -> EncodedGrid:
    """Transform a DEM while preserving NoData as a separate semantic mask.

    NoData samples are replaced by zero before the transform and restored from a
    bit mask after inverse reconstruction.  This prevents the sentinel value from
    contaminating neighbouring coefficients while preserving the exact input
    sample grid, including every NoData location.
    """

    source = _validate_grid(values)
    nodata_value = int(nodata)
    mask = source == nodata_value
    working = source.astype(np.int64, copy=True)
    working[mask] = 0
    coefficients, level_shapes = forward_2d(working, levels=levels)
    return EncodedGrid(
        coefficients=coefficients,
        nodata_mask=mask.astype(np.bool_, copy=False),
        level_shapes=level_shapes,
        source_dtype=np.dtype(source.dtype).str,
        nodata=nodata_value,
    )


def decode_grid(encoded: EncodedGrid) -> np.ndarray:
    """Decode an :class:`EncodedGrid` and restore source dtype and NoData."""

    restored = inverse_2d(encoded.coefficients, encoded.level_shapes)
    source_dtype = np.dtype(encoded.source_dtype)
    limits = np.iinfo(source_dtype)
    if restored.size:
        valid = ~encoded.nodata_mask
        if np.any(valid):
            minimum = int(restored[valid].min())
            maximum = int(restored[valid].max())
            if minimum < limits.min or maximum > limits.max:
                raise OverflowError(
                    f"decoded valid range [{minimum}, {maximum}] exceeds {source_dtype}"
                )
    restored[encoded.nodata_mask] = encoded.nodata
    return restored.astype(source_dtype, copy=False)


def _smallest_signed_dtype(values: np.ndarray) -> np.dtype:
    minimum = int(values.min()) if values.size else 0
    maximum = int(values.max()) if values.size else 0
    for dtype in (np.dtype("<i1"), np.dtype("<i2"), np.dtype("<i4"), np.dtype("<i8")):
        limits = np.iinfo(dtype)
        if minimum >= limits.min and maximum <= limits.max:
            return dtype
    raise OverflowError(f"coefficient range [{minimum}, {maximum}] exceeds int64")


def _dtype_code(dtype: np.dtype) -> str:
    dtype = np.dtype(dtype).newbyteorder("<")
    for code, candidate in _DTYPE_CODE_TO_NUMPY.items():
        if dtype == candidate:
            return code
    raise TypeError(f"unsupported coefficient dtype {dtype}")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pack_lossless(encoded: EncodedGrid, *, compression_level: int = 9) -> bytes:
    """Serialize transformed coefficients and NoData mask into a lossless blob."""

    if not 0 <= compression_level <= 9:
        raise ValueError("compression_level must be in range 0..9")

    coefficient_dtype = _smallest_signed_dtype(encoded.coefficients)
    coefficient_raw = encoded.coefficients.astype(
        coefficient_dtype, copy=False
    ).tobytes(order="C")
    mask_raw = np.packbits(
        encoded.nodata_mask.reshape(-1).astype(np.uint8), bitorder="little"
    ).tobytes()
    coefficient_payload = zlib.compress(coefficient_raw, level=compression_level)
    mask_payload = zlib.compress(mask_raw, level=compression_level)

    header: dict[str, Any] = {
        "schema": "wenzhou-dem-cdf53-container/v1",
        "shape": [int(encoded.shape[0]), int(encoded.shape[1])],
        "sourceDtype": encoded.source_dtype,
        "coefficientDtype": _dtype_code(coefficient_dtype),
        "nodata": int(encoded.nodata),
        "levelShapes": [list(shape) for shape in encoded.level_shapes],
        "coefficientRawBytes": len(coefficient_raw),
        "coefficientPayloadBytes": len(coefficient_payload),
        "coefficientRawSha256": _sha256(coefficient_raw),
        "coefficientPayloadSha256": _sha256(coefficient_payload),
        "maskRawBytes": len(mask_raw),
        "maskPayloadBytes": len(mask_payload),
        "maskRawSha256": _sha256(mask_raw),
        "maskPayloadSha256": _sha256(mask_payload),
        "compression": "zlib",
        "compressionLevel": int(compression_level),
        "transform": "reversible_integer_cdf_5_3_lifting",
        "nodataPolicy": "separate_bit_mask_and_zero_fill_before_transform",
    }
    header_bytes = json.dumps(
        header, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return (
        MAGIC
        + _HEADER_LENGTH.pack(len(header_bytes))
        + header_bytes
        + coefficient_payload
        + mask_payload
    )


def unpack_lossless(blob: bytes | bytearray | memoryview) -> EncodedGrid:
    """Parse and integrity-check a :func:`pack_lossless` container."""

    payload = bytes(blob)
    minimum_size = len(MAGIC) + _HEADER_LENGTH.size
    if len(payload) < minimum_size or not payload.startswith(MAGIC):
        raise FormatError("missing or invalid WZDEM53R1 magic")

    header_offset = len(MAGIC)
    (header_length,) = _HEADER_LENGTH.unpack_from(payload, header_offset)
    header_start = header_offset + _HEADER_LENGTH.size
    header_end = header_start + int(header_length)
    if header_end > len(payload):
        raise FormatError("truncated JSON header")

    try:
        header = json.loads(payload[header_start:header_end].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FormatError(f"invalid JSON header: {exc}") from exc

    if header.get("schema") != "wenzhou-dem-cdf53-container/v1":
        raise FormatError(f"unsupported schema {header.get('schema')!r}")
    if header.get("compression") != "zlib":
        raise FormatError(f"unsupported compression {header.get('compression')!r}")

    coefficient_size = int(header["coefficientPayloadBytes"])
    mask_size = int(header["maskPayloadBytes"])
    coefficient_start = header_end
    coefficient_end = coefficient_start + coefficient_size
    mask_end = coefficient_end + mask_size
    if mask_end != len(payload):
        raise FormatError(
            f"payload length mismatch: expected {mask_end}, actual {len(payload)}"
        )

    coefficient_payload = payload[coefficient_start:coefficient_end]
    mask_payload = payload[coefficient_end:mask_end]
    if _sha256(coefficient_payload) != header["coefficientPayloadSha256"]:
        raise FormatError("coefficient payload SHA256 mismatch")
    if _sha256(mask_payload) != header["maskPayloadSha256"]:
        raise FormatError("mask payload SHA256 mismatch")

    try:
        coefficient_raw = zlib.decompress(coefficient_payload)
        mask_raw = zlib.decompress(mask_payload)
    except zlib.error as exc:
        raise FormatError(f"zlib decompression failed: {exc}") from exc

    if len(coefficient_raw) != int(header["coefficientRawBytes"]):
        raise FormatError("coefficient raw length mismatch")
    if len(mask_raw) != int(header["maskRawBytes"]):
        raise FormatError("mask raw length mismatch")
    if _sha256(coefficient_raw) != header["coefficientRawSha256"]:
        raise FormatError("coefficient raw SHA256 mismatch")
    if _sha256(mask_raw) != header["maskRawSha256"]:
        raise FormatError("mask raw SHA256 mismatch")

    shape = tuple(int(value) for value in header["shape"])
    if len(shape) != 2 or shape[0] < 1 or shape[1] < 1:
        raise FormatError(f"invalid shape {shape}")
    coefficient_dtype = _DTYPE_CODE_TO_NUMPY.get(header["coefficientDtype"])
    if coefficient_dtype is None:
        raise FormatError(
            f"unsupported coefficient dtype {header['coefficientDtype']!r}"
        )
    expected_coefficient_values = shape[0] * shape[1]
    coefficients = np.frombuffer(coefficient_raw, dtype=coefficient_dtype)
    if coefficients.size != expected_coefficient_values:
        raise FormatError(
            "coefficient count mismatch: "
            f"expected {expected_coefficient_values}, actual {coefficients.size}"
        )
    coefficients = coefficients.astype(np.int64).reshape(shape)

    mask_bits = np.unpackbits(
        np.frombuffer(mask_raw, dtype=np.uint8), bitorder="little"
    )
    expected_mask_bits = expected_coefficient_values
    if mask_bits.size < expected_mask_bits:
        raise FormatError("NoData mask is truncated")
    nodata_mask = mask_bits[:expected_mask_bits].astype(np.bool_).reshape(shape)

    source_dtype = np.dtype(header["sourceDtype"])
    if source_dtype not in _SUPPORTED_SOURCE_DTYPES:
        raise FormatError(f"unsupported source dtype {source_dtype}")
    level_shapes = tuple(
        (int(shape_pair[0]), int(shape_pair[1]))
        for shape_pair in header["levelShapes"]
    )

    return EncodedGrid(
        coefficients=coefficients,
        nodata_mask=nodata_mask,
        level_shapes=level_shapes,
        source_dtype=source_dtype.str,
        nodata=int(header["nodata"]),
    )


def decode_lossless(blob: bytes | bytearray | memoryview) -> np.ndarray:
    """Convenience function to unpack and exactly reconstruct one DEM grid."""

    return decode_grid(unpack_lossless(blob))


def zero_detail_levels(
    coefficients: np.ndarray,
    level_shapes: Sequence[Sequence[int]],
    levels_to_zero: Iterable[int],
) -> np.ndarray:
    """Return a coefficient copy with selected detail-band rectangles set to zero.

    Level ``0`` is the finest transform level.  This function supports controlled
    observation reconstruction experiments.  It does not mutate the canonical
    transform state.
    """

    result = np.asarray(coefficients, dtype=np.int64).copy()
    selected = {int(level) for level in levels_to_zero}
    shapes = tuple((int(shape[0]), int(shape[1])) for shape in level_shapes)

    invalid = sorted(level for level in selected if level < 0 or level >= len(shapes))
    if invalid:
        raise ValueError(f"detail level indices out of range: {invalid}")

    for level_index, (height, width) in enumerate(shapes):
        if level_index not in selected:
            continue
        low_height = (height + 1) // 2
        low_width = (width + 1) // 2
        # HL: low rows, high columns.
        if low_width < width:
            result[:low_height, low_width:width] = 0
        # LH and HH: all columns in the high-row region.
        if low_height < height:
            result[low_height:height, :width] = 0
    return result


def reconstruct_with_zeroed_details(
    encoded: EncodedGrid,
    levels_to_zero: Iterable[int],
) -> np.ndarray:
    """Reconstruct an observation grid after removing selected detail bands."""

    filtered = EncodedGrid(
        coefficients=zero_detail_levels(
            encoded.coefficients, encoded.level_shapes, levels_to_zero
        ),
        nodata_mask=encoded.nodata_mask,
        level_shapes=encoded.level_shapes,
        source_dtype=encoded.source_dtype,
        nodata=encoded.nodata,
    )
    return decode_grid(filtered)


__all__ = [
    "EncodedGrid",
    "FormatError",
    "MAGIC",
    "decode_grid",
    "decode_lossless",
    "encode_grid",
    "forward_1d",
    "forward_2d",
    "inverse_1d",
    "inverse_2d",
    "pack_lossless",
    "reconstruct_with_zeroed_details",
    "unpack_lossless",
    "zero_detail_levels",
]
