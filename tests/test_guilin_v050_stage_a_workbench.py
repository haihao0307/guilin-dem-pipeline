from __future__ import annotations

import json
import hashlib
import re
import subprocess
import sys
import tempfile
import unittest
from array import array
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "guilin-v050"
CORE_ASSETS = WEB / "assets" / "cores"
RELEASE_GATE = ROOT / "projects" / "guilin" / "config" / "release_gate_v050.json"

CORE_IDS = (
    "zhenbao-ding",
    "guilin-old-city",
    "yangtang-airfield",
    "yangshuo-county-seat",
)
SEASONS = {"spring", "summer", "autumn", "winter"}
WORKER_STATES = {
    "unavailable",
    "idle",
    "checking",
    "ready",
    "building",
    "succeeded",
    "failed",
    "cancelled",
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(read_text(path))


def first_number(mapping: dict, *keys: str) -> float:
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
    raise AssertionError(f"missing numeric field; expected one of {keys}")


def first_value(mapping: dict, *keys: str):
    for key in keys:
        if key in mapping:
            return mapping[key]
    raise AssertionError(f"missing field; expected one of {keys}")


def flatten_strings(value) -> set[str]:
    values: set[str] = set()
    if isinstance(value, str):
        values.add(value.lower())
    elif isinstance(value, dict):
        for key, item in value.items():
            values.add(str(key).lower())
            values.update(flatten_strings(item))
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            values.update(flatten_strings(item))
    return values


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def little_endian_u16(path: Path) -> array:
    values = array("H")
    values.frombytes(path.read_bytes())
    if sys.byteorder != "little":
        values.byteswap()
    return values


def run_node_contract(modules: list[Path], contract: str) -> None:
    """Execute a browser-neutral ES module contract with Node.

    Copying sources to ``.mjs`` keeps this check independent of the repository's
    package type while still executing the exact checked-in JavaScript text.
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        for source in modules:
            (temp / f"{source.stem}.mjs").write_text(read_text(source), encoding="utf-8")
        script = temp / "contract.mjs"
        script.write_text(contract, encoding="utf-8")
        result = subprocess.run(
            ["node", str(script)],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
        if result.returncode:
            raise AssertionError(
                f"Node contract failed ({result.returncode})\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
            )


class GuilinV050StageAWorkbenchTests(unittest.TestCase):
    """Truthfulness gates for the unified Stage A inspection workbench.

    These tests intentionally inspect both declarations and executable wiring.
    A label, button, or optimistic status string alone cannot satisfy a gate.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.index = read_text(WEB / "index.html")
        cls.style = read_text(WEB / "style.css")
        cls.runtime = read_text(WEB / "runtime.js")
        cls.manifest = read_json(WEB / "manifest.json")
        cls.gate = read_json(RELEASE_GATE)

    def test_main_entry_is_one_local_workbench_without_iframes(self) -> None:
        lowered = self.index.lower()
        self.assertNotRegex(lowered, r"<\s*iframe\b")
        self.assertNotIn("frame.src", self.runtime)
        self.assertNotRegex(self.runtime, r"\bwindow\.open\s*\(")
        self.assertNotIn("sunhaihao.chatgpt.site", self.index + self.runtime)
        self.assertEqual(len(re.findall(r"<\s*canvas\b", lowered)), 1)
        self.assertRegex(
            lowered,
            r"<script[^>]+type=[\"']module[\"'][^>]+src=[\"'](?:\./)?(?:runtime|bootstrap)\.js[\"']",
        )
        self.assertRegex(self.index, r"(?:全域总图|桂林全域)")
        for label in ("GAEA", "水文", "稳定版", "用户视觉批准"):
            self.assertIn(label, self.index)
        for core_id in CORE_IDS:
            self.assertRegex(
                self.index,
                rf"data-core=[\"']{re.escape(core_id)}[\"']",
                core_id,
            )

    def test_main_runtime_imports_real_stage_a_modules(self) -> None:
        modules = {
            "gaea-bridge.js": "createGaeaBridge",
            "hydrology-runtime.js": "createHydrologyRuntime",
            "core-loader.js": "createCoreLoader",
            "ecology-core-runtime.js": "createEcologyCoreRuntime",
        }
        for filename, export_name in modules.items():
            source_path = WEB / filename
            self.assertTrue(source_path.is_file(), filename)
            source = read_text(source_path)
            self.assertRegex(source, rf"export\s+(?:async\s+)?function\s+{export_name}\b")
            self.assertRegex(
                self.runtime,
                rf"(?s:import\s*\{{[^}}]*\b{export_name}\b[^}}]*\}}\s*from\s*[\"']\./{re.escape(filename)}[\"'])",
            )

    def test_overall_metrics_come_from_manifest(self) -> None:
        task_aoi = self.manifest.get("taskAoi")
        web_context = self.manifest.get("webContext")
        overall = self.manifest.get("overall")
        fallback = self.manifest.get("fallback")
        self.assertIsInstance(task_aoi, dict, "manifest must expose taskAoi")
        self.assertIsInstance(web_context, dict, "manifest must expose webContext")
        self.assertIsInstance(overall, dict, "manifest must expose overall")
        self.assertIsInstance(fallback, dict, "manifest must expose fallback truth")
        area = first_number(task_aoi, "areaSquareKilometers", "areaKm2")
        self.assertGreater(area, 100.0)
        resolution = first_value(
            overall,
            "resolutionMeters",
            "pixelSpacingMeters",
            "resolution",
        )
        if isinstance(resolution, list):
            self.assertEqual(len(resolution), 2)
            resolution = sum(map(float, resolution)) / 2
        self.assertGreater(float(resolution), 0)
        source_resolution = first_number(overall, "sourceResolutionMeters")
        self.assertEqual(source_resolution, 30.0)
        raster_spacing = first_value(overall, "rasterSpacingMeters", "webRasterSpacingMeters")
        self.assertIsInstance(raster_spacing, list)
        self.assertEqual(len(raster_spacing), 2)
        grid_width = int(first_number(overall, "gridWidth"))
        grid_height = int(first_number(overall, "gridHeight"))
        bounds = first_value(overall, "projectedBounds", "bounds")
        derived_spacing = [
            (float(bounds[2]) - float(bounds[0])) / (grid_width - 1),
            (float(bounds[3]) - float(bounds[1])) / (grid_height - 1),
        ]
        for declared, derived in zip(raster_spacing, derived_spacing):
            self.assertAlmostEqual(float(declared), derived, places=9)
        self.assertAlmostEqual(float(resolution), sum(derived_spacing) / 2, places=9)
        self.assertGreater(float(resolution), source_resolution * 3)
        sampling = overall.get("rasterSampling")
        self.assertIsInstance(sampling, dict)
        self.assertEqual(sampling.get("method"), "bilinear")
        self.assertEqual(sampling.get("maximumSidePixels"), 2048)
        self.assertEqual(sampling.get("gridConvention"), "vertex-grid")
        self.assertIn("grid-dimension-1", sampling.get("spacingDerivation", ""))
        self.assertEqual(
            sampling.get("sourceManifestResolutionSemantics"),
            "source-dem-resolution-not-web-raster-spacing",
        )
        self.assertTrue(
            overall.get("sourceManifest")
            and (overall.get("lineage") or overall.get("sourceLineage")),
            "overall DEM must identify its source and lineage",
        )

        source_manifest_path = (WEB / overall["sourceManifest"]).resolve()
        height_path = (WEB / overall["heightBinary"]).resolve()
        mask_path = (WEB / overall["maskBinary"]).resolve()
        for path in (source_manifest_path, height_path, mask_path):
            self.assertTrue(path.is_relative_to(ROOT), path)
            self.assertTrue(path.is_file(), path)
        source_manifest = read_json(source_manifest_path)
        self.assertEqual(int(source_manifest["gridWidth"]), grid_width)
        self.assertEqual(int(source_manifest["gridHeight"]), grid_height)
        self.assertEqual(source_manifest["bounds"], bounds)
        self.assertEqual(source_manifest["crs"], overall["crs"])
        self.assertEqual([float(value) for value in source_manifest["resolution"]], [30.0, 30.0])
        self.assertEqual(height_path.stat().st_size, grid_width * grid_height * 2)
        self.assertEqual(mask_path.stat().st_size, grid_width * grid_height)
        self.assertEqual(height_path.stat().st_size, source_manifest["heightByteLength"])
        self.assertEqual(mask_path.stat().st_size, source_manifest["maskByteLength"])
        self.assertEqual(sha256(height_path), source_manifest["heightSha256"])
        self.assertEqual(sha256(mask_path), source_manifest["maskSha256"])
        self.assertEqual(mask_path.read_bytes().count(0), 0)
        self.assertEqual(float(source_manifest["validFraction"]), 1.0)
        self.assertIs(source_manifest.get("visualFillApplied"), False)

        self.assertTrue("active" in fallback or "applied" in fallback)
        self.assertIs(first_value(fallback, "active", "applied"), True)
        self.assertIn("reason", fallback)
        self.assertEqual(first_number(fallback, "sourceResolutionMeters"), source_resolution)
        self.assertEqual(fallback.get("rasterSpacingMeters"), raster_spacing)
        fallback_sampling = fallback.get("rasterSampling")
        self.assertIsInstance(fallback_sampling, dict)
        for field in ("method", "maximumSidePixels", "gridConvention", "spacingDerivation"):
            self.assertEqual(fallback_sampling.get(field), sampling.get(field))

        self.assertRegex(self.runtime, r"(?:fetch|fetchJson)\s*\(\s*[\"']\./manifest\.json[\"']")
        for field in ("taskAoi", "webContext", "fallback"):
            self.assertIn(field, self.runtime)
        for field in ("sourceResolutionMeters", "rasterSpacingMeters", "rasterSampling"):
            self.assertIn(field, self.runtime)
        self.assertNotIn("resolutionMeters: Number(sourceManifest.resolution", self.runtime)
        self.assertIn("dataset.sourceResolutionMeters", self.runtime)
        for label in ("网页采样", "bilinear"):
            self.assertIn(label, self.runtime + self.manifest["coverage"]["fallbackLabel"])
        self.assertRegex(self.runtime, r"(?:textContent|replaceChildren|setAttribute)\s*=")

        # The inspection document may say what a metric means, but must not freeze
        # the old 5,000/20,000 km2 placeholder as the live value.
        self.assertNotRegex(self.index, r"(?:5[ ,]?000|20[ ,]?000)\s*(?:km|平方公里)")

    def test_four_core_packages_are_exact_800_square_source_windows(self) -> None:
        packages = self.manifest.get("corePackages")
        self.assertTrue(packages, "main manifest has no corePackages declaration")
        if isinstance(packages, dict):
            declared_ids = set(packages)
        else:
            declared_ids = {
                item.get("id") if isinstance(item, dict) else str(item)
                for item in packages
            }
        self.assertEqual(declared_ids, set(CORE_IDS))

        expected_index_schema = None
        expected_index_generation = None
        expected_mosaic_id = None
        expected_mosaic_origin = None
        for core_id in CORE_IDS:
            core_dir = CORE_ASSETS / core_id
            manifest_path = core_dir / "manifest.json"
            self.assertTrue(manifest_path.is_file(), core_id)
            core = read_json(manifest_path)
            self.assertEqual(core.get("id"), core_id)
            self.assertEqual(int(first_number(core, "gridWidth", "widthPixels")), 800)
            self.assertEqual(int(first_number(core, "gridHeight", "heightPixels")), 800)
            self.assertEqual(first_number(core, "widthMeters", "sideMeters"), 10000.0)
            self.assertEqual(first_number(core, "heightMeters", "sideMeters"), 10000.0)
            self.assertEqual(core.get("crs"), "EPSG:32649")

            resolution = first_value(core, "resolution", "resolutionMeters", "pixelSpacingMeters")
            if isinstance(resolution, list):
                self.assertEqual([float(value) for value in resolution], [12.5, 12.5])
            else:
                self.assertEqual(float(resolution), 12.5)
            self.assertEqual(core["raster"].get("gridConvention"), "pixel-center")
            self.assertEqual(
                core["raster"].get("spacingDerivation"),
                "projected-extent/grid-dimension",
            )

            bounds = core.get("projectedBounds") or core.get("bounds")
            self.assertIsInstance(bounds, list)
            self.assertEqual(len(bounds), 4)
            self.assertAlmostEqual(float(bounds[2]) - float(bounds[0]), 10000.0, places=6)
            self.assertAlmostEqual(float(bounds[3]) - float(bounds[1]), 10000.0, places=6)
            self.assertEqual(
                core.get("firstPixelCenterProjected"),
                [float(bounds[0]) + 6.25, float(bounds[3]) - 6.25],
            )

            self.assertIn("pixelOrigin", core)
            self.assertIn("sourceMosaic", core)
            self.assertIn("coverage", core)
            lineage = core.get("sourceLineage")
            self.assertTrue(lineage, f"{core_id} has no source lineage")
            lineage_strings = flatten_strings(lineage)
            self.assertTrue(
                any("12.5" in value or "12_5" in value for value in lineage_strings),
                f"{core_id} lineage does not identify the 12.5 m source",
            )
            self.assertIsInstance(lineage, dict)
            self.assertEqual(lineage.get("cropMethod"), "center-window-no-spatial-resampling")
            crop = lineage.get("cropWindow")
            self.assertIsInstance(crop, dict)
            self.assertEqual(int(crop.get("width", 0)), 800)
            self.assertEqual(int(crop.get("height", 0)), 800)
            self.assertEqual(int(lineage.get("sourceGridWidth", 0)), 1132)
            self.assertEqual(int(lineage.get("sourceGridHeight", 0)), 1132)
            self.assertEqual(
                core["pixelOrigin"],
                [
                    int(lineage["sourcePixelOrigin"][0]) + int(crop["columnOffset"]),
                    int(lineage["sourcePixelOrigin"][1]) + int(crop["rowOffset"]),
                ],
            )
            self.assertRegex(str(lineage.get("sourceManifest", "")), rf"/{re.escape(core_id)}/")
            for hash_key in (
                "sourceManifestSha256",
                "sourceHeightSha256",
                "sourceMaskSha256",
            ):
                self.assertRegex(str(lineage.get(hash_key, "")), r"^[0-9a-f]{64}$")
            if expected_index_schema is None:
                expected_index_schema = lineage.get("sourceIndexSchemaVersion")
                expected_index_generation = lineage.get("sourceIndexGeneratedAt")
            self.assertEqual(lineage.get("sourceIndexSchemaVersion"), expected_index_schema)
            self.assertEqual(lineage.get("sourceIndexGeneratedAt"), expected_index_generation)

            source_mosaic = core["sourceMosaic"]
            self.assertEqual(source_mosaic.get("crs"), "EPSG:32649")
            self.assertEqual(float(source_mosaic.get("resolutionMeters", 0)), 12.5)
            self.assertEqual(source_mosaic.get("gridOriginConvention"), "west-north-vertex")
            if expected_mosaic_id is None:
                expected_mosaic_id = source_mosaic.get("mosaicId")
                expected_mosaic_origin = source_mosaic.get("gridOriginProjected")
            self.assertEqual(source_mosaic.get("mosaicId"), expected_mosaic_id)
            self.assertEqual(source_mosaic.get("gridOriginProjected"), expected_mosaic_origin)
            self.assertEqual(lineage.get("sourceMosaicId"), expected_mosaic_id)
            self.assertEqual(lineage.get("sourceMosaicGridOriginProjected"), expected_mosaic_origin)
            self.assertEqual(int(source_mosaic.get("fineRegionGridWidth", 0)), 1132)
            self.assertEqual(int(source_mosaic.get("fineRegionGridHeight", 0)), 1132)
            self.assertIsInstance(source_mosaic.get("pixelOrigin"), list)
            self.assertTrue(all(isinstance(value, int) for value in core["pixelOrigin"]))

            inferred_origin = [
                float(source_mosaic["fineRegionBounds"][0]) - int(source_mosaic["pixelOrigin"][0]) * 12.5,
                float(source_mosaic["fineRegionBounds"][3]) + int(source_mosaic["pixelOrigin"][1]) * 12.5,
            ]
            self.assertEqual(inferred_origin, expected_mosaic_origin)

            height_path = core_dir / first_value(core, "heightBinary", "heightAsset")
            mask_path = core_dir / first_value(core, "maskBinary", "maskAsset")
            self.assertEqual(height_path.stat().st_size, 800 * 800 * 2, core_id)
            self.assertEqual(mask_path.stat().st_size, 800 * 800, core_id)
            self.assertEqual(sha256(height_path), core["heightSha256"], core_id)
            self.assertEqual(sha256(mask_path), core["maskSha256"], core_id)
            valid_fraction = first_number(core["coverage"], "validFraction")
            self.assertGreater(valid_fraction, 0.99, core_id)
            self.assertLessEqual(valid_fraction, 1.0, core_id)
            missing = int(core["coverage"]["missingPixelCount"])
            if core_id == "zhenbao-ding":
                self.assertEqual(missing, 263)
                self.assertIs(core["coverage"]["complete"], False)
                self.assertEqual(core.get("status"), "incomplete_12_5m")
            else:
                self.assertEqual(missing, 0, core_id)
                self.assertIs(core["coverage"]["complete"], True)

            source_height_path = ROOT / lineage["sourceHeightBinary"]
            source_mask_path = ROOT / lineage["sourceMaskBinary"]
            source_manifest_path = ROOT / lineage["sourceManifest"]
            self.assertEqual(sha256(source_height_path), lineage["sourceHeightSha256"])
            self.assertEqual(sha256(source_mask_path), lineage["sourceMaskSha256"])
            self.assertEqual(sha256(source_manifest_path), lineage["sourceManifestSha256"])

            source_mask = source_mask_path.read_bytes()
            core_mask = mask_path.read_bytes()
            source_width = int(lineage["sourceGridWidth"])
            column_offset = int(crop["columnOffset"])
            row_offset = int(crop["rowOffset"])
            expected_mask = b"".join(
                source_mask[
                    row * source_width + column_offset:
                    row * source_width + column_offset + 800
                ]
                for row in range(row_offset, row_offset + 800)
            )
            self.assertEqual(core_mask, expected_mask, f"{core_id} mask is not the declared source window")

            source_height_raw = source_height_path.read_bytes()
            core_height_raw = height_path.read_bytes()
            expected_height = b"".join(
                source_height_raw[
                    (row * source_width + column_offset) * 2:
                    (row * source_width + column_offset + 800) * 2
                ]
                for row in range(row_offset, row_offset + 800)
            )
            self.assertEqual(
                core_height_raw,
                expected_height,
                f"{core_id} height codes are not the exact declared source window",
            )
            self.assertEqual(
                lineage.get("heightReencoding"),
                "none-source-u16-codes-cropped-byte-for-byte",
            )

            source_values = little_endian_u16(source_height_path)
            core_values = little_endian_u16(height_path)
            source_minimum = float(lineage["sourceMinimumElevation"])
            source_maximum = float(lineage["sourceMaximumElevation"])
            core_minimum = float(core["minimumElevation"])
            core_maximum = float(core["maximumElevation"])
            tolerance = (
                (source_maximum - source_minimum) / 65535.0
                + (core_maximum - core_minimum) / 65535.0
                + 1e-6
            )
            # Mask identity proves the complete crop geometry. This deterministic
            # lattice additionally proves that height samples still decode to the
            # declared source pixels after loss-bounded requantisation.
            for row in range(0, 800, 53):
                for column in range(0, 800, 47):
                    core_index = row * 800 + column
                    if not core_mask[core_index]:
                        continue
                    source_index = (row + row_offset) * source_width + column + column_offset
                    source_elevation = source_minimum + source_values[source_index] / 65535.0 * (
                        source_maximum - source_minimum
                    )
                    core_elevation = core_minimum + core_values[core_index] / 65535.0 * (
                        core_maximum - core_minimum
                    )
                    self.assertAlmostEqual(
                        core_elevation,
                        source_elevation,
                        delta=tolerance,
                        msg=f"{core_id} source pixel ({column}, {row}) changed",
                    )

    def test_core_loader_does_not_alias_all_buttons_to_one_core(self) -> None:
        source = read_text(WEB / "core-loader.js")
        for method in ("loadCore", "getManifest", "release", "dispose"):
            self.assertRegex(source, rf"\b{method}\b")
        for core_id in CORE_IDS:
            self.assertIn(core_id, self.index + self.runtime + source)
        self.assertNotIn("activeCore:'yangtang-airfield'", self.runtime.replace(" ", ""))
        self.assertRegex(self.runtime, r"loadCore\s*\(")
        self.assertRegex(self.runtime, r"release\s*\(")

        run_node_contract(
            [WEB / "core-loader.js"],
            r"""
import assert from 'node:assert/strict';
import { createCoreLoader } from './core-loader.mjs';

const values = new Map([
  ['zhenbao-ding', 101],
  ['guilin-old-city', 202],
  ['yangtang-airfield', 303],
  ['yangshuo-county-seat', 404],
]);
const calls = [];
globalThis.fetch = async (url) => {
  const parsed = new URL(url);
  calls.push(parsed.pathname);
  const match = parsed.pathname.match(/\/([^/]+)\/(manifest\.json|height_u16\.bin|mask_u8\.bin)$/);
  assert.ok(match, parsed.pathname);
  const [, id, asset] = match;
  assert.ok(values.has(id), id);
  if (asset === 'manifest.json') {
    return {
      ok: true,
      async json() {
        return {
          schemaVersion: 'guilin-core-dem/v1', id, crs: 'EPSG:32649',
          raster: { width: 800, height: 800, resolutionMeters: 12.5 },
          widthMeters: 10000, heightMeters: 10000,
          projectedBounds: [0, 0, 10000, 10000], wgs84Bounds: [110, 25, 111, 26],
          centerProjected: [5000, 5000], heightBinary: 'height_u16.bin', maskBinary: 'mask_u8.bin',
          minimumElevation: 0, maximumElevation: 1000,
        };
      },
    };
  }
  if (asset === 'height_u16.bin') {
    const height = new Uint16Array(800 * 800);
    height[0] = values.get(id);
    return { ok: true, async arrayBuffer() { return height.buffer; } };
  }
  const mask = new Uint8Array(800 * 800).fill(1);
  return { ok: true, async arrayBuffer() { return mask.buffer; } };
};

const loader = createCoreLoader({ baseUrl: 'https://example.test/cores/' });
const first = await loader.loadCore('zhenbao-ding');
const second = await loader.loadCore('guilin-old-city');
assert.equal(first.manifest.id, 'zhenbao-ding');
assert.equal(second.manifest.id, 'guilin-old-city');
assert.equal(first.height[0], 101);
assert.equal(second.height[0], 202);
assert.notStrictEqual(first.height, second.height);
assert.ok(calls.some((path) => path.includes('/zhenbao-ding/height_u16.bin')));
assert.ok(calls.some((path) => path.includes('/guilin-old-city/height_u16.bin')));
assert.equal(loader.release('zhenbao-ding'), true);
await assert.rejects(loader.loadCore('not-a-core'), RangeError);
loader.dispose();
""",
        )

    def test_gaea_bridge_exposes_truthful_preview_and_worker_states(self) -> None:
        source = read_text(WEB / "gaea-bridge.js")
        self.assertIn("browser-preview", source)
        for state in WORKER_STATES:
            self.assertIn(state, source)
        for method in ("health", "build", "cancel", "reset", "dispose"):
            self.assertRegex(source, rf"\b{method}\b")
        self.assertRegex(source, r"\bunavailable\b")
        self.assertNotRegex(source, r"unavailable[\s\S]{0,120}(?:succeeded|ready)\s*[:=]\s*true")

        combined = self.index + self.runtime
        for label in ("浏览器预览", "GAEA Worker", "构建进度"):
            self.assertIn(label, combined)
        self.assertRegex(combined, r"\.health\s*\(")
        self.assertRegex(combined, r"\.build\s*\(")
        self.assertRegex(combined, r"addEventListener\s*\(\s*[\"'](?:input|change)[\"']")

        run_node_contract(
            [WEB / "gaea-bridge.js"],
            r"""
import assert from 'node:assert/strict';
import { createGaeaBridge } from './gaea-bridge.mjs';

const unavailableStore = { gaea: { parameters: { verticalExaggeration: 1.8 } } };
const unavailableBridge = createGaeaBridge({ store: unavailableStore });
assert.equal(unavailableStore.gaea.preview.mode, 'browser-preview');
assert.equal(unavailableStore.gaea.preview.approximation, true);
assert.equal(unavailableStore.gaea.preview.authoritativeElevationChanged, false);
const unavailableHealth = await unavailableBridge.health({ timeoutMs: 250 });
const unavailableBuild = await unavailableBridge.build({ parameters: { erosionStrength: 1.2 } });
assert.equal(unavailableHealth.status, 'unavailable');
assert.equal(unavailableBuild.status, 'unavailable');
assert.equal(unavailableBuild.preview.approximation, true);
assert.equal(unavailableBuild.preview.authoritativeElevationChanged, false);
unavailableBridge.dispose();

class MockWorker {
  constructor() { this.listeners = new Map(); this.terminated = false; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(data) { queueMicrotask(() => this.listeners.get('message')?.({ data })); }
  postMessage(message) {
    if (message.type === 'gaea:health') {
      this.emit({ type: 'gaea:health', requestId: message.requestId, version: 'test-worker' });
    }
    if (message.type === 'gaea:build') {
      this.emit({ type: 'gaea:progress', requestId: message.requestId, progress: 0.5, stage: 'erosion' });
      this.emit({ type: 'gaea:result', requestId: message.requestId, result: { elevation: 'real-worker-output' } });
    }
  }
  terminate() { this.terminated = true; }
}

let applied = null;
const worker = new MockWorker();
const workerStore = { gaea: { workerFactory: () => worker } };
const workerBridge = createGaeaBridge({
  store: workerStore,
  onBuildApplied: (result) => { applied = result; },
});
const ready = await workerBridge.health({ timeoutMs: 500 });
assert.equal(ready.status, 'ready');
const built = await workerBridge.build({ input: { height: 'source-dem' } });
assert.equal(built.status, 'succeeded');
assert.equal(built.authoritative, true);
assert.equal(applied.result.elevation, 'real-worker-output');
assert.equal(workerStore.gaea.build.status, 'succeeded');
assert.equal(workerStore.gaea.build.authoritative, true);
workerBridge.dispose();
assert.equal(worker.terminated, true);
""",
        )

    def test_hydrology_preserves_source_parts_and_exposes_diagnostics(self) -> None:
        source = read_text(WEB / "hydrology-runtime.js")
        for token in (
            "LineString",
            "MultiLineString",
            "centerlines",
            "surfaces",
            "banks",
            "flowArrows",
            "breakpoints",
            "isLandExcluded",
            "getDiagnostics",
        ):
            self.assertIn(token, source)
        self.assertNotIn("filter(Number.isFinite)", source)
        self.assertRegex(source, r"(?:part|segment)(?:Index|Id|Key)")

        combined = self.index + self.runtime
        for label in (
            "漓江",
            "湘江",
            "主要支流",
            "中心线",
            "流向",
            "连续性",
            "断点",
            "水位",
            "夏季",
            "冬季",
        ):
            self.assertIn(label, combined)
        self.assertRegex(combined, r"(?:河面|水面)")
        self.assertRegex(combined, r"(?:河岸|岸线)")
        self.assertRegex(
            self.index,
            r"id=[\"']waterLevel[\"'][^>]+min=[\"']\.?15[\"'][^>]+max=[\"']1\.5[\"'][^>]+value=[\"']1[\"']",
        )
        self.assertRegex(
            self.index,
            r"id=[\"']waterWidth[\"'][^>]+min=[\"']\.?4[\"'][^>]+max=[\"']2[\"'][^>]+value=[\"']1[\"']",
        )
        self.assertIn("水位倍率", self.index)
        self.assertIn("河宽倍率", self.index)
        self.assertRegex(self.runtime, r"getRenderBatches\s*\(")
        self.assertRegex(
            self.runtime,
            r"(?s:createEcologyCoreRuntime\s*\(\s*\{[^}]*\bhydrologyRuntime\b)",
        )

        run_node_contract(
            [WEB / "hydrology-runtime.js"],
            r"""
import assert from 'node:assert/strict';
import { createHydrologyRuntime } from './hydrology-runtime.mjs';

const source = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { osmId: 10, name: '漓江', width: 50 },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[0.10, 0.20], [0.25, 0.20], [0.40, 0.20]],
          [[0.60, 0.70], [0.72, 0.72], [0.84, 0.74]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { osmId: 20, name: '湘江', width: 40 },
      geometry: { type: 'LineString', coordinates: [[0.18, 0.82], [0.34, 0.78], [0.48, 0.76]] },
    },
  ],
};

const runtime = await createHydrologyRuntime({ sourceUrls: source });
const datasetStatus = runtime.setDataset({ widthMeters: 1000, heightMeters: 1000, wgs84Bounds: [0, 0, 1, 1] });
assert.equal(datasetStatus.sourceParts, 3);
assert.equal(datasetStatus.crossSegmentConnections, 0);
const state = {
  showLijiang: true,
  showXiangjiang: true,
  showTributaries: true,
  showCenterlines: true,
  showSurface: true,
  showBanks: true,
  showFlow: true,
  showDiagnostics: true,
  waterLevel: 1,
};
const terrain = () => 100;
const summer = runtime.getRenderBatches({ ...state, season: 'summer' }, terrain);
const winter = runtime.getRenderBatches({ ...state, season: 'winter' }, terrain);
const wide = runtime.getRenderBatches({ ...state, season: 'summer', waterWidth: 2 }, terrain);
const narrow = runtime.getRenderBatches({ ...state, season: 'summer', waterWidth: 0.4 }, terrain);
const high = runtime.getRenderBatches({ ...state, season: 'summer', waterLevel: 1.5 }, terrain);
const low = runtime.getRenderBatches({ ...state, season: 'summer', waterLevel: 0.15 }, terrain);
assert.equal(summer.centerlines.length, 3);
assert.equal(summer.surfaces.length, 3);
assert.equal(new Set(summer.surfaces.map((batch) => batch.segmentId)).size, 3);
assert.equal(new Set(summer.centerlines.map((batch) => batch.segmentId)).size, 3);
for (const batch of summer.surfaces) {
  assert.ok(batch.positions instanceof Float32Array);
  assert.ok(batch.indices instanceof Uint32Array);
  assert.ok(Math.max(...batch.indices) < batch.positions.length / 3);
}
assert.ok(summer.surfaces[0].widthMeters > winter.surfaces[0].widthMeters);
assert.ok(summer.surfaces[0].positions[1] > winter.surfaces[0].positions[1]);
assert.ok(wide.surfaces[0].widthMeters > narrow.surfaces[0].widthMeters);
assert.ok(high.surfaces[0].positions[1] > low.surfaces[0].positions[1]);
assert.equal(runtime.isLandExcluded(0.25, 0.20), true);
assert.equal(runtime.isLandExcluded(0.50, 0.50), false);
const diagnostics = runtime.getDiagnostics();
assert.equal(diagnostics.geometrySafety.sourcePartsRemainIndependent, true);
assert.equal(diagnostics.geometrySafety.clipRunsRemainIndependent, true);
assert.equal(diagnostics.geometrySafety.crossSegmentConnections, 0);
assert.equal(diagnostics.geometrySafety.bridgeTriangles, 0);
assert.equal(diagnostics.geometrySafety.outOfBoundsVertices, 0);
assert.ok(diagnostics.plantExclusion.excludedQueryCount >= 1);
runtime.dispose();
""",
        )

    def test_four_seasons_and_1940_1945_years_are_runtime_controls(self) -> None:
        ecology = self.manifest.get("ecology")
        self.assertIsInstance(ecology, dict, "manifest has no ecology temporal truth")
        self.assertEqual(ecology.get("epochYears"), list(range(1940, 1946)))
        manifest_seasons = ecology.get("seasons")
        self.assertEqual(set(map(str.lower, manifest_seasons or [])), SEASONS)

        combined = self.index + self.runtime
        for season in SEASONS:
            self.assertIn(season, combined.lower())
        for year in range(1940, 1946):
            self.assertIn(str(year), combined)
        self.assertRegex(self.runtime, r"\[\s*[\"']season[\"']\s*,\s*[\"']year[\"']\s*\]")
        self.assertIn("store.state.ecology[id]", self.runtime)
        self.assertRegex(combined, r"addEventListener\s*\(\s*[\"']change[\"']")

        ecology_source = read_text(WEB / "ecology-core-runtime.js")
        for token in (
            "showForest",
            "showShrubs",
            "showPaddy",
            "showDryCrops",
            "showOrchards",
            "showBunds",
            "windDirection",
            "windSpeed",
            "gustStrength",
            "isLandExcluded",
            "rootPinned",
            "channelVegetationCount",
        ):
            self.assertIn(token, ecology_source)

        run_node_contract(
            [WEB / "ecology-core-runtime.js"],
            r"""
import assert from 'node:assert/strict';
import { createEcologyCoreRuntime, ECOLOGY_CLAIM } from './ecology-core-runtime.mjs';

let exclusionCalls = 0;
const hydrologyRuntime = {
  isLandExcluded(xNorm) { exclusionCalls += 1; return xNorm < 0.12; },
  getDiagnostics() { return { revision: 1, segmentCount: 3, exclusionZoneCount: 3 }; },
};
const runtime = createEcologyCoreRuntime({ hydrologyRuntime });
runtime.setDataset({
  id: 'overall',
  widthMeters: 1000,
  heightMeters: 1000,
  minimumElevation: 0,
  maximumElevation: 200,
  crs: 'EPSG:32649',
  projectedBounds: [0, 0, 1000, 1000],
  pixelOrigin: [0, 0],
  sourceLineage: { lineageId: 'test-lineage' },
});
const sampleHeight = () => 100;
const summer = runtime.getRenderData({ season: 'summer', year: 1942, windDirection: 0, windSpeed: 9, gustStrength: 0 }, sampleHeight);
assert.ok(summer.count > 0);
assert.equal(summer.positions.length, summer.count * 3);
assert.equal(summer.windVectors.length, summer.count * 2);
assert.equal(summer.channelVegetationCount, 0);
assert.equal(summer.rootPinned, true);
assert.equal(summer.rootHeightSource, 'sampleHeight');
assert.equal(summer.claim, ECOLOGY_CLAIM);
assert.equal(summer.nativeSurveyClaim, false);
for (let index = 1; index < summer.positions.length; index += 3) assert.equal(summer.positions[index], 100);

const autumn = runtime.getRenderData({ season: 'autumn', year: 1945, windDirection: 90, showPaddy: false }, sampleHeight);
assert.equal(autumn.season, 'autumn');
assert.equal(autumn.year, 1945);
assert.equal(autumn.counts.paddy, 0);
assert.notDeepEqual(Array.from(autumn.colors.slice(0, 12)), Array.from(summer.colors.slice(0, 12)));
assert.notDeepEqual(Array.from(autumn.windVectors.slice(0, 12)), Array.from(summer.windVectors.slice(0, 12)));
assert.ok(exclusionCalls > 0);
const diagnostics = runtime.getDiagnostics();
assert.deepEqual([...diagnostics.supportedSeasons], ['spring', 'summer', 'autumn', 'winter']);
assert.deepEqual([...diagnostics.supportedYears], [1940, 1941, 1942, 1943, 1944, 1945]);
assert.equal(diagnostics.hydrologyExclusionAvailable, true);
assert.equal(diagnostics.channelVegetationCount, 0);
runtime.setDataset({ id: 'guilin-old-city', widthMeters: 10000, heightMeters: 10000, projectedBounds: [0, 0, 10000, 10000] });
assert.ok(runtime.getDiagnostics().releasedDenseInstanceCount >= summer.count);
runtime.dispose();
""",
        )

    def test_all_three_inspection_heights_and_touch_navigation_are_reachable(self) -> None:
        combined = self.index + self.runtime
        for value in ("50m", "2m", "1.7m"):
            self.assertRegex(self.index, rf"data-camera=[\"']{re.escape(value)}[\"']")
        self.assertRegex(combined, r"(?:setInspectionHeight|setCameraHeight|inspectionHeight)")
        self.assertIn("sampleHeight", self.runtime)
        self.assertRegex(self.index, r"id=[\"']touchPad[\"']")
        self.assertGreaterEqual(len(re.findall(r"data-move=[\"'][^\"']+[\"']", self.index)), 4)

        for event_name in ("pointerdown", "pointermove", "pointerup", "pointercancel"):
            self.assertIn(event_name, self.runtime)
        self.assertRegex(self.runtime, r"pointerId")
        self.assertRegex(self.runtime, r"querySelectorAll\s*\(\s*[\"']\[data-move\][\"']\s*\)")
        self.assertIn("button.dataset.move", self.runtime)
        self.assertIn("chooseInspectionView", self.runtime)
        self.assertIn("sampleRenderedTerrainHeight", self.runtime)
        self.assertIn("minimumVerifiedVisibleDistanceMeters", self.runtime)
        self.assertIn("renderedAltitudeAboveGroundMeters", self.runtime)
        self.assertIn("__GUILIN_SHARED_RUNTIME_HANDLES__", self.runtime)
        style = read_text(WEB / "style.css")
        self.assertRegex(style, r"\.controller\.open\s*~\s*\.touch-pad\s*\{\s*display:\s*none")
        self.assertIn("heldMoves", self.runtime)
        self.assertRegex(self.runtime, r"moveCamera\s*\(")
        self.assertRegex(self.style, r"touch-action\s*:\s*none")
        self.assertNotRegex(
            self.style,
            r"@media[^{}]*max-width\s*:\s*680px[\s\S]{0,1800}?\.panel\s*\{[^}]*display\s*:\s*none",
        )

    def test_release_stays_locked_pending_user_visual_approval(self) -> None:
        publish_gate = self.manifest["publishGate"]
        publication = self.manifest["publication"]
        self.assertEqual(publish_gate.get("status"), "blocked")
        self.assertIs(publish_gate.get("requiresUserVisualApproval"), True)
        self.assertIs(publish_gate.get("pullRequestMustRemainDraft"), True)
        self.assertIs(publish_gate.get("mergeAllowed"), False)
        self.assertIs(publication.get("allowed"), False)
        self.assertIs(publication.get("automatic"), False)
        self.assertIs(self.gate.get("public_release_allowed"), False)
        self.assertIs(self.gate.get("automatic_publication_allowed"), False)
        self.assertEqual(self.gate.get("stable_release"), "v0.3.1")
        self.assertRegex(self.index, r"(?:用户视觉批准|待用户批准|发布锁定)")
        self.assertRegex(self.index, r"id=[\"']stableRollbackLink[\"'][^>]+href=[\"'][^\"']+[\"']")
        self.assertIn("v0.3.1", self.index)

    def test_startup_failures_are_visible_and_error_counts_are_not_fabricated(self) -> None:
        self.assertRegex(self.index, r"id=[\"']errorCard[\"'][^>]+role=[\"']alert[\"']")
        self.assertIn("showFatal", self.runtime)
        self.assertRegex(self.runtime, r"initialise\s*\(\s*\)\.catch\s*\(\s*showFatal\s*\)")
        self.assertRegex(self.runtime, r"errorText\.textContent\s*=")
        self.assertRegex(self.runtime, r"errorCard\.classList\.add\s*\(\s*[\"']visible[\"']\s*\)")
        for metric in ("resource404Count", "consoleErrorCount"):
            self.assertNotRegex(
                self.runtime,
                rf"\b{metric}\s*:\s*0\b",
                f"{metric}=0 must come from a real counter; use null/unmeasured until browser QA runs",
            )

    def test_javascript_is_directly_parseable_without_runtime_source_rewrite(self) -> None:
        bootstrap = read_text(WEB / "bootstrap.js") if (WEB / "bootstrap.js").is_file() else ""
        self.assertNotIn("SOURCE_REPLACEMENTS", bootstrap)
        self.assertNotIn("new Blob([`${source}", bootstrap)
        self.assertNotIn("state.showWater?.35*state.waterLevel:0", self.runtime)

        javascript = sorted(WEB.glob("*.js"))
        self.assertGreaterEqual(len(javascript), 4)
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            for path in javascript:
                module = temp / f"{path.stem}.mjs"
                module.write_text(read_text(path), encoding="utf-8")
                result = subprocess.run(
                    ["node", "--check", str(module)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, f"{path.name}: {result.stderr}")


if __name__ == "__main__":
    unittest.main()
