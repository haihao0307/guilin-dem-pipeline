from __future__ import annotations

"""Execute the P05 builder after tightening two saturation selectors.

The first P05 draft used broad literal fragments that also matched the
Microscope scale control. This wrapper narrows those two replacements to the
saturation control only, while leaving the production script and its evidence
contract otherwise unchanged.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p05_palua_smooth_filled.py')
code = SOURCE.read_text(encoding='utf-8')

old_slider = "html = replace_once(html, 'value=\"1\">', 'value=\"0.92\">', 'saturation slider default')"
new_slider = (
    "html = replace_once(html, '<input id=\"saturation\" type=\"range\" min=\"0.55\" max=\"1.45\" "
    "step=\"0.01\" value=\"1\">', '<input id=\"saturation\" type=\"range\" min=\"0.55\" "
    "max=\"1.45\" step=\"0.01\" value=\"0.92\">', 'saturation slider default')"
)
old_output = "html = replace_once(html, '>1.00</output>', '>0.92</output>', 'saturation output default')"
new_output = (
    "html = replace_once(html, '<output id=\"saturationO\">1.00</output>', "
    "'<output id=\"saturationO\">0.92</output>', 'saturation output default')"
)

for old, new in ((old_slider, new_slider), (old_output, new_output)):
    if old not in code:
        raise RuntimeError(f'P05 runner source marker missing: {old}')
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
