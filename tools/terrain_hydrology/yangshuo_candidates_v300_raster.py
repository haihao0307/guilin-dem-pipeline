"""Verified raster I/O helpers for Yangshuo Lijiang candidates v3.0."""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from yangshuo_candidates_v300_common import sha


def dependencies() -> tuple[Any, Any, Any, Any, Any]:
    try:
        import numpy as np
        from PIL import Image, ImageDraw
        from osgeo import gdal, osr
    except ImportError as exc:
        raise SystemExit(f"NumPy, Pillow and GDAL Python bindings are required: {exc}") from exc
    return np, Image, ImageDraw, gdal, osr


def dataset_epsg(dataset: Any, osr: Any) -> str:
    reference = osr.SpatialReference(); reference.ImportFromWkt(dataset.GetProjectionRef()); reference.AutoIdentifyEPSG()
    code = reference.GetAuthorityCode(None) or reference.GetAuthorityCode("PROJCS")
    return f"EPSG:{code}" if code else "unknown"


def check_source(source: Path, dataset: Any, config: dict[str, Any], osr: Any) -> tuple[Any, float | None]:
    truth = config["truthSource"]
    if not source.is_file(): raise SystemExit(f"Source DEM missing: {source}")
    if source.name != truth["file"]: raise SystemExit(f"Source filename mismatch: {source.name}")
    if source.stat().st_size != truth["bytes"]: raise SystemExit("Source byte count mismatch")
    if sha(source) != truth["expectedSha256"]: raise SystemExit("Source SHA256 mismatch")
    if dataset is None or dataset.RasterCount < 1: raise SystemExit("GDAL could not open a valid source DEM")
    if [dataset.RasterXSize, dataset.RasterYSize] != truth["grid"]: raise SystemExit("Source grid mismatch")
    if dataset_epsg(dataset, osr) != config["crs"]: raise SystemExit("Source CRS mismatch")
    geotransform = dataset.GetGeoTransform(can_return_null=True)
    if geotransform is None or any(not math.isclose(float(geotransform[i]), float(value), abs_tol=1e-6) for i, value in enumerate(truth["transform"])):
        raise SystemExit("Source geotransform mismatch")
    band = dataset.GetRasterBand(1); nodata = band.GetNoDataValue()
    if nodata is not None and truth.get("nodata") is not None and not math.isclose(float(nodata), float(truth["nodata"]), abs_tol=1e-6):
        raise SystemExit("Source NoData mismatch")
    return band, nodata


def translate_slice(gdal: Any, dataset: Any, band: Any, window: list[int], path: Path) -> None:
    options: dict[str, Any] = {"srcWin": window, "outputType": band.DataType}
    if gdal.GetDriverByName("COG"):
        options.update(format="COG", creationOptions=["COMPRESS=DEFLATE", "BLOCKSIZE=512", "OVERVIEWS=IGNORE_EXISTING"])
    else:
        options.update(format="GTiff", creationOptions=["TILED=YES", "COMPRESS=DEFLATE", "BLOCKXSIZE=512", "BLOCKYSIZE=512"])
    result = gdal.Translate(str(path), dataset, options=gdal.TranslateOptions(**options))
    if result is None: raise SystemExit(f"Failed to write {path}")
    result.FlushCache(); result = None


def asset(path: Path, sample_type: str | None = None) -> dict[str, Any]:
    result = {"path": path.name, "sha256": sha(path), "bytes": path.stat().st_size}
    if sample_type: result["sampleType"] = sample_type
    return result
