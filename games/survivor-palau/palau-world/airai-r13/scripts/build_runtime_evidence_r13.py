#!/usr/bin/env python3
"""Build the source-coupled R13 browser payload from reconstructed R11 grids."""
from __future__ import annotations

import argparse
import base64
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.features import rasterize

I16_NODATA = -32768
U16_NODATA = 65535


def valid(array, nodata):
    result = np.isfinite(array)
    return result if nodata is None else result & (array != nodata)


def encoded(array, dtype):
    raw = np.ascontiguousarray(
        array.astype(np.dtype(dtype).newbyteorder("<"), copy=False)
    ).tobytes()
    return base64.b64encode(raw).decode("ascii")


def qi16(array, ok, scale=10):
    output = np.full(array.shape, I16_NODATA, dtype=np.int16)
    values = np.rint(array[ok] * scale)
    if np.any(values < -32767) or np.any(values > 32767):
        raise ValueError("int16 overflow")
    output[ok] = values.astype(np.int16)
    return output


def qu16(array, ok, scale=1):
    output = np.full(array.shape, U16_NODATA, dtype=np.uint16)
    values = np.rint(array[ok] * scale)
    if np.any(values < 0) or np.any(values > 65534):
        raise ValueError("uint16 overflow")
    output[ok] = values.astype(np.uint16)
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True)
    args = parser.parse_args()

    root = args.root.resolve()
    results = args.results.resolve()
    grids = results / "grids"
    vectors = results / "vectors"
    source = root / "source"
    data = root / "data"
    source.mkdir(parents=True, exist_ok=True)
    data.mkdir(parents=True, exist_ok=True)

    paths = {
        "depth": grids / "candidate_depth_chart_datum_m_r11.tif",
        "unc": grids / "candidate_uncertainty_enc_depare_conditioned_m_r11.tif",
        "near": grids / "nearest_evidence_distance_m_r11.tif",
        "quality": grids / "candidate_source_quality_weight_r11.tif",
        "semantic": grids / "candidate_semantic_zone_r08.tif",
        "support": grids / "candidate_support_class_r11.tif",
        "lower": grids / "enc_depare_drval1_m_r11.tif",
        "upper": grids / "enc_depare_drval2_m_r11.tif",
        "residual": grids / "enc_depare_range_residual_m_r11.tif",
        "land": vectors / "LNDARE.geojson",
        "soundings": vectors / "SOUNDG_QUALITY_JOINED.geojson",
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise SystemExit("missing runtime inputs: " + ", ".join(missing))

    arrays = {}
    nodata = {}
    with rasterio.open(paths["depth"]) as dataset:
        signature = (
            dataset.width,
            dataset.height,
            str(dataset.crs),
            tuple(dataset.transform),
        )
        width, height = dataset.width, dataset.height
        crs = dataset.crs
        transform = dataset.transform
        bounds = dataset.bounds
        arrays["depth"] = dataset.read(1).astype(float)
        nodata["depth"] = dataset.nodata

    for key in (
        "unc",
        "near",
        "quality",
        "semantic",
        "support",
        "lower",
        "upper",
        "residual",
    ):
        with rasterio.open(paths[key]) as dataset:
            current = (
                dataset.width,
                dataset.height,
                str(dataset.crs),
                tuple(dataset.transform),
            )
            if current != signature:
                raise SystemExit("alignment mismatch: " + key)
            arrays[key] = dataset.read(1)
            nodata[key] = dataset.nodata

    depth_ok = valid(arrays["depth"], nodata["depth"])
    unc_ok = valid(arrays["unc"], nodata["unc"])
    near_ok = valid(arrays["near"], nodata["near"])
    quality_ok = valid(arrays["quality"], nodata["quality"])
    all_ok = depth_ok & unc_ok & near_ok & quality_ok
    if int(all_ok.sum()) != 56874:
        raise SystemExit(f"unexpected valid cells: {int(all_ok.sum())}")

    land = gpd.read_file(paths["land"])
    land = land.set_crs(4326) if land.crs is None else land.to_crs(4326)
    land = land[land.geometry.notna() & ~land.geometry.is_empty]
    land = land[
        land.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
    ].to_crs(crs)
    land_mask = rasterize(
        [(geometry, 1) for geometry in land.geometry],
        out_shape=(height, width),
        transform=transform,
        fill=0,
        dtype="uint8",
    )

    output_arrays = {
        "valid": all_ok.astype(np.uint8),
        "land": land_mask.astype(np.uint8),
        "depthDm": qi16(arrays["depth"], depth_ok),
        "uncertaintyDm": qu16(arrays["unc"].astype(float), unc_ok, 10),
        "nearestM": qu16(arrays["near"].astype(float), near_ok),
        "qualityQ": np.where(
            quality_ok,
            np.rint(np.clip(arrays["quality"], 0, 1) * 254),
            0,
        ).astype(np.uint8),
        "semantic": arrays["semantic"].astype(np.uint8),
        "support": arrays["support"].astype(np.uint8),
        "depareLowerDm": qi16(
            arrays["lower"].astype(float),
            valid(arrays["lower"], nodata["lower"]),
        ),
        "depareUpperDm": qi16(
            arrays["upper"].astype(float),
            valid(arrays["upper"], nodata["upper"]),
        ),
        "depareResidualDm": qu16(
            arrays["residual"].astype(float),
            valid(arrays["residual"], nodata["residual"]),
            10,
        ),
    }

    center_e = (bounds.left + bounds.right) / 2
    center_n = (bounds.bottom + bounds.top) / 2
    inverse = Transformer.from_crs(crs, 4326, always_xy=True)
    center_lonlat = inverse.transform(center_e, center_n)
    southwest = inverse.transform(bounds.left, bounds.bottom)
    northeast = inverse.transform(bounds.right, bounds.top)

    soundings = gpd.read_file(paths["soundings"])
    soundings = (
        soundings.set_crs(4326)
        if soundings.crs is None
        else soundings.to_crs(4326)
    )
    core = soundings.cx[134.535:134.605, 7.315:7.385].to_crs(crs).copy()
    core["depth_m"] = pd.to_numeric(core["depth_m"], errors="coerce")
    points = []
    for _, row in core.iterrows():
        if (
            row.geometry is None
            or row.geometry.is_empty
            or not math.isfinite(float(row["depth_m"]))
        ):
            continue
        points.append(
            [
                round(float(row.geometry.x - center_e), 2),
                round(float(row.geometry.y - center_n), 2),
                round(float(row["depth_m"]), 2),
                str(row.get("zoc_label") or "UNQUALIFIED"),
                str(row.get("_enc_cell") or ""),
                str(row.get("semantic_zone") or ""),
            ]
        )
    if len(points) != 392:
        raise SystemExit(f"unexpected core soundings: {len(points)}")

    metadata = {
        "schema": "kaopu.palau.airai-r13-runtime-evidence-grid/1.0",
        "version": "AIRAI_R13_EVIDENCE_BOUND_CORE_20260921",
        "width": width,
        "height": height,
        "resolutionM": float(transform.a),
        "utmEpsg": 32653,
        "originWestM": float(bounds.left),
        "originNorthM": float(bounds.top),
        "centerEastingM": center_e,
        "centerNorthingM": center_n,
        "centerLonLat": list(center_lonlat),
        "bboxWGS84": [
            southwest[0],
            southwest[1],
            northeast[0],
            northeast[1],
        ],
        "validCandidateCells": int(all_ok.sum()),
        "landCells": int(land_mask.sum()),
        "waterCandidateCellsAfterLandSuppression": int(
            (all_ok & (land_mask == 0)).sum()
        ),
        "soundings": len(points),
        "datum": {
            "code": 24,
            "name": "local datum",
            "mslEquivalence": "NOT_ASSERTED",
        },
        "status": "AIRAI_CORE_EVIDENCE_BOUND_CANDIDATE_NOT_SURVEY_TRUTH",
        "fullPalauTerrainStatus": (
            "BLOCKED_COMPLETE_PALAU_DEM_OR_AUTHORITY_RASTER_MISSING"
        ),
        "storyRegionStatus": "BLOCKED_EXACT_AUTHORITY_IMAGE_BINARY_MISSING",
        "sampling": (
            "nearest 25 m evidence cell; NoData is never bridged; "
            "land mask suppresses candidate water depth"
        ),
        "semanticNames": {
            "0": "NoData",
            "1": "outside_allen_geomorphic_or_unclassified",
            "2": "reef_flat_or_crest",
            "3": "shallow_lagoon",
            "4": "deep_lagoon",
            "5": "reef_slope",
            "6": "plateau",
        },
        "supportNames": {
            "0": "NoData",
            "1": "outside_selected_DEPARE",
            "2": "within_DEPARE_range",
            "3": "shallower_than_DRVAL1",
            "4": "deeper_than_DRVAL2",
        },
        "quantization": {
            "depthDm": {
                "type": "Int16LE",
                "scaleM": 0.1,
                "nodata": I16_NODATA,
            },
            "uncertaintyDm": {
                "type": "Uint16LE",
                "scaleM": 0.1,
                "nodata": U16_NODATA,
            },
            "nearestM": {
                "type": "Uint16LE",
                "scaleM": 1,
                "nodata": U16_NODATA,
            },
            "qualityQ": {"type": "Uint8", "scale": 1 / 254},
            "depareLowerDm": {
                "type": "Int16LE",
                "scaleM": 0.1,
                "nodata": I16_NODATA,
            },
            "depareUpperDm": {
                "type": "Int16LE",
                "scaleM": 0.1,
                "nodata": I16_NODATA,
            },
            "depareResidualDm": {
                "type": "Uint16LE",
                "scaleM": 0.1,
                "nodata": U16_NODATA,
            },
        },
    }

    types = {
        "valid": ("u8", "u1"),
        "land": ("u8", "u1"),
        "depthDm": ("i16", "i2"),
        "uncertaintyDm": ("u16", "u2"),
        "nearestM": ("u16", "u2"),
        "qualityQ": ("u8", "u1"),
        "semantic": ("u8", "u1"),
        "support": ("u8", "u1"),
        "depareLowerDm": ("i16", "i2"),
        "depareUpperDm": ("i16", "i2"),
        "depareResidualDm": ("u16", "u2"),
    }
    payload = {
        "meta": metadata,
        "arrays": {
            key: {
                "type": types[key][0],
                "b64": encoded(value, types[key][1]),
            }
            for key, value in output_arrays.items()
        },
        "soundings": points,
    }
    runtime_path = source / "runtime_evidence_grid_r13.js"
    runtime_path.write_text(
        "window.__AIRAI_R13_EVIDENCE__="
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    receipt = {
        **metadata,
        "runtimeJs": {
            "path": str(runtime_path.relative_to(root)),
            "bytes": runtime_path.stat().st_size,
        },
        "oldCandidateAnchorLoaded": False,
        "traditionalLOD": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    receipt_path = data / "RUNTIME_EVIDENCE_GRID_R13.json"
    receipt_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
