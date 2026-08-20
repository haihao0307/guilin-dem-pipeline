from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.transform import from_origin

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = PACKAGE_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import asf_download_stdlib as downloader
import mosaic_dem
from build_boundary_stdlib import assemble_segments, common_edge_segments, vincenty_direct
from common import read_json, write_json


class PipelineTests(unittest.TestCase):
    def test_north_limit_is_stable(self) -> None:
        lon, lat = vincenty_direct(110.82528, 26.13556, 0.0, 15000.0)
        self.assertAlmostEqual(lon, 110.82528, places=9)
        self.assertAlmostEqual(lat, 26.270949917691137, places=9)

    def test_boundary_common_edges_form_single_chain(self) -> None:
        nodes = {
            1: (110.0, 24.5),
            2: (110.1, 24.55),
            3: (110.2, 24.52),
            4: (110.3, 24.57),
            5: (109.9, 24.6),
            6: (110.4, 24.6),
        }
        ways = {10: [5, 1, 2, 3, 4], 20: [1, 2, 3, 4, 6]}
        segments = common_edge_segments([10], [20], ways, nodes)
        chain, count = assemble_segments(segments)
        self.assertEqual(count, 1)
        self.assertEqual({chain[0], chain[-1]}, {nodes[1], nodes[4]})

    def test_downloader_rejects_provisional_boundary(self) -> None:
        with tempfile.TemporaryDirectory(prefix="dem_boundary_guard_") as temporary:
            root = Path(temporary)
            (root / "config").mkdir(parents=True)
            (root / "metadata").mkdir(parents=True)
            config = read_json(PACKAGE_ROOT / "config" / "task_config.json")
            config_path = root / "config" / "task_config.json"
            write_json(config_path, config)
            shutil.copy2(PACKAGE_ROOT / "config" / "existing_five_manifest.json", root / "config" / "existing_five_manifest.json")
            write_json(
                root / config["outputs"]["resolvedAoiJson"],
                {
                    "status": "provisional_offline_preview",
                    "final": {"wgs84Polygon": [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]},
                    "search": {"envelopeWkt": "POLYGON((0 0,1 0,1 1,0 1,0 0))"},
                },
            )
            fixture = root / "fixture.json"
            write_json(fixture, {"results": [{"gn": "X", "w": "POLYGON((0 0,1 0,1 1,0 1,0 0))"}]})
            with self.assertRaises(downloader.PipelineError):
                downloader.run(config_path, root, fixture, True)

    def test_incremental_selector_reuses_existing_coverage(self) -> None:
        target = [(0, 0), (2, 0), (2, 2), (0, 2), (0, 0)]
        existing = [[(0, 0), (1, 0), (1, 2), (0, 2), (0, 0)]]
        results = [
            {
                "p": 1,
                "f": 1,
                "gn": "NEW_A",
                "w": "POLYGON((1 0,2 0,2 1,1 1,1 0))",
                "additionalUrls": ["https://example.org/NEW_A.dem.tif"],
            },
            {
                "p": 1,
                "f": 2,
                "gn": "NEW_B",
                "w": "POLYGON((1 1,2 1,2 2,1 2,1 1))",
                "additionalUrls": ["https://example.org/NEW_B.dem.tif"],
            },
            {
                "p": 1,
                "f": 3,
                "gn": "OLD_TILE",
                "w": "POLYGON((0 0,1 0,1 2,0 2,0 0))",
                "additionalUrls": ["https://example.org/OLD_TILE.dem.tif"],
            },
        ]
        selected, diagnostics = downloader.select_products(
            results,
            target,
            existing,
            {"old_tile"},
            target_fraction=0.99,
            max_selected=5,
            grid_size=40,
        )
        self.assertEqual([downloader.granule_name(item.item) for item in selected], ["NEW_A", "NEW_B"])
        self.assertGreaterEqual(diagnostics["existingCoverageFraction"], 0.49)
        self.assertGreaterEqual(diagnostics["selectedCoverageFraction"], 0.99)

    def test_synthetic_mosaic_and_cog(self) -> None:
        with tempfile.TemporaryDirectory(prefix="dem_pipeline_test_") as temporary:
            root = Path(temporary)
            (root / "config").mkdir(parents=True)
            (root / "metadata").mkdir(parents=True)
            (root / "data" / "raw" / "dem").mkdir(parents=True)
            (root / "outputs").mkdir(parents=True)
            (root / "reports").mkdir(parents=True)

            config = read_json(PACKAGE_ROOT / "config" / "task_config.json")
            config["processing"]["blockSize"] = 128
            config["processing"]["fillSmallGaps"] = False
            config["processing"]["minimumValidFraction"] = 0.999
            config["processing"]["overviewLevels"] = [2, 4]
            config_path = root / "config" / "task_config.json"
            write_json(config_path, config)

            crs = "EPSG:32649"
            resolution = 12.5
            x0 = 400000.0
            top = 2800800.0
            source1 = root / "source1.dem.tif"
            source2 = root / "source2.dem.tif"
            profile = {
                "driver": "GTiff",
                "width": 64,
                "height": 64,
                "count": 1,
                "dtype": "int16",
                "crs": crs,
                "nodata": 0,
                "tiled": True,
                "blockxsize": 32,
                "blockysize": 32,
                "compress": "DEFLATE",
            }
            with rasterio.open(source1, "w", transform=from_origin(x0, top, resolution, resolution), **profile) as dataset:
                dataset.write(np.full((64, 64), 100, dtype=np.int16), 1)
            with rasterio.open(source2, "w", transform=from_origin(x0 + 400, top, resolution, resolution), **profile) as dataset:
                dataset.write(np.full((64, 64), 200, dtype=np.int16), 1)

            to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
            utm_ring = [
                (x0, top - 800),
                (x0 + 1200, top - 800),
                (x0 + 1200, top),
                (x0, top),
                (x0, top - 800),
            ]
            wgs_ring = [to_wgs.transform(x, y) for x, y in utm_ring]
            resolved = {
                "status": "exact_boundary_resolved",
                "final": {"wgs84Polygon": [[x, y] for x, y in wgs_ring]},
                "search": {"envelopeWkt": "POLYGON EMPTY"},
            }
            write_json(root / config["outputs"]["resolvedAoiJson"], resolved)
            write_json(
                root / config["outputs"]["existingResolved"],
                {
                    "status": "complete",
                    "files": [
                        {"file": source1.name, "resolvedPath": str(source1)},
                        {"file": source2.name, "resolvedPath": str(source2)},
                    ],
                },
            )

            result = mosaic_dem.run(config_path, root)
            self.assertEqual(result, 0)
            final_path = root / config["outputs"]["finalDem"]
            self.assertTrue(final_path.is_file())
            with rasterio.open(final_path) as dataset:
                self.assertEqual(dataset.crs.to_string(), crs)
                self.assertAlmostEqual(abs(dataset.transform.a), resolution)
                left = next(dataset.sample([(x0 + 200, top - 400)]))[0]
                overlap = next(dataset.sample([(x0 + 600, top - 400)]))[0]
                right = next(dataset.sample([(x0 + 1000, top - 400)]))[0]
                self.assertAlmostEqual(float(left), 100.0, places=2)
                self.assertAlmostEqual(float(overlap), 150.0, places=2)
                self.assertAlmostEqual(float(right), 200.0, places=2)
                self.assertEqual(dataset.tags(ns="IMAGE_STRUCTURE").get("LAYOUT"), "COG")


if __name__ == "__main__":
    unittest.main(verbosity=2)
