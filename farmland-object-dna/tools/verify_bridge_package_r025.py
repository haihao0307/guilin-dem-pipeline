#!/usr/bin/env python3
"""Validate the Farmland R025 Xiaoma/TLO/DEM bridge and its ZIP package.

The contract-only mode is suitable for the source commit that defines the
bridge. Full mode verifies the external receipt, archive structure, every
manifest/checksum entry, the Git snapshot when available, and the packaged
R025/unit-test runtime.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any


BRIDGE_ID = "FARMLAND_XIAOMA_TLO_DEM_BRIDGE_R025_20260911"
BRIDGE_SCHEMA = "farmland-xiaoma-tlo-dem-bridge/r025"
SCOPE_SCHEMA = "farmland-xiaoma-tlo-dem-bridge-package-scope/r025"
PACKAGE_SCHEMA = "farmland-xiaoma-tlo-dem-bridge-package/v1"
VALIDATION_SCHEMA = "farmland-xiaoma-tlo-dem-bridge-validation/v1"
MANIFEST_SCHEMA = "farmland-xiaoma-tlo-dem-bridge-manifest/v1"
RECEIPT_SCHEMA = "farmland-xiaoma-tlo-dem-bridge-receipt/v1"
PACKAGE_ROOT_NAME = "Farmland_Object_DNA_Xiaoma_TLO_DEM_Bridge_R025_2026-09-11"
ARCHIVE_NAME = f"{PACKAGE_ROOT_NAME}.zip"
RECEIPT_NAME = f"{PACKAGE_ROOT_NAME}.receipt.json"
SHA_NAME = f"{PACKAGE_ROOT_NAME}.sha256"
LATEST_NAME = "LATEST.json"

BRIDGE_REL = Path("farmland-object-dna/bridges/r025-xiaoma-tlo-dem")
DIST_REL = Path("farmland-object-dna/distributions/bridges/r025-xiaoma-tlo-dem")

R025_BASELINE = {
    "repository": "haihao0307/guilin-dem-pipeline",
    "branch": "restart/farmland-object-dna-v020-20260907",
    "commit": "082d2ae692f9fae3811531a847d2cb53e8ff348f",
    "tree": "c12ffbf8f7ed8a8bdd46f1d2ecb96625cf6ae573",
    "pull_request": 65,
    "validation_run": 34546616093,
    "validation_conclusion": "success",
    "test_count": 106,
}

RECIPIENTS = ["Xiaoma / TLO", "DEM / Landscape", "next Farmland executor"]
UNFROZEN_TLO_PARTS = {
    "file_extension",
    "binary_or_text_container",
    "chunk_and_index_layout",
    "compression_codec",
    "streaming_protocol",
    "global_location_contract",
    "event_encoding",
    "relation_ontology",
}
EXPLICIT_UNKNOWNS = [
    "parcel_site",
    "parcel_boundary",
    "terrain_sample_window",
    "field_microtopography",
    "bund_sections",
    "channel_sections",
    "water_control_elevations",
]
EXPECTED_GATES = {
    "bridge_semantics_ready": True,
    "numeric_terrain_connected": False,
    "field_scale_terrain_complete": False,
    "honghe_terrain_complete": False,
    "ready_for_regional_geometry": False,
    "ready_for_structural_truth_workbench": False,
    "ready_for_public_candidate": False,
    "visualAcceptance": False,
    "productionReady": False,
}
REPOSITORY_CONTEXT = {
    "AGENTS.md",
    "contracts/PRODUCTION_CONTRACT.json",
    "knowledge/PUBLIC_WEB_DELIVERY_GATE.md",
    ".github/workflows/validate-farmland-object-dna-rules.yml",
}
GENERATED_RECORDS = {
    "PACKAGE_METADATA.json",
    "VALIDATION_REPORT.json",
    "PACKAGE_MANIFEST.json",
    "SHA256SUMS.txt",
}
EXCLUDED_PREFIXES = {
    "farmland-object-dna/distributions/",
    "farmland-object-dna/workbench-v001/",
}
PROHIBITED_PAYLOADS = {
    "raw TIFF",
    "canonical numeric DEM tile binaries",
    "historical distribution ZIP files",
    "rejected V0.1 visual workbench",
    "protected portal content",
    "credentials or authentication material",
    "unrelated Mother assets",
}
TOP_LEVEL_SOURCE_COPIES = {
    "00_START_HERE.md",
    "BRIDGE_CONTRACT.json",
    "PACKAGE_SCOPE.json",
    "NEXT_REQUESTS.md",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def _mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def _nonempty_string_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{label} must be a nonempty array")
    if any(not isinstance(item, str) or not item for item in value):
        raise ValueError(f"{label} must contain nonempty strings")
    if len(value) != len(set(value)):
        raise ValueError(f"{label} contains duplicates")
    return value


def validate_bridge_contract(contract: dict[str, Any]) -> dict[str, Any]:
    """Validate the fixed R025 bridge semantics and closed production gates."""

    if contract.get("schema") != BRIDGE_SCHEMA:
        raise ValueError("bridge schema changed")
    if contract.get("bridge_id") != BRIDGE_ID:
        raise ValueError("bridge identity changed")
    if contract.get("date") != "2026-09-11":
        raise ValueError("bridge date changed")
    if contract.get("status") != "ready_for_deterministic_packaging":
        raise ValueError("bridge source status changed")
    if contract.get("sender") != "Farmland Object DNA":
        raise ValueError("bridge sender changed")
    if contract.get("recipients") != RECIPIENTS:
        raise ValueError("bridge recipients changed")
    if contract.get("r025_baseline") != R025_BASELINE:
        raise ValueError("R025 baseline commit, tree, PR, run, or test count changed")

    flow = _mapping(contract.get("knowledge_flow"), "knowledge_flow")
    if set(flow) != {"received", "adopted", "not_adopted", "published"}:
        raise ValueError("knowledge-flow sections are incomplete")
    for key in sorted(flow):
        _nonempty_string_list(flow[key], f"knowledge_flow.{key}")
    if "synthetic Landscape R6 as terrain truth" not in flow["not_adopted"]:
        raise ValueError("synthetic Landscape R6 truth boundary is missing")
    if "Guilin DEM as Honghe terrain" not in flow["not_adopted"]:
        raise ValueError("Guilin/Honghe regional separation is missing")

    tlo = _mapping(contract.get("tlo"), "tlo")
    if tlo.get("status") != "candidate_not_frozen":
        raise ValueError("TLO candidate must remain not frozen")
    if tlo.get("coordinate_order") != ["t", "x", "y", "z"]:
        raise ValueError("TLO coordinate order changed")
    if tlo.get("object_is_mesh") is not False:
        raise ValueError("Object identity cannot be a mesh")
    if tlo.get("object_is_fifth_geometric_dimension") is not False:
        raise ValueError("Object identity cannot become a fifth geometric dimension")
    if tlo.get("farmland_core_schema_changed") is not False:
        raise ValueError("candidate TLO cannot change the Farmland core schema")
    if set(_nonempty_string_list(tlo.get("unfrozen_parts"), "tlo.unfrozen_parts")) != UNFROZEN_TLO_PARTS:
        raise ValueError("TLO unresolved parts must remain explicit")

    terrain = _mapping(contract.get("terrain_authority"), "terrain_authority")
    expected_terrain = {
        "canonical_release": "guilin-native-12p5m-single-truth-v001",
        "canonical_release_commit": "e4906653b705712edb610ee31f91716f18922369",
        "region": "Guilin accepted AOI only",
        "crs": "EPSG:32649",
        "grid": [17408, 18867],
        "resolution_m": [12.5, 12.5],
        "tile_count": 54,
        "numeric_tiles_in_farmland": False,
        "terrain_sample_read": False,
        "query_adapter_implemented": False,
        "field_component_resolution": False,
        "honghe_covered": False,
    }
    if terrain != expected_terrain:
        raise ValueError("terrain authority, identity, or readiness boundary changed")

    if contract.get("explicit_unknowns") != EXPLICIT_UNKNOWNS:
        raise ValueError("all seven bridge unknowns must remain explicit and ordered")

    requests = _mapping(contract.get("requests"), "requests")
    if set(requests) != {"xiaoma_tlo", "dem_landscape", "farmland"}:
        raise ValueError("recipient request groups are incomplete")
    for key in sorted(requests):
        _nonempty_string_list(requests[key], f"requests.{key}")

    if contract.get("gates") != EXPECTED_GATES:
        raise ValueError("bridge, geometry, visual, or production gates changed")

    return {
        "ok": True,
        "bridge_id": BRIDGE_ID,
        "r025_baseline_commit": R025_BASELINE["commit"],
        "recipient_count": len(RECIPIENTS),
        "explicit_unknown_count": len(EXPLICIT_UNKNOWNS),
        "tlo_frozen": False,
        "numeric_terrain_connected": False,
        "visualAcceptance": False,
        "productionReady": False,
    }


def validate_package_scope(scope: dict[str, Any]) -> dict[str, Any]:
    """Validate the package inclusion boundary and prohibited payload list."""

    if scope.get("schema") != SCOPE_SCHEMA:
        raise ValueError("package scope schema changed")
    if scope.get("bridge_id") != BRIDGE_ID:
        raise ValueError("package scope bridge identity changed")

    included = _mapping(scope.get("include"), "include")
    if included.get("farmland_tracked_source") != (
        "all files under farmland-object-dna at the package source commit except excluded prefixes"
    ):
        raise ValueError("Farmland source selection rule changed")
    if set(_nonempty_string_list(included.get("repository_context"), "include.repository_context")) != REPOSITORY_CONTEXT:
        raise ValueError("repository context set changed")
    if set(_nonempty_string_list(included.get("generated_records"), "include.generated_records")) != GENERATED_RECORDS:
        raise ValueError("generated record set changed")

    if set(_nonempty_string_list(scope.get("exclude_prefixes"), "exclude_prefixes")) != EXCLUDED_PREFIXES:
        raise ValueError("distribution and rejected-workbench exclusions must remain exact")
    if set(_nonempty_string_list(scope.get("prohibited_payloads"), "prohibited_payloads")) != PROHIBITED_PAYLOADS:
        raise ValueError("prohibited payload boundary changed")
    if not isinstance(scope.get("reason"), str) or not scope["reason"].strip():
        raise ValueError("package scope reason is required")

    return {
        "ok": True,
        "repository_context_count": len(REPOSITORY_CONTEXT),
        "excluded_prefix_count": len(EXCLUDED_PREFIXES),
        "prohibited_payload_count": len(PROHIBITED_PAYLOADS),
    }


def selected_source_paths(paths: list[str]) -> list[str]:
    selected: list[str] = []
    for path in sorted(paths):
        if path in REPOSITORY_CONTEXT:
            selected.append(path)
            continue
        if not path.startswith("farmland-object-dna/"):
            continue
        if any(path.startswith(prefix) for prefix in EXCLUDED_PREFIXES):
            continue
        selected.append(path)
    return selected


def _run(command: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(command)}\n"
            f"stdout={result.stdout}\nstderr={result.stderr}"
        )
    return result


def _parse_test_count(stdout: str, stderr: str) -> int:
    match = re.search(r"Ran (\d+) tests?", f"{stdout}\n{stderr}")
    if not match:
        raise RuntimeError("could not read unittest count")
    return int(match.group(1))


def _parse_checksum_file(data: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        lines = data.decode("utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ValueError("SHA256SUMS.txt is not UTF-8") from exc
    for line in lines:
        if not re.fullmatch(r"[0-9a-f]{64}  .+", line):
            raise ValueError(f"invalid SHA256SUMS line: {line!r}")
        digest, path = line.split("  ", 1)
        if path in result:
            raise ValueError(f"duplicate SHA256SUMS path: {path}")
        result[path] = digest
    return result


def _json_from_payload(payload: dict[str, bytes], path: str) -> dict[str, Any]:
    try:
        value = json.loads(payload[path].decode("utf-8"))
    except KeyError as exc:
        raise ValueError(f"mandatory package file missing: {path}") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid package JSON: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"package JSON must be an object: {path}")
    return value


def _read_archive(archive_path: Path) -> dict[str, bytes]:
    if not archive_path.is_file():
        raise FileNotFoundError(f"bridge archive missing: {archive_path}")
    payload: dict[str, bytes] = {}
    with zipfile.ZipFile(archive_path, "r") as archive:
        bad = archive.testzip()
        if bad is not None:
            raise ValueError(f"archive CRC failed at {bad}")
        seen_names: set[str] = set()
        for info in archive.infolist():
            name = info.filename
            if name in seen_names:
                raise ValueError(f"duplicate ZIP member: {name}")
            seen_names.add(name)
            if info.is_dir():
                continue
            if "\\" in name or name.startswith("/"):
                raise ValueError(f"unsafe ZIP member path: {name}")
            parts = PurePosixPath(name).parts
            if not parts or parts[0] != PACKAGE_ROOT_NAME or any(part in {"", ".", ".."} for part in parts):
                raise ValueError(f"ZIP member is outside the single package root: {name}")
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise ValueError(f"ZIP symlink is prohibited: {name}")
            rel = PurePosixPath(*parts[1:]).as_posix()
            if not rel or rel in payload:
                raise ValueError(f"invalid or duplicate package path: {rel}")
            payload[rel] = archive.read(info)
    if not payload:
        raise ValueError("bridge archive is empty")
    return payload


def _verify_manifest(payload: dict[str, bytes], manifest: dict[str, Any]) -> dict[str, Any]:
    if manifest.get("schema") != MANIFEST_SCHEMA or manifest.get("bridgeId") != BRIDGE_ID:
        raise ValueError("package manifest identity changed")
    entries = manifest.get("entries")
    if not isinstance(entries, list):
        raise ValueError("package manifest entries must be an array")
    expected_paths = sorted(set(payload) - {"PACKAGE_MANIFEST.json", "SHA256SUMS.txt"})
    actual_paths: list[str] = []
    payload_bytes = 0
    for index, item in enumerate(entries):
        item = _mapping(item, f"manifest.entries[{index}]")
        path = item.get("path")
        if not isinstance(path, str) or path in actual_paths:
            raise ValueError("manifest paths must be unique strings")
        if path not in payload:
            raise ValueError(f"manifest path missing from archive: {path}")
        data = payload[path]
        if item.get("bytes") != len(data) or item.get("sha256") != sha256_bytes(data):
            raise ValueError(f"manifest size or hash mismatch: {path}")
        actual_paths.append(path)
        payload_bytes += len(data)
    if actual_paths != expected_paths:
        raise ValueError("manifest path set or sort order changed")
    if manifest.get("entryCount") != len(entries) or manifest.get("payloadBytes") != payload_bytes:
        raise ValueError("manifest count or byte total mismatch")
    expected_rule = (
        "entries exclude PACKAGE_MANIFEST.json and SHA256SUMS.txt; "
        "SHA256SUMS covers every file except itself"
    )
    if manifest.get("manifestRule") != expected_rule:
        raise ValueError("manifest coverage rule changed")
    return {"status": "pass", "entryCount": len(entries), "payloadBytes": payload_bytes}


def _verify_checksums(payload: dict[str, bytes]) -> dict[str, Any]:
    if "SHA256SUMS.txt" not in payload:
        raise ValueError("SHA256SUMS.txt is missing")
    actual = _parse_checksum_file(payload["SHA256SUMS.txt"])
    expected_paths = sorted(set(payload) - {"SHA256SUMS.txt"})
    if list(actual) != expected_paths:
        raise ValueError("SHA256SUMS path set or sort order changed")
    for path in expected_paths:
        if actual[path] != sha256_bytes(payload[path]):
            raise ValueError(f"SHA256SUMS digest mismatch: {path}")
    return {"status": "pass", "entryCount": len(actual)}


def _verify_source_selection(payload: dict[str, bytes], scope: dict[str, Any]) -> list[str]:
    del scope  # already validated; constants make the selection deterministic
    prefix = "source/repository/"
    source_paths = sorted(path[len(prefix):] for path in payload if path.startswith(prefix))
    if not source_paths:
        raise ValueError("source/repository snapshot is empty")
    for path in source_paths:
        allowed = path in REPOSITORY_CONTEXT or path.startswith("farmland-object-dna/")
        if not allowed or any(path.startswith(item) for item in EXCLUDED_PREFIXES):
            raise ValueError(f"source selection contains prohibited path: {path}")
        lower = path.lower()
        if lower.endswith((".tif", ".tiff", ".zip")):
            raise ValueError(f"prohibited terrain or historical archive payload: {path}")
        if lower.endswith(".bin") and "native-" in lower:
            raise ValueError(f"canonical numeric DEM tile payload is prohibited: {path}")
    if not REPOSITORY_CONTEXT.issubset(source_paths):
        raise ValueError("repository context files are incomplete")
    for name in TOP_LEVEL_SOURCE_COPIES:
        source_path = f"source/repository/{BRIDGE_REL.as_posix()}/{name}"
        if source_path not in payload or name not in payload:
            raise ValueError(f"bridge source/top-level copy is missing: {name}")
        if payload[source_path] != payload[name]:
            raise ValueError(f"bridge top-level copy differs from source snapshot: {name}")
    return source_paths


def _verify_git_snapshot(
    repo_root: Path,
    source_commit: str,
    source_tree: str,
    payload: dict[str, bytes],
    packaged_source_paths: list[str],
) -> dict[str, Any]:
    exists = subprocess.run(
        ["git", "cat-file", "-e", f"{source_commit}^{{commit}}"],
        cwd=repo_root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if exists.returncode != 0:
        return {"status": "source_commit_not_available", "contentIntegrity": "manifest_verified"}
    actual_tree = _run(["git", "rev-parse", f"{source_commit}^{{tree}}"], repo_root).stdout.strip()
    if actual_tree != source_tree:
        raise ValueError("package source tree does not match source commit")
    tracked = _run(["git", "ls-tree", "-r", "--name-only", source_commit], repo_root).stdout.splitlines()
    expected_paths = selected_source_paths(tracked)
    if packaged_source_paths != expected_paths:
        raise ValueError("packaged source path set differs from the fixed Git source commit")
    for path in expected_paths:
        result = subprocess.run(
            ["git", "show", f"{source_commit}:{path}"],
            cwd=repo_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode != 0:
            raise RuntimeError(f"could not read {path} from source commit")
        if payload[f"source/repository/{path}"] != result.stdout:
            raise ValueError(f"packaged source bytes differ from Git source commit: {path}")
    return {"status": "pass", "sourceCommit": source_commit, "sourceTree": source_tree}


def _verify_packaged_runtime(
    extracted_root: Path,
    metadata: dict[str, Any],
    validation: dict[str, Any],
) -> dict[str, Any]:
    source = extracted_root / "source/repository"
    farmland = source / "farmland-object-dna"
    intake = farmland / "research/r025-xiaoma-tlo-dem-intake/XIAOMA_TLO_DEM_INTAKE.json"
    checkpoint = farmland / "research/r025-xiaoma-tlo-dem-intake/FARMLAND_TLO_CHECKPOINT.json"
    intake_result = _run(
        [sys.executable, str(farmland / "tools/cross_mother_intake.py"), str(intake), str(checkpoint)],
        source,
    )
    parsed_intake = json.loads(intake_result.stdout)
    if (
        parsed_intake.get("intake", {}).get("ok") is not True
        or parsed_intake.get("checkpoint", {}).get("ok") is not True
    ):
        raise ValueError("packaged R025 intake/checkpoint validator did not pass")

    tests = _run(
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            str(farmland / "tools"),
            "-p",
            "test_*.py",
            "-v",
        ],
        source,
    )
    test_count = _parse_test_count(tests.stdout, tests.stderr)
    report_tests = _mapping(_mapping(validation.get("checks"), "validation.checks").get("unitTests"), "unitTests")
    if report_tests.get("status") != "pass" or report_tests.get("count") != test_count:
        raise ValueError("packaged test count differs from validation report")
    if metadata.get("unitTestCount") != test_count:
        raise ValueError("packaged test count differs from package metadata")
    if test_count < R025_BASELINE["test_count"]:
        raise ValueError("packaged tests regress below the R025 baseline")
    return {"status": "pass", "r025": "pass", "unitTestCount": test_count}


def verify_bridge_package(
    repo_root: Path,
    archive_path: Path,
    receipt_path: Path,
    sha_path: Path,
    *,
    run_runtime_tests: bool = True,
) -> dict[str, Any]:
    """Perform full cryptographic, source, semantic, and runtime verification."""

    receipt = load_json(receipt_path)
    archive_digest = sha256_file(archive_path)
    archive_bytes = archive_path.stat().st_size
    if receipt.get("schema") != RECEIPT_SCHEMA or receipt.get("bridgeId") != BRIDGE_ID:
        raise ValueError("bridge receipt identity changed")
    if receipt.get("archive") != ARCHIVE_NAME:
        raise ValueError("bridge receipt archive name changed")
    if receipt.get("archiveSha256") != archive_digest or receipt.get("archiveBytes") != archive_bytes:
        raise ValueError("bridge archive differs from external receipt")
    expected_sidecar = f"{archive_digest}  {ARCHIVE_NAME}\n"
    if sha_path.read_text(encoding="utf-8") != expected_sidecar:
        raise ValueError("external archive SHA256 sidecar mismatch")

    payload = _read_archive(archive_path)
    mandatory = TOP_LEVEL_SOURCE_COPIES | GENERATED_RECORDS
    missing = sorted(mandatory - set(payload))
    if missing:
        raise ValueError(f"mandatory package files missing: {missing}")

    contract = _json_from_payload(payload, "BRIDGE_CONTRACT.json")
    scope = _json_from_payload(payload, "PACKAGE_SCOPE.json")
    metadata = _json_from_payload(payload, "PACKAGE_METADATA.json")
    validation = _json_from_payload(payload, "VALIDATION_REPORT.json")
    manifest = _json_from_payload(payload, "PACKAGE_MANIFEST.json")
    contract_result = validate_bridge_contract(contract)
    scope_result = validate_package_scope(scope)

    if metadata.get("schema") != PACKAGE_SCHEMA or metadata.get("bridgeId") != BRIDGE_ID:
        raise ValueError("package metadata identity changed")
    if metadata.get("packageRoot") != PACKAGE_ROOT_NAME or metadata.get("archive") != ARCHIVE_NAME:
        raise ValueError("package root or archive identity changed")
    if metadata.get("gates") != EXPECTED_GATES:
        raise ValueError("package metadata gates changed")
    if validation.get("schema") != VALIDATION_SCHEMA or validation.get("bridgeId") != BRIDGE_ID:
        raise ValueError("validation report identity changed")
    if validation.get("overall") != "pass" or validation.get("gates") != EXPECTED_GATES:
        raise ValueError("validation report does not preserve closed gates")

    source_commit = metadata.get("sourceCommit")
    source_tree = metadata.get("sourceTree")
    if not isinstance(source_commit, str) or not re.fullmatch(r"[0-9a-f]{40}", source_commit):
        raise ValueError("invalid package source commit")
    if not isinstance(source_tree, str) or not re.fullmatch(r"[0-9a-f]{40}", source_tree):
        raise ValueError("invalid package source tree")
    for key, expected in {
        "packageRoot": PACKAGE_ROOT_NAME,
        "sourceCommit": source_commit,
        "sourceTree": source_tree,
        "payloadFileCount": len(payload),
        "unitTestCount": metadata.get("unitTestCount"),
        "validation": "pass",
        "visualAcceptance": False,
        "productionReady": False,
    }.items():
        if receipt.get(key) != expected:
            raise ValueError(f"receipt field does not match package: {key}")
    if receipt.get("r025BaselineCommit") != R025_BASELINE["commit"]:
        raise ValueError("receipt R025 baseline changed")

    manifest_result = _verify_manifest(payload, manifest)
    checksum_result = _verify_checksums(payload)
    packaged_source_paths = _verify_source_selection(payload, scope)
    if metadata.get("sourceSnapshotFileCount") != len(packaged_source_paths):
        raise ValueError("source snapshot file count differs from metadata")
    farmland_count = sum(path.startswith("farmland-object-dna/") for path in packaged_source_paths)
    if metadata.get("copiedFarmlandFileCount") != farmland_count:
        raise ValueError("Farmland source file count differs from metadata")
    if metadata.get("copiedRepositoryContextFileCount") != len(REPOSITORY_CONTEXT):
        raise ValueError("repository context count differs from metadata")

    git_result = _verify_git_snapshot(
        repo_root, source_commit, source_tree, payload, packaged_source_paths
    )

    json_count = 0
    for path, data in payload.items():
        if path.endswith(".json"):
            json.loads(data.decode("utf-8"))
            json_count += 1

    runtime_result: dict[str, Any] = {"status": "skipped"}
    if run_runtime_tests:
        with tempfile.TemporaryDirectory(prefix="farmland-r025-bridge-verify-") as temp_dir:
            temp = Path(temp_dir)
            with zipfile.ZipFile(archive_path, "r") as archive:
                archive.extractall(temp)
            runtime_result = _verify_packaged_runtime(
                temp / PACKAGE_ROOT_NAME, metadata, validation
            )

    return {
        "ok": True,
        "bridgeId": BRIDGE_ID,
        "archive": ARCHIVE_NAME,
        "archiveSha256": archive_digest,
        "archiveBytes": archive_bytes,
        "payloadFileCount": len(payload),
        "jsonFileCount": json_count,
        "contract": contract_result,
        "scope": scope_result,
        "manifest": manifest_result,
        "checksums": checksum_result,
        "gitSource": git_result,
        "runtime": runtime_result,
        "visualAcceptance": False,
        "productionReady": False,
    }


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def main() -> int:
    repo_root = _repo_root()
    default_bridge = repo_root / BRIDGE_REL
    default_dist = repo_root / DIST_REL
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, default=default_bridge / "BRIDGE_CONTRACT.json")
    parser.add_argument("--scope", type=Path, default=default_bridge / "PACKAGE_SCOPE.json")
    parser.add_argument("--contract-only", action="store_true")
    parser.add_argument("--archive", type=Path, default=default_dist / ARCHIVE_NAME)
    parser.add_argument("--receipt", type=Path, default=default_dist / RECEIPT_NAME)
    parser.add_argument("--sha256-file", type=Path, default=default_dist / SHA_NAME)
    parser.add_argument("--skip-runtime-tests", action="store_true")
    args = parser.parse_args()

    contract_result = validate_bridge_contract(load_json(args.contract))
    scope_result = validate_package_scope(load_json(args.scope))
    if args.contract_only:
        result = {
            "ok": True,
            "mode": "contract-only",
            "contract": contract_result,
            "scope": scope_result,
        }
    else:
        result = verify_bridge_package(
            repo_root,
            args.archive,
            args.receipt,
            args.sha256_file,
            run_runtime_tests=not args.skip_runtime_tests,
        )
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"BRIDGE_VERIFY_FAILED: {exc}", file=sys.stderr)
        raise
