#!/usr/bin/env python3
import contextlib
import ctypes as C
import importlib
import io
import json
import math
import struct

with contextlib.redirect_stdout(io.StringIO()):
    r49 = importlib.import_module('gaussian_float_target_r49')

gl = r49.gl
r48 = r49.r48
SIZE = r48.SIZE
GL_FRAMEBUFFER = 0x8D40
GL_COLOR_BUFFER_BIT = 0x4000
GL_BLEND = 0x0BE2
GL_DITHER = 0x0BD0
GL_RGBA = 0x1908
GL_FLOAT = 0x1406
GL_TRIANGLES = 0x0004

def f32(value):
    return C.c_float(value).value

def f32_bits(value):
    return struct.unpack('<I', struct.pack('<f', f32(value)))[0]

def bits_f32(bits):
    return struct.unpack('<f', struct.pack('<I', bits))[0]

def render_center(scale, distance_x, distance_y):
    gl.glBindFramebuffer(GL_FRAMEBUFFER, r49.framebuffer.value)
    gl.glViewport(0, 0, SIZE, SIZE)
    gl.glDisable(GL_DITHER)
    gl.glDisable(GL_BLEND)
    gl.glClearColor(0, 0, 0, 0)
    gl.glClear(GL_COLOR_BUFFER_BIT)
    gl.glUseProgram(r48.program)
    gl.glUniform2f(r48.loc['uCenter'], -distance_x, -distance_y)
    gl.glUniform2f(r48.loc['uScale'], scale, scale)
    gl.glUniform1f(r48.loc['uAngle'], 0.0)
    gl.glUniform3f(r48.loc['uColor'], 1.0, 1.0, 1.0)
    gl.glUniform1f(r48.loc['uAlpha'], 0.5)
    gl.glDrawArrays(GL_TRIANGLES, 0, 3)
    pixel = (C.c_float * 4)()
    gl.glReadPixels(16, 16, 1, 1, GL_RGBA, GL_FLOAT, pixel)
    return list(pixel)

scales = [2**-10, 0.3, 1.0, 3.7, 256.0, 1024.0]
directions = [
    ('axis', 2.0, 0.0),
    ('shallow', math.sqrt(3.75), 0.5),
    ('one-one-root2', math.sqrt(3.0), 1.0),
    ('diagonal', math.sqrt(2.0), math.sqrt(2.0)),
    ('steep', math.sqrt(1.75), 1.5),
    ('root3', 1.0, math.sqrt(3.0)),
]
step_range = range(-64, 65)
cases = []
double_mismatches = []
float_mismatches = []
for scale_input in scales:
    scale = f32(scale_input)
    for direction, qx, qy in directions:
      base_x = f32(qx * scale)
      distance_y = f32(qy * scale)
      base_bits = f32_bits(base_x)
      for ulp_step in step_range:
        distance_x = bits_f32(base_bits + ulp_step)
        center_x, center_y = f32(-distance_x), f32(-distance_y)
        effective_x, effective_y = f32(-center_x), f32(-center_y)
        r2_double = (effective_x / scale) ** 2 + (effective_y / scale) ** 2
        qx_float = f32(effective_x / scale)
        qy_float = f32(effective_y / scale)
        r2_float = f32(f32(qx_float * qx_float) + f32(qy_float * qy_float))
        rgba = render_center(scale, effective_x, effective_y)
        backend_covered = rgba[3] > 0.0
        double_covered = r2_double <= 4.0
        float_covered = r2_float <= 4.0
        case = {
            'scale': scale,
            'direction': direction,
            'xUlpStepFromDirectionBase': ulp_step,
            'distance': [effective_x, effective_y],
            'r2Double': r2_double,
            'r2Float32Model': r2_float,
            'doubleCovered': double_covered,
            'float32ModelCovered': float_covered,
            'backendCovered': backend_covered,
            'backendAlpha': rgba[3],
        }
        cases.append(case)
        if double_covered != backend_covered:
            double_mismatches.append(case)
        if float_covered != backend_covered:
            float_mismatches.append(case)

exact_cases = [c for c in cases if c['direction'] == 'axis' and c['xUlpStepFromDirectionBase'] == 0]
outside_double_inside_backend = [c for c in double_mismatches if not c['doubleCovered'] and c['backendCovered']]
inside_double_outside_backend = [c for c in double_mismatches if c['doubleCovered'] and not c['backendCovered']]
mismatch_counts_by_direction = {
    direction: sum(c['direction'] == direction for c in double_mismatches)
    for direction, _, _ in directions
}
double_excesses = [c['r2Double'] - 4.0 for c in outside_double_inside_backend]

result = {
    'schema': 'kaopu-gaussian-cutoff-boundary-probe/r50',
    'status': 'Candidate-pass',
    'source': {
        'threeRevision': '148ef33ecb6d2502ff796d4554abd1549c95d519',
        'r49Commit': '2987fe98d2d5d32e915959ae250c7fca2982d8c8',
    },
    'backend': r48.identity,
    'fixture': {
        'target': 'RGBA32F texture framebuffer',
        'pixel': [16, 16],
        'scales': [f32(v) for v in scales],
        'directions': [v[0] for v in directions],
        'xUlpStepsPerDirection': [min(step_range), max(step_range)],
        'caseCount': len(cases),
        'cutoffRule': 'discard when r2 > 4.0',
        'note': 'Adversarial float-neighbor control using the independent R48 shader; not Three.js-generated TSL.',
    },
    'summary': {
        'doublePredicateMismatchCount': len(double_mismatches),
        'float32PredicateMismatchCount': len(float_mismatches),
        'doubleOutsideBackendInsideCount': len(outside_double_inside_backend),
        'doubleInsideBackendOutsideCount': len(inside_double_outside_backend),
        'minimumDoubleExcessAmongIncludedMismatches': min(double_excesses) if double_excesses else None,
        'maximumDoubleExcessAmongIncludedMismatches': max(double_excesses) if double_excesses else None,
        'mismatchCountsByDirection': mismatch_counts_by_direction,
        'exactTwiceScaleCasesCovered': sum(c['backendCovered'] for c in exact_cases),
        'exactTwiceScaleCaseCount': len(exact_cases),
    },
    'counterexamples': {
        'doubleOutsideBackendInsideFirst': outside_double_inside_backend[0] if outside_double_inside_backend else None,
        'doubleInsideBackendOutsideFirst': inside_double_outside_backend[0] if inside_double_outside_backend else None,
    },
    'checks': {},
    'limits': {
        'directThreeTsl': False,
        'webglOrWebgpu': False,
        'hardwareGpu': False,
        'browserOrTargetDevice': False,
        'realPhotoOrLearnedAsset': False,
        'humanAcceptance': False,
    },
}
result['checks'] = {
    'allCasesExecuted': len(cases) == len(scales) * len(directions) * len(step_range),
    'float32ModelMatchesBackendCoverage': len(float_mismatches) == 0,
    'doublePredicateHasCoverageCounterexample': len(double_mismatches) > 0,
    'exactCutoffIsIncluded': all(c['backendCovered'] for c in exact_cases),
    'bothSidesOfBoundaryWereSampled': any(not c['backendCovered'] for c in cases) and any(c['backendCovered'] for c in cases),
}
print(json.dumps(result, indent=2))
assert all(result['checks'].values())
