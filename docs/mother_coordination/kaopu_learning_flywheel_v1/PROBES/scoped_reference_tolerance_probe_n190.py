"""N190 scoped-tolerance contract probe; synthetic policy fixtures only."""

import copy
import hashlib
import json


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def verify(case):
    contract = case["contract"]
    receipt = case["receipt"]
    failures = []

    if not contract.get("userInstructionDigest"):
        failures.append("USER_INSTRUCTION_NOT_BOUND")
    if contract.get("globalRelaxed"):
        failures.append("GLOBAL_RELAXATION_FORBIDDEN")

    observations = receipt.get("fieldObservations", {})
    for rule in contract.get("fieldPolicy", []):
        field = rule["field"]
        observed = observations.get(field)
        if not observed:
            failures.append(f"FIELD_RECEIPT_MISSING:{field}")
            continue

        if rule["mode"] == "STRICT":
            if observed.get("status") != "VERIFIED" or not observed.get("matches"):
                failures.append(f"STRICT_FIELD_FAILED:{field}")
        elif rule["mode"] == "PROVISIONAL":
            if observed.get("status") not in {"PROVISIONAL", "VERIFIED"}:
                failures.append(f"PROVISIONAL_STATUS_INVALID:{field}")
            if observed.get("claim") == "FINAL":
                failures.append(f"PROVISIONAL_CLAIMED_FINAL:{field}")
            if not observed.get("scopeSourceDigest"):
                failures.append(f"RELAXATION_SOURCE_MISSING:{field}")
        else:
            failures.append(f"UNKNOWN_POLICY_MODE:{field}")

    return {"candidateAllowed": not failures, "failures": failures}


contract = {
    "userInstructionDigest": "sha256:user-material-strict-color-provisional",
    "globalRelaxed": False,
    "fieldPolicy": [
        {"field": "buildingIdentity", "mode": "STRICT"},
        {"field": "referenceRecency", "mode": "STRICT"},
        {"field": "facadeGeometryAndOpenings", "mode": "STRICT"},
        {"field": "materialClass", "mode": "STRICT"},
        {"field": "colorTone", "mode": "PROVISIONAL"},
    ],
}


def valid_receipt(color_status="PROVISIONAL"):
    strict = lambda: {"status": "VERIFIED", "matches": True, "claim": "CANDIDATE"}
    return {
        "fieldObservations": {
            "buildingIdentity": strict(),
            "referenceRecency": strict(),
            "facadeGeometryAndOpenings": strict(),
            "materialClass": strict(),
            "colorTone": {
                "status": color_status,
                "matches": color_status == "VERIFIED",
                "claim": "CANDIDATE",
                "scopeSourceDigest": contract["userInstructionDigest"],
            },
        }
    }


fixtures = []


def add(name, contract_mutation=None, receipt_mutation=None, expected=False, color_status="PROVISIONAL"):
    c = copy.deepcopy(contract)
    r = valid_receipt(color_status)
    if contract_mutation:
        contract_mutation(c)
    if receipt_mutation:
        receipt_mutation(r)
    fixtures.append({"name": name, "contract": c, "receipt": r, "expected": expected})


add("strict facts verified, color explicitly provisional", expected=True)
add("wrong material hidden by acceptable color", receipt_mutation=lambda r: r["fieldObservations"]["materialClass"].update(status="MISMATCH", matches=False), expected=False)
add("old photo used instead of requested latest state", receipt_mutation=lambda r: r["fieldObservations"]["referenceRecency"].update(status="STALE", matches=False), expected=False)
add("wrong building identity", receipt_mutation=lambda r: r["fieldObservations"]["buildingIdentity"].update(status="MISMATCH", matches=False), expected=False)
add("generic facade and openings", receipt_mutation=lambda r: r["fieldObservations"]["facadeGeometryAndOpenings"].update(status="MISMATCH", matches=False), expected=False)
add("single relaxed phrase expanded globally", contract_mutation=lambda c: c.update(globalRelaxed=True), expected=False)
add("unbound user instruction", contract_mutation=lambda c: c.update(userInstructionDigest=""), expected=False)
add("provisional color claimed final", receipt_mutation=lambda r: r["fieldObservations"]["colorTone"].update(claim="FINAL"), expected=False)
add("material class incorrectly downgraded to provisional", receipt_mutation=lambda r: r["fieldObservations"]["materialClass"].update(status="PROVISIONAL", matches=False), expected=False)
add("all strict facts and exact color verified", expected=True, color_status="VERIFIED")


results = []
for fixture in fixtures:
    outcome = verify(fixture)
    results.append({
        "name": fixture["name"],
        "expected": fixture["expected"],
        "actual": outcome["candidateAllowed"],
        "failures": outcome["failures"],
        "pass": fixture["expected"] == outcome["candidateAllowed"],
    })

report = {
    "schemaVersion": "n190-v1",
    "probeKind": "synthetic_field_scoped_tolerance_contract_not_asset_validation",
    "fixtureDigest": digest(fixtures),
    "caseCount": len(results),
    "passed": sum(row["pass"] for row in results),
    "allExpectedOutcomesMatched": all(row["pass"] for row in results),
    "results": results,
    "interpretation": "A user relaxation applies only to named fields. Provisional color may coexist with strict identity, current-source, geometry/openings, and material-class requirements; it cannot be promoted to final acceptance or expanded globally.",
}

print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
assert report["allExpectedOutcomesMatched"]
