#!/usr/bin/env python3
"""Resolve S-57 sounding datum lineage for the Airai bathymetry evidence.

R09 corrects an important semantic mistake in earlier audit code: S-57 depth
features normally do NOT carry VERDAT individually. The default sounding datum
is stored in the dataset DSPM SDAT subfield; only areas that differ from that
default are encoded with M_SDAT/VERDAT. No numerical datum conversion is
performed here.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

import geopandas as gpd
import numpy as np
import rasterio
from shapely.geometry import box

CORE = [134.535, 7.315, 134.605, 7.385]
CONTEXT = [134.49, 7.27, 134.64, 7.42]

# S-57 VERDAT enumeration values used by SDAT/M_SDAT. Keep the numeric code as
# canonical evidence; names are convenience labels only.
DATUM_NAMES = {
    1: "mean low water springs",
    2: "mean lower low water springs",
    3: "mean sea level",
    4: "lowest low water",
    5: "mean low water",
    6: "lowest low water springs",
    7: "approximate mean low water springs",
    8: "Indian spring low water",
    9: "low water springs",
    10: "approximate lowest astronomical tide",
    11: "nearly lowest low water",
    12: "mean lower low water",
    13: "low water",
    14: "approximate mean low water",
    15: "approximate mean lower low water",
    16: "mean high water",
    17: "mean high water springs",
    18: "high water",
    19: "approximate mean sea level",
    20: "high water springs",
    21: "mean higher high water",
    22: "equinoctial spring low water",
    23: "lowest astronomical tide",
    24: "local datum",
    25: "International Great Lakes Datum 1985",
    26: "mean water level",
    27: "lower low water large tide",
    28: "higher high water large tide",
    29: "nearly highest high water",
    30: "highest astronomical tide",
}

IHO_UOC_URL = "https://iho.int/iho_pubs/standard/S-57Ed3.1/S-57%20Appendix%20B.1%20Annex%20A%20UOC%20Edition%204.1.0_Jan18_EN.pdf"
GDAL_S57_URL = "https://gdal.org/en/latest/drivers/vector/s57.html"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def run_json_layer(base: Path, layer: str) -> dict | None:
    """Read one S-57 layer through ogr2ogr as GeoJSON, including null geometry."""
    cp = subprocess.run(
        ["ogr2ogr", "-f", "GeoJSON", "/vsistdout/", str(base), layer],
        text=True,
        capture_output=True,
    )
    if cp.returncode != 0 or not cp.stdout.strip():
        return None
    try:
        return json.loads(cp.stdout)
    except json.JSONDecodeError:
        return None


def prop(props: dict, *candidates: str):
    by_upper = {str(k).upper(): v for k, v in props.items()}
    for c in candidates:
        cu = c.upper()
        if cu in by_upper:
            return by_upper[cu]
        for k, v in by_upper.items():
            if k.endswith("_" + cu) or k.endswith(cu):
                return v
    return None


def int_or_none(value):
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def extract_enc_metadata(intake: Path) -> tuple[dict[str, dict], list[dict]]:
    cell_meta: dict[str, dict] = {}
    overrides: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="airai-r09-") as td:
        work = Path(td)
        for zpath in sorted((intake / "raw/noaa_enc").glob("US*.zip")):
            cell = zpath.stem
            target = work / cell
            target.mkdir(parents=True, exist_ok=True)
            try:
                with zipfile.ZipFile(zpath) as zf:
                    zf.extractall(target)
            except zipfile.BadZipFile:
                cell_meta[cell] = {"error": "bad zip", "zipSha256": sha256(zpath)}
                continue
            base = next(iter(target.rglob("*.000")), None)
            if base is None:
                cell_meta[cell] = {"error": "no .000 base found", "zipSha256": sha256(zpath)}
                continue

            dsid = run_json_layer(base, "DSID") or {"features": []}
            feat = (dsid.get("features") or [{}])[0]
            props = feat.get("properties") or {}
            sdat = int_or_none(prop(props, "SDAT"))
            vdat = int_or_none(prop(props, "VDAT"))
            duni = int_or_none(prop(props, "DUNI"))
            huni = int_or_none(prop(props, "HUNI"))
            puni = int_or_none(prop(props, "PUNI"))
            hdat = int_or_none(prop(props, "HDAT"))
            cscl = int_or_none(prop(props, "CSCL"))
            cell_meta[cell] = {
                "zipSha256": sha256(zpath),
                "baseName": base.name,
                "datasetName": prop(props, "DSNM"),
                "edition": prop(props, "EDTN"),
                "updateNumber": prop(props, "UPDN"),
                "issueDate": prop(props, "ISDT"),
                "horizontalDatumCode": hdat,
                "verticalDatumCode": vdat,
                "soundingDatumCode": sdat,
                "soundingDatumName": DATUM_NAMES.get(sdat, "unknown/unmapped") if sdat is not None else None,
                "depthUnitCode": duni,
                "heightUnitCode": huni,
                "positionalAccuracyUnitCode": puni,
                "compilationScale": cscl,
                "dspmFieldsFound": sorted([str(k) for k in props.keys() if str(k).upper().endswith(("SDAT", "VDAT", "DUNI", "HUNI", "PUNI", "HDAT", "CSCL"))]),
            }

            msdat = run_json_layer(base, "M_SDAT")
            if msdat:
                for feature in msdat.get("features", []):
                    p = feature.get("properties") or {}
                    code = int_or_none(prop(p, "VERDAT"))
                    overrides.append({
                        "cell": cell,
                        "code": code,
                        "name": DATUM_NAMES.get(code, "unknown/unmapped") if code is not None else None,
                        "inform": prop(p, "INFORM"),
                        "geometry": feature.get("geometry"),
                    })
    return cell_meta, overrides


def core_source_cells(path: Path, core_poly) -> list[str]:
    if not path.exists():
        return []
    gdf = gpd.read_file(path)
    if gdf.empty:
        return []
    gdf = gdf.to_crs(4326) if gdf.crs else gdf.set_crs(4326)
    gdf = gdf[gdf.intersects(core_poly)]
    if "_enc_cell" not in gdf.columns:
        return []
    return sorted({str(x) for x in gdf["_enc_cell"].dropna().tolist()})


def attach_sounding_datums(results: Path, cell_meta: dict[str, dict], overrides: list[dict]) -> tuple[gpd.GeoDataFrame, dict]:
    src = results / "vectors/SOUNDG_QUALITY_JOINED.geojson"
    snd = gpd.read_file(src)
    snd = snd.to_crs(4326) if snd.crs else snd.set_crs(4326)
    core_poly = box(*CORE)

    ov_gdf = None
    valid_ov = [o for o in overrides if o.get("geometry") and o.get("code") is not None]
    if valid_ov:
        ov_gdf = gpd.GeoDataFrame(
            [{"_enc_cell": o["cell"], "sdat_code": o["code"], "sdat_name": o["name"], "geometry": o["geometry"]} for o in valid_ov],
            geometry=gpd.GeoSeries.from_geojson(json.dumps({"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":o["geometry"]} for o in valid_ov]})),
            crs=4326,
        )

    codes = []
    names = []
    sources = []
    for _, row in snd.iterrows():
        cell = str(row.get("_enc_cell", ""))
        meta = cell_meta.get(cell, {})
        code = meta.get("soundingDatumCode")
        name = meta.get("soundingDatumName")
        source = "DSPM_SDAT"
        if valid_ov:
            for ov in valid_ov:
                if ov["cell"] != cell:
                    continue
                try:
                    from shapely.geometry import shape
                    if shape(ov["geometry"]).covers(row.geometry):
                        code = ov["code"]
                        name = ov["name"]
                        source = "M_SDAT_VERDAT"
                        break
                except Exception:
                    pass
        codes.append(code)
        names.append(name)
        sources.append(source if code is not None else "UNRESOLVED")
    snd["sdat_code"] = codes
    snd["sdat_name"] = names
    snd["sdat_source"] = sources

    out = results / "vectors/SOUNDG_DATUM_JOINED_R09.geojson"
    snd.to_file(out, driver="GeoJSON")

    core = snd[snd.intersects(core_poly)].copy()
    summary = {
        "allSoundings": int(len(snd)),
        "coreSoundings": int(len(core)),
        "coreResolved": int(core["sdat_code"].notna().sum()),
        "coreUnresolved": int(core["sdat_code"].isna().sum()),
        "coreDatumCodeCounts": {str(k): int(v) for k, v in Counter(core["sdat_code"].dropna().astype(int)).items()},
        "coreDatumNameCounts": {str(k): int(v) for k, v in Counter(core["sdat_name"].dropna()).items()},
        "coreDatumSourceCounts": {str(k): int(v) for k, v in Counter(core["sdat_source"].dropna()).items()},
    }
    return snd, summary


def make_datum_aware_grid(results: Path, resolved_code: int | None, resolved_name: str | None, source_cells: list[str]) -> dict:
    grids = results / "grids"
    src_names = {
        "depth": "candidate_depth_chart_datum_m_r02.tif",
        "uncertainty": "candidate_uncertainty_m_r02.tif",
        "nearestEvidence": "nearest_evidence_distance_m_r02.tif",
        "qualityWeight": "candidate_source_quality_weight_r02.tif",
    }
    if resolved_code is None:
        return {"built": False, "reason": "core candidate constraints do not resolve to one S-57 sounding datum"}
    outputs = {}
    for role, name in src_names.items():
        src = grids / name
        if not src.exists():
            continue
        dst = grids / name.replace("_r02.tif", "_r09.tif")
        shutil.copy2(src, dst)
        with rasterio.open(dst, "r+") as ds:
            ds.update_tags(
                WORLD_STATUS="CANDIDATE_NOT_SURVEY_TRUTH",
                SOUNDING_DATUM_CODE=str(resolved_code),
                SOUNDING_DATUM_NAME=resolved_name or "unknown/unmapped",
                SOUNDING_DATUM_SOURCE="S57 DSPM SDAT with M_SDAT override check (R09)",
                DATUM_NUMERIC_TRANSFORM="NONE",
                MSL_EQUIVALENCE="NOT_ASSERTED",
                CORE_SOURCE_CELLS=",".join(source_cells),
            )
        outputs[role] = f"grids/{dst.name}"
    return {
        "built": bool(outputs),
        "numericDepthValuesChanged": False,
        "soundingDatumCode": resolved_code,
        "soundingDatumName": resolved_name,
        "sourceCells": source_cells,
        "outputs": outputs,
        "status": "CANDIDATE_NOT_SURVEY_TRUTH",
        "rule": "R09 improves datum provenance only; it does not convert chart sounding datum to MSL or another vertical datum.",
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--intake", type=Path, required=True)
    ap.add_argument("--results", type=Path, required=True)
    args = ap.parse_args()
    results = args.results
    core_poly = box(*CORE)

    cell_meta, overrides = extract_enc_metadata(args.intake)
    _, sound_summary = attach_sounding_datums(results, cell_meta, overrides)

    core_sound_cells = core_source_cells(results / "vectors/SOUNDG.geojson", core_poly)
    core_contour_cells = core_source_cells(results / "vectors/DEPCNT.geojson", core_poly)
    core_depare_cells = core_source_cells(results / "vectors/DEPARE.geojson", core_poly)
    constraint_cells = sorted(set(core_sound_cells) | set(core_contour_cells))
    codes = sorted({cell_meta[c].get("soundingDatumCode") for c in constraint_cells if cell_meta.get(c, {}).get("soundingDatumCode") is not None})
    override_codes_core = set()
    for ov in overrides:
        if ov.get("geometry") and ov.get("code") is not None:
            try:
                from shapely.geometry import shape
                if shape(ov["geometry"]).intersects(core_poly):
                    override_codes_core.add(int(ov["code"]))
            except Exception:
                pass
    all_codes = sorted(set(codes) | override_codes_core)
    resolved_code = all_codes[0] if len(all_codes) == 1 else None
    resolved_name = DATUM_NAMES.get(resolved_code, "unknown/unmapped") if resolved_code is not None else None

    grid = make_datum_aware_grid(results, resolved_code, resolved_name, constraint_cells)
    report = {
        "schema": "kaopu.palau.s57-sounding-datum-r09/1.0",
        "coreBBoxWGS84": CORE,
        "contextBBoxWGS84": CONTEXT,
        "standardsBasis": {
            "ihoUoc": IHO_UOC_URL,
            "gdalS57": GDAL_S57_URL,
            "rule": "S-57 SOUNDG, VALSOU, DRVAL1/2 and VALDCO are referenced to DSPM SDAT unless an M_SDAT area overrides it. Individual depth objects should not be used to infer sounding datum from VERDAT.",
        },
        "correctionToEarlierR08Audit": "Empty per-feature VERDAT on SOUNDG/DEPARE is expected under S-57 ENC encoding rules and was not a valid reason to call the sounding datum unresolved. R09 reads dataset-level DSPM SDAT and checks M_SDAT overrides instead.",
        "encCellMetadata": cell_meta,
        "m_sdatOverrideCount": len(overrides),
        "m_sdatOverrides": [{k: v for k, v in o.items() if k != "geometry"} for o in overrides],
        "coreSourceCells": {
            "soundings": core_sound_cells,
            "depthContours": core_contour_cells,
            "depthAreas": core_depare_cells,
            "candidateConstraintCells": constraint_cells,
        },
        "candidateConstraintDatumCodes": all_codes,
        "candidateConstraintDatumStatus": "UNIFORM_RESOLVED" if resolved_code is not None else "MIXED_OR_UNRESOLVED",
        "candidateConstraintDatumCode": resolved_code,
        "candidateConstraintDatumName": resolved_name,
        "soundings": sound_summary,
        "datumAwareCandidateGrid": grid,
        "conversionBoundary": "No conversion to mean sea level, ellipsoid height, or another datum is applied without an explicit datum transformation model.",
        "palauWorldContract": "R09 datum provenance is metadata/evidence consumed by the same PalauWorld.sample() conductor; it does not create a separate LOD world.",
    }
    out = results / "ENC_SOUNDING_DATUM_R09.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")

    main_report_path = results / "AIRAI_REEF_EVIDENCE_REPORT.json"
    if main_report_path.exists():
        main_report = json.loads(main_report_path.read_text())
        main_report["soundingDatumR09"] = report
        if grid.get("built"):
            main_report["candidateGridPreferred"] = {
                **(main_report.get("candidateGridPreferred") or {}),
                **grid,
            }
        main_report_path.write_text(json.dumps(main_report, indent=2, ensure_ascii=False) + "\n")

    # Refresh the manifest after all R09 products and report mutation.
    manifest = []
    for p in sorted(results.rglob("*")):
        if p.is_file() and p.name != "MANIFEST.sha256" and "_work" not in p.parts:
            manifest.append(f"{sha256(p)}  {p.relative_to(results).as_posix()}")
    (results / "MANIFEST.sha256").write_text("\n".join(manifest) + "\n")
    print(json.dumps({
        "candidateConstraintDatumStatus": report["candidateConstraintDatumStatus"],
        "candidateConstraintDatumCode": resolved_code,
        "candidateConstraintDatumName": resolved_name,
        "coreSoundings": sound_summary,
        "datumAwareCandidateGrid": grid,
    }, indent=2))


if __name__ == "__main__":
    main()
