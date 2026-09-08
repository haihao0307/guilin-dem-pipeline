#!/usr/bin/env python3
"""Read-only architecture audit. Exit 2 means expansion is blocked, 1 invalid evidence.

Never reads the old QA.passed flag. Existing score bytes are independently decoded.
The producer is imported ONLY to encode internal seam fixtures, never to decode.
"""
import argparse
import base64
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import struct
import sys
import zlib

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
PILOT = ROOT / 'projects/wenzhou/full-score-v001'
BOOT = ROOT / 'bootstrap/wenzhou-full-score-v001'
PIN_SCORE = '2d9cc9ee0c3e26fa47e3e3784dc2a9a5533907502ea0539098b2a75b4256202f'
PIN_SOURCE_BLOB = 'da4c3be6c70a212accdbc275ac4a60d39467c475'
U64 = 1 << 64


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def sources():
    raw = (BOOT / 'source_data.py').read_bytes()
    require(hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
            == PIN_SOURCE_BLOB, 'source fixture differs from reviewed checkpoint')
    source = module(BOOT / 'source_data.py', 'gate_source').SOURCE
    decoded = {}
    for page in source['pages']:
        h = zlib.decompress(base64.b64decode(page['heightZlibB64']))
        m = zlib.decompress(base64.b64decode(page['maskZlibB64']))
        require(digest(h) == page['heightRawSha256'], 'source height hash')
        require(digest(m) == page['maskRawSha256'], 'source mask hash')
        require(digest(h + m) == page['combinedTruthSha256'], 'source combined hash')
        a = np.frombuffer(h, dtype='<i2').reshape(page['height'], page['width'])
        mask = np.unpackbits(np.frombuffer(m, dtype='u1'), bitorder='little')[:a.size].reshape(a.shape).astype(bool)
        require(np.array_equal(mask, a == page['nodata']), 'source NoData identity')
        decoded[page['pageId']] = (page, a, mask)
    return source, decoded


def inverse_line(values):
    """Scalar lifting inverse, independent of producer's vectorized implementation."""
    n = len(values)
    if n < 2:
        return list(values)
    count = (n + 1) // 2
    low = [int(x) for x in values[:count]]
    high = [int(x) for x in values[count:]]
    even = [x - (high[max(0, i-1)] + high[min(i, len(high)-1)] + 2) // 4
            for i, x in enumerate(low)]
    odd = [x + (even[i] + even[min(i+1, len(even)-1)]) // 2
           for i, x in enumerate(high)]
    out = []
    for i, x in enumerate(even):
        out.append(x)
        if i < len(odd):
            out.append(odd[i])
    return out


def inverse(coefficients, shapes):
    a = coefficients.astype(np.int64).copy()
    for h, w in reversed(shapes):
        for c in range(w):
            a[:h, c] = inverse_line(a[:h, c])
        for r in range(h):
            a[r, :w] = inverse_line(a[r, :w])
    return a


def decode(index, score, page, ids):
    packets = {p['packetId']: p for p in index['packets']}
    require(len(ids) == len(set(ids)), 'duplicate packet reference')
    coefficients = np.zeros(page['shape'], dtype=np.int64)
    mask = None
    for pid in ids:
        require(pid in packets, 'unknown packet reference')
        p = packets[pid]
        require(p['pageId'] == page['pageId'], 'cross-page packet reference')
        payload = score[p['offset']:p['offset'] + p['payloadBytes']]
        require(len(payload) == p['payloadBytes'], 'truncated packet')
        require(digest(payload) == p['payloadSha256'], 'payload hash')
        raw = zlib.decompress(payload)
        require(len(raw) == p['rawBytes'] and digest(raw) == p['rawSha256'], 'raw packet hash')
        if p['band'] == 'MASK':
            require(mask is None, 'duplicate mask')
            mask = np.unpackbits(np.frombuffer(raw, dtype='u1'), bitorder='little')[:coefficients.size].reshape(page['shape']).astype(bool)
        else:
            r, c, h, w = p['window']
            require(0 <= r < r+h <= page['shape'][0] and 0 <= c < c+w <= page['shape'][1], 'packet window')
            coefficients[r:r+h, c:c+w] = np.frombuffer(raw, dtype=p['dtype']).reshape(h, w)
    require(mask is not None, 'missing NoData mask')
    a = inverse(coefficients, page['shapes'])
    require(np.all((a[~mask] >= -32767) & (a[~mask] <= 32767)), 'valid reconstruction overflows int16 or aliases NoData')
    a[mask] = page['nodata']
    return a, mask


def flow(a, mask):
    """Diagnostic D8 steepest positive descent; ties use fixed row-major order.

    Only complete interior 3x3 neighborhoods are eligible. No drainage conditioning,
    flat routing, outlet inference or hydrological acceptance is claimed.
    """
    out = np.full(a.shape, -2, dtype=int)
    directions = [(r, c) for r in (-1, 0, 1) for c in (-1, 0, 1) if r or c]
    for r in range(1, a.shape[0]-1):
        for c in range(1, a.shape[1]-1):
            if mask[r-1:r+2, c-1:c+2].any():
                continue
            drops = [(int(a[r, c])-int(a[r+dr, c+dc])) / (2 ** .5 if dr and dc else 1)
                     for dr, dc in directions]
            out[r, c] = int(np.argmax(drops)) if max(drops) > 0 else -1
    return out


