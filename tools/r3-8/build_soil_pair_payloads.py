from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPERIMENT = ROOT / "tools/r3-8/experiment_pack_soil_pair.py"
DEFAULT_FIXED_COMMIT = "3018da201a2ef6b5d122522e85bbbb5b91f8a34d"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--fixed-commit", default=DEFAULT_FIXED_COMMIT)
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    run = subprocess.run(
        [sys.executable, str(EXPERIMENT), "--out", str(args.out), "--fixed-commit", args.fixed_commit],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(run.stdout)
    assert report["allRoundTripExact"] is True
    assert report["pairCount"] == 48
    assert report["sourceLayerCount"] == 96

    manifest = {
        "schema": "wenzhou-r3.8-soil-pair-context/wsp1",
        "sourceCandidateCommit": args.fixed_commit,
        "sourceLayerCount": report["sourceLayerCount"],
        "pairCount": report["pairCount"],
        "codec": "WSP1 + zlib/deflate, exact reversible",
        "totalRawBytes": report["totalRawBytes"],
        "totalPackedBytes": report["totalPackedBytes"],
        "savedBytes": report["savedBytes"],
        "savedFraction": report["savedFraction"],
        "truthBoundary": {
            "canonicalTruth": False,
            "fieldObservation": False,
            "mayOverrideCanonicalDem": False,
            "semanticChange": False,
        },
        "pairs": [
            {
                "property": p["property"],
                "depth": p["depth"],
                "path": p["path"],
                "bytes": p["packedBytes"],
                "sha256": p["containerSha256"],
                "rawBytes": p["rawBytes"],
                "roundTripExact": p["roundTripExact"],
                "valueSourcePath": p["valueSourcePath"],
                "uncertaintySourcePath": p["uncertaintySourcePath"],
            }
            for p in report["pairs"]
        ],
    }
    (args.out / "soil-pair-context.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "passed": True,
        "pairCount": manifest["pairCount"],
        "totalRawBytes": manifest["totalRawBytes"],
        "totalPackedBytes": manifest["totalPackedBytes"],
        "savedFraction": manifest["savedFraction"],
        "manifest": str(args.out / "soil-pair-context.json"),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
