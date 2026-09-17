#!/usr/bin/env python3
import json
import math
import pathlib
import struct

H = 1.0 / 128.0
COUNT = 256
OFFSETS = [0, 8, 16, 64, 256, 1024, 4096, 8192]

def half(x):
    return struct.unpack('<e', struct.pack('<e', x))[0]

def fract(x):
    return x - math.floor(x)

def hash1(i):
    x = i & 0xffffffff
    x ^= x >> 16
    x = (x * 0x7feb352d) & 0xffffffff
    x ^= x >> 15
    x = (x * 0x846ca68b) & 0xffffffff
    x ^= x >> 16
    return (x / 4294967295.0) * 2.0 - 1.0

def value_noise_parts(cell, t):
    s = t * t * (3.0 - 2.0 * t)
    return hash1(cell) * (1.0 - s) + hash1(cell + 1) * s

def value_noise(x):
    cell = math.floor(x)
    return value_noise_parts(cell, fract(x))

def binary16_ulp_at(x):
    if x == 0:
        return 2.0 ** -24
    return 2.0 ** (math.floor(math.log2(abs(x))) - 10)

def rmse(a, b):
    return math.sqrt(sum((x-y)**2 for x, y in zip(a, b)) / len(a))

def metrics(offset):
    xs = [offset + i * H for i in range(COUNT)]
    reference_phase = [fract(x) for x in xs]
    direct_x = [half(x) for x in xs]
    direct_phase = [fract(x) for x in direct_x]
    local_x = [half(i * H) for i in range(COUNT)]
    local_phase = [fract(x) for x in local_x]

    reference_noise = [value_noise(x) for x in xs]
    direct_noise = [value_noise(x) for x in direct_x]
    # Tile/cell identity stays integer/high precision; only bounded local t is mediump.
    split_noise = []
    for local in local_x:
        cell_delta = math.floor(local)
        split_noise.append(value_noise_parts(offset + cell_delta, fract(local)))

    return {
        'offset': offset,
        'binary16UlpAtOffset': binary16_ulp_at(offset),
        'directUniqueCoordinates': len(set(direct_x)),
        'directUniquePhases': len(set(direct_phase)),
        'directAdjacentCollapseFraction': sum(a == b for a,b in zip(direct_x, direct_x[1:])) / (COUNT-1),
        'directPhaseRmse': rmse(reference_phase, direct_phase),
        'splitPhaseRmse': rmse(reference_phase, local_phase),
        'directValueNoiseRmse': rmse(reference_noise, direct_noise),
        'splitValueNoiseRmse': rmse(reference_noise, split_noise),
    }

rows = [metrics(o) for o in OFFSETS]
checks = {
    'half-format-available': half(1.5) == 1.5,
    'origin-retains-grid': rows[0]['directUniqueCoordinates'] == COUNT,
    'eight-retains-grid': rows[1]['directUniqueCoordinates'] == COUNT,
    'sixteen-loses-samples': rows[2]['directUniqueCoordinates'] < COUNT,
    'sixtyfour-mostly-collapses': rows[3]['directAdjacentCollapseFraction'] > 0.70,
    'one-kilounit-phase-frozen': rows[5]['directUniquePhases'] == 1,
    'direct-noise-error-grows': rows[5]['directValueNoiseRmse'] > rows[2]['directValueNoiseRmse'],
    'split-phase-preserved-all-offsets': all(r['splitPhaseRmse'] == 0 for r in rows),
    'split-noise-low-error-all-offsets': all(r['splitValueNoiseRmse'] < 1e-12 for r in rows),
    'large-offset-not-overflow': all(math.isfinite(half(o)) for o in OFFSETS),
}

result = {
    'schema': 'kaopu-mediump-coordinate-probe-n13-v1',
    'emulation': 'IEEE-754 binary16 candidate matching GLSL ES mediump minimum relative precision/range class; not a universal mediump implementation',
    'coordinateStep': H,
    'sampleCount': COUNT,
    'rows': rows,
    'checks': [{'id': k, 'pass': v} for k,v in checks.items()],
    'summary': {'checks': len(checks), 'passed': sum(checks.values()), 'failed': len(checks)-sum(checks.values()), 'status': 'pass' if all(checks.values()) else 'fail'}
}
out = pathlib.Path(__file__).with_name('mediump_coordinate_result_n13.json')
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
if not all(checks.values()):
    raise SystemExit(result['summary'])