def phase(i, n):
    require(type(i) is int and 0 <= i < n, 'sample outside domain')
    return ((2*i+1)*U64)//(2*n)


def sample(p, n):
    require(type(p) is int and 0 <= p < U64, 'invalid Q0.64')
    return (p*n)//U64


def address_probe(source):
    # Domain-wide sample phases, independent of page size; no global sphere claim.
    h, w = source['sourceCanonical']['height'], source['sourceCanonical']['width']
    checked = sum(all(sample(phase(i, n), n) == i for i in range(n)) for n in (h, w))
    require(checked == 2, 'domain-axis address roundtrip')
    rng = np.random.default_rng(20260908)
    checked_routes = 0
    for _ in range(20000):
        r, c = int(rng.integers(h)), int(rng.integers(w))
        identity = (phase(c, w), phase(r, h))
        for size in (16, 32, 256):
            pr, lr = divmod(r, size)
            pc, lc = divmod(c, size)
            require((phase(pc*size+lc, w), phase(pr*size+lr, h)) == identity, 'page-dependent identity')
            checked_routes += 1
    rejected = 0
    for p in (-1, U64, 1.0, True):
        try:
            sample(p, w)
        except ValueError:
            rejected += 1
    require(rejected == 4, 'invalid phase accepted')
    return {'status': 'passed_local_candidate', 'axisSamples': h+w,
            'pageRoutingChecks': checked_routes, 'invalidInputsRejected': rejected,
            'globalClosureProved': False, 'productionAddressChanged': False}


def seam_probe(decoded, size=17, stride=15, modes=('exact', 'overview')):
    # Four overlapping 17x17 views cover each existing 32x32 page exactly.
    # Two shared rows/columns allow both value and first-difference comparison.
    # These are internal subwindows, never new full-size Canonical pages.
    sys.path.insert(0, str(BOOT))
    producer = module(BOOT / 'materialize_v001.py', 'gate_encoder')
    rows = []
    for pid, (_, truth, mask) in decoded.items():
        views = []
        for ro, co in ((0, 0), (0, stride), (stride, 0), (stride, stride)):
            a, m = truth[ro:ro+size, co:co+size], mask[ro:ro+size, co:co+size]
            work = np.where(m, 0, a)
            coeff, shapes = producer.fwd2(work, 5)
            exact = inverse(coeff, shapes)
            require(np.array_equal(exact[~m], a[~m]), 'subwindow exact failure')
            variants = {'exact': exact, 'archive': exact}
            for mode in modes:
                if mode in variants:
                    continue
                selected = np.zeros_like(coeff)
                for (level, band), sl in producer.slices(shapes).items():
                    keep = (mode == 'overview' and level >= 4
                            or mode == 'focus' and level >= 2
                            or mode == 'hydrology' and (level >= 3 or level == 2 and band in ('U', 'V'))
                            or mode == 'physics' and (level >= 2 or level == 1 and band in ('U', 'V')))
                    if band == 'LL' or keep or m.any():
                        selected[sl] = coeff[sl]
                variants[mode] = inverse(selected, shapes)
            views.append((variants, m))
        pairs = [(0, 1, 'vertical'), (2, 3, 'vertical'), (0, 2, 'horizontal'), (1, 3, 'horizontal')]
        for left, right, orientation in pairs:
            for mode_a, mode_b in itertools.product(modes, repeat=2):
                a, ma = views[left][0][mode_a], views[left][1]
                b, mb = views[right][0][mode_b], views[right][1]
                sa, sb = ((slice(None), slice(-2, None)), (slice(None), slice(0, 2))) if orientation == 'vertical' else ((slice(-2, None), slice(None)), (slice(0, 2), slice(None)))
                require(np.array_equal(ma[sa], mb[sb]), 'shared NoData mismatch')
                valid = ~ma[sa]
                diff = a[sa]-b[sb]
                axis = 1 if orientation == 'vertical' else 0
                dv = np.diff(a[sa], axis=axis)-np.diff(b[sb], axis=axis)
                eligible = np.diff(ma[sa].astype(int), axis=axis) == 0
                eligible &= ~np.take(ma[sa], [0], axis=axis)
                maximum = int(np.max(np.abs(diff[valid]))) if valid.any() else None
                if mode_a == mode_b == 'exact':
                    require(maximum in (None, 0), 'exact seam failure')
                rows.append({'parentPage': pid, 'pair': [left, right], 'orientation': orientation,
                             'modes': [mode_a, mode_b], 'maxSharedHeightDifferenceMeters': maximum,
                             'maxSharedFirstDifferenceMeters': int(np.max(np.abs(dv[eligible]))) if eligible.any() else None})
    return {'fixtureKind': f'2x2 windows with at most {size}x{size} samples, stride {stride}, overlap 2',
            'resampling': False, 'newFullSizeAdjacentPages': size == 514, 'comparisons': rows,
            'sharedEdgeContractPassed': all(x['maxSharedHeightDifferenceMeters'] in (None, 0) for x in rows)}


