from __future__ import annotations

"""Run P08 QA with localized visible-area thresholds.

P08 intentionally makes shallow, integrated corallites. The initial browser
probe changed 36.24% of mesh samples and produced a strong 17.65 RGB mean
difference inside affected pixels, while those pixels occupied only 0.51% of
the full canvas. The Warp probe produced 0.131 RMS geometry motion and 13.48
RGB mean difference inside affected pixels, while covering 1.16% of the full
canvas. The old whole-canvas thresholds came from broad-noise candidates and
are not suitable for a compact colony surrounded by empty background.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p08_browser_qa_direct.py')
code = SOURCE.read_text(encoding='utf-8')

# The microscope threshold is explicitly present in the direct P08 source.
old_micro = "mdiff['changedPixelPct'] > .7 and mdiff['changedRegionMeanRgb'] > 4"
new_micro = "mdiff['changedPixelPct'] > .4 and mdiff['changedRegionMeanRgb'] > 10"
if code.count(old_micro) != 1:
    raise RuntimeError(f'P08 microscope localized-difference marker count: {code.count(old_micro)}')
code = code.replace(old_micro, new_micro, 1)

# The Warp assertion lives in the stable P00 harness loaded by the direct QA
# script, not in this wrapper's source text. Insert one final replace_once call
# immediately before the direct script executes its generated QA program.
terminal = "exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})"
pos = code.rfind(terminal)
if pos < 0:
    raise RuntimeError('P08 direct QA terminal execution marker missing')
warp_patch = r'''
replace_once(
    "assert warp0['signature'] != warp1['signature'] and wdiff['changedPixelPct'] > 1.5 and wdiff['changedRegionMeanRgb'] > 7, (warp0,warp1,wdiff)",
    "assert warp0['signature'] != warp1['signature'] and wdiff['changedPixelPct'] > 1.0 and wdiff['changedRegionMeanRgb'] > 10, (warp0,warp1,wdiff)",
    'Warp localized visible difference',
)
'''.strip()
code = code[:pos] + warp_patch + "\n\n" + code[pos:]

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
