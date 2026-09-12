#!/usr/bin/env python3
import contextlib
import ctypes as C
import importlib
import io
import json
import math

with contextlib.redirect_stdout(io.StringIO()):
    r48 = importlib.import_module('gaussian_software_gl_compositor_r48')

gl = r48.gl
SIZE = r48.SIZE

GL_FRAMEBUFFER = 0x8D40
GL_FRAMEBUFFER_COMPLETE = 0x8CD5
GL_COLOR_ATTACHMENT0 = 0x8CE0
GL_TEXTURE_2D = 0x0DE1
GL_TEXTURE_MIN_FILTER = 0x2801
GL_TEXTURE_MAG_FILTER = 0x2800
GL_NEAREST = 0x2600
GL_RGBA32F = 0x8814
GL_RGBA = 0x1908
GL_FLOAT = 0x1406
GL_COLOR_BUFFER_BIT = 0x4000
GL_BLEND = 0x0BE2
GL_DITHER = 0x0BD0
GL_SRC_ALPHA = 0x0302
GL_ONE_MINUS_SRC_ALPHA = 0x0303
GL_ONE = 1
GL_TRIANGLES = 0x0004

gl.glGenFramebuffers.argtypes = [C.c_int, C.POINTER(C.c_uint)]
gl.glBindFramebuffer.argtypes = [C.c_uint, C.c_uint]
gl.glCheckFramebufferStatus.argtypes = [C.c_uint]
gl.glCheckFramebufferStatus.restype = C.c_uint
gl.glFramebufferTexture2D.argtypes = [C.c_uint, C.c_uint, C.c_uint, C.c_uint, C.c_int]
gl.glGenTextures.argtypes = [C.c_int, C.POINTER(C.c_uint)]
gl.glBindTexture.argtypes = [C.c_uint, C.c_uint]
gl.glTexParameteri.argtypes = [C.c_uint, C.c_uint, C.c_int]
gl.glTexImage2D.argtypes = [C.c_uint, C.c_int, C.c_int, C.c_int, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_void_p]

texture = C.c_uint()
framebuffer = C.c_uint()
gl.glGenTextures(1, C.byref(texture))
gl.glBindTexture(GL_TEXTURE_2D, texture.value)
gl.glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST)
gl.glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST)
gl.glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA32F, SIZE, SIZE, 0, GL_RGBA, GL_FLOAT, None)
gl.glGenFramebuffers(1, C.byref(framebuffer))
gl.glBindFramebuffer(GL_FRAMEBUFFER, framebuffer.value)
gl.glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, texture.value, 0)
status = gl.glCheckFramebufferStatus(GL_FRAMEBUFFER)
if status != GL_FRAMEBUFFER_COMPLETE:
    raise RuntimeError(f'RGBA32F framebuffer incomplete: 0x{status:x}')

def render_float(order, decoded, viewer):
    gl.glBindFramebuffer(GL_FRAMEBUFFER, framebuffer.value)
    gl.glViewport(0, 0, SIZE, SIZE)
    gl.glDisable(GL_DITHER)
    gl.glEnable(GL_BLEND)
    gl.glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA)
    gl.glClearColor(0, 0, 0, 0)
    gl.glClear(GL_COLOR_BUFFER_BIT)
    gl.glUseProgram(r48.program)
    for index in order:
        s = r48.splats[index]
        ellipse = s['decoded' if decoded else 'source']
        color = s['viewerColor' if viewer else 'sourceColor']
        gl.glUniform2f(r48.loc['uCenter'], *s['center'])
        gl.glUniform2f(r48.loc['uScale'], *ellipse['scale'])
        gl.glUniform1f(r48.loc['uAngle'], ellipse['angle'])
        gl.glUniform3f(r48.loc['uColor'], *color)
        gl.glUniform1f(r48.loc['uAlpha'], s['opacity'] * ellipse['alphaScale'])
        gl.glDrawArrays(GL_TRIANGLES, 0, 3)
    pixels = (C.c_float * (SIZE * SIZE * 4))()
    gl.glReadPixels(0, 0, SIZE, SIZE, GL_RGBA, GL_FLOAT, pixels)
    return list(pixels)

