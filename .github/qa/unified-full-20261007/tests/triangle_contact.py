"""Shared authored triangle predicate copied from accepted neck QA.
Floating-point classification with 1 micrometre tolerance; not exact arithmetic.
Source: kaopu-unified-human-workbench/tests/neck_geometry.py, public neck baseline.
"""
import numpy as np
EPS=1e-6
AREA_EPS=1e-11
COPLANAR_AREA_EPS=EPS**2
def normals_and_areas(triangles):
    raw = np.cross(triangles[:, 1] - triangles[:, 0],
                   triangles[:, 2] - triangles[:, 0])
    lengths = np.linalg.norm(raw, axis=1)
    normals = np.divide(raw, lengths[:, None], out=np.zeros_like(raw),
                        where=lengths[:, None] > 0)
    return normals, lengths / 2


def cross2(a, b):
    return float(a[0] * b[1] - a[1] * b[0])


def polygon_area(poly):
    if len(poly) < 3:
        return 0.0
    return abs(sum(cross2(p, q) for p, q in zip(poly, poly[1:] + poly[:1]))) / 2


def clip_coplanar(a, b):
    """Exact-sign 2D convex clipping; tolerance is applied to final area only."""
    poly = [p.copy() for p in a]
    orient = 1 if cross2(b[1] - b[0], b[2] - b[0]) >= 0 else -1
    for u, v in zip(b, np.roll(b, -1, axis=0)):
        if not poly:
            break
        out = []
        for p, q in zip(poly, poly[1:] + poly[:1]):
            dp = orient * cross2(v - u, p - u)
            dq = orient * cross2(v - u, q - u)
            if dp >= 0:
                out.append(p)
            if (dp >= 0) != (dq >= 0):
                out.append(p + (q - p) * (dp / (dp - dq)))
        poly = out
    return poly


def point_segment_distance(p, a, b):
    edge = b - a
    t = np.clip(np.dot(p - a, edge) / max(float(np.dot(edge, edge)), 1e-30), 0, 1)
    return float(np.linalg.norm(p - (a + t * edge)))


def triangles_touch_2d(a, b):
    # Proper edge crossings would already have a nonempty clipped polygon.
    return min(point_segment_distance(p, u, v)
               for source, other in [(a, b), (b, a)] for p in source
               for u, v in zip(other, np.roll(other, -1, axis=0))) <= EPS


def plane_section(triangle, distances):
    points = [triangle[i] for i, d in enumerate(distances) if abs(d) <= EPS]
    for i, j in [(0, 1), (1, 2), (2, 0)]:
        if (distances[i] > EPS and distances[j] < -EPS) or \
           (distances[i] < -EPS and distances[j] > EPS):
            t = distances[i] / (distances[i] - distances[j])
            points.append(triangle[i] + t * (triangle[j] - triangle[i]))
    return points


def interior_margin(p, triangle, normal):
    # Signed distance to each oriented edge, measured within the triangle plane.
    return min(float(np.dot(np.cross(v - u, p - u), normal)) /
               max(float(np.linalg.norm(v - u)), 1e-30)
               for u, v in zip(triangle, np.roll(triangle, -1, axis=0)))


def classify_pair(a, b, na=None, nb=None):
    """Disjoint, proper noncoplanar crossing, coplanar area overlap, or touch.

    Shared vertex/index adjacency is removed by the caller, not called a hit.
    A proper hit requires a positive intersection interval whose midpoint is
    strictly inside BOTH faces by EPS; line/point/edge contact is separate.
    """
    if na is None or nb is None:
        normals, areas = normals_and_areas(np.stack([a, b]))
        na, nb = normals
        if min(areas) <= AREA_EPS:
            return "degenerate", {}
    da = (a - b[0]) @ nb
    db = (b - a[0]) @ na
    if min(da) > EPS or max(da) < -EPS or min(db) > EPS or max(db) < -EPS:
        return "disjoint", {}
    if max(abs(da)) <= EPS and max(abs(db)) <= EPS:
        drop = int(np.argmax(abs(na)))
        aa, bb = np.delete(a, drop, axis=1), np.delete(b, drop, axis=1)
        poly = clip_coplanar(aa, bb)
        # Undo the projected-plane area factor.
        area = polygon_area(poly) / max(abs(float(na[drop])), 1e-30)
        if area > COPLANAR_AREA_EPS:
            return "coplanar_overlap", {"overlapAreaMM2": area * 1e6}
        if poly or triangles_touch_2d(aa, bb):
            return "coplanar_touch", {}
        return "disjoint", {}
    direction = np.cross(na, nb)
    length = float(np.linalg.norm(direction))
    if length < 1e-12:
        return "disjoint", {}
    direction /= length
    sa, sb = plane_section(a, da), plane_section(b, db)
    if not sa or not sb:
        return "disjoint", {}
    ta, tb = np.asarray(sa) @ direction, np.asarray(sb) @ direction
    low, high = max(min(ta), min(tb)), min(max(ta), max(tb))
    if high < low - EPS:
        return "disjoint", {}
    p = sa[int(np.argmin(ta))] + direction * ((low + high) / 2 - min(ta))
    margin = min(interior_margin(p, a, na), interior_margin(p, b, nb))
    if high - low > EPS and margin > EPS:
        return "proper_crossing", {"segmentLengthMM": float((high - low) * 1000),
                                   "interiorMarginMM": float(margin * 1000),
                                   "witnessMetres": p.tolist()}
    return "noncoplanar_touch", {"segmentLengthMM": float(max(0, high - low) * 1000)}


