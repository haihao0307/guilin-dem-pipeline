#!/usr/bin/env python3
"""Run the V200 place resolver through one source-traceable Overpass snapshot.

All requested aliases are queried together once. The identical raw OSM snapshot
is then evaluated independently for every requested target by the frozen core
selection logic. This reduces load on public Overpass endpoints while keeping
raw responses, exact queries, OSM element IDs, coordinates and hashes.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

MODULE_PATH = Path(__file__).with_name("acquire_osm_places_v200.py")
CONFIG_PATH = MODULE_PATH.parents[1] / "config" / "osm_places_v200.json"
SPEC = importlib.util.spec_from_file_location("wenzhou_v200_places_core", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {MODULE_PATH}")
CORE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CORE)
ORIGINAL_REQUEST = CORE.request_overpass
CONFIG = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
GLOBAL_ALIASES = sorted(
    {alias for target in CONFIG["targets"] for alias in target["aliases"]},
    key=lambda value: (len(value), value),
)
CACHE: dict[str, Any] = {}


def posix_literal(value: str) -> str:
    specials = set('\\.^$|?*+()[]{}"')
    return "".join(("\\" + char) if char in specials else char for char in value)


def overpass_query(
    bounds: list[float],
    aliases: list[str],
    tag_keys: list[str],
    timeout_seconds: int,
) -> str:
    del aliases
    west, south, east, north = bounds
    bbox = f"{south:.8f},{west:.8f},{north:.8f},{east:.8f}"
    pattern = "(" + "|".join(posix_literal(alias) for alias in GLOBAL_ALIASES) + ")"
    clauses: list[str] = []
    for element in ("node", "way", "relation"):
        for key in tag_keys:
            clauses.append(f'  {element}["{key}"~"{pattern}",i]({bbox});')
    return (
        f"[out:json][timeout:{timeout_seconds}];\n"
        "(\n"
        + "\n".join(clauses)
        + "\n);\n"
        "out tags center qt;\n"
    )


def request_overpass(
    target_id: str,
    endpoints: list[str],
    query: str,
    attempts_per_endpoint: int,
    pause_429: float,
    pause_other: float,
) -> tuple[bytes, dict[str, Any]]:
    if "content" not in CACHE:
        content, transfer = ORIGINAL_REQUEST(
            "all_requested_places",
            endpoints,
            query,
            attempts_per_endpoint,
            pause_429,
            pause_other,
        )
        CACHE["content"] = content
        CACHE["transfer"] = transfer
        CACHE["firstTargetId"] = target_id
        return content, {
            **transfer,
            "snapshotPolicy": "single_combined_query",
            "cacheReuse": False,
            "requestedTargetId": target_id,
        }
    return CACHE["content"], {
        **CACHE["transfer"],
        "snapshotPolicy": "single_combined_query",
        "cacheReuse": True,
        "firstTargetId": CACHE["firstTargetId"],
        "requestedTargetId": target_id,
    }


CORE.overpass_query = overpass_query
CORE.request_overpass = request_overpass

if __name__ == "__main__":
    sys.exit(CORE.main())
