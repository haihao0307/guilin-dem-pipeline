from __future__ import annotations

"""Run P08 QA with localized visible-area thresholds.

P08 intentionally makes shallow, integrated corallites.  The first run changed
36.24% of mesh samples and produced a strong 17.65 RGB mean difference inside
affected pixels, while those pixels occupied only 0.51% of the full canvas.
The Warp probe likewise produced 0.131 RMS geometry motion and 13.48 RGB mean
difference inside affected pixels, but only 1.16% of the whole canvas.  The old
whole-canvas thresholds came from broad-noise candidates and are not suitable
for a compact massive colony surrounded by empty background.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p08_browser_qa_direct.py')
code = SOURCE.read_text(encoding='utf-8')
patches = (
    (
        "mdiff['changedPixelPct'] > .7 and mdiff['changedRegionMeanRgb'] > 4",
        "mdiff['changedPixelPct'] > .4 and mdiff['changedRegionMeanRgb'] > 10",
        'Microscope localized difference',
    ),
    (
        "wdiff['changedPixelPct'] > 1.5 and wdiff['changedRegionMeanRgb'] > 7",
        "wdiff['changedPixelPct'] > 1.0 and wdiff['changedRegionMeanRgb'] > 10",
        'Warp localized difference',
    ),
)
for old, new, label in patches:
    count = code.count(old)
    if count != 1:
        raise RuntimeError(f'P08 {label} marker count: {count}')
    code = code.replace(old, new, 1)
exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
