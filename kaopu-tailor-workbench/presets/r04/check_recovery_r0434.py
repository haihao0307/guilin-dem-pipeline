"""Read-only recovery of R04.3.4's completed public acceptance; never publishes or starts jobs."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

SOURCE = "8c8245dd87e5fdf0e2a7720a96776743134ab17a"
BASE = "https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r0434-8c8245dd87e5/"
EXPECTED = {
    "R0434_RELEASE_STATE.json": "d981875dee3c493ac449935bcf08bbfd0ebfe1e6c46d25c401520d2e5c069e65",
    "R0434_MANIFEST.json": "6aeb883f5ab3b537bec21fdaeed724f47c9794c76665ac795d39496eb827f9d6",
    "R0434_PUBLIC_REPORT.json": "f5be6394684ebadc5e5233c6c542826cd1141ba224d90c9f84742b0450beb205",
    "R0434_SAFETY_PUBLIC_REPORT.json": "d9a3433dd794ff94697a2be07bff5a579f2593f36576bd710859303080c99cba",
    "R0434_FRESH_PUBLIC_REPORT.json": "92f8c7507643b0089de1252814403b1913a5b99614375b2318a6c1c8a7594f89",
    "R0434_PUBLIC_BYTES.json": "196e0af77f431b575e61420974cedfe05a46bc153e600e4849ee0082041db399",
}

def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)

def inspect(root: Path) -> dict[str, Any]:
    docs: dict[str, Any] = {}
    for name, digest in EXPECTED.items():
        data = (root / name).read_bytes()
        require(hashlib.sha256(data).hexdigest() == digest, "Evidence changed; inspect before proceeding: " + name)
        docs[name] = json.loads(data)
    state = docs["R0434_RELEASE_STATE.json"]
    manifest = docs["R0434_MANIFEST.json"]
    display = docs["R0434_PUBLIC_REPORT.json"]
    safety = docs["R0434_SAFETY_PUBLIC_REPORT.json"]
    fresh = docs["R0434_FRESH_PUBLIC_REPORT.json"]
    public = docs["R0434_PUBLIC_BYTES.json"]
    require(state["publicVerified"] is True and state["fixedURL"] == BASE + "?preset=T01-P01", "Wrong or unverified release")
    require(state["runtimeSourceCommit"] == manifest["runtimeSourceCommit"] == public["runtimeSourceCommit"] == SOURCE, "Source mismatch")
    for report, expected_count, public_key in [(display, 31, "actualPublicBrowser"), (safety, 10, "actualPublicBrowser"), (fresh, 8, "public")]:
        require(report["passed"] is True and report[public_key] is True and report["url"] == BASE, "Wrong browser evidence")
        require(len(report["checks"]) == expected_count and all(c["passed"] is True for c in report["checks"]), "Missing or failed assertions")
    expected_ids = {f"{prefix}{i:02}" for prefix, count in [("T", 18), ("P", 10), ("S", 14), ("D", 12), ("J", 6)] for i in range(1, count + 1)}
    require(len(display["styles"]) == 60 and {r["id"] for r in display["styles"]} == expected_ids, "Incomplete style coverage")
    require(all(r["passedDisplay"] is True for r in display["styles"]), "Style display failed")
    require(sum(r["staticPassed"] is True for r in display["styles"]) == 22, "Unexpected quality-state change")
    expected_outfits = {f"T{i:02}-{p}{j:02}" for i in range(1, 19) for p, count in [("P", 10), ("S", 14)] for j in range(1, count + 1)}
    require(len(display["outfits"]) == 432 and {r["id"] for r in display["outfits"]} == expected_outfits, "Incomplete outfit coverage")
    require(all(r["passedDisplay"] is True and r["members"] == r["id"].split("-") for r in display["outfits"]), "Wrong outfit identity")
    paths = {r["path"]: r for r in public["checked"]}
    require(public["allMatch"] is True and len(public["checked"]) == len(paths) == 739, "Public byte coverage mismatch")
    require(set(paths) == set(manifest["files"]), "Manifest coverage mismatch")
    require(all(r["sha256"] == manifest["files"][n]["sha256"] for n, r in paths.items()), "Public byte identity mismatch")
    require(sum(r["decodedCurrent3DPreview"] is True for r in paths.values()) == 492, "Current preview coverage mismatch")
    require(all(t["before"] == t["after"] for t in state["protectedTrees"].values()), "Protected old entrance changed")
    require(state["all60GarmentsAccepted"] is False and display["userAccepted"] is False, "Display is not garment or user approval")
    require(display["jointOutfitPhysicsCertified"] is False, "Do not claim joint outfit physics")
    return {
        "recoveryAction": "READY_FOR_USER_REVIEW_NO_REBUILD",
        "fixedURL": state["fixedURL"],
        "runtimeSourceCommit": SOURCE,
        "evidenceCommit": "36ce375dd0c2fc6f419b627899ecce1aa6849e7e",
        "workflowRun": 38113488943,
        "stylesDisplayed": 60, "outfitsDisplayed": 432, "staticPass": 22, "needsRepair": 38,
        "publicPathsVerified": 739, "currentPreviewsDecoded": 492,
        "checks": {"display": 31, "safety": 10, "freshNativeSewing": 8},
        "scope": "Integrity and consistency of stored completed public-browser evidence; no new live-browser test.",
        "runtimeChanged": False, "networkRequests": 0, "jobsStarted": 0, "published": False,
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args.root), ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"recoveryAction": "HOLD_INSPECT_EVIDENCE", "error": str(exc), "published": False}), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
