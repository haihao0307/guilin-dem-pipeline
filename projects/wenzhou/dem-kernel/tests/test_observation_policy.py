#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path
import unittest

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
for location in (ROOT / "runtime", ROOT / "transform"):
    sys.path.insert(0, str(location))

from observation_policy import (  # noqa: E402
    PrecisionRequest,
    PrecisionRequestError,
    reconstruct_for_request,
    select_visible_bands,
    select_visible_bands_from_dict,
)
from reversible_cdf53 import encode_grid  # noqa: E402


class ObservationPolicyTests(unittest.TestCase):
    def test_dyadic_band_mapping_is_monotonic(self) -> None:
        expectations = {
            12.5: (),
            24.999: (),
            25.0: (0,),
            49.999: (0,),
            50.0: (0, 1),
            100.0: (0, 1, 2),
            800.0: (0, 1, 2, 3, 4, 5),
        }
        for governing_spacing, expected in expectations.items():
            request = PrecisionRequest(
                pixel_footprint_m=governing_spacing,
                visual_error_fraction=1.0,
            )
            selection = select_visible_bands(
                request, available_detail_levels=6
            )
            self.assertEqual(selection.zero_detail_levels, expected)

    def test_strictest_domain_request_governs(self) -> None:
        request = PrecisionRequest(
            pixel_footprint_m=160.0,
            physics_spacing_m=25.0,
            interaction_spacing_m=50.0,
            story_spacing_m=100.0,
            safety_spacing_m=200.0,
            task="collision",
        )
        selection = select_visible_bands(request, available_detail_levels=8)
        self.assertEqual(selection.governing_domain, "physics")
        self.assertEqual(selection.governing_spacing_m, 25.0)
        self.assertEqual(selection.zero_detail_levels, (0,))
        self.assertEqual(selection.selected_nominal_spacing_m, 25.0)

    def test_force_truth_disables_band_removal(self) -> None:
        request = PrecisionRequest(
            pixel_footprint_m=5000.0,
            force_truth=True,
            task="anchor_qa",
        )
        selection = select_visible_bands(request, available_detail_levels=10)
        self.assertEqual(selection.zero_detail_levels, ())
        self.assertEqual(selection.governing_domain, "force_truth")
        self.assertEqual(selection.selected_nominal_spacing_m, 12.5)

    def test_far_reconstruction_without_nodata_can_drop_fine_bands(self) -> None:
        y, x = np.mgrid[:65, :67]
        source = np.rint(200 + x * 2.0 + y * 1.3 + 8 * np.sin(x / 2)).astype(
            np.int16
        )
        encoded = encode_grid(source)
        far, selection = reconstruct_for_request(
            encoded, PrecisionRequest(pixel_footprint_m=160.0)
        )
        self.assertEqual(selection.zero_detail_levels, (0, 1))
        self.assertFalse(selection.nodata_guarded)
        self.assertFalse(np.array_equal(far, source))

    def test_nodata_tile_forces_truth_until_mask_aware_filter_exists(self) -> None:
        y, x = np.mgrid[:65, :67]
        source = np.rint(200 + x * 2.0 + y * 1.3 + 8 * np.sin(x / 2)).astype(
            np.int16
        )
        source[5:10, 11:15] = -32768
        encoded = encode_grid(source)
        reconstructed, selection = reconstruct_for_request(
            encoded, PrecisionRequest(pixel_footprint_m=160.0)
        )
        self.assertTrue(selection.nodata_guarded)
        self.assertEqual(selection.governing_domain, "nodata_guard")
        self.assertEqual(selection.zero_detail_levels, ())
        np.testing.assert_array_equal(reconstructed, source)

    def test_interaction_request_can_restore_truth(self) -> None:
        y, x = np.mgrid[:33, :35]
        source = np.rint(100 + x + y + 3 * np.sin(x)).astype(np.int16)
        encoded = encode_grid(source)
        interaction, selection = reconstruct_for_request(
            encoded,
            PrecisionRequest(
                pixel_footprint_m=160.0,
                interaction_spacing_m=12.5,
            ),
        )
        self.assertEqual(selection.zero_detail_levels, ())
        np.testing.assert_array_equal(interaction, source)

    def test_json_wrapper_rejects_unknown_fields(self) -> None:
        with self.assertRaises(PrecisionRequestError):
            select_visible_bands_from_dict(
                {"pixel_footprint_m": 50.0, "camera_changes_truth": True},
                available_detail_levels=5,
            )

    def test_invalid_units_are_rejected(self) -> None:
        invalid_requests = [
            PrecisionRequest(pixel_footprint_m=0.0),
            PrecisionRequest(pixel_footprint_m=float("nan")),
            PrecisionRequest(pixel_footprint_m=10.0, visual_error_fraction=1.1),
            PrecisionRequest(pixel_footprint_m=10.0, physics_spacing_m=-1.0),
            PrecisionRequest(pixel_footprint_m=10.0, task=""),
        ]
        for request in invalid_requests:
            with self.assertRaises(PrecisionRequestError):
                select_visible_bands(request, available_detail_levels=4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
