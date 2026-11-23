#!/usr/bin/env python3
"""N341 candidate gate for process-bound weathering-mask identity.

The verifier receives its trusted anchor digest and verifier policy digest as
out-of-band runtime inputs. They are not accepted from the Producer receipt.
"""

from __future__ import annotations

import copy
import hashlib
import json
from itertools import combinations


def digest(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def canonical_pair(a: str, b: str) -> tuple[str, str]:
    return tuple(sorted((a, b)))


def verify(anchor: dict, receipt: dict, observation: dict, trust: dict) -> list[str]:
    holds: list[str] = []

    if digest(anchor) != trust["trustedAnchorDigest"]:
        holds.append("HOLD_AUTHORITY_ANCHOR_NOT_TRUSTED")
    if observation.get("verifierPolicyDigest") != trust["trustedVerifierPolicyDigest"]:
        holds.append("HOLD_VERIFIER_POLICY_MISMATCH")
    if observation.get("observerIdentity") == receipt.get("producerIdentity"):
        holds.append("HOLD_PRODUCER_SELF_VERIFICATION")

    subject_keys = ("sourceHead", "artifactDigest")
    if any(observation.get(k) != receipt.get(k) for k in subject_keys):
        holds.append("HOLD_MASK_OBSERVATION_SUBJECT_MISMATCH")
    if receipt.get("sourceHead") != anchor.get("sourceHead"):
        holds.append("HOLD_MASK_RECEIPT_SOURCE_HEAD_MISMATCH")

    expected = set(anchor["expectedProcessIds"])
    observed_items = observation.get("processMasks", [])
    observed_ids = [item.get("processId") for item in observed_items]
    observed = set(observed_ids)
    if len(observed_ids) != len(observed):
        holds.append("HOLD_DUPLICATE_PROCESS_MASK_OBSERVATION")
    if expected - observed:
        holds.append("HOLD_PROCESS_MASK_COVERAGE_INCOMPLETE")
    if observed - expected:
        holds.append("HOLD_UNANCHORED_PROCESS_MASK")

    allowed = {
        canonical_pair(*pair) for pair in anchor.get("allowedProcessMaskAliases", [])
    }

    construction_groups: dict[str, list[str]] = {}
    mask_groups: dict[str, list[str]] = {}
    for item in observed_items:
        process_id = item.get("processId")
        construction = item.get("maskConstruction")
        observed_mask_digest = item.get("observedMaskDigest")
        if not isinstance(construction, dict) or not observed_mask_digest:
            holds.append("HOLD_PROCESS_MASK_OBSERVATION_INCOMPLETE")
            continue
        construction_groups.setdefault(digest(construction), []).append(process_id)
        mask_groups.setdefault(observed_mask_digest, []).append(process_id)

    for group in construction_groups.values():
        for a, b in combinations(sorted(group), 2):
            if canonical_pair(a, b) not in allowed:
                holds.append("HOLD_CROSS_PROCESS_MASK_CONSTRUCTION_ALIASING")

    for group in mask_groups.values():
        for a, b in combinations(sorted(group), 2):
            if canonical_pair(a, b) not in allowed:
                holds.append("HOLD_CROSS_PROCESS_OBSERVED_MASK_ALIASING")

    return sorted(set(holds))


PROCESS_IDS = ["edge_wear", "corrosion", "crevice_dirt", "runoff"]


def construction(seed_domain: str, generator: str, geometry_inputs: list[str]) -> dict:
    return {
        "generator": generator,
        "seedDerivation": {"base": "materialSeed", "domain": seed_domain},
        "parameters": {"scale": 4.0, "octaves": 2},
        "geometryInputs": geometry_inputs,
        "postTransform": "normalize01",
    }


anchor = {
    "taskId": "N341-PROCESS-BOUND-MASK-IDENTITY",
    "sourceHead": "SOURCE_HEAD_A",
    "expectedProcessIds": PROCESS_IDS,
    "allowedProcessMaskAliases": [],
    "verifierPolicyDigest": "POLICY_A",
}
trust = {
    "trustedAnchorDigest": digest(anchor),
    "trustedVerifierPolicyDigest": "POLICY_A",
}
receipt = {
    "sourceHead": "SOURCE_HEAD_A",
    "artifactDigest": "ARTIFACT_A",
    "producerIdentity": "producer-A",
}
valid_observation = {
    "sourceHead": "SOURCE_HEAD_A",
    "artifactDigest": "ARTIFACT_A",
    "observerIdentity": "verifier-B",
    "verifierPolicyDigest": "POLICY_A",
    "processMasks": [
        {
            "processId": "edge_wear",
            "maskConstruction": construction("WEAR", "edgeExposureBreakup", ["convexity"]),
            "observedMaskDigest": "MASK_WEAR",
        },
        {
            "processId": "corrosion",
            "maskConstruction": construction("CORROSION", "corrosionGrowth", ["cavity"]),
            "observedMaskDigest": "MASK_CORROSION",
        },
        {
            "processId": "crevice_dirt",
            "maskConstruction": construction("DIRT", "creviceCapture", ["cavity", "upFacing"]),
            "observedMaskDigest": "MASK_DIRT",
        },
        {
            "processId": "runoff",
            "maskConstruction": construction("RUNOFF", "gravityStreak", ["convexity", "upFacing"]),
            "observedMaskDigest": "MASK_RUNOFF",
        },
    ],
}


fixtures: list[tuple[str, dict, dict, dict, dict, list[str]]] = []
fixtures.append(("valid distinct process bindings", anchor, receipt, valid_observation, trust, []))

n340 = copy.deepcopy(valid_observation)
shared = construction("GENERIC", "genericNoise", [])
for item in n340["processMasks"]:
    item["maskConstruction"] = shared
    item["observedMaskDigest"] = "MASK_GENERIC"
fixtures.append((
    "N340 decoy seed diversity with one actual generic mask",
    anchor, receipt, n340, trust,
    ["HOLD_CROSS_PROCESS_MASK_CONSTRUCTION_ALIASING", "HOLD_CROSS_PROCESS_OBSERVED_MASK_ALIASING"],
))

same_output = copy.deepcopy(valid_observation)
for item in same_output["processMasks"]:
    item["observedMaskDigest"] = "MASK_COLLISION"
fixtures.append((
    "different constructors collapse to the same observed mask",
    anchor, receipt, same_output, trust,
    ["HOLD_CROSS_PROCESS_OBSERVED_MASK_ALIASING"],
))

missing = copy.deepcopy(valid_observation)
missing["processMasks"].pop()
fixtures.append(("missing expected process", anchor, receipt, missing, trust, ["HOLD_PROCESS_MASK_COVERAGE_INCOMPLETE"]))

extra = copy.deepcopy(valid_observation)
extra["processMasks"].append({
    "processId": "invented_patina",
    "maskConstruction": construction("EXTRA", "genericNoise", []),
    "observedMaskDigest": "MASK_EXTRA",
})
fixtures.append(("unanchored process", anchor, receipt, extra, trust, ["HOLD_UNANCHORED_PROCESS_MASK"]))

wrong_subject = copy.deepcopy(valid_observation)
wrong_subject["artifactDigest"] = "ARTIFACT_B"
fixtures.append(("observation from another artifact", anchor, receipt, wrong_subject, trust, ["HOLD_MASK_OBSERVATION_SUBJECT_MISMATCH"]))

self_verified = copy.deepcopy(valid_observation)
self_verified["observerIdentity"] = receipt["producerIdentity"]
fixtures.append(("Producer self-verifies", anchor, receipt, self_verified, trust, ["HOLD_PRODUCER_SELF_VERIFICATION"]))

bad_policy = copy.deepcopy(valid_observation)
bad_policy["verifierPolicyDigest"] = "POLICY_B"
fixtures.append(("untrusted verifier policy", anchor, receipt, bad_policy, trust, ["HOLD_VERIFIER_POLICY_MISMATCH"]))

forged_anchor = copy.deepcopy(anchor)
forged_anchor["expectedProcessIds"] = ["edge_wear", "corrosion", "crevice_dirt"]
fixtures.append(("Producer-shrunk anchor without trusted digest", forged_anchor, receipt, missing, trust, ["HOLD_AUTHORITY_ANCHOR_NOT_TRUSTED"]))

allowed_anchor = copy.deepcopy(anchor)
allowed_anchor["allowedProcessMaskAliases"] = [["edge_wear", "runoff"]]
allowed_trust = copy.deepcopy(trust)
allowed_trust["trustedAnchorDigest"] = digest(allowed_anchor)
allowed = copy.deepcopy(valid_observation)
allowed["processMasks"][3]["maskConstruction"] = allowed["processMasks"][0]["maskConstruction"]
allowed["processMasks"][3]["observedMaskDigest"] = allowed["processMasks"][0]["observedMaskDigest"]
fixtures.append(("authority explicitly permits one causal cross-process alias", allowed_anchor, receipt, allowed, allowed_trust, []))

results = []
for name, fixture_anchor, fixture_receipt, fixture_observation, fixture_trust, expected in fixtures:
    actual = verify(fixture_anchor, fixture_receipt, fixture_observation, fixture_trust)
    results.append({
        "name": name,
        "expected": sorted(expected),
        "actual": actual,
        "pass": actual == sorted(expected),
    })

output = {
    "caseId": "N341-PROCESS-BOUND-MASK-IDENTITY-GATE",
    "status": "PASS" if all(item["pass"] for item in results) else "FAIL",
    "passed": sum(item["pass"] for item in results),
    "total": len(results),
    "productionAuthorityTrustRoot": "UNKNOWN",
    "productionMotherRun": False,
    "results": results,
}
print(json.dumps(output, indent=2, ensure_ascii=False, sort_keys=True))
