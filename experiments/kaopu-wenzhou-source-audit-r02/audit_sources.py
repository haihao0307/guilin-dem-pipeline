"""Audit R01 evidence limits; this is not a raw-data replay or promotion gate."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


def asset_identity(url):
    """Recognize DOI resolver and publisher copies of this fixture's main paper."""
    parsed = urlparse(url.strip())
    path = parsed.path.lower().rstrip('/')
    doi = '10.3389/fmars.2026.1898828'
    if parsed.hostname in ('doi.org', 'dx.doi.org') and path == '/' + doi:
        return 'doi:' + doi
    if parsed.hostname == 'www.frontiersin.org' and path in (
        '/journals/marine-science/articles/' + doi,
        '/journals/marine-science/articles/' + doi + '/full',
    ):
        return 'doi:' + doi
    return url.strip()


def audit(fixture):
    roots = fixture['observationRoots']
    assets = sorted({asset_identity(r['evidenceAsset']) for r in roots})
    blockers = [
        'primary-gauge-bytes-and-checksum-not-verified',
        'exact-altimetry-product-version-and-bytes-not-verified',
        'shared-calibration-and-processing-dependencies-not-audited',
        'quantity-reference-frame-and-spatial-support-not-aligned',
        'raw-data-replay-not-implemented',
    ]
    if fixture['scope'].get('exactStationCoordinates') in (None, 'Unknown'):
        blockers.append('station-location-unknown')
    wave = fixture['typedWave']
    if any(c.get('phase') in (None, 'Unknown') for c in wave['components']):
        blockers.append('wave-phase-unknown')
    if wave.get('residualRequired'):
        blockers.append('required-residual-not-reconstructed')
    return {
        'auditKind': 'source-limit-audit-not-physical-verification',
        'auditScope': 'fixture-specific-gap-snapshot',
        'unverifiedInputClaims': [
            {'rootId': r['rootId'], 'field': 'rootStatus',
             'reportedValue': r.get('rootStatus'),
             'effectiveStatus': 'unverified',
             'instruction': 'Do not use the legacy rootStatus as proof of independence'}
            for r in roots
        ],
        'crossRootInterpretation': 'reported-difference-not-demonstrated-conflict',
        'reportedRootIds': sorted({r['rootId'] for r in roots}),
        'reportedPhysicalFamilies': sorted({r['physicalObservationFamily'] for r in roots}),
        'distinctCitedAssetsForRoots': assets,
        'verifiedIndependentPhysicalRootCount': None,
        'independenceStatus': 'unverified-not-proven-dependent',
        'rawDataReplayPassed': False,
        'formalR2Frozen': False,
        'productionReady': False,
        'judgment': 'Park raw replay; continue source acquisition',
        'blockers': blockers,
    }


if __name__ == '__main__':
    source = Path(__file__).parent.parent / 'kaopu-wenzhou-real-score-r01/FIXTURE_R01.json'
    raw = source.read_bytes()
    result = audit(json.loads(raw))
    result['inputSha256'] = hashlib.sha256(raw).hexdigest()
    print(json.dumps(result, ensure_ascii=False, indent=2))
