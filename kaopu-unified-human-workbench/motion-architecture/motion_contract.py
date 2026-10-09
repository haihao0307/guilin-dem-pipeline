"""Original, offline motion interchange/QA. No neural model is imported or run.

NumPy is only needed by the optional NPZ command. The contract/QA use stdlib.
No source skeleton is silently retargeted to Anny's 104-bone hierarchy.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

SCHEMA = "kaopu-motion-clip/1"
CONTACT_ORDER = ["left_heel", "left_toe", "right_heel", "right_toe"]
# Right-handed change of basis: Y-up/+Z-forward -> Z-up/-Y-forward.
C = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def vector(v, n, label):
    require(isinstance(v, (list, tuple)) and len(v) == n and all(number(x) for x in v), label)


def transpose(a):
    return [list(x) for x in zip(*a)]


def matmul(a, b):
    return [[sum(x * y for x, y in zip(row, col)) for col in zip(*b)] for row in a]


def mv(a, v):
    return [sum(x * y for x, y in zip(row, v)) for row in a]


def rotation(r):
    require(isinstance(r, list) and len(r) == 3, "rotation must be 3x3")
    for row in r:
        vector(row, 3, "rotation must be finite")
    rt = matmul(r, transpose(r))
    require(max(abs(rt[i][j] - (i == j)) for i in range(3) for j in range(3)) < 1e-4,
            "rotation must be orthonormal")
    det = sum(r[0][i] * (r[1][(i+1)%3]*r[2][(i+2)%3] - r[1][(i+2)%3]*r[2][(i+1)%3]) for i in range(3))
    require(abs(det - 1) < 1e-4, "reflection is not a rotation")


def canonical_bytes(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def validate_skeleton(s):
    names, parents = s.get("names"), s.get("parents")
    require(isinstance(s.get("id"), str) and bool(s["id"]), "skeleton id is required")
    require(isinstance(names, list) and len(names) > 0 and all(isinstance(n, str) and n for n in names), "named skeleton is required")
    require(len(set(names)) == len(names), "duplicate bone names")
    require(isinstance(parents, list) and len(parents) == len(names), "parent count mismatch")
    require(parents[0] == -1, "joint 0 must be the declared root")
    for j, p in enumerate(parents[1:], 1):
        require(type(p) is int and 0 <= p < j, "parents must be a single topologically ordered tree")
    require(s.get("fingerprint") == digest({"id": s["id"], "names": names, "parents": parents}), "skeleton fingerprint mismatch")


def make_skeleton(identifier, names, parents):
    s = {"id": identifier, "names": list(names), "parents": list(parents)}
    s["fingerprint"] = digest(s)
    validate_skeleton(s)
    return s


def validate_clip(clip):
    require(clip.get("schema") == SCHEMA, "unsupported motion schema")
    require(clip.get("coordinates") == {"units": "metres", "up": "+Z", "forward": "-Y", "handedness": "right"}, "explicit canonical coordinates required")
    require(clip.get("rotationConvention") == "absolute-parent-local-matrix", "local rotation convention required")
    require(number(clip.get("fps")) and clip["fps"] > 0, "positive finite fps required")
    validate_skeleton(clip["skeleton"])
    n = len(clip["skeleton"]["names"])
    frames = clip.get("frames")
    require(isinstance(frames, list) and len(frames) > 0, "nonempty frames required")
    require(clip.get("contactOrder") == CONTACT_ORDER, "contact ordering must be explicit")
    src = clip.get("source", {})
    require(isinstance(src.get("kind"), str) and bool(src["kind"]), "source kind required")
    require(type(src.get("neuralInferenceExecuted")) is bool, "inference status must be explicit")
    if src["neuralInferenceExecuted"]:
        require(all(isinstance(src.get(k), str) and src[k] for k in ("modelId", "checkpointSha256", "runEvidence")), "inference requires model, checkpoint and run evidence")
        require(len(src["checkpointSha256"]) == 64 and all(c in "0123456789abcdef" for c in src["checkpointSha256"]), "invalid checkpoint hash")
    for i, f in enumerate(frames):
        vector(f["rootPosition"], 3, "root position must be finite")
        require(len(f["localRotations"]) == n, "joint count mismatch")
        for r in f["localRotations"]:
            rotation(r)
        require(isinstance(f["contacts"], list) and len(f["contacts"]) == 4 and all(number(c) or type(c) is bool for c in f["contacts"]), "four finite contact values required")
        require(all(0 <= c <= 1 for c in f["contacts"]), "contact probability outside [0,1]")
        require(len(f["jointPositions"]) == n, "joint position count mismatch")
        for v in f["jointPositions"]:
            vector(v, 3, "world joint positions must be finite")
        require(math.dist(f["rootPosition"], f["jointPositions"][0]) < 1e-4, "actual root and joint 0 disagree")
        if "smoothRootPosition" in f:
            vector(f["smoothRootPosition"], 3, "smooth root must be finite")
    require(abs(clip.get("durationSeconds", -1) - (len(frames)-1)/clip["fps"]) < 1e-9, "duration must span sampled endpoints")
    return clip


def import_kimodo(data, metadata):
    """Convert documented Kimodo arrays without inferring FPS, joints or units.

    metadata must be recorded from the actual model/skeleton used for the run.
    The seven-array NPZ alone does not guarantee a model ID, joint list or FPS.
    This function transforms basis, not rig correspondence or human identity.
    """
    require(metadata.get("coordinateSystem") == "right-handed-Y-up-+Z-forward", "Kimodo coordinate system must be explicit")
    require(metadata.get("units") == "metres", "Kimodo input units must be metres")
    require(metadata.get("rotationConvention") == "absolute-parent-local-matrix", "Kimodo rotation convention must be explicit")
    s = copy.deepcopy(metadata["skeleton"])
    validate_skeleton(s)
    required = ("root_positions", "local_rot_mats", "posed_joints", "foot_contacts")
    require(all(k in data for k in required), "missing required Kimodo array")
    count = len(data["root_positions"])
    require(all(len(data[k]) == count for k in required), "Kimodo time axis mismatch")
    if "smooth_root_pos" in data:
        require(len(data["smooth_root_pos"]) == count, "smoothed root time axis mismatch")
    frames = []
    for t in range(count):
        root, positions, rotations = data["root_positions"][t], data["posed_joints"][t], data["local_rot_mats"][t]
        vector(root, 3, "root must be finite")
        for r in rotations:
            rotation(r)
        for v in positions:
            vector(v, 3, "position must be finite")
        f = {"rootPosition": mv(C, root), "jointPositions": [mv(C, v) for v in positions],
             "localRotations": [matmul(matmul(C, r), transpose(C)) for r in rotations],
             "contacts": list(data["foot_contacts"][t])}
        if "smooth_root_pos" in data:
            vector(data["smooth_root_pos"][t], 3, "smooth root must be finite")
            f["smoothRootPosition"] = mv(C, data["smooth_root_pos"][t])
        frames.append(f)
    fps = metadata.get("fps")
    require(number(fps) and fps > 0, "positive finite fps required; never guessed from NPZ")
    clip = {"schema": SCHEMA, "coordinates": {"units": "metres", "up": "+Z", "forward": "-Y", "handedness": "right"},
            "rotationConvention": "absolute-parent-local-matrix", "fps": fps,
            "durationSeconds": (count-1)/fps, "skeleton": s, "contactOrder": CONTACT_ORDER[:],
            "source": copy.deepcopy(metadata["source"]), "frames": frames,
            "adaptation": {"kind": "basis-conversion-only", "basis": copy.deepcopy(C), "retargetedToAnny": False,
                           "rootMotionRecentered": False, "perFrameGrounding": False}}
    return validate_clip(clip)


def audit_motion(clip, *, foot_joint_ids=None, floor_z=None, max_contact_speed=.10,
                 max_joint_acceleration=100., max_bone_drift=.002, max_penetration=.002,
                 expected_motion_mask=None):
    """Deterministic diagnostics, NOT StableMotion predictions or physics proof.

    Thresholds are editable policies. A static pose is not automatically faulty.
    Contact velocity is measured only when a contact is active at both endpoints.
    """
    validate_clip(clip)
    for x in (max_contact_speed, max_joint_acceleration, max_bone_drift, max_penetration):
        require(number(x) and x >= 0, "nonnegative finite QA thresholds required")
    frames, fps = clip["frames"], clip["fps"]
    parents = clip["skeleton"]["parents"]
    if foot_joint_ids is not None:
        require(len(foot_joint_ids) == 4 and all(type(j) is int and 0 <= j < len(parents) for j in foot_joint_ids), "four valid contact joint indices required")
    require(floor_z is None or number(floor_z), "finite floor required")
    if expected_motion_mask is not None:
        require(len(expected_motion_mask) == len(frames) and all(type(v) is bool for v in expected_motion_mask), "expected-motion mask must match frames")
    rest_lengths = [0 if p < 0 else math.dist(frames[0]["jointPositions"][j], frames[0]["jointPositions"][p]) for j, p in enumerate(parents)]
    issues, rows, last_velocity = [], [], None
    for t, f in enumerate(frames):
        row = {"frame": t, "timeSeconds": t/fps, "maxContactSpeed": 0., "maxJointAcceleration": 0., "maxBoneLengthDrift": 0., "maxContactPenetration": 0., "unexpectedFrozen": False}
        points = f["jointPositions"]
        row["maxBoneLengthDrift"] = max(abs(math.dist(points[j], points[p])-rest_lengths[j]) for j,p in enumerate(parents) if p >= 0) if len(parents)>1 else 0.
        if t:
            prev = frames[t-1]["jointPositions"]
            velocity = [[(a-b)*fps for a,b in zip(v,w)] for v,w in zip(points,prev)]
            if last_velocity is not None:
                row["maxJointAcceleration"] = max(math.dist(a,b)*fps for a,b in zip(velocity,last_velocity))
            last_velocity = velocity
            angular_change = max(abs(f["localRotations"][j][a][b]-frames[t-1]["localRotations"][j][a][b]) for j in range(len(parents)) for a in range(3) for b in range(3))
            row["unexpectedFrozen"] = bool(expected_motion_mask is not None and expected_motion_mask[t] and max(math.dist(a,b) for a,b in zip(points,prev)) < 1e-8 and angular_change < 1e-8)
            if foot_joint_ids is not None:
                for c,j in enumerate(foot_joint_ids):
                    if f["contacts"][c] >= .5 and frames[t-1]["contacts"][c] >= .5:
                        row["maxContactSpeed"] = max(row["maxContactSpeed"], math.hypot(*velocity[j][:2]))
        if foot_joint_ids is not None and floor_z is not None:
            row["maxContactPenetration"] = max([0.] + [floor_z - points[j][2] for c,j in enumerate(foot_joint_ids) if f["contacts"][c] >= .5])
        for key, limit in [("maxContactSpeed",max_contact_speed),("maxJointAcceleration",max_joint_acceleration),("maxBoneLengthDrift",max_bone_drift),("maxContactPenetration",max_penetration)]:
            if row[key] > limit:
                issues.append({"frame":t,"metric":key,"value":row[key],"threshold":limit})
        if row["unexpectedFrozen"]:
            issues.append({"frame":t,"metric":"unexpectedFrozen"})
        rows.append(row)
    return {"schema":"kaopu-motion-audit/1", "method":"deterministic-kinematic-diagnostics", "neuralQualityModelExecuted":False,
            "clipSha256":digest(clip), "status":"flagged" if issues else "no-configured-flags",
            "unchecked":["mesh self-collision", "dynamic stability", "intent realism", "neural bad-frame classification"] + ([] if foot_joint_ids is not None else ["contact drift"]) + ([] if foot_joint_ids is not None and floor_z is not None else ["contact penetration"]) + ([] if expected_motion_mask is not None else ["task-conditioned freeze detection"]),
            "measurementConfig":{"footJointIds":copy.deepcopy(foot_joint_ids),"floorZMetres":floor_z,"expectedMotionMask":copy.deepcopy(expected_motion_mask),"contactActiveThreshold":.5,"contactVelocity":"world-ground-plane velocity at consecutive active contacts","penetrationGeometry":"declared contact joint locations, not skinned foot surface"},
            "thresholds":{"contactSpeedMetresPerSecond":max_contact_speed,"jointAccelerationMetresPerSecondSquared":max_joint_acceleration,"boneDriftMetres":max_bone_drift,"penetrationMetres":max_penetration},
            "issues":issues,"rows":rows}


def archive_record(clip, audit, *, source_asset_sha256, rights):
    validate_clip(clip)
    require(audit.get("clipSha256") == digest(clip), "audit is for a different clip")
    require(len(source_asset_sha256) == 64 and all(c in "0123456789abcdef" for c in source_asset_sha256), "source asset sha256 required")
    require(isinstance(rights, dict) and all(k in rights for k in ("codeLicense","modelLicense","inputRights","redistributionApproved")), "separate rights fields required")
    require(type(rights["redistributionApproved"]) is bool, "redistribution approval must be boolean")
    return {"schema":"kaopu-motion-record/1", "clipSha256":digest(clip),"sourceAssetSha256":source_asset_sha256,
            "skeletonFingerprint":clip["skeleton"]["fingerprint"],"auditSha256":digest(audit),"rights":copy.deepcopy(rights),
            "publicationState":"eligible-for-review" if rights["redistributionApproved"] else "local-only",
            "run":copy.deepcopy(clip["source"])}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", type=Path, help="Kimodo .npz (numeric arrays only) or JSON array dictionary")
    p.add_argument("metadata", type=Path, help="explicit skeleton/FPS/source metadata JSON")
    p.add_argument("output", type=Path)
    args = p.parse_args()
    if args.input.suffix == ".npz":
        import numpy as np
        with np.load(args.input, allow_pickle=False) as arrays:
            keys = ("root_positions","local_rot_mats","posed_joints","foot_contacts","smooth_root_pos")
            data = {k: arrays[k].tolist() for k in keys if k in arrays}
    else:
        data = json.loads(args.input.read_text())
    metadata = json.loads(args.metadata.read_text())
    clip = import_kimodo(data, metadata)
    args.output.write_bytes(canonical_bytes(clip)+b"\n")
    print(json.dumps({"output":str(args.output),"sha256":digest(clip),"frames":len(clip["frames"]),"retargetedToAnny":False}))


if __name__ == "__main__":
    main()
