"""Compile one exact Yangshuo Lijiang native 2048 candidate product."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from yangshuo_candidates_v300_analysis import normalize, projected_lines, terrain_derivatives
from yangshuo_candidates_v300_common import sha, window_bounds
from yangshuo_candidates_v300_manifest import build_manifest
from yangshuo_candidates_v300_raster import asset, translate_slice


def compile_one(
    np: Any,
    Image: Any,
    ImageDraw: Any,
    gdal: Any,
    osr: Any,
    dataset: Any,
    band: Any,
    nodata: float | None,
    source: Path,
    config: dict[str, Any],
    config_path: Path,
    hydro_document: dict[str, Any],
    hydro_path: Path,
    candidate: dict[str, Any],
    output_root: Path,
) -> dict[str, Any]:
    candidate_id, slug = str(candidate["id"]), str(candidate["slug"])
    window = list(map(int, candidate["pixelWindow"]))
    if window[2:] != [2048, 2048]:
        raise SystemExit(f"{candidate_id}: runtime window must be 2048 x 2048")
    destination = output_root / f"{candidate_id.lower()}-{slug}"
    destination.mkdir(parents=True, exist_ok=True)

    array = band.ReadAsArray(*window)
    if array is None:
        raise SystemExit(f"{candidate_id}: source read failed")
    heights = np.asarray(array, dtype="<f4")
    valid = np.isfinite(heights)
    if nodata is not None:
        valid &= heights != np.float32(nodata)
    if heights.shape != (2048, 2048) or not bool(valid.any()):
        raise SystemExit(f"{candidate_id}: invalid window data")

    runtime = heights.copy()
    runtime[~valid] = np.nan
    paths = {
        "height": destination / "height_f32.bin",
        "mask": destination / "valid_u8.bin",
        "truth": destination / "truth-slice.tif",
    }
    runtime.tofile(paths["height"])
    valid.astype(np.uint8).tofile(paths["mask"])
    translate_slice(gdal, dataset, band, window, paths["truth"])

    spacing = float(config["windowContract"]["sourcePixelSpacingMeters"])
    derivatives = terrain_derivatives(np, runtime, valid, spacing)
    elevation, elevation_scale = normalize(np, runtime, valid)
    slope, slope_scale = normalize(np, derivatives["slopeDegrees"], derivatives["valid"])
    curvature, curvature_scale = normalize(np, derivatives["curvature"], derivatives["valid"], signed=True)
    hillshade = np.zeros(runtime.shape, dtype=np.uint8)
    hillshade[derivatives["valid"]] = np.rint(derivatives["hillshade"][derivatives["valid"]]).astype(np.uint8)

    previews: dict[str, Any] = {}
    for name, pixels in (
        ("elevation", elevation),
        ("slope", slope),
        ("curvature", curvature),
        ("hillshade", hillshade),
    ):
        path = destination / f"{name}.png"
        Image.fromarray(pixels, mode="L").save(path, optimize=True)
        previews[name] = asset(path)

    bounds = window_bounds(config["truthSource"]["transform"], window)
    overlay = Image.merge("RGB", (Image.fromarray(hillshade),) * 3)
    drawing = ImageDraw.Draw(overlay)
    for line in projected_lines(hydro_document, bounds, spacing, osr):
        drawing.line(line, fill=(25, 205, 255), width=5, joint="curve")
    overlay_path = destination / "river-peak-lowland.png"
    overlay.save(overlay_path, optimize=True)
    previews["riverPeakLowland"] = asset(overlay_path)

    valid_fraction = float(valid.mean())
    minimum = float(config["windowContract"]["minimumValidFractionForApproval"])
    status = "ready-for-area-review" if valid_fraction >= minimum else "blocked-incomplete-coverage"
    manifest = build_manifest(
        source,
        config,
        config_path,
        hydro_path,
        candidate,
        window,
        bounds,
        valid_fraction,
        runtime[valid],
        status,
        paths,
        previews,
        {"elevation": elevation_scale, "slope": slope_scale, "curvature": curvature_scale},
    )
    manifest_path = destination / "candidate-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "id": candidate_id,
        "slug": slug,
        "status": status,
        "validFraction": valid_fraction,
        "manifest": str(manifest_path.relative_to(output_root)),
        "manifestSha256": sha(manifest_path),
    }
