"""Read original R07 evidence and print bounded section measurements as JSON.

No mesh, image, repository or output file is changed. This is a geometric
analysis of recorded cuts, not a renderer, anatomical model or aesthetic test.
The ellipse bound assumes BOTH local shoulder endpoints AND its arc are fixed;
those are stronger conditions than the product's body/contact/cap constraints.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
POSES = ("jaw", "speak")
VERSIONS = ("r06", "r07")


def file_record(path, root):
    raw = path.read_bytes()
    return {"path": path.relative_to(root).as_posix(), "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest()}


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def angle(a, b):
    return math.degrees(math.acos(max(-1, min(1, dot(a, b)))))


def project_y(position, camera, height):
    # All analyzed macro cameras are unrotated perspective cameras. Fail on
    # another camera rather than silently applying this formula to that case.
    assert camera["quaternion"] == [0, 0, 0, 1]
    cp = camera["position"]
    assert cp[2] > position[2]
    return height / 2 * (1 - camera["projection"][5] *
                         (position[1] - cp[1]) / (cp[2] - position[2]))


def ordered_path(q, domain, section, measured, analyzer):
    segments = q[domain]["sections"][section]["segments"]
    indexed = {s["triangle"]: s for s in segments}
    assert len(indexed) == len(segments)
    key = analyzer.normkey(measured["start"])
    points, selected = [measured["start"]], []
    for triangle in measured["triangles"]:
        segment = indexed[triangle]
        a, b = segment["endpoints"]
        assert key in (analyzer.normkey(a), analyzer.normkey(b))
        following = b if analyzer.normkey(a) == key else a
        points.append(following)
        selected.append(segment)
        key = analyzer.normkey(following)
    assert key == analyzer.normkey(measured["end"])
    return points, selected


def facing_summary(segments, camera):
    pure = [s for s in segments if all(
        e["attributes"]["l19Oral"][0] > .999 for e in s["endpoints"])]
    cosines = []
    for segment in pure:
        midpoint = [sum(e["position"][k] for e in segment["endpoints"]) / 2
                    for k in range(3)]
        vector = [camera["position"][k] - midpoint[k] for k in range(3)]
        cosines.append(dot(vector, segment["triangleNormal"]) /
                       math.sqrt(dot(vector, vector)))
    assert cosines
    return {"pureOralSegments": len(pure),
            "frontFacingPureOralSegments": sum(c > 0 for c in cosines),
            "facingCosineRange": [min(cosines), max(cosines)]}


def ellipse_bound(start, end, length, frame, camera, height, original_points):
    p, z = start["mouthMM"], end["mouthMM"]
    assert abs(p[0] - z[0]) < 1e-8
    chord = math.dist(p, z)
    assert length >= chord - 1e-9
    a, b = length / 2, math.sqrt(max(0, length * length - chord * chord)) / 2
    tangent = [(z[k] - p[k]) / chord for k in (1, 2)]
    normal = [-tangent[1], tangent[0]]
    midpoint = [(p[k] + z[k]) / 2 for k in range(3)]
    center = [frame["center"][i] + sum(midpoint[k] * frame[axis][i] / 1000
              for k, axis in enumerate(("x", "up", "front"))) for i in range(3)]
    cosine = [a * (tangent[0] * frame["up"][i] + tangent[1] * frame["front"][i]) / 1000
              for i in range(3)]
    sine = [b * (normal[0] * frame["up"][i] + normal[1] * frame["front"][i]) / 1000
            for i in range(3)]
    cp = camera["position"]
    n0, nc, ns = center[1] - cp[1], cosine[1], sine[1]
    d0, dc, ds = cp[2] - center[2], -cosine[2], -sine[2]
    assert d0 > math.hypot(dc, ds) and camera["quaternion"] == [0, 0, 0, 1]
    # Exact extrema of (n0+nc*cos(t)+ns*sin(t))/(d0+dc*cos(t)+ds*sin(t)).
    aa = d0 * d0 - dc * dc - ds * ds
    bb = -2 * n0 * d0 + 2 * nc * dc + 2 * ns * ds
    cc = n0 * n0 - nc * nc - ns * ns
    discriminant = bb * bb - 4 * aa * cc
    assert discriminant >= 0
    ratios = [(-bb - math.sqrt(discriminant)) / (2 * aa),
              (-bb + math.sqrt(discriminant)) / (2 * aa)]
    y_range = sorted(height / 2 * (1 - camera["projection"][5] * x) for x in ratios)
    original_y = [project_y(p["position"], camera, height) for p in original_points]
    span = max(original_y) - min(original_y)
    return {"assumptions": "Both local shoulder endpoints and local arc length fixed; same cut, camera and projection; no occlusion deducted.",
            "strongerThanProductConstraints": True, "halfMinorAxisMM": b,
            "originalShoulderYSpanPixels": span,
            "ellipseYSpanUpperBoundPixels": y_range[1] - y_range[0],
            "additionalSpanUpperBoundPixels": y_range[1] - y_range[0] - span,
            "maximumAboveOriginalPixels": min(original_y) - y_range[0],
            "maximumBelowOriginalPixels": y_range[1] - max(original_y)}


def shoulder_metrics(points, segments, frame, camera, height):
    lo = next(i for i, p in enumerate(points)
              if p["attributes"]["l19Oral"][0] > 1e-7) - 1
    hi = next(i for i, p in enumerate(points)
              if p["attributes"]["l19Oral"][0] >= 1 - 1e-7)
    assert 0 <= lo < hi < len(points) - 1
    start, crest = points[lo], points[hi]
    length = sum(s["lengthMM"] for s in segments[lo:hi])
    chord = math.dist(start["mouthMM"], crest["mouthMM"])
    def tilt(a, b):
        return math.degrees(math.atan2(b["mouthMM"][1] - a["mouthMM"][1],
                                      a["mouthMM"][2] - b["mouthMM"][2]))
    incoming, outgoing = tilt(points[hi - 1], crest), tilt(crest, points[hi + 1])
    internal_turns = [angle(segments[i - 1]["triangleNormal"], segments[i]["triangleNormal"])
                      for i in range(lo + 1, hi)]
    # An equal-arc circular shoulder is a 2-D geometric reference, not an
    # implemented surface, a universal bound on curvature, or a new mesh.
    left, right = 1e-8, math.pi
    assert length / chord < math.pi / 2
    for _ in range(60):
        theta = (left + right) / 2
        if theta / (2 * math.sin(theta / 2)) < length / chord:
            left = theta
        else:
            right = theta
    circular_turn = math.degrees((left + right) / 2)
    circular_end = tilt(start, crest) - circular_turn / 2
    return {"definition": "Last oral=0 point before the first positive oral point, through first oral=1 point; not the narrower .01<oral<.99 node span.",
            "startUpFrontMM": start["mouthMM"][1:], "crestUpFrontMM": crest["mouthMM"][1:],
            "arcLengthMM": length, "chordLengthMM": chord,
            "arcExcessMM": length - chord, "arcExcessPercent": 100 * (length / chord - 1),
            "deltaUpMM": crest["mouthMM"][1] - start["mouthMM"][1],
            "backwardFrontTravelMM": start["mouthMM"][2] - crest["mouthMM"][2],
            "maximumInternalAdjacentFaceTurnDegrees": max(internal_turns),
            "lastIncomingTiltDegrees": incoming, "firstInnerTiltDegrees": outgoing,
            "crestSectionTangentTurnDegrees": incoming - outgoing,
            "equalArcCircularReference": {"totalTurnDegrees": circular_turn,
                "lastTiltDegrees": circular_end, "remainingKinkIfInnerUnchangedDegrees": circular_end - outgoing,
                "notImplementedAndNotAnImpossibilityProof": True},
            "fixedEndpointsAndArcProjectionBound": ellipse_bound(start, crest, length, frame, camera, height, points[lo:hi + 1])}, crest


def analyze_all(root):
    module_path = root / "research/analyze-return-sections.py"
    spec = importlib.util.spec_from_file_location("indexed_return_sections", module_path)
    analyzer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(analyzer)
    result = {"schema": "kaopu/lip-return-visibility-analysis@1",
              "readOnly": True, "analyzer": file_record(Path(__file__).resolve(), root),
              "pathAnalyzer": file_record(module_path, root), "candidates": {}}
    qas = {}
    for candidate in ("candidate-02", "candidate-03"):
        evidence = root / "evidence" / candidate
        qa = json.loads((evidence / "qa.json").read_bytes())
        qas[candidate] = qa
        height = qa["framebuffer"]["height"]
        entry = {"sourceSHA": qa["sourceSHA"], "buildSHA": qa["buildSHA"],
                 "qa": file_record(evidence / "qa.json", root),
                 "completed": qa["completed"], "testsPassed": sum(t["passed"] for t in qa["tests"]),
                 "testsRecorded": len(qa["tests"]), "savedFrames": sum(f["saved"] for f in qa["frames"]),
                 "readbacks": len(qa["frames"]), "visualAcceptance": qa["visualAcceptance"],
                 "geometryFiles": [], "sections": [], "pinCrestUpCounterfactual": []}
        for pose in POSES:
            comp = next(c for c in qa["comparisons"] if c["pose"] == pose and c["view"] == "macro")
            paired = {}
            for version in VERSIONS:
                tag = f"{pose}-macro-{version}"
                path = evidence / (tag + "-geometry.json")
                record = file_record(path, root)
                registered = next(g for g in qa["geometryProbes"] if g["tag"] == tag)
                assert record["sha256"] == registered["sha256"] and record["bytes"] == registered["bytes"]
                entry["geometryFiles"].append(record)
                q = json.loads(path.read_bytes())
                assert q["drawObject"]["matrixWorld"] == IDENTITY
                state = comp["offState" if version == "r06" else "onState"]
                camera, frame = state["camera"], q["coordinateFrame"]
                cp_delta = [camera["position"][i] - frame["center"][i] for i in range(3)]
                eye = [dot(cp_delta, frame[axis]) * 1000 for axis in ("x", "up", "front")]
                paired[version] = []
                for si in range(3):
                    for domain in ("native", "draw"):
                        assert not q[domain]["sections"][si]["truncated"]
                    native, anchors = analyzer.analyze(q, "native", si)
                    draw, _ = analyzer.analyze(q, "draw", si, anchors)
                    assert native["connected"] and draw["connected"]
                    assert native["nonmanifoldSectionNodes"] == draw["nonmanifoldSectionNodes"] == 0
                    points, segments = ordered_path(q, "native", si, native, analyzer)
                    _, draw_segments = ordered_path(q, "draw", si, draw, analyzer)
                    shoulder, crest = shoulder_metrics(points, segments, frame, camera, height)
                    towards_eye = [eye[i] - crest["mouthMM"][i] for i in range(3)]
                    row = {"tag": tag, "u": native["u"], "camera": camera,
                           "eyeInMouthMM": eye, "materialSides": [m["values"]["side"] for m in state["materials"]],
                           "eyeElevationAtSemanticCrestDegrees": math.degrees(math.atan2(towards_eye[1], math.hypot(towards_eye[0], towards_eye[2]))),
                           "nativePathArcMM": native["arcLengthMM"], "drawPathArcMM": draw["arcLengthMM"],
                           "nativeMaximumAdjacentFaceTurnDegrees": native["maximumAdjacentNormalTurnDegrees"],
                           "drawMaximumAdjacentFaceTurnDegrees": draw["maximumAdjacentNormalTurnDegrees"],
                           "actualHighestMouthMM": native["peakMouthMM"],
                           "semanticCrestEdgeKey": list(analyzer.normkey(crest)),
                           "nativePureOralFacing": facing_summary(segments, camera),
                           "drawPureOralFacing": facing_summary(draw_segments, camera), "shoulder": shoulder}
                    entry["sections"].append(row)
                    paired[version].append((crest, frame, camera))
            for si, ((old, _, _), (now, frame, camera)) in enumerate(zip(paired["r06"], paired["r07"])):
                assert analyzer.normkey(old) == analyzer.normkey(now)
                delta = (old["mouthMM"][1] - now["mouthMM"][1]) / 1000
                restored = [now["position"][k] + frame["up"][k] * delta for k in range(3)]
                entry["pinCrestUpCounterfactual"].append({"pose": pose, "u": (-.45, 0, .45)[si],
                    "sameOriginalEdgeKey": list(analyzer.normkey(old)), "restoreUpMM": delta * 1000,
                    "singlePointProjectedRisePixels": project_y(now["position"], camera, height) - project_y(restored, camera, height),
                    "meaning": "Move this same crest point only along mouth-up to its R06 height, retaining R07 front. Not a constrained solve, post-microgeometry prediction, or visible-width guarantee."})
        result["candidates"][candidate] = entry
    old, new = result["candidates"].values()
    result["candidate02And03SectionMeasurementsExact"] = old["sections"] == new["sections"]
    result["candidate02And03PinCounterfactualExact"] = old["pinCrestUpCounterfactual"] == new["pinCrestUpCounterfactual"]
    frames03 = {f["name"]: f for f in qas["candidate-03"]["frames"]}
    shared = []
    for old_frame in qas["candidate-02"]["frames"]:
        assert old_frame["saved"]
        name = old_frame["name"]
        new_frame = frames03[name]
        records = [file_record(root / "evidence" / c / (name + ".png"), root)
                   for c in ("candidate-02", "candidate-03")]
        assert records[0]["sha256"] == old_frame["pngSHA256"]
        assert records[1]["sha256"] == new_frame["pngSHA256"]
        shared.append({"name": name, "pngFiles": records,
                       "pngBytesExact": records[0]["sha256"] == records[1]["sha256"],
                       "registeredReadbackSHA256Exact": old_frame["sha256"] == new_frame["sha256"]})
    result["sharedBeautyFrames"] = shared
    result["limitations"] = ["Three cuts per pose only; no whole-surface or physiological claim.",
        "Geometric facing is based on actual recorded draw attributes and face normals; no GPU displacement or occlusion reconstruction.",
        "Arc and projection are not anatomical thickness or actual visible pixel coverage.",
        "Fixed local endpoints plus local arc are additional assumptions, not consequences of the 0.6mm/body/contact constraints.",
        "This script verifies PNG bytes and compares registered GPU readback hashes; it does not independently decode PNG pixels.",
        "No lower angle, nonzero pixel difference, solver convergence or derived bound is an aesthetic pass."]
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help="R07 directory containing research/ and evidence/; stdout is the only output.")
    args = parser.parse_args()
    print(json.dumps(analyze_all(args.root.resolve()), indent=2, ensure_ascii=False, allow_nan=False))
