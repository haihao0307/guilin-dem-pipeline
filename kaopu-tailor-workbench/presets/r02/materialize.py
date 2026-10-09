"""Materialize the authored R02 module deterministically and idempotently.

The first authored version contained compact JavaScript such as
``flag?.165:.2``. JavaScript parses that token sequence as optional chaining,
not a numeric ternary. Only question-mark-dot sequences followed by a decimal
digit are rewritten; real optional property access such as ``row?.overrides``
is never changed. A retained generated branch already contains the corrected
form, so subsequent delivery runs must accept zero rewrites.
"""
from pathlib import Path
import re

HERE=Path(__file__).resolve().parent
path=HERE/'showcase-3d.mjs'
text=path.read_text(encoding='utf-8')
pattern=r'([A-Za-z0-9_\)\]])\?\.([0-9])'
fixed,count=re.subn(pattern,r'\1 ? .\2',text)
if count not in {0,5}:
    raise SystemExit(f'Expected zero or five compact numeric ternaries, found {count}')
if re.search(pattern,fixed):
    raise SystemExit('A compact numeric ternary remains')
path.write_text(fixed,encoding='utf-8')
print(f'R02_MATERIALIZED numeric_ternaries={count} already_materialized={count==0}')
