"""Resume only the completed core checks for this exact, unchanged production build.

Run 39020723675 did not complete: its cleanup timed out and its performance
measurement did not prove draw completion. Neither result is accepted here.
The original artifact and qa.json are preserved, including those limitations.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
SOURCE = "544ec81bcef6185a553df138585c7059e832a122"
RUN = "39020723675-1"
ARTIFACT = "12096734029"
ARCHIVE_SHA = "0c693546b50b859ec70e269809eee120f3015f112249a54ae37ea520dfe1078d"
MODULE_SHA = "0e3246b07a5f0a9f0f4de3298dcfc43ccf88c8018e55792c28225cb74b76b03d"
BUILD_SOURCE_SHA = "1f7143bc0ce0f580e8853973d6867b4f56048a22ebd8a2e9e24308f394d7664f"
PREVIEW_SHA = "4d11c5a8c7b9a0573e37e68ce93eaa9a1657c6b49da6c386a6aa6488ff45f231"
QA_SHA = "7a416bda6e1e7cf1c7ea18d891a60074de0d6cccba6678be97d379af87cc2b40"
MANIFEST_SHA = "bc3640992173d01d0b59bce478d0e7297ce943a9e50fc9d8033c1fd7d83bac8e"
CORE_NAMES = [
    "fixed R07 and disabled candidate preserve geometry and exact pixels",
    "lip pixels change with exact outside-mouth identity and reversible toggle",
    "mask colour roughness and normal diagnostics reach the framebuffer",
    "lip controls affect real pixels while geometry and original skin stay fixed",
    "native slider keyboard input changes settings and actual lip pixels",
    "native jaw-open and pucker poses retain surface binding and restore the full person",
    "existing portrait and skin-tone combinations retain the lip module",
    "view API changes the real camera and keeps current lighting intact",
    "all actual GPU programs link with zero shader and browser errors",
]
PERF_NAME = "same-machine frame-time comparison stays within bounded regression budget"

def digest(data):
    return hashlib.sha256(data).hexdigest()

assert len(sys.argv) == 2, "Provide the downloaded original artifact ZIP"
assert os.environ.get("SOURCE_SHA") == SOURCE, "Production source identity changed"
assert digest((ROOT / "LipSurface.js").read_bytes()) == MODULE_SHA, "Lip production module changed; full core verification is required"
assert digest((ROOT / "build.cjs").read_bytes()) == BUILD_SOURCE_SHA, "Builder changed; full core verification is required"
assert digest((ROOT / "preview.html").read_bytes()) == PREVIEW_SHA, "Preview bytes differ from the actually tested production build"
current_manifest = json.loads((ROOT / "BUILD_MANIFEST.json").read_text())
assert current_manifest["sourceCommit"] == SOURCE
assert current_manifest["hostRestorationExact"] is True
assert current_manifest["moduleSHA256"] == MODULE_SHA
assert current_manifest["previewSHA256"] == PREVIEW_SHA

archive = Path(sys.argv[1]).read_bytes()
assert digest(archive) == ARCHIVE_SHA, "Original CI artifact ZIP digest mismatch"
prefix = f"evidence/{RUN}/candidate/"
with zipfile.ZipFile(sys.argv[1]) as z:
    records = {}
    for item in z.infolist():
        name = item.filename
        assert not Path(name).is_absolute() and ".." not in Path(name).parts
        assert (item.external_attr >> 16) & 0o170000 != 0o120000, "Symlink artifact entry rejected"
        assert not item.is_dir(), "Unexpected directory artifact entry"
        assert name == "BUILD_MANIFEST.json" or name.startswith(prefix), "Unexpected artifact path"
        assert name not in records, "Duplicate artifact path"
        records[name] = z.read(item)
assert len(records) == 54
assert digest(records[prefix + "qa.json"]) == QA_SHA
assert digest(records["BUILD_MANIFEST.json"]) == MANIFEST_SHA
old = json.loads(records["BUILD_MANIFEST.json"])
assert old["sourceCommit"] == SOURCE and old["previewSHA256"] == PREVIEW_SHA
assert old["moduleSHA256"] == MODULE_SHA and old["hostRestorationExact"] is True
for key in ("hostSHA256", "originalScriptHashes", "previewBytes"):
    assert current_manifest[key] == old[key]
qa = json.loads(records[prefix + "qa.json"])
assert qa["sourceCommit"] == SOURCE and qa["previewSHA256"] == PREVIEW_SHA
assert qa["completed"] is False and qa.get("failure") is None
assert qa["cleanupError"] == "Error: close Chromium exceeded 10000 ms; pending browser work is not treated as completed"
assert qa["publicHttpsPassed"] is False and qa["shareAllowed"] is False
for key in ("errors", "consoleErrors", "failedRequests", "resourceErrors"):
    assert qa[key] == []
tests = {t["name"]: t for t in qa["tests"]}
assert len(tests) == len(qa["tests"]) == 10
assert set(tests) == set(CORE_NAMES + [PERF_NAME])
assert all(tests[name]["passed"] is True for name in CORE_NAMES)
for shot in qa["screenshots"]:
    data = records[prefix + shot["name"] + ".png"]
    assert len(data) == shot["bytes"] and digest(data) == shot["sha256"]

# Preserve all original files unchanged; the old manifest gets an explicit run path.
for name, data in records.items():
    dest = ROOT / (f"evidence/{RUN}/BUILD_MANIFEST.json" if name == "BUILD_MANIFEST.json" else name)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        assert dest.read_bytes() == data, "Refuse to overwrite different prior evidence"
    else:
        dest.write_bytes(data)
proof = {
    "schema": "kaopu/lip-core-evidence-reuse@1",
    "sourceCommit": SOURCE,
    "verificationCommit": os.environ.get("LIP_VERIFICATION_SHA"),
    "originRunId": "39020723675",
    "originRunAttempt": "1",
    "artifactId": ARTIFACT,
    "artifactSHA256": ARCHIVE_SHA,
    "originQA": prefix + "qa.json",
    "originQASHA256": QA_SHA,
    "signature": {"moduleSHA256": MODULE_SHA, "buildSourceSHA256": BUILD_SOURCE_SHA, "previewSHA256": PREVIEW_SHA},
    "acceptedTests": [{"name": name, "passed": True, "originRunId": "39020723675"} for name in CORE_NAMES],
    "excludedTests": [{"name": PERF_NAME, "reason": "The old timing lacked evidence that submitted GPU work had completed; its PASS flag is invalid and is not reused."}],
    "originCompleted": False,
    "originCleanupError": qa["cleanupError"],
    "requiresFresh": ["actual submitted draws and synchronized pixel-readback performance", "bounded browser cleanup", "fixed public HTTPS bytes and real desktop/mobile-viewport interaction"],
    "sourceVerifiedByteForByte": True,
    "visualAcceptance": False,
    "productionReady": False,
    "validatedAt": datetime.now(timezone.utc).isoformat(),
}
(ROOT / "CORE_EVIDENCE_VALIDATED.json").write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"reusedCoreGroups": len(CORE_NAMES), "excludedPerformance": True, "previewSHA256": PREVIEW_SHA, "originalEvidencePreserved": True}))
