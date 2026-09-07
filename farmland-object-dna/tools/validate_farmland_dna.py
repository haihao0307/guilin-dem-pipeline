#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ALLOWED_TYPES = {
    "paddy",
    "dry_field",
    "vegetable_garden",
    "orchard",
    "nursery",
    "fallow",
}
ALLOWED_EVIDENCE = {"observed", "inferred", "generated", "unknown", "conflicted"}
REQUIRED_TOP = {
    "identity",
    "spatial",
    "parcel",
    "hydraulics",
    "soil",
    "crop",
    "laborSettlement",
    "calendar",
    "maintenance",
    "degradation",
    "coupling",
    "representation",
}


def fail(message):
    raise ValueError(message)


def validate(data):
    missing = sorted(REQUIRED_TOP - set(data))
    if missing:
        fail(f"missing top-level sections: {missing}")

    identity = data["identity"]
    for key in ("world_id", "object_id", "type_id", "revision", "evidence", "review_status"):
        if key not in identity:
            fail(f"identity missing {key}")
    if identity["type_id"] not in ALLOWED_TYPES:
        fail(f"unsupported type_id: {identity['type_id']}")
    if identity["evidence"].get("kind") not in ALLOWED_EVIDENCE:
        fail("invalid evidence kind")

    spatial = data["spatial"]
    if not isinstance(spatial.get("area_m2"), (int, float)) or spatial["area_m2"] <= 0:
        fail("spatial.area_m2 must be positive")
    boundary = spatial.get("boundary")
    if not isinstance(boundary, list) or len(boundary) < 3:
        fail("spatial.boundary requires at least three points")

    representation = data["representation"]
    if "seed" not in representation or not representation.get("method_version"):
        fail("representation requires seed and method_version")

    coupling = data["coupling"]
    if not isinstance(coupling.get("inputs"), list) or not isinstance(coupling.get("outputs"), list):
        fail("coupling inputs and outputs must be arrays")

    if identity["type_id"] == "paddy":
        hydraulics = data["hydraulics"]
        if hydraulics.get("water_source") is None:
            fail("paddy requires a declared water_source, including unknown external source")
        if not hydraulics.get("inlets"):
            fail("paddy requires at least one inlet")
        if not hydraulics.get("outlets"):
            fail("paddy requires at least one outlet")
        if not hydraulics.get("channels"):
            fail("paddy requires at least one channel or drain")

        labor = data["laborSettlement"]
        if "maintenance_capacity_state" not in labor:
            fail("traditional paddy requires maintenance capacity state")

    return {
        "ok": True,
        "object_id": identity["object_id"],
        "type_id": identity["type_id"],
        "revision": identity["revision"],
    }


def main():
    if len(sys.argv) != 2:
        print("usage: validate_farmland_dna.py <object.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        result = validate(data)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
