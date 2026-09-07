#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "transform"))

from reversible_cdf53 import (  # noqa: E402
    FormatError,
    decode_grid,
    decode_lossless,
    encode_grid,
    forward_1d,
    forward_2d,
    inverse_1d,
    inverse_2d,
    pack_lossless,
    reconstruct_with_zeroed_details,
    unpack_lossless,
)


class ReversibleCDF53Tests(unittest.TestCase):
    def test_one_dimensional_round_trip_for_odd_even_and_negative_values(self) -> None:
        rng = np.random.default_rng(20260907)
        for length in range(1, 34):
            for _ in range(20):
                source = rng.integers(-32768, 32768, size=length, dtype=np.int64)
                restored = inverse_1d(forward_1d(source))
                np.testing.assert_array_equal(restored, source)

    def test_two_dimensional_round_trip_for_varied_shapes(self) -> None:
        rng = np.random.default_rng(20260908)
        shapes = [(1, 1), (1, 9), (8, 1), (2, 2), (3, 5), (16, 17), (31, 32)]
        for shape in shapes:
            source = rng.integers(-32768, 32768, size=shape, dtype=np.int16)
            coefficients, level_shapes = forward_2d(source)
            restored = inverse_2d(coefficients, level_shapes)
            np.testing.assert_array_equal(restored, source.astype(np.int64))

    def test_level_limit_round_trip(self) -> None:
        rng = np.random.default_rng(20260909)
        source = rng.integers(-2000, 5000, size=(19, 27), dtype=np.int16)
        _, all_level_shapes = forward_2d(source)
        for levels in range(0, len(all_level_shapes) + 3):
            coefficients, level_shapes = forward_2d(source, levels=levels)
            self.assertEqual(len(level_shapes), min(levels, len(all_level_shapes)))
            restored = inverse_2d(coefficients, level_shapes)
            np.testing.assert_array_equal(restored, source.astype(np.int64))

    def test_nodata_mask_is_preserved_exactly(self) -> None:
        source = np.array(
            [
                [-32768, 10, 11, 12, 13],
                [20, 21, -32768, 23, 24],
                [30, 31, 32, 33, -32768],
            ],
            dtype=np.int16,
        )
        encoded = encode_grid(source, nodata=-32768)
        restored = decode_grid(encoded)
        self.assertEqual(restored.dtype, source.dtype)
        np.testing.assert_array_equal(restored, source)
        np.testing.assert_array_equal(restored == -32768, source == -32768)

    def test_container_round_trip_and_integrity(self) -> None:
        rng = np.random.default_rng(20260910)
        source = rng.integers(-400, 2400, size=(37, 29), dtype=np.int16)
        source[::7, ::5] = -32768
        blob = pack_lossless(encode_grid(source), compression_level=9)
        restored = decode_lossless(blob)
        np.testing.assert_array_equal(restored, source)

        parsed = unpack_lossless(blob)
        np.testing.assert_array_equal(parsed.nodata_mask, source == -32768)

        corrupted = bytearray(blob)
        corrupted[-1] ^= 0x01
        with self.assertRaises(FormatError):
            decode_lossless(corrupted)

    def test_zeroing_detail_level_keeps_nodata_identity(self) -> None:
        y, x = np.mgrid[:35, :33]
        source = np.rint(800 + 4 * x + 3 * y + 25 * np.sin(x / 3)).astype(np.int16)
        source[4:8, 9:12] = -32768
        encoded = encode_grid(source)
        approximate = reconstruct_with_zeroed_details(encoded, [0])
        np.testing.assert_array_equal(approximate == -32768, source == -32768)
        self.assertFalse(np.array_equal(approximate, source))

    def test_full_int16_extremes_round_trip_without_intermediate_overflow(self) -> None:
        source = np.array(
            [
                [-32767, 32767, -32767, 32767, -32767],
                [32767, -32767, 32767, -32767, 32767],
                [-32767, 32767, 0, 32767, -32767],
            ],
            dtype=np.int16,
        )
        restored = decode_lossless(pack_lossless(encode_grid(source)))
        np.testing.assert_array_equal(restored, source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
