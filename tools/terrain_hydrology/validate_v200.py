#!/usr/bin/env python3
"""Fail-closed validation for the high-precision terrain and hydrology workbench."""
from __future__ import annotations
import argparse,json
from pathlib import Path
from PIL import Image

def main()->int:
    parser=argparse.ArgumentParser(); parser.add_argument('--site',required=True,type=Path); args=parser.parse_args(); site=args.site.resolve()
    manifest=json.loads((site/'manifest.json').read_text(encoding='utf-8'))
    if manifest['schema']!='terrain-hydrology-workbench@2.0.0': raise SystemExit('unexpected manifest schema')
    if [r['id'] for r in manifest['regions']]!=['guilin','wenzhou','kunming']: raise SystemExit('three-region order mismatch')
    release=manifest['release']
    if release['truthOverwrite'] is not False or release['syntheticGapFill'] is not False or release['sourceResampling'] is not False or release['derivedHydrologyAuthoritative'] is not False: raise SystemExit('release truth boundary failed')
    for region in manifest['regions']:
        if region['grid']['width']!=800 or region['grid']['height']!=800: raise SystemExit(f"{region['id']} is not 800 x 800")
        if region['grid']['spacingMeters']!=[12.5,12.5]: raise SystemExit(f"{region['id']} spacing mismatch")
        if region['world']!={'widthMeters':10000,'heightMeters':10000}: raise SystemExit(f"{region['id']} world mismatch")
        if region['exactMetricSlice'] is not True or region['source']['resampled'] is not False: raise SystemExit(f"{region['id']} exact source contract failed")
        if region['source']['validFraction']<=0: raise SystemExit(f"{region['id']} has no valid samples")
        root=site/region['assets']['root'].removeprefix('./'); height=root/region['assets']['height']; mask=root/region['assets']['mask']; hydro=root/region['assets']['hydrology']; preview=root/region['assets']['preview']
        if height.stat().st_size!=800*800*2: raise SystemExit(f"{region['id']} height byte count mismatch")
        if mask.stat().st_size!=800*800: raise SystemExit(f"{region['id']} mask byte count mismatch")
        for image_path in (hydro,preview):
            with Image.open(image_path) as image:
                if image.size!=(800,800): raise SystemExit(f"{region['id']} image size mismatch")
                image.verify()
        if region['render']['focusMesh']<700: raise SystemExit(f"{region['id']} focus mesh too low")
    text_paths=[p for p in site.rglob('*') if p.is_file() and p.suffix.lower() in {'.html','.js','.css','.json','.md'}]
    combined='\n'.join(p.read_text(encoding='utf-8',errors='ignore') for p in text_paths).lower()
    for token in ('cesium','sesame','?region=','iframe'):
        if token in combined: raise SystemExit(f'forbidden runtime token present: {token}')
    index=(site/'index.html').read_text(encoding='utf-8')
    if 'http://' in index or 'https://' in index: raise SystemExit('runtime index contains external URL')
    if '<script type="module" src="./app.js"></script>' not in index or '单独精细查看' not in index: raise SystemExit('direct page or focus control missing')
    evidence=json.loads((site/'build-evidence.json').read_text(encoding='utf-8'))
    if evidence['pageChecks']['singleDirectPage'] is not True or evidence['pageChecks']['intermediateSelectionPage'] is not False: raise SystemExit('direct page contract failed')
    print(json.dumps({'passed':True,'regions':3,'grid':[800,800],'focusMeshMinimum':min(r['render']['focusMesh'] for r in manifest['regions']),'externalRuntimeDependencies':0,'forbiddenRuntimeTokens':0},ensure_ascii=False,indent=2)); return 0

if __name__=='__main__': raise SystemExit(main())
