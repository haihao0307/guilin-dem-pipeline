#!/usr/bin/env python3
"""Bounded neck geometry QA, using existing fixtures; no teacher evaluation.

Run from any directory: python tests/neck_geometry.py
Only research/neck-geometry-report.json is written. Exit 1 means review required.
Requires NumPy already used by the reproduction tools; does not install anything.
This is not a whole-body collision certificate or an exact-arithmetic predicate.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import sys
import time

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CASES = ["neutral", "child", "old", "heavy", "lean", "muscular", "turn",
         "arms", "knee", "expression", "identity", "mhr_plus", "mhr_minus",
         "mhr_pose", "combined"]
# Engineering review thresholds, not a validated biological/production standard.
EPS = 1e-6                    # metres: 0.001 mm, above Float32 fixture roundoff
AREA_EPS = 1e-11              # m^2: 0.00001 mm^2
COPLANAR_AREA_EPS = EPS**2
WARN_DEGREES = 75.0
FAIL_DEGREES = 120.0          # angle between consistently oriented face normals


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


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", nargs="+", choices=CASES, default=CASES,
                        help="Diagnostic subset; cannot produce a full release pass")
    args = parser.parse_args()
    started = time.time()
    self_tests = predicate_self_tests()
    cp = ROOT / "assets/canonical.json"
    c = json.loads(cp.read_text())
    faces = np.asarray(c["faces"], dtype=np.int64).reshape(-1, 3)
    body_count = len(c["annyRecipes"])
    vertex_count = body_count + len(c["gnmRecipes"])
    actual_topology_hash = hashlib.sha256(faces.astype("<u4").tobytes()).hexdigest()
    assert actual_topology_hash == c["topologySha256"], "Declared topology hash does not match faces"
    affected = {int(row["index"]) for row in c["neckFairing"]["band"]}
    affected |= {body_count + int(row[0]) for row in c["neckContour"]["headLinks"]}
    ring = set(c["bodyRing"]) | set(c["headRing"])
    affected |= ring
    ids = np.flatnonzero(np.isin(faces, list(affected)).any(1))
    collar_ids = set(np.flatnonzero(np.isin(faces, list(ring)).any(1)).tolist())
    assert len(ids) > 0
    edges = collections.defaultdict(list)
    for fi in ids:
        for u, v in zip(faces[fi], np.roll(faces[fi], -1)):
            edges[tuple(sorted((int(u), int(v))))].append(int(fi))
    edge_rows = [(edge, fs) for edge, fs in edges.items() if len(fs) == 2]
    edge_faces = np.asarray([row[1] for row in edge_rows], dtype=np.int64)

    # Source neutral is diagnostic provenance only, not a case-matched native
    # reference for expression, identity, or posed fixtures.
    source_paths = [ROOT / "research" / name for name in ("anny-neutral.json", "gnm-neutral.json")]
    has_sources = all(path.exists() for path in source_paths)
    a, g = [json.loads(path.read_text()) for path in source_paths] if has_sources else (None, None)
    declared_protected = set(c.get("protectedHeadIndices", []))
    assert declared_protected, "Canonical must declare protected facial/oral vertices"
    protected = ({i for i, (s0, s1, _) in enumerate(c["gnmRecipes"])
                  if any(g["regionId"][src] < 20 or g["componentId"][src] != 0
                         for src in (s0, s1))} if has_sources else declared_protected)
    protected_global = {i + body_count for i in protected}
    contour_global = {body_count + int(row[0]) for row in c["neckContour"]["headLinks"]}
    fairing_global = {int(row["index"]) for row in c["neckFairing"]["band"]}
    # Without teacher metadata, verify consistency of a single rigid attachment,
    # but do not claim to independently know that bone's semantic label.
    head_bone = a["bones"].index("head") if has_sources else c["headSkinIndices"][min(protected)][0]
    bad_skin = [i for i in sorted(protected)
                if c["headSkinIndices"][i] != [head_bone] or c["headSkinWeights"][i] != [1]]
    protection = {"protectedVertices": len(protected),
                  "protectedContourVertices": sorted(protected_global & contour_global),
                  "protectedFairingVertices": sorted(protected_global & fairing_global),
                  "protectedVerticesNotRigidHeadOnly": bad_skin,
                  "sourceMetadataAvailable": has_sources, "headBoneLabelVerified": has_sources,
                  "verification": "source-and-structural" if has_sources else "structural-only-source-provenance-skipped",
                  "declaredProtectionMatchesSourceMetadata": protected == declared_protected if has_sources else None}
    protection["passed"] = not (protection["protectedContourVertices"] or
                                protection["protectedFairingVertices"] or bad_skin) and \
        protection["declaredProtectionMatchesSourceMetadata"] is not False
    def interpolate(source, recipes):
        source = np.asarray(source).reshape(-1, 3)
        r = np.asarray(recipes)
        return source[r[:, 0].astype(int)] * (1 - r[:, 2, None]) + source[r[:, 1].astype(int)] * r[:, 2, None]
    source_angles, source_scan, source_hits = None, None, set()
    if has_sources:
        source_body = interpolate(a["vertices"], c["annyRecipes"])
        source_head = interpolate(g["vertices"], c["gnmRecipes"])
        source_head = source_head @ np.asarray(c["headTransform"]["matrix"]).T
        source_head = source_head * c["headTransform"].get("scale", 1) + c["headTransform"]["translation"]
        source_vertices = np.concatenate([source_body, source_head])
        source_normals, _ = normals_and_areas(source_vertices[faces])
        source_angles = np.degrees(np.arccos(np.clip(np.sum(source_normals[edge_faces[:, 0]] *
                                                          source_normals[edge_faces[:, 1]], axis=1), -1, 1)))
        source_scan = collision_scan(source_vertices, faces, ids)
        source_hits = {tuple(row["faces"]) for row in source_scan["intersections"]}
    semantic_mask = collections.defaultdict(lambda: {"vertices": 0, "maxContourWeight": 0.0})
    for hi, *_, weight in c["neckContour"]["headLinks"]:
        source = int(c["gnmRecipes"][int(hi)][0])
        comp = g["meta"]["componentNames"][g["componentId"][source]] if has_sources else "unverified-source"
        region_id = g["regionId"][source] if has_sources else 255
        region = g["meta"]["regionNames"][region_id] if has_sources and region_id < len(g["meta"]["regionNames"]) else "unlabelled"
        row = semantic_mask[comp + "/" + region]
        row["vertices"] += 1
        row["maxContourWeight"] = max(row["maxContourWeight"], weight)

    def label_face(fi):
        if fi < c["report"]["bodyFaces"]:
            return "Anny/body"
        if fi >= c["report"]["bodyFaces"] + c["report"]["headFaces"]:
            return "canonical/seam"
        if not has_sources:
            return "GNM/source-region-unverified"
        labels = set()
        for vi in faces[fi]:
            src = int(c["gnmRecipes"][int(vi) - body_count][0])
            comp = g["meta"]["componentNames"][g["componentId"][src]]
            ri = g["regionId"][src]
            region = g["meta"]["regionNames"][ri] if ri < len(g["meta"]["regionNames"]) else "unlabelled"
            labels.add(comp + "/" + region)
        return "+".join(sorted(labels))

    results = []
    for name in args.cases:
        path = ROOT / "research" / (name + "-vertices.bin")
        vertices = np.fromfile(path, dtype="<f4").astype(np.float64).reshape(-1, 3)
        assert vertices.shape == (vertex_count, 3) and np.isfinite(vertices).all(), name
        normals, areas = normals_and_areas(vertices[faces])
        angles = np.degrees(np.arccos(np.clip(np.sum(normals[edge_faces[:, 0]] *
                                                    normals[edge_faces[:, 1]], axis=1), -1, 1)))
        scan = collision_scan(vertices, faces, ids)
        for hit in scan["intersections"]:
            hit["regions"] = [label_face(fi) for fi in hit["faces"]]
            hit["alsoIntersectsInRawNeutralTeachers"] = tuple(hit["faces"]) in source_hits if has_sources else None
            hit["involvesSeamCollar"] = any(fi in collar_ids for fi in hit["faces"])
        fold_ids = np.flatnonzero(angles > FAIL_DEGREES)
        folds = []
        for ei in fold_ids[np.argsort(-angles[fold_ids])]:
            edge, fs = edge_rows[int(ei)]
            folds.append({"edge": list(edge), "faces": fs, "angleDegrees": float(angles[ei]),
                          "rawNeutralTeacherAngleDegrees": float(source_angles[ei]) if has_sources else None,
                          "regions": [label_face(fi) for fi in fs],
                          "involvesSeamCollar": any(fi in collar_ids for fi in fs)})
        degenerate = [int(fi) for fi in ids if areas[fi] <= AREA_EPS]
        collar_hits = [hit for hit in scan["intersections"] if hit["involvesSeamCollar"]]
        collar_folds = [fold for fold in folds if fold["involvesSeamCollar"]]
        full_pass = not scan["intersections"] and not folds and not degenerate
        collar_pass = not collar_hits and not collar_folds and not (set(degenerate) & collar_ids)
        result = {"case": name, "fixtureSHA256": sha256(path), "fullCorrectionMaskGatePassed": full_pass,
                  "seamCollarGatePassed": collar_pass,
                  "properCrossings": sum(h["kind"] == "proper_crossing" for h in scan["intersections"]),
                  "coplanarAreaOverlaps": sum(h["kind"] == "coplanar_overlap" for h in scan["intersections"]),
                  "touchingOnlyCounts": dict(collections.Counter(h["kind"] for h in scan["touchingOnly"])),
                  "intersectionsAlreadyPresentInRawNeutralTeachers": sum(h["alsoIntersectsInRawNeutralTeachers"] for h in scan["intersections"]) if has_sources else None,
                  "seamCollarIntersections": len(collar_hits), "seamCollarFolds": len(collar_folds),
                  "maximumDihedralDegrees": float(angles.max()),
                  "edgesOverWarningThreshold": int(sum(angles > WARN_DEGREES)),
                  "edgesOverFailureThreshold": len(folds),
                  "minimumTriangleAreaMM2": float(areas[ids].min() * 1e6),
                  "degenerateFaces": degenerate,
                  "sharedVertexOrEdgePairsExcluded": scan["sharedVertexOrEdgePairsExcluded"],
                  "pairsAfterAABBAndPlaneReject": scan["pairsAfterAABBAndPlaneReject"],
                  "intersections": scan["intersections"], "folds": folds,
                  "touchingOnlyExamples": scan["touchingOnly"][:20]}
        results.append(result)
        print(json.dumps({k: result[k] for k in ["case", "properCrossings", "coplanarAreaOverlaps",
              "seamCollarIntersections", "maximumDihedralDegrees", "edgesOverFailureThreshold",
              "seamCollarFolds", "fullCorrectionMaskGatePassed", "seamCollarGatePassed"]}), flush=True)

    complete = set(args.cases) == set(CASES)
    passed = complete and protection["passed"] and all(r["fullCorrectionMaskGatePassed"] for r in results)
    report = {"schema": "kaopu-neck-geometry-qa/1", "passed": passed, "all15FixturesChecked": complete,
              "gateMeaning": "Bounded neck geometry plus available protection checks; see sourceProvenanceStatus before claiming teacher-provenance verification.",
              "fullyVerifiedWithTeacherProvenance": passed and has_sources,
              "sourceProvenanceStatus": "verified-present-source-files" if has_sources else "skipped-optional-teacher-files-absent",
              "seamCollarGatePassed": complete and all(r["seamCollarGatePassed"] for r in results),
              "canonicalSHA256": sha256(cp), "topologySHA256": actual_topology_hash,
              "scriptSHA256": sha256(Path(__file__)), "predicateSelfTests": self_tests,
              "protectedFaceAndOralIntegrity": protection,
              "sourceReferenceSHA256": {path.name: sha256(path) for path in source_paths} if has_sources else None,
              "thresholds": {"distanceToleranceMetres": EPS, "degenerateAreaMM2": AREA_EPS * 1e6,
                             "coplanarOverlapAreaMM2": COPLANAR_AREA_EPS * 1e6,
                             "dihedralWarningDegrees": WARN_DEGREES, "dihedralFailureDegrees": FAIL_DEGREES},
              "scope": {"affectedVertices": len(affected), "testedTriangles": len(ids),
                        "seamCollarTriangles": len(collar_ids), "testedInternalEdges": len(edge_rows),
                        "definition": "Triangles incident to frozen fairing, contour-correction or seam-ring vertices. Collision pairs require both faces in this set. Seam collar means at least one hit/fold face touches an original seam ring.",
                        "sharedVertexOrEdgePairs": "Excluded from intersection checks; their shared-edge dihedrals are checked separately.",
                        "fullMaskIncludesSourceAnatomy": dict(semantic_mask)},
              "rawNeutralTeacherDiagnostic": {"properCrossings": sum(h["kind"] == "proper_crossing" for h in source_scan["intersections"]),
                                               "coplanarOverlaps": sum(h["kind"] == "coplanar_overlap" for h in source_scan["intersections"]),
                                               "edgesOverFailureThreshold": int(sum(source_angles > FAIL_DEGREES))} if has_sources else None,
              "limitations": [
                  "Bounded discrete-fixture check, not whole-body or continuous-animation collision certification.",
                  "A positive-area crossing/overlap fails the strict mask gate. Coplanar and noncoplanar touching are counted separately and do not fail it.",
                  "High dihedral is a review flag and can reflect legitimate inherited lips, teeth or tongue anatomy; it is not proof of an adapter-induced fold.",
                  "Raw neutral teacher provenance cannot distinguish native expression/identity deformation from adapter changes in nonneutral fixtures.",
                  "Without optional raw neutral teacher JSON files, source-region provenance and the semantic identity of the rigid head bone are unverified; structural protection and geometric tests still run.",
                  "Pairs sharing a vertex are deliberately excluded, so nonlocal overlap between such adjacent faces is not certified absent.",
                  "Float64 predicates operate on Float32 fixtures with an explicit 1-micrometre tolerance; exact-arithmetic robustness is not claimed.",
                  "A failed strict correction-mask gate must not be relabelled a whole-model pass because the smaller seam collar passes.",
              ], "cases": results, "elapsedSeconds": time.time() - started}
    target = ROOT / "research/neck-geometry-report.json"
    target.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": passed, "seamCollarGatePassed": report["seamCollarGatePassed"],
                      "report": str(target.relative_to(ROOT)), "seconds": report["elapsedSeconds"]}), flush=True)
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
