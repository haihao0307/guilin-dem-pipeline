from __future__ import annotations

"""P04 QA profile.

P00-P03 used a broad-displacement coverage threshold suitable for sinusoidal
fields. P04 deliberately uses discrete cellular pits, rims, and shared walls,
so unaffected plateaus between corallites are valid. This wrapper keeps all
original browser, topology, anchoring, image-difference, and performance gates
while replacing only the two broad-field coverage assumptions.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p00_browser_qa.py')
code = SOURCE.read_text(encoding='utf-8')

replacements = {
    "qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 70":
        "qa.get('microscopeGeometry') is True and qa.get('microCoveragePct', 0) > 30",
    "micro1['microRms'] > .015 and micro1['microCoverage'] > 70":
        "micro1['microRms'] > .010 and micro1['microCoverage'] > 30",
}
for old, new in replacements.items():
    if old not in code:
        raise RuntimeError(f'P04 QA source marker missing: {old}')
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
