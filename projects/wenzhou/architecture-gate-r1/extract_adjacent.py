#!/usr/bin/env python3
"""Extract auditable candidate-page regression data from the pinned numeric store.

No TIFF access; modular Lorenzo decoding uses independent NumPy cumulative sums.
Missing records are rejected, never silently synthesized as NoData.
"""
import argparse
from functools import lru_cache
import json
from pathlib import Path
import struct
import zlib

import numpy as np

from gate import digest, require, sources

COLD_HASH = '8800c053608c5fa74eeebd2ce0d06c1bed54fd65274ed059d6e84fc2ec82a1dc'
INDEX_HASH = '44a1713aac3e8800d801d6d0984e92e56df537fe37012fd9975fcf595130ef9b'
REC = struct.Struct('<HHHHIII32s')


def extract(core, out):
    cold = core/'01_CANONICAL_COLD/WENZHOU_FINAL_CANONICAL_R2_2_1.lorenzo.wzdem2'
    idx = cold.with_name('WENZHOU_FINAL_CANONICAL_R2_2_1.lorenzo.index.json')
    raw = cold.read_bytes()
    require(digest(raw) == COLD_HASH, 'cold store hash')
    require(digest(idx.read_bytes()) == INDEX_HASH, 'cold index hash')
    doc = json.loads(idx.read_text())
    header = doc['header']
    n = struct.unpack('<I', raw[8:12])[0]
    require(raw[:8] == b'WZDEM2C\0' and json.loads(raw[12:12+n]) == header, 'cold header')
    entries = {(e['tileRow'], e['tileCol']): e for e in doc['entries']}
    records = {}

    @lru_cache(maxsize=32)
    def tile(tr, tc):
        require((tr, tc) in entries, 'missing cold record; cannot infer NoData')
        e = entries[(tr, tc)]
        start = e['offset']
        rr, cc, h, w, vc, ml, dl, rh = REC.unpack(raw[start:start+REC.size])
        require((rr, cc, h, w, vc, ml, dl) == (tr, tc, e['height'], e['width'], e['validPixels'], e['maskBytes'], e['dataBytes']), 'record/index mismatch')
        p = start+REC.size
        mb = zlib.decompress(raw[p:p+ml])
        rb = zlib.decompress(raw[p+ml:p+ml+dl])
        residual = np.frombuffer(rb, dtype='<u2').reshape(h, w)
        values = (residual.astype(np.uint64).cumsum(0).cumsum(1) & 65535).astype('<u2').view('<i2')
        require(digest(values.tobytes()+mb) == rh.hex() == e['rawSha256'], 'cold tile hash')
        valid = np.unpackbits(np.frombuffer(mb, dtype='u1'), bitorder='little')[:h*w].reshape(h, w).astype(bool)
        require(int(valid.sum()) == vc, 'valid count')
        records[f'{tr}/{tc}'] = {'offset': start, 'rawSha256': rh.hex(), 'shape': [h, w]}
        return np.where(valid, values, header['nodata']).astype('<i2')

    def window(ro, co, h, w):
        result = np.empty((h, w), dtype='<i2')
        for tr in range(ro//512, (ro+h-1)//512+1):
            for tc in range(co//512, (co+w-1)//512+1):
                a = tile(tr, tc)
                r0, c0 = max(ro, tr*512), max(co, tc*512)
                r1, c1 = min(ro+h, tr*512+a.shape[0]), min(co+w, tc*512+a.shape[1])
                result[r0-ro:r1-ro, c0-co:c1-co] = a[r0-tr*512:r1-tr*512, c0-tc*512:c1-tc*512]
        return result

    # Verify both existing PR seeds against recovered cold truth before new extraction.
    _, seeds = sources()
    for _, (page, a, _) in seeds.items():
        actual = window(page['sourceRowOffset'], page['sourceColumnOffset'], *a.shape)
        require(np.array_equal(actual, a), 'PR seed differs from recovered cold store')
    arrays, windows = {}, []
    for name, ro, co in [('river', 19*512-1, 4*512-1),
                         ('coast', 25*512-1, 8*512-1),
                         ('south_tail', 38*512-1, 4*512-1),
                         ('east_tail', 19*512-1, 33*512-1)]:
        h, w = min(1026, header['height']-ro), min(1026, header['width']-co)
        a = window(ro, co, h, w)
        arrays[name] = a
        windows.append({'name': name, 'sourceRowOffset': ro, 'sourceColumnOffset': co,
                        'shape': [h, w], 'rawSha256': digest(a.tobytes()),
                        'nodataCount': int(np.count_nonzero(a == header['nodata'])),
                        'candidateCoreSamples': 512, 'haloSamples': 1,
                        'pageStride': 512, 'sharedOverlapSamples': 2})
    out.mkdir(parents=True, exist_ok=True)
    target = out/'adjacent.npz'
    np.savez_compressed(target, **arrays)
    manifest = {'schema': 'wenzhou-adjacent-fixtures/r1', 'coldStoreSha256': COLD_HASH,
                'coldIndexSha256': INDEX_HASH, 'header': header,
                'existingSeedsMatchColdStore': True, 'resampling': False,
                'fixtureSha256': digest(target.read_bytes()), 'windows': windows,
                'verifiedColdRecords': records, 'fullDomainConverted': False}
    (out/'ADJACENT_MANIFEST.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({'fixtureBytes': target.stat().st_size, 'verifiedColdRecords': len(records), 'windows': windows}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--core', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    extract(args.core, args.out)
