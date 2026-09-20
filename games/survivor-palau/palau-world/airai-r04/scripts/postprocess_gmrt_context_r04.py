#!/usr/bin/env python3
"""Quantify GMRT high-resolution contributor coverage without treating it as reef survey truth.

GMRT topo-mask is a high-resolution contributor mask. It may include curated multibeam
and contributed grids, so this postprocessor deliberately avoids calling every masked
pixel a direct measurement. It never converts vertical datums or fuses GMRT elevations
into the ENC-constrained candidate grid.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import rasterio
from pyproj import Transformer

CORE = [134.535, 7.315, 134.605, 7.385]
CONTEXT = [134.49, 7.27, 134.64, 7.42]
ANCHOR = [134.5667427743189, 7.349032638038719]


def stats(values: np.ndarray) -> dict:
    values = values[np.isfinite(values)]
    if values.size == 0:
        return {"count": 0}
    return {
        "count": int(values.size),
        "min": float(np.min(values)),
        "p05": float(np.percentile(values, 5)),
        "median": float(np.median(values)),
        "p95": float(np.percentile(values, 95)),
        "max": float(np.max(values)),
    }


def pixel_centers(transform, height: int, width: int) -> tuple[np.ndarray, np.ndarray]:
    cols = np.arange(width, dtype=np.float64) + 0.5
    rows = np.arange(height, dtype=np.float64) + 0.5
    xs = transform.c + cols * transform.a + 0.5 * transform.b
    ys = transform.f + rows * transform.e + 0.5 * transform.d
    return xs, ys


def nearest_distance_m(xs: np.ndarray, ys: np.ndarray, mask: np.ndarray, anchor: list[float]) -> float | None:
    rr, cc = np.where(mask)
    if rr.size == 0:
        return None
    lon = xs[cc]
    lat = ys[rr]
    tx = Transformer.from_crs("EPSG:4326", "EPSG:32653", always_xy=True)
    mx, my = tx.transform(lon, lat)
    ax, ay = tx.transform(anchor[0], anchor[1])
    return float(np.min(np.hypot(np.asarray(mx) - ax, np.asarray(my) - ay)))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--intake", type=Path, required=True)
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()

    topo_path = args.intake / "raw/gmrt/airai_topo_max.tif"
    mask_path = args.intake / "raw/gmrt/airai_topo_mask_max.tif"
    metadata_path = args.intake / "metadata/gmrt/airai_metadata.json"
    if not topo_path.exists() or not mask_path.exists():
        raise SystemExit("GMRT topo/topo-mask files are missing from intake")

    with rasterio.open(mask_path) as src:
        gmrt = src.read(1, masked=True).filled(np.nan).astype(np.float64)
        transform = src.transform
        crs = str(src.crs)
        nodata = src.nodata
        height, width = src.height, src.width
        xs, ys = pixel_centers(transform, height, width)

    core_mask = (
        (xs[None, :] >= CORE[0]) & (xs[None, :] <= CORE[2]) &
        (ys[:, None] >= CORE[1]) & (ys[:, None] <= CORE[3])
    )
    highres = np.isfinite(gmrt)
    highres_ocean = highres & (gmrt < 0)
    core_highres = highres & core_mask
    core_ocean = highres_ocean & core_mask
    core_depth = -gmrt[core_ocean]

    total_core_pixels = int(np.count_nonzero(core_mask))
    highres_core_pixels = int(np.count_nonzero(core_highres))
    ocean_core_pixels = int(np.count_nonzero(core_ocean))

    depth60_70 = int(np.count_nonzero((core_depth >= 60.0) & (core_depth <= 70.0))) if core_depth.size else 0
    depth_gt100 = int(np.count_nonzero(core_depth > 100.0)) if core_depth.size else 0

    metadata_state = "PRESENT" if metadata_path.exists() else "MISSING"
    report = {
        "schema": "kaopu.palau.gmrt-context-r04/1.0",
        "gmrtRole": "HIGH_RESOLUTION_CONTRIBUTOR_CONTEXT_NOT_REEF_SURVEY_TRUTH",
        "contextBBoxWGS84": CONTEXT,
        "coreBBoxWGS84": CORE,
        "storyAnchorWGS84": ANCHOR,
        "sourceFiles": {
            "topo": str(topo_path.relative_to(args.intake)),
            "topoMask": str(mask_path.relative_to(args.intake)),
            "metadata": str(metadata_path.relative_to(args.intake)),
            "metadataState": metadata_state,
        },
        "raster": {
            "crs": crs,
            "shape": [height, width],
            "nodata": nodata,
            "highResolutionContributorPixelsContext": int(np.count_nonzero(highres)),
            "highResolutionOceanPixelsContext": int(np.count_nonzero(highres_ocean)),
            "corePixelCount": total_core_pixels,
            "coreHighResolutionContributorPixels": highres_core_pixels,
            "coreHighResolutionOceanPixels": ocean_core_pixels,
            "coreHighResolutionContributorFraction": (highres_core_pixels / total_core_pixels) if total_core_pixels else None,
            "coreHighResolutionOceanFraction": (ocean_core_pixels / total_core_pixels) if total_core_pixels else None,
            "nearestHighResolutionOceanPixelToStoryAnchorM": nearest_distance_m(xs, ys, highres_ocean, ANCHOR),
        },
        "coreHighResolutionOceanDepthM": stats(core_depth),
        "workingHypothesisCheck": {
            "pixelsBetween60And70M": depth60_70,
            "pixelsDeeperThan100M": depth_gt100,
            "status": "CONTEXT_CHECK_ONLY",
            "warning": (
                "GMRT topo-mask identifies high-resolution contributors, not a homogeneous survey. "
                "These pixels may include curated multibeam or contributed grids and are not used to prove "
                "reef-interior maximum depth."
            ),
        },
        "verticalDatumBoundary": (
            "No vertical-datum conversion is performed. GMRT elevations remain in their published synthesis frame; "
            "ENC chart depths remain in their chart-datum frame. Direct residuals are therefore not treated as truth."
        ),
        "candidateGridUse": {
            "used": False,
            "reason": (
                "GMRT is retained as regional/high-resolution context until source lineage and vertical compatibility "
                "are resolved. ENC SOUNDG/DEPCNT with M_QUAL remain the current reef-depth constraints."
            ),
        },
        "sourceIdentityBoundary": (
            "A valid topo-mask pixel means GMRT high-resolution contributor coverage. It must not be relabeled as "
            "ship multibeam or direct measurement without contributor-level provenance."
        ),
    }

    args.results.mkdir(parents=True, exist_ok=True)
    (args.results / "preview").mkdir(parents=True, exist_ok=True)
    out_json = args.results / "GMRT_CONTEXT_R04.json"
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fig, ax = plt.subplots(figsize=(7, 7))
    display = np.where(highres_ocean, -gmrt, np.nan)
    im = ax.imshow(
        display,
        extent=[xs.min(), xs.max(), ys.min(), ys.max()],
        origin="upper",
        interpolation="nearest",
    )
    ax.set_title("GMRT high-resolution ocean contributor context (depth, m)")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.plot([CORE[0], CORE[2], CORE[2], CORE[0], CORE[0]], [CORE[1], CORE[1], CORE[3], CORE[3], CORE[1]], linewidth=1.5)
    ax.scatter([ANCHOR[0]], [ANCHOR[1]], marker="x", s=55)
    fig.colorbar(im, ax=ax, label="GMRT synthesis depth (m; not ENC chart datum)")
    fig.tight_layout()
    fig.savefig(args.results / "preview/GMRT_HIGHRES_CONTEXT_R04.png", dpi=170)
    plt.close(fig)

    evidence = args.results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if evidence.exists():
        doc = json.loads(evidence.read_text(encoding="utf-8"))
        doc["gmrtContextR04"] = report
        evidence.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "core_highres_fraction": report["raster"]["coreHighResolutionContributorFraction"],
        "core_ocean_pixels": ocean_core_pixels,
        "depth_stats": report["coreHighResolutionOceanDepthM"],
        "between_60_70": depth60_70,
        "deeper_than_100": depth_gt100,
        "candidate_grid_used": False,
    }, indent=2))


if __name__ == "__main__":
    main()
