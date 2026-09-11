#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from osgeo import gdal

ROWS = 1003
COLS = 884
BOUNDS = [190250.0, 2991250.0, 411250.0, 3242000.0]
NODATA = -32768
SOURCE_RUN_ID = 34189255543
SOURCE_COMMIT = 'b8471edd4de95a50656ae95d6559c2f687301f42'
SOURCE_RELEASE_TAG = 'wenzhou-r3.7-soilgrids-evidence-20260911'

ARTIFACT_DIGESTS = {
    'physical_texture': '9cc80faaf1cf6bde8ae5d77beeda73f2c6dc8b485b3a1bb22b65a00d258c5278',
    'chemical_carbon': 'f961be74e11912bfb56c85ddaa728e1a5a10cdae624464f13f2589fc8dd73ac0',
    'hydraulic': '3c0f590da84a7ab4646d3e32e8ce23ca26923eeb7663d02264e1d00e946c23d8',
    'wrb': 'a32110ba7bdf94c95e61486e7514c8a856957350ca25caedf444ef2fe5d97b30',
}

PROPERTIES = {
    'clay': {'group': 'physical_texture', 'labelZh': '黏土', 'mappedUnit': 'g/kg', 'conversionFactor': 10, 'conventionalUnit': 'mass%'},
    'sand': {'group': 'physical_texture', 'labelZh': '砂', 'mappedUnit': 'g/kg', 'conversionFactor': 10, 'conventionalUnit': 'mass%'},
    'silt': {'group': 'physical_texture', 'labelZh': '粉砂', 'mappedUnit': 'g/kg', 'conversionFactor': 10, 'conventionalUnit': 'mass%'},
    'soc': {'group': 'chemical_carbon', 'labelZh': '土壤有机碳', 'mappedUnit': 'dg/kg', 'conversionFactor': 10, 'conventionalUnit': 'g/kg'},
    'phh2o': {'group': 'chemical_carbon', 'labelZh': 'pH', 'mappedUnit': 'pH x 10', 'conversionFactor': 10, 'conventionalUnit': 'pH'},
    'bdod': {'group': 'physical_texture', 'labelZh': '容重', 'mappedUnit': 'cg/cm3', 'conversionFactor': 100, 'conventionalUnit': 'kg/dm3'},
    'cfvo': {'group': 'physical_texture', 'labelZh': '粗颗粒体积分数', 'mappedUnit': 'cm3/dm3', 'conversionFactor': 10, 'conventionalUnit': 'vol%'},
    'wv0033': {'group': 'hydraulic', 'labelZh': '33 kPa 持水量', 'mappedUnit': '10^-3 cm3/cm3', 'conversionFactor': 10, 'conventionalUnit': 'vol%'},
}


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read_tif(path: Path) -> tuple[np.ndarray, list[float]]:
    ds = gdal.Open(str(path), gdal.GA_ReadOnly)
    if ds is None:
        raise RuntimeError(f'cannot open {path}')
    if ds.RasterXSize != COLS or ds.RasterYSize != ROWS:
        raise RuntimeError(f'shape mismatch for {path}: {ds.RasterXSize}x{ds.RasterYSize}')
    arr = ds.GetRasterBand(1).ReadAsArray()
    if arr is None:
        raise RuntimeError(f'cannot read {path}')
    arr = np.asarray(arr, dtype=np.int16)
    gt = list(ds.GetGeoTransform())
    ds = None
    return arr, gt


def stats(arr: np.ndarray) -> dict:
    v = arr[arr != NODATA].astype(np.float64)
    if not v.size:
        return {'validCount': 0}
    q = np.percentile(v, [2, 5, 50, 95, 98])
    return {
        'validCount': int(v.size),
        'noDataCount': int(arr.size - v.size),
        'minRaw': int(v.min()),
        'maxRaw': int(v.max()),
        'p02Raw': float(q[0]),
        'p05Raw': float(q[1]),
        'p50Raw': float(q[2]),
        'p95Raw': float(q[3]),
        'p98Raw': float(q[4]),
    }


