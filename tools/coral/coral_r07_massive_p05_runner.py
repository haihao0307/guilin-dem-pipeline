from __future__ import annotations

"""Execute the P05 builder with selectors narrowed to specific controls.

The first P05 draft used a few broad value fragments.  Some values are shared
by more than one slider in the P04 baseline, so this wrapper rewrites those
builder statements to target the base, grain, and saturation controls by ID.
The production contract is otherwise unchanged.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p05_palua_smooth_filled.py')
code = SOURCE.read_text(encoding='utf-8')

patches = (
    (
        "html = replace_once(html, 'value=\"0.34\"', 'value=\"0.18\"', 'base slider default')",
        "html = replace_once(html, '<input id=\"base\" type=\"range\" min=\"0\" max=\"0.85\" step=\"0.01\" value=\"0.34\">', '<input id=\"base\" type=\"range\" min=\"0\" max=\"0.85\" step=\"0.01\" value=\"0.18\">', 'base slider default')",
    ),
    (
        "html = replace_once(html, '>0.34</output>', '>0.18</output>', 'base output default')",
        "html = replace_once(html, '<output id=\"baseO\">0.34</output>', '<output id=\"baseO\">0.18</output>', 'base output default')",
    ),
    (
        "html = replace_once(html, 'value=\"0.34\"', 'value=\"0.22\"', 'grain slider default')",
        "html = replace_once(html, '<input id=\"grain\" type=\"range\" min=\"0\" max=\"1\" step=\"0.01\" value=\"0.34\">', '<input id=\"grain\" type=\"range\" min=\"0\" max=\"1\" step=\"0.01\" value=\"0.22\">', 'grain slider default')",
    ),
    (
        "html = replace_once(html, '>0.34</output>', '>0.22</output>', 'grain output default')",
        "html = replace_once(html, '<output id=\"grainO\">0.34</output>', '<output id=\"grainO\">0.22</output>', 'grain output default')",
    ),
    (
        "html = replace_once(html, 'value=\"1\">', 'value=\"0.92\">', 'saturation slider default')",
        "html = replace_once(html, '<input id=\"saturation\" type=\"range\" min=\"0.55\" max=\"1.45\" step=\"0.01\" value=\"1\">', '<input id=\"saturation\" type=\"range\" min=\"0.55\" max=\"1.45\" step=\"0.01\" value=\"0.92\">', 'saturation slider default')",
    ),
    (
        "html = replace_once(html, '>1.00</output>', '>0.92</output>', 'saturation output default')",
        "html = replace_once(html, '<output id=\"saturationO\">1.00</output>', '<output id=\"saturationO\">0.92</output>', 'saturation output default')",
    ),
)

for old, new in patches:
    if old not in code:
        raise RuntimeError(f'P05 runner source marker missing: {old}')
    code = code.replace(old, new, 1)

exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
