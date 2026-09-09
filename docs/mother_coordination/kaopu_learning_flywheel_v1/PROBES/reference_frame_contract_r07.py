import math

TOL = 1e-6


def det3(m):
    return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(dot(a, a))


def rotation_columns(m4):
    return [[m4[r][c] for r in range(3)] for c in range(3)]


def validate_rigid_world_to_ecef(m4, tol=TOL):
    if len(m4) != 4 or any(len(row) != 4 for row in m4):
        return False, "matrix-shape"
    cols = rotation_columns(m4)
    for i, c in enumerate(cols):
        if abs(norm(c) - 1.0) > tol:
            return False, f"scale-in-column-{i}"
    for i in range(3):
        for j in range(i + 1, 3):
            if abs(dot(cols[i], cols[j])) > tol:
                return False, f"non-orthogonal-{i}-{j}"
    r = [[m4[row][col] for col in range(3)] for row in range(3)]
    if abs(det3(r) - 1.0) > 1e-5:
        return False, "rotation-determinant"
    if any(abs(x) > tol for x in m4[3][:3]) or abs(m4[3][3] - 1.0) > tol:
        return False, "homogeneous-row"
    return True, "ok"


def validate_packet(packet):
    required = {
        "frameId",
        "referenceSurface",
        "worldToECEF",
        "altitudeReference",
        "evaluatorId",
        "stateSourceId",
    }
    missing = sorted(required - packet.keys())
    if missing:
        return False, {"reason": "missing-fields", "fields": missing}
    ok, reason = validate_rigid_world_to_ecef(packet["worldToECEF"])
    if not ok:
        return False, {"reason": reason}
    if packet["altitudeReference"] not in {
        "ellipsoid-height",
        "geopotential-height",
        "surface-relative",
        "model-native",
    }:
        return False, {"reason": "unknown-altitude-reference"}
    return True, {"reason": "ok"}


VALID = {
    "frameId": "earth-ecef-runtime-r01",
    "referenceSurface": "WGS84",
    "worldToECEF": [
        [1.0, 0.0, 0.0, 6378137.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ],
    "altitudeReference": "ellipsoid-height",
    "evaluatorId": "candidate-evaluator",
    "stateSourceId": "candidate-state",
}

INVALID_SCALE = {
    **VALID,
    "worldToECEF": [
        [2.0, 0.0, 0.0, 6378137.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ],
}


if __name__ == "__main__":
    ok_valid, detail_valid = validate_packet(VALID)
    ok_invalid, detail_invalid = validate_packet(INVALID_SCALE)
    assert ok_valid
    assert not ok_invalid
    print("VALID_PACKET", detail_valid["reason"])
    print("INVALID_SCALE_PACKET", detail_invalid["reason"])
    print("RESULT 2/2 PASS")