def predicate_self_tests():
    a = np.array([[0., 0, 0], [1, 0, 0], [0, 1, 0]])
    examples = [
        ("proper crossing", [[.2, .2, -1], [.2, .2, 1], [.8, .2, 0]], "proper_crossing"),
        ("separate planes", a + [0, 0, .1], "disjoint"),
        ("coplanar disjoint", a + [2, 0, 0], "disjoint"),
        ("coplanar area overlap", a + [.2, .2, 0], "coplanar_overlap"),
        ("coplanar edge touch", [[0, 0, 0], [1, 0, 0], [0, -1, 0]], "coplanar_touch"),
        ("coplanar vertex touch", a + [1, 0, 0], "coplanar_touch"),
        ("noncoplanar edge touch", [[0, 0, 0], [1, 0, 0], [.5, 0, 1]], "noncoplanar_touch"),
        ("noncoplanar point touch", [[.2, .2, 0], [.3, .2, 1], [.2, .3, 1]], "noncoplanar_touch"),
        ("AABB overlap without hit", [[.8, .8, -1], [.8, .8, 1], [1, 1, 0]], "disjoint"),
    ]
    for name, b, expected in examples:
        b = np.asarray(b, dtype=float)
        for left, right in [(a, b), (b, a), (a[::-1], b), (a, b[::-1])]:
            result, _ = classify_pair(left, right)
            assert result == expected, (name, result, expected)
    return {"passed": True, "cases": len(examples), "includingSwapAndWindingVariants": 4 * len(examples)}


def aabb_candidates(triangles, face_indices):
    """Conservative sweep-and-prune. Every AABB is expanded by EPS."""
    lo, hi = triangles.min(1) - EPS, triangles.max(1) + EPS
    axis = int(np.argmax(hi.max(0) - lo.min(0)))
    order = np.argsort(lo[:, axis], kind="stable")
    lows = lo[order, axis]
    pairs = []
    adjacent = 0
    for place, i in enumerate(order):
        end = int(np.searchsorted(lows, hi[i, axis], side="right"))
        js = order[place + 1:end]
        if not len(js):
            continue
        js = js[np.all(lo[js] <= hi[i], axis=1) & np.all(hi[js] >= lo[i], axis=1)]
        if not len(js):
            continue
        shared = (face_indices[js, :, None] == face_indices[i, None, :]).any((1, 2))
        adjacent += int(shared.sum())
        pairs.extend((int(i), int(j)) for j in js[~shared])
    return np.asarray(pairs, dtype=np.int64).reshape(-1, 2), adjacent


def collision_scan(vertices, faces, ids):
    triangles = vertices[faces[ids]]
    normals, areas = normals_and_areas(triangles)
    pairs, adjacent = aabb_candidates(triangles, faces[ids])
    # Vectorized supporting-plane reject before the more expensive classification.
    if len(pairs):
        ia, ib = pairs.T
        da = np.einsum("nvc,nc->nv", triangles[ia] - triangles[ib, 0, None], normals[ib])
        db = np.einsum("nvc,nc->nv", triangles[ib] - triangles[ia, 0, None], normals[ia])
        viable = ~((da.min(1) > EPS) | (da.max(1) < -EPS) |
                   (db.min(1) > EPS) | (db.max(1) < -EPS))
        pairs = pairs[viable]
    hits, contacts = [], []
    for i, j in pairs:
        if areas[i] <= AREA_EPS or areas[j] <= AREA_EPS:
            continue
        kind, detail = classify_pair(triangles[i], triangles[j], normals[i], normals[j])
        if kind in ("proper_crossing", "coplanar_overlap"):
            hits.append({"faces": sorted([int(ids[i]), int(ids[j])]), "kind": kind, **detail})
        elif kind != "disjoint":
            contacts.append({"faces": sorted([int(ids[i]), int(ids[j])]), "kind": kind, **detail})
    return {"intersections": hits, "touchingOnly": contacts,
            "sharedVertexOrEdgePairsExcluded": adjacent,
            "pairsAfterAABBAndPlaneReject": len(pairs)}

