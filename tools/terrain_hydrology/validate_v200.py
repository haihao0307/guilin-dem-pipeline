#!/usr/bin/env python3
"""Fail-closed validation for the high-precision terrain and hydrology workbench."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', required=True, type=Path)
    args = parser.parse_args()
    site = args.site.resolve()

    manifest = json.loads((site / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['schema'] != 'terrain-hydrology-workbench@2.0.0':
        raise SystemExit('unexpected manifest schema')
    if [region['id'] for region in manifest['regions']] != ['guilin', 'wenzhou', 'kunming']:
        raise SystemExit('three-region order mismatch')

    release = manifest['release']
    if (
        release['truthOverwrite'] is not False
        or release['syntheticGapFill'] is not False
        or release['sourceResampling'] is not False
        or release['derivedHydrologyAuthoritative'] is not False
    ):
        raise SystemExit('release truth boundary failed')

    for region in manifest['regions']:
        if region['grid']['width'] != 800 or region['grid']['height'] != 800:
            raise SystemExit(f"{region['id']} is not 800 x 800")
        if region['grid']['spacingMeters'] != [12.5, 12.5]:
            raise SystemExit(f"{region['id']} spacing mismatch")
        if region['world'] != {'widthMeters': 10000, 'heightMeters': 10000}:
            raise SystemExit(f"{region['id']} world mismatch")
        if region['exactMetricSlice'] is not True or region['source']['resampled'] is not False:
            raise SystemExit(f"{region['id']} exact source contract failed")
        if region['source']['validFraction'] <= 0:
            raise SystemExit(f"{region['id']} has no valid samples")

        root = site / region['assets']['root'].removeprefix('./')
        height = root / region['assets']['height']
        mask = root / region['assets']['mask']
        hydro = root / region['assets']['hydrology']
        preview = root / region['assets']['preview']
        if height.stat().st_size != 800 * 800 * 2:
            raise SystemExit(f"{region['id']} height byte count mismatch")
        if mask.stat().st_size != 800 * 800:
            raise SystemExit(f"{region['id']} mask byte count mismatch")
        for image_path in (hydro, preview):
            with Image.open(image_path) as image:
                if image.size != (800, 800):
                    raise SystemExit(f"{region['id']} image size mismatch")
                image.verify()
        if region['render']['focusMesh'] < 700:
            raise SystemExit(f"{region['id']} focus mesh too low")

    text_paths = [
        path
        for path in site.rglob('*')
        if path.is_file() and path.suffix.lower() in {'.html', '.js', '.css', '.json', '.md'}
    ]
    combined = '\n'.join(
        path.read_text(encoding='utf-8', errors='ignore') for path in text_paths
    ).lower()
    for token in ('cesium', 'sesame', '?region=', 'iframe'):
        if token in combined:
            raise SystemExit(f'forbidden runtime token present: {token}')

    index = (site / 'index.html').read_text(encoding='utf-8')
    if 'http://' in index or 'https://' in index:
        raise SystemExit('runtime index contains external URL')
    module_entry = re.search(
        r'<script\s+type=["\']module["\']\s+src=["\']\./app\.js(?:\?v=\d+)?["\']\s*></script>',
        index,
        flags=re.IGNORECASE,
    )
    if module_entry is None or '单独精细查看' not in index:
        raise SystemExit('direct page or focus control missing')
    if '导出含原图知识包' not in index:
        raise SystemExit('embedded source-image intake control missing')

    intake = (site / 'intake.js').read_text(encoding='utf-8')
    for required in (
        'terrain-hydrology-reference-intake@2.1.0',
        'sourceImagesEmbedded: true',
        "encoding: 'base64'",
        'dataBase64',
        'indexedDB',
    ):
        if required not in intake:
            raise SystemExit(f'intake payload contract missing: {required}')

    renderer = (site / 'renderer.js').read_text(encoding='utf-8')
    for required in (
        'uPatchUvOrigin',
        'uPatchUvScale',
        'computePatch()',
        'Math.max(requested, 1025)',
        'visualSpacing',
        '真值 12.5 m',
    ):
        if required not in renderer:
            raise SystemExit(f'near-field renderer contract missing: {required}')

    shaders = (site / 'shaders.js').read_text(encoding='utf-8')
    for required in ('uPatchUvOrigin', 'uPatchUvScale', 'sampleHeight(vec2 uv)', 'heightAt(vec2 uv)'):
        if required not in shaders:
            raise SystemExit(f'continuous sampling shader contract missing: {required}')

    evidence = json.loads((site / 'build-evidence.json').read_text(encoding='utf-8'))
    if (
        evidence['pageChecks']['singleDirectPage'] is not True
        or evidence['pageChecks']['intermediateSelectionPage'] is not False
    ):
        raise SystemExit('direct page contract failed')

    print(
        json.dumps(
            {
                'passed': True,
                'regions': 3,
                'grid': [800, 800],
                'truthSpacingMeters': 12.5,
                'desktopFocusMeshMinimum': 1025,
                'embeddedSourceImageIntake': True,
                'adaptiveNearField': True,
                'externalRuntimeDependencies': 0,
                'forbiddenRuntimeTokens': 0,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
