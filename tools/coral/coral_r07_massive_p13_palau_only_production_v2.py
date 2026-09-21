from __future__ import annotations

"""Corrected P13 production entrypoint.

The first split builder correctly separated QA and Build gate injection but
retained a redundant exact `version:'R07-P12'` replacement after the broader
`R07-P12` replacement.  This wrapper removes only that unreachable duplicate
assertion and executes the otherwise frozen production builder.
"""

from pathlib import Path


SOURCE = Path(__file__).with_name("coral_r07_massive_p13_palau_only_production.py")
code = SOURCE.read_text(encoding="utf-8")
redundant = '        "version:\'R07-P12\'": "version:\'R07-P13\'",\n'
if redundant not in code:
    raise RuntimeError("P13 redundant-version marker missing")
code = code.replace(redundant, "", 1)
exec(compile(code, str(SOURCE), "exec"), {"__name__": "__main__", "__file__": str(SOURCE)})
