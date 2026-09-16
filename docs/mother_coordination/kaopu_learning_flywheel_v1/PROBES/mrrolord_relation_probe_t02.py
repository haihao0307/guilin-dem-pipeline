#!/usr/bin/env python3
"""T02: synthetic tests of candidate KAOPU invariants, not MrRolord source.
Standard library only. No actual terrain, physical calibration or GPU checks.
Run: python3 mrrolord_relation_probe_t02.py --output RESULT.json
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence


def key_unit(*parts: str) -> float:
    """Stable keyed pseudo-random value, independent of iteration/camera order.
    This reference implementation is not a performance recommendation for GPUs.
    """
    data = json.dumps(parts, ensure_ascii=False, separators=(',', ':')).encode()
    n = int.from_bytes(hashlib.sha256(data).digest()[:8], 'big') >> 11
    return n / (1 << 53)


def record(parent: str, parcel: str) -> dict:
    base = key_unit('T02', 'region_orientation', parent) * math.pi
    residual = (key_unit('T02', 'parcel_residual', parent, parcel) - .5) * .1
    return {'parcel_id': parent + '/' + parcel,
            'parent_orientation_radians': base,
            'parcel_orientation_radians': base + residual}


def water_volume(level: float, bed: Sequence[float], area: Sequence[float]) -> float:
    if len(bed) != len(area) or not bed:
        raise ValueError('Bed and areas must be nonempty and equal length')
    if not all(math.isfinite(v) for v in [level, *bed, *area]):
        raise ValueError('Nonfinite inputs')
    if any(a <= 0 for a in area):
        raise ValueError('Areas must be positive')
    return math.fsum(a * max(level-z, 0.0) for z, a in zip(bed, area))


def level_for_volume(volume: float, bed: Sequence[float], area: Sequence[float]) -> float:
    if volume < 0 or not math.isfinite(volume):
        raise ValueError('Invalid volume')
    water_volume(0, bed, area)  # Validate domain before solving.
    if volume == 0:
        return min(bed)
    low = min(bed)
    high = max(bed) + volume / math.fsum(area) + 1.0
    for _ in range(90):
        middle = (low+high)/2
        if water_volume(middle, bed, area) < volume:
            low = middle
        else:
            high = middle
    return (low+high)/2


def main() -> dict:
    # A: identity/orientation tied to hierarchy rather than array indices.
    ids = [('region-a', 'plot-0'), ('region-a', 'plot-1'), ('region-b', 'plot-0')]
    first = {record(*pair)['parcel_id']: record(*pair) for pair in ids}
    expanded = [('region-b', 'plot-extra'), *reversed(ids)]
    second = {record(*pair)['parcel_id']: record(*pair) for pair in expanded}
    unchanged = all(first[k] == second[k] for k in first)
    naive_before = {f'{a}/{b}': key_unit('array-index', str(i)) for i, (a,b) in enumerate(ids)}
    naive_after = {f'{a}/{b}': key_unit('array-index', str(i)) for i, (a,b) in enumerate(expanded)}
    naive_changed = sum(naive_before[k] != naive_after[k] for k in naive_before)
    same_parent = first['region-a/plot-0']['parent_orientation_radians'] == first['region-a/plot-1']['parent_orientation_radians']
    # B: classification from final microgeometry can disagree with structural ground.
    # Test threshold .1 is NOT an agricultural slope limit.
    structural_slope, amplitude_m, wavelength_m = .02, .002, .04
    threshold, samples = .1, 1000
    slopes = [structural_slope + amplitude_m * 2*math.pi/wavelength_m *
              math.cos(2*math.pi*(i+.5)/samples) for i in range(samples)]
    flipped = sum(abs(s) > threshold for s in slopes)
    # C: zero area-mean displacement preserves volume only when wetted area stays full.
    area = [.5, .5]
    bed = [-.006, .006]
    initial_bed = [0., 0.]
    shallow, deep = .004, .020
    old = water_volume(shallow, initial_bed, area)
    new = water_volume(shallow, bed, area)
    new_level = level_for_volume(old, bed, area)
    reconstructed = water_volume(new_level, bed, area)
    checks = {
        'A_stable_hierarchical_ids_and_shared_orientation': unchanged and same_parent and naive_changed > 0,
        'B_micro_slope_can_change_classification_without_structural_slope_change': flipped > samples/2 and structural_slope < threshold,
        'C_zero_mean_is_insufficient_near_shore_and_volume_reconciliation_works':
            abs(math.fsum(a*z for a,z in zip(area, bed))) < 1e-15 and new > old and
            abs(reconstructed-old) < 1e-14 and
            abs(water_volume(deep, initial_bed, area)-water_volume(deep,bed,area)) < 1e-14
    }
    result = {
        'id': 'KAOPU-MRROLORD-T02-20260916',
        'evidence_class': 'original synthetic counterexamples for candidate transfer, not author-code reproduction',
        'observed_at_utc': datetime.now(timezone.utc).isoformat(),
        'python': platform.python_version(),
        'probe_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'checks': checks, 'passed': sum(checks.values()), 'total': len(checks),
        'cases': {
            'hierarchy': {'stable_records': first, 'unchanged_existing_records': unchanged,
                          'naive_array_key_changed_records': naive_changed,
                          'limits': 'Synthetic hierarchy only, not real parcel subdivision or universal cross-platform determinism.'},
            'reference_slope': {'structural_slope': structural_slope, 'detail_amplitude_m': amplitude_m,
                'detail_wavelength_m': wavelength_m, 'arbitrary_test_threshold': threshold,
                'samples': samples, 'classification_changed_samples': flipped,
                'changed_fraction': flipped/samples,
                'limits': 'Synthetic surface; does not prescribe agronomic thresholds or measure current Mother code.'},
            'water_capacity': {'horizontal_areas_m2': area, 'bed_m': bed,
                'area_weighted_mean_displacement_m': math.fsum(a*z for a,z in zip(area,bed)),
                'initial_level_m': shallow, 'initial_volume_m3': old,
                'unchanged_level_new_volume_m3': new, 'relative_volume_change': new/old-1,
                'volume_preserving_new_level_m': new_level, 'reconciled_volume_m3': reconstructed,
                'deep_flooded_control_volume_m3': water_volume(deep,bed,area),
                'limits': 'Two-column horizontal level-pool example; no infiltration, flow dynamics, or regional calibration.'}
        },
        'not_tested': ['MrRolord Blender node graph', 'Yohei full shader', 'production implementation',
            'real agronomy or hydrology', 'GPU/browser/mobile performance', 'Mother adoption', 'user approval']
    }
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = main()
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(text, encoding='utf-8')
    print(text)
    raise SystemExit(0 if result['passed'] == result['total'] else 1)