def audit(pilot=PILOT):
    source, decoded = sources()
    index = json.loads((pilot/'03_SCORE/WENZHOU_FULL_SCORE_GITHUB_V001.index.json').read_text())
    score = (pilot/'03_SCORE'/index['scoreFile']).read_bytes()
    require(digest(score) == PIN_SCORE == index['scoreFileSha256'], 'score identity changed')
    require(len(score) == index['scoreFileBytes'] and score[:8] == b'WZFSG01\0', 'score header')
    length = struct.unpack('<I', score[8:12])[0]
    require(json.loads(score[12:12+length]) == index['header'], 'header/index mismatch')
    require({p['pageId'] for p in index['pages']} == set(decoded), 'page set mismatch')
    require(len({p['packetId'] for p in index['packets']}) == len(index['packets']), 'duplicate packet ID')
    results = []
    names = ('visual-overview', 'visual-focus', 'hydrology-analysis', 'physics-corridor', 'exact-truth', 'archive-scan')
    for name in names:
        conductor = json.loads((pilot/f'04_CONDUCTORS/{name}.json').read_text())
        require(conductor['scoreId'] == index['header']['scoreId'] and conductor['scoreSha256'] == PIN_SCORE, 'conductor identity')
        require(conductor['payloadEmbedded'] is False, 'embedded conductor payload')
        ids = conductor['packetIds']
        require(len(ids) == len(set(ids)) == conductor['packetCount'], 'conductor packet count')
        require(set(ids) <= {p['packetId'] for p in index['packets']}, 'unknown conductor packet')
        for page in index['pages']:
            src, truth, mask = decoded[page['pageId']]
            require((page['sourceRowOffset'], page['sourceColumnOffset']) == (src['sourceRowOffset'], src['sourceColumnOffset']), 'source window drift')
            require(page['truthSha256'] == src['combinedTruthSha256'], 'page truth identity')
            require(set(page['packetIds']) == {p['packetId'] for p in index['packets'] if p['pageId'] == page['pageId']}, 'page packet inventory')
            chosen = [pid for pid in ids if pid in page['packetIds']]
            a, m = decode(index, score, page, chosen)
            require(np.array_equal(m, mask) and np.array_equal(a[m], truth[m]), 'NoData mismatch')
            exact = set(chosen) == set(page['packetIds'])
            if name in ('exact-truth', 'archive-scan') or mask.any():
                require(exact and np.array_equal(a, truth), 'required exact reconstruction mismatch')
            diff = a[~mask]-truth[~mask]
            fa, ft = flow(a, mask), flow(truth, mask)
            eligible = ft != -2
            results.append({'conductor': name, 'page': page['pageId'], 'maxAbsMeters': int(np.abs(diff).max()),
                            'rmseMeters': float(np.sqrt(np.mean(diff.astype(float)**2))),
                            'changedSamples': int(np.count_nonzero(diff)),
                            'diagnosticD8EligibleCells': int(eligible.sum()),
                            'diagnosticD8ChangedCells': int(np.count_nonzero(fa[eligible] != ft[eligible])),
                            'taskAcceptance': 'unverified' if not exact else 'exact_samples_only'})
    seams = seam_probe(decoded)
    return {'schema': 'wenzhou-architecture-gate/r1', 'reviewedCommit': '7a0be68a3a71506638c1b425a5bc0872700a3b0b',
            'evidenceRecomputed': True, 'independentExactDecodePassed': True,
            'sourceScope': 'two pinned R2.2.1 seeds; recovered full-size fixtures audited separately in FULLPAGE_REPORT.json',
            'scoreSha256': digest(score), 'address': address_probe(source),
            'prBodyScoreHashMatchesBytes': False,
            'conductors': results, 'seams': seams,
            'blockers': ['global address closure and intersection disambiguation unimplemented',
                         'full-size mixed-precision shared-page contract failed; see FULLPAGE_REPORT.json',
                         'shared-edge contract missing for partial-band reconstruction',
                         'hydrology and physics task acceptance budgets undefined',
                         'GPU streaming and stale-request cancellation unverified',
                         'human visual acceptance absent'],
            'expansionAllowed': False, 'productionIntegration': False,
            'visualAcceptance': False, 'productionReady': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--check-evidence', action='store_true', help='exit 0 for valid audit even when expansion remains blocked')
    args = parser.parse_args()
    try:
        report = audit()
    except (ValueError, KeyError, OSError, zlib.error) as error:
        print(json.dumps({'evidenceRecomputed': False, 'expansionAllowed': False, 'error': str(error)}))
        return 1
    raw = json.dumps(report, indent=2) + '\n'
    if args.report:
        args.report.write_text(raw)
    print(raw)
    return 0 if args.check_evidence or report['expansionAllowed'] else 2


if __name__ == '__main__':
    sys.exit(main())
