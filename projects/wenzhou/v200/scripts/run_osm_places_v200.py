#!/usr/bin/env python3
"""Run the V200 place resolver with a POSIX-compatible Overpass query.

Overpass uses POSIX regular expressions. Python ``re.escape`` emits escaped
spaces and the original non-capturing group syntax is not portable to that
engine. This runner keeps the resolver logic unchanged and supplies an explicit
node, way and relation query using a POSIX capturing group.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any

MODULE_PATH = Path(__file__).with_name("acquire_osm_places_v200.py")
SPEC = importlib.util.spec_from_file_location("wenzhou_v200_places_core", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {MODULE_PATH}")
CORE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CORE)


def posix_literal(value: str) -> str:
    specials = set('\\.^$|?*+()[]{}"')
    return "".join(("\\" + char) if char in specials else char for char in value)


def overpass_query(
    bounds: list[float],
    aliases: list[str],
    tag_keys: list[str],
    timeout_seconds: int,
) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.8f},{west:.8f},{north:.8f},{east:.8f}"
    pattern = "(" + "|".join(posix_literal(alias) for alias in aliases) + ")"
    clauses: list[str] = []
    for element in ("node", "way", "relation"):
        for key in tag_keys:
            clauses.append(f'  {element}["{key}"~"{pattern}",i]({bbox});')
    return (
        f"[out:json][timeout:{timeout_seconds}];\n"
        "(\n"
        + "\n".join(clauses)
        + "\n);\n"
        "out center tags qt;\n"
    )


CORE.overpass_query = overpass_query

if __name__ == "__main__":
    sys.exit(CORE.main())
