#!/usr/bin/env python3
"""Replay full candidate-size page seams from immutable extracted numerical data."""
import json
from pathlib import Path
import sys

import numpy as np

from gate import digest, require, seam_probe

HERE = Path(__file__).resolve().parent


def audit():
    folder = HERE/'fixtures'
    manifest = json.loads((folder/'ADJACENT_MANIFEST.json').read_text())
    fixture = folder/'adjacent.npz'
    require(digest(fixture.read_bytes()) == manifest['fixtureSha256'], 'adjacent fixture hash')
    decoded = {}
    with np.load(fixture, allow_pickle=False) as arrays:
        for window in manifest['windows']:
            name = window['name']
            a = arrays[name]
            require(list(a.shape) == window['shape'] and a.dtype == np.dtype('<i2'), 'fixture shape/dtype')
            require(digest(a.tobytes()) == window['rawSha256'], 'fixture raw hash')
            mask = a == -32768
            require(int(mask.sum()) == window['nodataCount'], 'fixture NoData count')
            decoded[name] = (window, a, mask)
    seams = seam_probe(decoded, size=514, stride=512,
                       modes=('overview', 'focus', 'hydrology', 'physics', 'exact', 'archive'))
    comparisons = seams['comparisons']
    report = {'schema': 'wenzhou-fullsize-adjacent-gate/r1',
              'coldStoreSha256': manifest['coldStoreSha256'],
              'coldIndexSha256': manifest['coldIndexSha256'],
              'fixtureSha256': manifest['fixtureSha256'],
              'verifiedColdRecords': len(manifest['verifiedColdRecords']),
              'existingPrSeedsMatchColdStore': manifest['existingSeedsMatchColdStore'],
              'candidateCoreSamples': 512, 'haloSamples': 1, 'maxPageShape': [514, 514],
              'reversibleTransformLevels': 5,
              'note': 'V0.1 selection rules applied at candidate page size; not an accepted final multiscale codec',
              'windows': manifest['windows'],
              'independentExactRecoveryPassed': True,
              'comparisonCount': len(comparisons),
              'mismatchingComparisons': sum(x['maxSharedHeightDifferenceMeters'] not in (None, 0) for x in comparisons),
              'maxSharedHeightDifferenceMeters': max(x['maxSharedHeightDifferenceMeters'] or 0 for x in comparisons),
              'maxSharedFirstDifferenceMeters': max(x['maxSharedFirstDifferenceMeters'] or 0 for x in comparisons),
              'seams': seams, 'expansionAllowed': False,
              'globalClosureProved': False, 'gpuValidated': False,
              'productionIntegration': False, 'visualAcceptance': False, 'productionReady': False}
    return report


if __name__ == '__main__':
    report = audit()
    raw = json.dumps(report, indent=2)+'\n'
    if '--write-report' in sys.argv:
        (HERE/'FULLPAGE_REPORT.json').write_text(raw)
    print(json.dumps({k: v for k, v in report.items() if k not in ('seams', 'windows')}, indent=2))
    sys.exit(0 if '--check-evidence' in sys.argv else 2)