def float_metrics(actual, expected):
    diffs = [abs(a - b) for a, b in zip(actual, expected)]
    return {
        'maxAbs': max(diffs),
        'rmse': math.sqrt(sum(d*d for d in diffs) / len(diffs)),
        'channelsOver1e6': sum(d > 1e-6 for d in diffs),
        'channelsOver1e5': sum(d > 1e-5 for d in diffs),
    }

def rgba8_to_float(values):
    return [v / 255.0 for v in values]

def coverage_mismatch(actual, expected):
    mismatches = []
    for pixel in range(SIZE * SIZE):
        a = actual[pixel * 4 + 3] > 0.0
        b = expected[pixel * 4 + 3] > 0.0
        if a != b:
            mismatches.append({'x': pixel % SIZE - 16, 'y': pixel // SIZE - 16, 'backendCovered': a, 'cpuCovered': b})
    return mismatches

reference_float = render_float((1, 0), False, False)
candidate_float = render_float((0, 1), True, True)
reference_cpu = r48.render_cpu((1, 0), False, False)
candidate_cpu = r48.render_cpu((0, 1), True, True)
reference_rgba8 = rgba8_to_float(r48.reference_gl)
candidate_rgba8 = rgba8_to_float(r48.candidate_gl)

reference_coverage = coverage_mismatch(reference_float, reference_cpu)
candidate_coverage = coverage_mismatch(candidate_float, candidate_cpu)
float_cross = [abs(a-b) for a,b in zip(reference_float, candidate_float)]
cpu_cross = [abs(a-b) for a,b in zip(reference_cpu, candidate_cpu)]
rgba8_cross = [abs(a-b) for a,b in zip(reference_rgba8, candidate_rgba8)]

result = {
    'schema': 'kaopu-gaussian-float-target-probe/r49',
    'status': 'Candidate-pass',
    'source': {
        'threeRevision': '148ef33ecb6d2502ff796d4554abd1549c95d519',
        'r48Commit': '7e7b3897f9e05b310bd6eec1771caeb2e84b8a2f',
    },
    'backend': r48.identity,
    'fixture': {
        'imagePixels': [SIZE, SIZE],
        'splats': 2,
        'floatTarget': 'RGBA32F texture framebuffer',
        'finalTarget': 'RGBA8 EGL pbuffer',
        'dither': False,
        'srgb': False,
        'toneMapping': False,
        'note': 'Independent fixed-equation OpenGL shader inherited from R48; not Three.js-generated TSL.',
    },
    'reference': {
        'rgba32fVsContinuousCpu': float_metrics(reference_float, reference_cpu),
        'rgba8VsRgba32f': float_metrics(reference_rgba8, reference_float),
        'coverageMismatchPixels': reference_coverage,
    },
    'candidate': {
        'rgba32fVsContinuousCpu': float_metrics(candidate_float, candidate_cpu),
        'rgba8VsRgba32f': float_metrics(candidate_rgba8, candidate_float),
        'coverageMismatchPixels': candidate_coverage,
    },
    'crossImage': {
        'continuousCpuMaxAbs': max(cpu_cross),
        'rgba32fBackendMaxAbs': max(float_cross),
        'rgba8BackendMaxAbs': max(rgba8_cross),
        'cpuToFloatMaximumDelta': abs(max(cpu_cross) - max(float_cross)),
        'floatToRgba8MaximumDelta': abs(max(float_cross) - max(rgba8_cross)),
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
    'rgba32fFramebufferComplete': status == GL_FRAMEBUFFER_COMPLETE,
    'referenceFloatMatchesContinuousWithin1e5': result['reference']['rgba32fVsContinuousCpu']['maxAbs'] < 1e-5,
    'candidateFloatMatchesContinuousWithin1e5': result['candidate']['rgba32fVsContinuousCpu']['maxAbs'] < 1e-5,
    'referenceCoverageMatches': len(reference_coverage) == 0,
    'candidateCoverageMatches': len(candidate_coverage) == 0,
    'rgba8AddsMoreErrorThanFloatArithmetic': result['candidate']['rgba8VsRgba32f']['maxAbs'] > result['candidate']['rgba32fVsContinuousCpu']['maxAbs'],
    'materialCombinedDifferencePersistsInFloatTarget': result['crossImage']['rgba32fBackendMaxAbs'] > 0.05,
}
assert all(result['checks'].values())
print(json.dumps(result, indent=2))
