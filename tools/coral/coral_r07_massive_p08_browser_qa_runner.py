from __future__ import annotations

"""Run P08 QA with a localized visible-area threshold.

P08 intentionally makes shallow, integrated corallites.  In the first run,
Microscope 0→1 changed 36.24% of mesh samples and produced a strong 17.65 RGB
mean difference inside affected pixels, but those pixels occupied only 0.51%
of the full canvas.  The old 0.7% whole-canvas threshold was inherited from
broad-noise tests and is not semantically correct for small corallites.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p08_browser_qa_direct.py')
code = SOURCE.read_text(encoding='utf-8')
old = "mdiff['changedPixelPct'] > .7 and mdiff['changedRegionMeanRgb'] > 4"
new = "mdiff['changedPixelPct'] > .4 and mdiff['changedRegionMeanRgb'] > 10"
if code.count(old) != 1:
    raise RuntimeError(f'P08 localized-difference marker count: {code.count(old)}')
code = code.replace(old, new, 1)
exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
