from __future__ import annotations

"""R07-P06 browser profile layered on the P05 biological/evidence gates."""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p05_browser_qa.py')
code = SOURCE.read_text(encoding='utf-8')
final_exec = "exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})"
if final_exec not in code:
    raise RuntimeError('P06 QA final exec marker missing')

extra = r'''
# P06 changes the displacement space and mesh density, while retaining all P05
# species, Palau evidence, viewport, image-difference, and runtime gates.
p06_replacements = {
    "assert qa.get('vertexCount', 0) > 50000 and qa.get('triangleCount', 0) > 100000, initial":
        "assert qa.get('vertexCount', 0) > 70000 and qa.get('triangleCount', 0) > 145000, initial",
    "qa.get('meshResolution') == '160x320'":
        "qa.get('meshResolution') == '192x384'",
    "and qa.get('coralliteTopology') == 'shallow-pit-fine-rim-filled-elements', initial":
        "and qa.get('coralliteTopology') == 'shallow-pit-fine-rim-filled-elements' and qa.get('microDisplacementSpace') == 'surface-normal' and qa.get('microRadialOnly') is False and qa.get('microTangentialLeakRms', 1) < 1e-9 and qa.get('microNormalDisplacementRms', 0) > .002, initial",
    "assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial":
        "assert build.get('microDisplacementSpace') == 'surface-normal' and build.get('microRadialOnly') is False, initial\n        assert qa.get('visualAcceptance') is False and qa.get('productionReady') is False, initial",
    "microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,warpRms:q.warpDisplacementRms":
        "microRms:q.microDisplacementRms,microCoverage:q.microCoveragePct,microNormalRms:q.microNormalDisplacementRms,microTangentialLeak:q.microTangentialLeakRms,microSpace:q.microDisplacementSpace,warpRms:q.warpDisplacementRms",
    "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0, (micro0,micro1)":
        "assert abs(micro0['microRms']) < 1e-10 and micro0['microCoverage'] == 0 and abs(micro0['microNormalRms']) < 1e-10, (micro0,micro1)",
    "assert micro1['microRms'] > .004 and micro1['microCoverage'] > 20, (micro0,micro1)":
        "assert micro1['microRms'] > .004 and micro1['microCoverage'] > 20 and micro1['microNormalRms'] > .006 and micro1['microTangentialLeak'] < 1e-9 and micro1['microSpace'] == 'surface-normal', (micro0,micro1)",
    "defaults={'microDepth':.44,'warp':.12,'lobes':.16,'saturation':.92}":
        "defaults={'microDepth':.62,'warp':.12,'lobes':.16,'saturation':.92}",
}
for old, new in p06_replacements.items():
    if old not in code:
        raise RuntimeError(f'P06 QA source marker missing: {old}')
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
'''.strip()
code = code.replace(final_exec, extra, 1)
exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