def find_tif(stage: Path, group: str, prop: str, statistic: str) -> Path:
    cid = f'{prop}_0-5cm_{statistic}'
    path = stage / group / 'aligned_context' / prop / f'{cid}_EPSG32651_250M.tif'
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def write_layer(output: Path, stage: Path, prop: str, statistic: str, meta: dict) -> dict:
    src = find_tif(stage, meta['group'], prop, statistic)
    arr, gt = read_tif(src)
    name = f'{prop}-0-5cm-{statistic.lower().replace(".", "")}.i16le'
    dst = output / name
    dst.write_bytes(arr.astype('<i2', copy=False).tobytes(order='C'))
    expected = ROWS * COLS * 2
    if dst.stat().st_size != expected:
        raise RuntimeError(f'raw byte size mismatch for {name}')
    if statistic == 'uncertainty':
        mapped_unit = 'SoilGrids uncertainty index'
        conversion_factor = 1
        conventional_unit = 'relative index'
    else:
        mapped_unit = meta['mappedUnit']
        conversion_factor = meta['conversionFactor']
        conventional_unit = meta['conventionalUnit']
    return {
        'property': prop,
        'labelZh': meta['labelZh'],
        'depth': '0-5cm',
        'statistic': statistic,
        'path': name,
        'bytes': dst.stat().st_size,
        'sha256': sha(dst),
        'sourceAlignedTifSha256': sha(src),
        'rows': ROWS,
        'columns': COLS,
        'geotransform': gt,
        'bounds': BOUNDS,
        'noData': NODATA,
        'mappedUnit': mapped_unit,
        'conversionFactor': conversion_factor,
        'conventionalUnit': conventional_unit,
        'statisticsRaw': stats(arr),
        'sourceRow0IsNorth': True,
        'canonicalTruth': False,
        'fieldObservation': False,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    output = args.output
    output.mkdir(parents=True, exist_ok=True)

    layers = []
    for prop, meta in PROPERTIES.items():
        layers.append(write_layer(output, args.stage, prop, 'Q0.5', meta))
        layers.append(write_layer(output, args.stage, prop, 'uncertainty', meta))

    mask_tif = args.stage / 'physical_texture' / 'aligned_context' / 'LOCKED_DOMAIN_MASK_EPSG32651_250M.tif'
    mask_ds = gdal.Open(str(mask_tif), gdal.GA_ReadOnly)
    if mask_ds is None or mask_ds.RasterXSize != COLS or mask_ds.RasterYSize != ROWS:
        raise RuntimeError('domain mask missing or shape mismatch')
    mask = np.asarray(mask_ds.GetRasterBand(1).ReadAsArray(), dtype=np.uint8)
    mask_ds = None
    mask_path = output / 'locked-domain-mask.u8'
    mask_path.write_bytes(mask.tobytes(order='C'))

    manifest = {
        'schema': 'wenzhou-r3.7-soilgrids-browser-context/r1',
        'sourceIdentity': 'model_prediction_external_observation',
        'provider': 'ISRIC World Soil Information',
        'product': 'SoilGrids 2.0 rolling release',
        'sourceAcquisitionRunId': SOURCE_RUN_ID,
        'sourceAcquisitionCommit': SOURCE_COMMIT,
        'sourcePermanentReleaseTag': SOURCE_RELEASE_TAG,
        'sourceArtifactDigests': ARTIFACT_DIGESTS,
        'crs': 'EPSG:32651',
        'resolutionM': 250,
        'rows': ROWS,
        'columns': COLS,
        'bounds': BOUNDS,
        'depth': '0-5cm',
        'mask': {'path': mask_path.name, 'bytes': mask_path.stat().st_size, 'sha256': sha(mask_path)},
        'layers': layers,
        'displayPolicy': {
            'loadSelectedPropertyOnDemand': True,
            'medianAndUncertaintyKeptSeparate': True,
            'uncertaintyIsRelativeIndex': True,
            'interpolation': 'bilinear-for-display-only',
            'heightDisplacement': False,
            'mayGenerateFieldBoundaries': False,
            'mayGenerateIndividualObjects': False,
        },
        'truthBoundary': {
            'canonicalTruth': False,
            'mayClaim12p5mSoilTruth': False,
            'mayReplaceFieldSurvey': False,
            'mayOverrideCanonicalDem': False,
            'farmLevelUseRequiresLocalCalibration': True,
            'productionReady': False,
        },
    }
    manifest_path = output / 'soil-context.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': True, 'layers': len(layers), 'bytes': sum(x['bytes'] for x in layers) + mask_path.stat().st_size, 'manifest': str(manifest_path)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
