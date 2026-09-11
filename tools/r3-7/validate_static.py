#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site/dist/r3-7'
DATA = SITE / 'data/soil'
required = [
    SITE / 'index.html',
    SITE / 'bootstrap.js',
    SITE / 'soil-context.js',
    DATA / 'soil-context.json',
]
checks: dict[str, bool] = {}
errors: list[str] = []
for p in required:
    ok = p.is_file()
    checks[f'exists:{p.relative_to(ROOT)}'] = ok
    if not ok:
        errors.append(f'missing:{p.relative_to(ROOT)}')
if errors:
    print(json.dumps({'passed': False, 'checks': checks, 'errors': errors}, indent=2))
    raise SystemExit(2)

html = (SITE / 'index.html').read_text(encoding='utf-8')
boot = (SITE / 'bootstrap.js').read_text(encoding='utf-8')
js = (SITE / 'soil-context.js').read_text(encoding='utf-8')
m = json.loads((DATA / 'soil-context.json').read_text(encoding='utf-8'))
props = {'clay','sand','silt','soc','phh2o','bdod','cfvo','wv0033'}
layer_keys = {(x.get('property'), x.get('statistic')) for x in m.get('layers', [])}
expected_keys = {(p,s) for p in props for s in ('Q0.5','uncertainty')}

checks.update({
    'title-r37': 'R3.7' in html,
    'inherits-r36-bootstrap': "await import('../r3-6/bootstrap.js')" in boot,
    'legacy-r33-display-suppressed-current-page-only': "Symbol.for('wenzhou.r3.3.surface-evidence-installed')" in boot,
    'r33-history-not-copied-or-deleted': not (SITE / 'surface-evidence.js').exists(),
    'legacy-show-surface-removed-from-r37-ui': 'id="show-surface"' not in html and 'id="surface-card"' not in html,
    'soil-ui-present': all(token in html for token in ['id="show-soil-context"','id="soil-property"','id="show-soil-uncertainty"','id="soil-context-card"']),
    'manifest-schema': m.get('schema') == 'wenzhou-r3.7-soilgrids-browser-context/r1',
    'manifest-source-identity': m.get('sourceIdentity') == 'model_prediction_external_observation',
    'manifest-resolution-250m': m.get('resolutionM') == 250,
    'manifest-shape': [m.get('rows'),m.get('columns')] == [1003,884],
    'manifest-depth-0-5cm': m.get('depth') == '0-5cm',
    'manifest-16-layers': len(m.get('layers', [])) == 16,
    'manifest-property-stat-pairs': layer_keys == expected_keys,
    'manifest-permanent-release': m.get('sourcePermanentReleaseTag') == 'wenzhou-r3.7-soilgrids-evidence-20260911',
    'truth-not-canonical': m.get('truthBoundary',{}).get('canonicalTruth') is False,
    'truth-not-field-survey': m.get('truthBoundary',{}).get('mayReplaceFieldSurvey') is False,
    'truth-no-dem-override': m.get('truthBoundary',{}).get('mayOverrideCanonicalDem') is False,
    'truth-local-calibration': m.get('truthBoundary',{}).get('farmLevelUseRequiresLocalCalibration') is True,
    'display-no-height-displacement': m.get('displayPolicy',{}).get('heightDisplacement') is False,
    'display-no-field-boundary-generation': m.get('displayPolicy',{}).get('mayGenerateFieldBoundaries') is False,
    'display-no-object-generation': m.get('displayPolicy',{}).get('mayGenerateIndividualObjects') is False,
    'uncertainty-separate': m.get('displayPolicy',{}).get('medianAndUncertaintyKeptSeparate') is True,
    'uncertainty-relative-index': m.get('displayPolicy',{}).get('uncertaintyIsRelativeIndex') is True,
    'runtime-sha-verifies': 'crypto.subtle.digest' in js and 'checkedBytes' in js,
    'runtime-on-demand-property': 'selectedProperty()' in js and 'loadLayer(median)' in js and 'loadLayer(unc)' in js,
    'runtime-no-height-claim': "soilContextHeightClaim:'none'" in js and "heightClaim='none'" in js,
    'runtime-uncertainty-visual-only': 'uUseUncertainty' in js and 'mix(c,vec3(gray)' in js,
    'runtime-no-extrusion': not re.search(r'ExtrudeGeometry|BoxGeometry|CylinderGeometry', js),
    'runtime-no-terrain-position-write': not re.search(r'\.setY\(|attributes\.position\.setY|position\.array\s*\[', js),
})

for x in m.get('layers', []):
    p = DATA / x['path']
    key = f"payload:{x['property']}:{x['statistic']}"
    ok = p.is_file() and p.stat().st_size == x['bytes']
    if ok:
        h = hashlib.sha256()
        with p.open('rb') as f:
            for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
                h.update(chunk)
        ok = h.hexdigest() == x['sha256']
    checks[key] = ok
    if x.get('statistic') == 'uncertainty':
        checks[f"uncertainty-unit:{x['property']}"] = x.get('conventionalUnit') == 'relative index' and x.get('conversionFactor') == 1

mask = m.get('mask', {})
mp = DATA / mask.get('path','')
mask_ok = mp.is_file() and mp.stat().st_size == mask.get('bytes')
if mask_ok:
    mask_ok = hashlib.sha256(mp.read_bytes()).hexdigest() == mask.get('sha256')
checks['domain-mask-sha'] = mask_ok

for k,v in checks.items():
    if not v:
        errors.append(k)

result = {
    'schema': 'wenzhou-r3.7-soil-static-qa/r1',
    'passed': not errors,
    'checks': checks,
    'errors': errors,
    'boundary': 'SoilGrids 250 m is model-prediction external evidence. R3.7 preserves median and relative uncertainty separately, generates no height/field/object truth, and keeps R3.2-R3.6 history outside this new site directory.'
}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(1 if errors else 0)
