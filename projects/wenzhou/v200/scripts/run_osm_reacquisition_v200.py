#!/usr/bin/env python3
"""Reacquire OSM coastline and waterways for the Wenzhou V200 17-tile AOI.

The repository already contains a source-traceable OSM acquisition engine used by
PR #49. This runner reuses that audited engine in an isolated worktree step,
feeds it the V200 AOI, copies the resulting raw responses and derived geometry
into projects/wenzhou/v200, rewrites report paths, and restores every legacy
path before the workflow commits. No manual coastline or river geometry is
created here.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[4]
V200_CONFIG = REPO_ROOT / "projects/wenzhou/v200/config/osm_hydrology_v200.json"
V200_DATA = REPO_ROOT / "projects/wenzhou/v200/data/hydrology/osm"
V200_REPORTS = REPO_ROOT / "projects/wenzhou/v200/reports"
V200_ACQUISITION = V200_REPORTS / "OSM_HYDROLOGY_ACQUISITION.json"
V200_QA = V200_REPORTS / "HYDROLOGY_TOPOLOGY_QA.json"
V200_STATE = V200_REPORTS / "WENZHOU_V200_OSM_REACQUISITION_STATE.json"

LEGACY_CONFIG = REPO_ROOT / "projects/wenzhou/coastal/config/osm_hydrology_v100.json"
LEGACY_SCRIPT = REPO_ROOT / "projects/wenzhou/coastal/scripts/download_osm_hydrology.py"
LEGACY_DATA = REPO_ROOT / "projects/wenzhou/coastal/data/hydrology/osm"
LEGACY_ACQUISITION = REPO_ROOT / "projects/wenzhou/coastal/reports/OSM_HYDROLOGY_ACQUISITION.json"
LEGACY_QA = REPO_ROOT / "projects/wenzhou/coastal/reports/HYDROLOGY_TOPOLOGY_QA.json"

OLD_DATA_PREFIX = "projects/wenzhou/coastal/data/hydrology/osm"
NEW_DATA_PREFIX = "projects/wenzhou/v200/data/hydrology/osm"
TRUTH_SHA256 = "c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43"
BASE_ENGINE_COMMIT = "e84b507653554ecc8062c75d3be597d82de57d93"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def rewrite_paths(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace(OLD_DATA_PREFIX, NEW_DATA_PREFIX)
    if isinstance(value, list):
        return [rewrite_paths(item) for item in value]
    if isinstance(value, dict):
        return {key: rewrite_paths(item) for key, item in value.items()}
    return value


def restore_legacy_paths() -> None:
    subprocess.run(
        [
            "git",
            "restore",
            "--source=HEAD",
            "--",
            str(LEGACY_CONFIG.relative_to(REPO_ROOT)),
            str(LEGACY_DATA.relative_to(REPO_ROOT)),
            str(LEGACY_ACQUISITION.relative_to(REPO_ROOT)),
            str(LEGACY_QA.relative_to(REPO_ROOT)),
        ],
        cwd=REPO_ROOT,
        check=True,
    )


def verify_report_files(report: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for key in ("rawFiles", "outputFiles"):
        for item in report.get(key, []):
            path = REPO_ROOT / item["path"]
            if not path.is_file():
                raise RuntimeError(f"missing reported file: {path}")
            actual_bytes = path.stat().st_size
            actual_sha = sha256_file(path)
            if actual_bytes != int(item["bytes"]):
                raise RuntimeError(f"byte mismatch: {path}")
            if actual_sha != item["sha256"]:
                raise RuntimeError(f"hash mismatch: {path}")
            records.append(
                {
                    "role": item["role"],
                    "path": item["path"],
                    "bytes": actual_bytes,
                    "sha256": actual_sha,
                }
            )
    return records


def main() -> int:
    if not V200_CONFIG.is_file():
        raise FileNotFoundError(V200_CONFIG)
    if not LEGACY_SCRIPT.is_file():
        raise FileNotFoundError(LEGACY_SCRIPT)

    config = json.loads(V200_CONFIG.read_text(encoding="utf-8"))
    if config["domain"]["truthCogSha256"] != TRUTH_SHA256:
        raise RuntimeError("V200 config truth hash does not match the frozen manifest")
    if config["qa"].get("manualGeometryAllowed") is not False:
        raise RuntimeError("manual geometry must remain disabled")

    generated = datetime.now(timezone.utc).isoformat()
    V200_REPORTS.mkdir(parents=True, exist_ok=True)
    if V200_DATA.exists():
        shutil.rmtree(V200_DATA)
    for path in (V200_ACQUISITION, V200_QA, V200_STATE):
        path.unlink(missing_ok=True)

    try:
        if LEGACY_DATA.exists():
            shutil.rmtree(LEGACY_DATA)
        LEGACY_ACQUISITION.unlink(missing_ok=True)
        LEGACY_QA.unlink(missing_ok=True)

        legacy_compatible = {
            "schema": "wenzhou_osm_hydrology@1.1.0",
            "source": config["source"],
            "domain": {
                "wgs84Bounds": config["domain"]["wgs84Bounds"],
                "projectedCrs": config["domain"]["projectedCrs"],
                "projectedClipBounds": config["domain"]["projectedClipBounds"],
            },
            "tiling": config["tiling"],
            "query": config["query"],
            "retry": config["retry"],
            "derived": {
                "preserveSourceCoordinates": config["derived"]["preserveSourceCoordinates"],
                "preserveSourceWayIds": config["derived"]["preserveSourceWayIds"],
                "preserveSourceNodeIdsWhenReturned": True,
                "clipProjectedGeometry": config["derived"]["clipProjectedGeometry"],
                "mutateSourceGeometry": config["derived"]["mutateSourceGeometry"],
                "riverWidthMayModifyCenterline": config["derived"]["riverWidthMayModifyCenterline"],
                "minimumWayVertexCount": config["derived"]["minimumWayVertexCount"],
            },
            "qa": {
                "maximumOutOfBoundsVertices": config["qa"]["maximumOutOfBoundsVertices"],
                "maximumDuplicatePartIds": config["qa"]["maximumDuplicatePartIds"],
                "maximumMissingWayGeometry": config["qa"]["maximumMissingWayGeometry"],
                "maximumIntroducedSelfIntersections": config["qa"]["maximumIntroducedSelfIntersections"],
                "requireCoastlineFeatures": config["qa"]["requireCoastlineFeatures"],
                "requireWaterwayFeatures": config["qa"]["requireWaterwayFeatures"],
                "estuaryConnectivityStatus": config["qa"]["estuaryConnectivityStatus"],
            },
        }
        write_json(LEGACY_CONFIG, legacy_compatible)

        subprocess.run([sys.executable, str(LEGACY_SCRIPT)], cwd=REPO_ROOT, check=True)

        if not LEGACY_DATA.is_dir() or not LEGACY_ACQUISITION.is_file() or not LEGACY_QA.is_file():
            raise RuntimeError("audited OSM engine did not produce its required outputs")

        shutil.copytree(LEGACY_DATA, V200_DATA)
        acquisition = rewrite_paths(json.loads(LEGACY_ACQUISITION.read_text(encoding="utf-8")))
        qa = rewrite_paths(json.loads(LEGACY_QA.read_text(encoding="utf-8")))

        acquisition.update(
            {
                "project": "wenzhou-v200-17tile-truth-hydrology-rebuild",
                "domainVersion": "v200-17tile",
                "truthCogSha256": TRUTH_SHA256,
                "engine": {
                    "path": str(LEGACY_SCRIPT.relative_to(REPO_ROOT)),
                    "baseCommit": BASE_ENGINE_COMMIT,
                    "reusePolicy": "audited engine reused with isolated V200 configuration and outputs",
                },
                "manualGeometryUsed": False,
            }
        )
        qa.update(
            {
                "project": "wenzhou-v200-17tile-truth-hydrology-rebuild",
                "domainVersion": "v200-17tile",
                "truthCogSha256": TRUTH_SHA256,
                "manualGeometryUsed": False,
            }
        )

        write_json(V200_ACQUISITION, acquisition)
        write_json(V200_QA, qa)
        checked = verify_report_files(acquisition)

        expected_tiles = int(config["tiling"]["columns"]) * int(config["tiling"]["rows"])
        if len(acquisition.get("tiles", [])) != expected_tiles:
            raise RuntimeError("unexpected OSM tile count")
        if acquisition.get("passed") is not True:
            raise RuntimeError("OSM source acquisition did not pass")
        if qa.get("sourceAcquisitionPassed") is not True:
            raise RuntimeError("OSM source acquisition QA did not pass")
        if qa.get("projectedSkeletonPassed") is not True:
            raise RuntimeError("projected OSM skeleton QA did not pass")
        if qa.get("outOfBoundsVertexCount") != 0:
            raise RuntimeError("projected geometry escaped the V200 AOI")
        if qa.get("duplicatePartIdCount") != 0:
            raise RuntimeError("duplicate projected part IDs detected")
        if qa.get("widthCenterlineInvariantPolicy") != "width changes lateral offsets only":
            raise RuntimeError("centerline invariant was not preserved")

        write_json(
            V200_STATE,
            {
                "schema": "wenzhou_v200_osm_reacquisition_state@1.0.0",
                "generatedAtUtc": generated,
                "status": "source_acquired_projected_skeleton_passed_estuary_topology_pending",
                "truthCogSha256": TRUTH_SHA256,
                "tileCount": expected_tiles,
                "sourceCoastlineWayCount": qa.get("sourceCoastlineWayCount"),
                "sourceWaterwayWayCount": qa.get("sourceWaterwayWayCount"),
                "derivedCoastlinePartCount": qa.get("derivedCoastlinePartCount"),
                "derivedWaterwayPartCount": qa.get("derivedWaterwayPartCount"),
                "checkedFileCount": len(checked),
                "manualGeometryUsed": False,
                "estuaryConnectivityStatus": "pending",
                "truthBinaryPresent": False,
                "truthDependentDrapingAllowed": False,
            },
        )
    finally:
        restore_legacy_paths()

    print(V200_STATE.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
