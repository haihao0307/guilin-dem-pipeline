from __future__ import annotations

"""Run P07 with whitespace-tolerant replacement of the P06 generate block."""

from pathlib import Path


SOURCE = Path(__file__).with_name('coral_r07_massive_p07_explicit_corallite_cups.py')
code = SOURCE.read_text(encoding='utf-8')
old = r"r'function generate\(\)\{.*?\n}\nfunction m4mul'"
new = r"r'function generate\(\)\{.*?\n}\s*function m4mul'"
if old not in code:
    raise RuntimeError('P07 runner generate-regex marker missing')
code = code.replace(old, new, 1)
exec(compile(code, str(SOURCE), 'exec'), {'__name__': '__main__', '__file__': str(SOURCE)})
