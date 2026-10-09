"""Materialize the authored R02 module deterministically.

The contents API preserved compact JavaScript such as ``flag?.165:.2``. In
JavaScript that token sequence is parsed as optional chaining instead of a
ternary. Only question-mark-dot sequences followed by a decimal digit are
rewritten; real optional property access such as ``row?.overrides`` is never
changed. The generated result is committed by the isolated Actions workflow.
"""
from pathlib import Path
import re

HERE=Path(__file__).resolve().parent
path=HERE/'showcase-3d.mjs'
text=path.read_text(encoding='utf-8')
fixed,count=re.subn(r'([A-Za-z0-9_\)\]])\?\.([0-9])',r'\1 ? .\2',text)
if count!=5:
    raise SystemExit(f'Expected exactly five compact numeric ternaries, found {count}')
if re.search(r'[A-Za-z0-9_\)\]]\?\.[0-9]',fixed):
    raise SystemExit('A compact numeric ternary remains')
path.write_text(fixed,encoding='utf-8')
print(f'R02_MATERIALIZED numeric_ternaries={count}')
