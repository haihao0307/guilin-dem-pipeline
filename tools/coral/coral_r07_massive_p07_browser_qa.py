from __future__ import annotations

"""R07-P07 QA profile layered on the P06 evidence and viewport gates."""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p06_browser_qa.py')
code = SOURCE.read_text(encoding='utf-8')
final_exec = "exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})"
marker = "\n" + final_exec + "\n"
pos = code.rfind(marker)
if pos < 0:
    raise RuntimeError('P07 QA terminal exec marker missing')

extra = r'''
p07_replacements = {
    "assert qa.get('vertexCount', 0) > 70000 and qa.get('triangleCount', 0) > 145000, initial":
        "assert qa.get('vertexCount', 0) > 90000 and qa.get('triangleCount', 0) > 160000, initial",
    "qa.get('meshResolution') == '192x384'":
        "qa.get('meshResolution') == '128x256+explicit-cups'",
    "qa.get('coralliteTopology') == 'shallow-pit-fine-rim-filled-elements'":
        "qa.get('coralliteTopology') == 'outer-blend-rim-inner-filled-center'",
    "qa.get('microDisplacementSpace') == 'surface-normal' and qa.get('microRadialOnly') is False and qa.get('microTangentialLeakRms', 1) < 1e-9 and qa.get('microNormalDisplacementRms', 0) > .002":
        "qa.get('microDisplacementSpace') == 'explicit-surface-normal-cup-mesh' and qa.get('microRadialOnly') is False and qa.get('microTangentialLeakRms', 1) < 1e-9 and qa.get('microNormalDisplacementRms', 0) > .002 and qa.get('baseSurfaceMicroNoise') is False and qa.get('cupCount', 0) > 1000 and qa.get('cupSides') == 12 and qa.get('cupVertexCount', 0) > 40000 and qa.get('cupTriangleCount', 0) > 50000",
    "assert build.get('microDisplacementSpace') == 'surface-normal' and build.get('microRadialOnly') is False, initial":
        "assert build.get('microDisplacementSpace') == 'explicit-surface-normal-cup-mesh' and build.get('microRadialOnly') is False and build.get('baseSurfaceMicroNoise') is False, initial",
    "micro1['microSpace'] == 'surface-normal'":
        "micro1['microSpace'] == 'explicit-surface-normal-cup-mesh'",
}
for old, new in p07_replacements.items():
    if old not in code:
        raise RuntimeError(f'P07 QA source marker missing: {old}')
    code = code.replace(old, new, 1)

# Expose explicit-cup counts in the functional probe and require the cup mesh
# to disappear completely at microscope=0 and return at microscope=1.
probe_old = "microSpace:q.microDisplacementSpace,warpRms:q.warpDisplacementRms"
probe_new = "microSpace:q.microDisplacementSpace,cupCount:q.cupCount,cupVertices:q.cupVertexCount,cupTriangles:q.cupTriangleCount,baseSurfaceMicroNoise:q.baseSurfaceMicroNoise,warpRms:q.warpDisplacementRms"
if probe_old not in code:
    raise RuntimeError('P07 probe marker missing')
code = code.replace(probe_old, probe_new, 1)

micro0_old = "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0 and abs(micro0['microNormalRms']) < 1e-10, (micro0,micro1)"
micro0_new = "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0 and abs(micro0['microNormalRms']) < 1e-10 and micro0['cupCount'] == 0, (micro0,micro1)"
if micro0_old not in code:
    raise RuntimeError('P07 microscope-zero marker missing')
code = code.replace(micro0_old, micro0_new, 1)

micro1_old = "assert micro1['microRms'] > .004 and micro1['microCoverage'] > 20 and micro1['microNormalRms'] > .006 and micro1['microTangentialLeak'] < 1e-9 and micro1['microSpace'] == 'explicit-surface-normal-cup-mesh', (micro0,micro1)"
micro1_new = "assert micro1['microRms'] > .004 and micro1['microCoverage'] > 20 and micro1['microNormalRms'] > .006 and micro1['microTangentialLeak'] < 1e-9 and micro1['microSpace'] == 'explicit-surface-normal-cup-mesh' and micro1['cupCount'] > 1000 and micro1['cupVertices'] > 40000 and micro1['cupTriangles'] > 50000 and micro1['baseSurfaceMicroNoise'] is False, (micro0,micro1)"
if micro1_old not in code:
    raise RuntimeError('P07 microscope-one marker missing')
code = code.replace(micro1_old, micro1_new, 1)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
'''.strip()

code = code[:pos] + "\n" + extra + "\n" + code[pos + len(marker):]
exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
