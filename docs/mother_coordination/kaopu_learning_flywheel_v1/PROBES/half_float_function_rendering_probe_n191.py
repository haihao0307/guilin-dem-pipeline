"""N191 numeric audition for a half-float function-rendering path.

This tests storage semantics used by Building R01; it does not modify or render
the production artifact.
"""

import json
import math
import struct


def half(value):
    try:
        return struct.unpack(">e", struct.pack(">e", value))[0]
    except OverflowError:
        return math.copysign(math.inf, value)


def packed_identity(object_id, instance_id, material_role, flags):
    assert 0 <= object_id <= 0xFFFF
    assert 0 <= instance_id <= 0xFF
    assert 0 <= material_role <= 0x0F
    assert 0 <= flags <= 0x0F
    return [object_id & 0xFF, object_id >> 8, instance_id, (material_role << 4) | flags]


def unpacked_identity(rgba):
    return {
        "objectId": rgba[0] | (rgba[1] << 8),
        "instanceId": rgba[2],
        "materialRole": rgba[3] >> 4,
        "flags": rgba[3] & 0x0F,
    }


object_ids = [2047, 2048, 2049, 30000, 30001, 30002, 30008, 30016]
id_rows = [{"input": value, "half": half(value)} for value in object_ids]
id_groups = {}
for row in id_rows:
    id_groups.setdefault(str(row["half"]), []).append(row["input"])
id_collisions = [values for values in id_groups.values() if len(values) > 1]

distances = [10.0, 10.001, 10.002, 100.0, 100.01, 100.03, 100.04]
distance_rows = [{"input": value, "half": half(value)} for value in distances]
distance_groups = {}
for row in distance_rows:
    distance_groups.setdefault(str(row["half"]), []).append(row["input"])
distance_collisions = [values for values in distance_groups.values() if len(values) > 1]

identity_examples = [
    {"objectId": 30000, "instanceId": 0, "materialRole": 3, "flags": 1},
    {"objectId": 30001, "instanceId": 31, "materialRole": 6, "flags": 1},
    {"objectId": 65535, "instanceId": 255, "materialRole": 15, "flags": 15},
]
identity_roundtrips = []
for example in identity_examples:
    packed = packed_identity(**{
        "object_id": example["objectId"],
        "instance_id": example["instanceId"],
        "material_role": example["materialRole"],
        "flags": example["flags"],
    })
    unpacked = unpacked_identity(packed)
    identity_roundtrips.append({
        "input": example,
        "rgba8": packed,
        "output": unpacked,
        "exact": unpacked == example,
    })

sentinel = half(1e20)
report = {
    "schemaVersion": "n191-v1",
    "probeKind": "numeric_storage_audition_not_production_render_validation",
    "productionFacts": {
        "currentHitSentinel": 1e20,
        "currentRailObjectIdBase": 30000,
        "currentTargets": "three RGBA32F MRT ping-pong attachments",
    },
    "halfObjectIdRows": id_rows,
    "halfObjectIdCollisions": id_collisions,
    "halfDistanceRows": distance_rows,
    "halfDistanceCollisions": distance_collisions,
    "halfSentinel": "Infinity" if math.isinf(sentinel) else sentinel,
    "packedIdentityRoundtrips": identity_roundtrips,
    "directRgba16fSubstitutionSafe": False,
    "hybridCandidate": {
        "metricNormalLocal": "RGBA16F",
        "identity": "RGBA8: objectId16 + instanceId8 + materialRole4 + flags4",
        "attachmentCount": 4,
        "identityExactForDeclaredBounds": all(row["exact"] for row in identity_roundtrips),
        "requiresExtension": "EXT_color_buffer_half_float",
        "requiresFramebufferCompletenessProbe": True,
        "requiresVisualAndInteractionEquivalence": True,
    },
    "decision": "REJECT_DIRECT_HALF_SUBSTITUTION__AUDITION_HYBRID_HALF_PLUS_PACKED_IDENTITY",
}

print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))

assert report["halfObjectIdCollisions"]
assert report["halfDistanceCollisions"]
assert report["halfSentinel"] == "Infinity"
assert report["hybridCandidate"]["identityExactForDeclaredBounds"] is True
