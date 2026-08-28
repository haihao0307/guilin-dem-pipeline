#!/usr/bin/env python3
"""Resolve requested Wenzhou V200 labels from source-traceable OSM features.

Every resolved label must come from an OSM node, way centre or relation centre
inside the exact V200 AOI. Queries, raw responses, OSM element IDs, tags,
WGS84 coordinates, EPSG:32651 coordinates, hashes and selection scores are
preserved. Manual coordinates and edge clamping are prohibited.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/v200/config/osm_places_v200.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/v200/data/places/osm"
RAW_ROOT = DATA_ROOT / "raw"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/v200/reports"
ACQUISITION_REPORT = REPORT_ROOT / "OSM_PLACES_ACQUISITION.json"
QA_REPORT = REPORT_ROOT / "OSM_PLACES_QA.json"
RESOLUTION_PATH = DATA_ROOT / "WENZHOU_REQUESTED_LABELS_RESOLUTION.json"
CANDIDATES_WGS84 = DATA_ROOT / "WENZHOU_PLACE_CANDIDATES_WGS84.geojson"
RESOLVED_WGS84 = DATA_ROOT / "WENZHOU_REQUESTED_PLACES_WGS84.geojson"
RESOLVED_PROJECTED = DATA_ROOT / "WENZHOU_REQUESTED_PLACES_EPSG32651.geojson"

TAG_WEIGHTS = {
    "name": 100,
    "name:zh": 98,
    "official_name": 95,
    "short_name": 90,
    "alt_name": 80,
    "old_name": 70,
    "name:en": 60,
}
PLACE_WEIGHTS = {
    "city": 55,
    "town": 50,
    "village": 40,
    "suburb": 38,
    "borough": 36,
    "quarter": 32,
    "neighbourhood": 30,
    "hamlet": 25,
    "locality": 20,
}
EXPECTED_KIND_TAGS = {
    "city": ("place", "city"),
    "town": ("place", "town"),
    "village": ("place", "village"),
    "suburb": ("place", "suburb"),
    "locality": ("place", "locality"),
    "island": ("natural", "island"),
    "islet": ("natural", "islet"),
    "attraction": ("tourism", "attraction"),
    "administrative": ("boundary", "administrative"),
}


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temporary:
        temporary.write(content)
        temporary.flush()
        os.fsync(temporary.fileno())
        temporary_path = Path(temporary.name)
    try:
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def write_json(path: Path, payload: Any) -> None:
    atomic_write(
        path,
        (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8"),
    )


def write_deterministic_gzip(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with temporary_path.open("wb") as target:
            with gzip.GzipFile(filename="", mode="wb", fileobj=target, mtime=0) as compressed:
                compressed.write(content)
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(REPO_ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def tag_tokens(value: str) -> list[str]:
    return [
        normalize(token)
        for token in re.split(r"[;|/、]", value)
        if token.strip()
    ]


def overpass_query(
    bounds: list[float],
    aliases: list[str],
    tag_keys: list[str],
    timeout_seconds: int,
) -> str:
    west, south, east, north = bounds
    bbox = f"{south:.8f},{west:.8f},{north:.8f},{east:.8f}"
    pattern = "(?:" + "|".join(re.escape(alias) for alias in aliases) + ")"
    clauses = []
    for key in tag_keys:
        clauses.append(f'  nwr["{key}"~"{pattern}",i]({bbox});')
    return (
        f"[out:json][timeout:{timeout_seconds}];\n"
        "(\n"
        + "\n".join(clauses)
        + "\n);\n"
        "out center tags qt;\n"
    )


def request_overpass(
    target_id: str,
    endpoints: list[str],
    query: str,
    attempts_per_endpoint: int,
    pause_429: float,
    pause_other: float,
) -> tuple[bytes, dict[str, Any]]:
    encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
    attempts: list[dict[str, Any]] = []
    for round_index in range(attempts_per_endpoint):
        for endpoint in endpoints:
            started = time.monotonic()
            attempt_number = round_index + 1
            request = urllib.request.Request(
                endpoint,
                data=encoded,
                method="POST",
                headers={
                    "User-Agent": (
                        "WenzhouV200Places/1.0 "
                        "repository=haihao0307/guilin-dem-pipeline"
                    ),
                    "Referer": "https://github.com/haihao0307/guilin-dem-pipeline",
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=240) as response:
                    content = response.read()
                    status = int(getattr(response, "status", 200))
                    record = {
                        "targetId": target_id,
                        "endpoint": endpoint,
                        "attempt": attempt_number,
                        "httpStatus": status,
                        "contentType": response.headers.get("Content-Type", ""),
                        "contentLengthHeader": response.headers.get("Content-Length"),
                        "durationSeconds": time.monotonic() - started,
                    }
                    attempts.append(record)
                    if status != 200 or not content:
                        raise RuntimeError(f"Overpass returned HTTP {status} or no bytes")
                    prefix = content[:256].lstrip().lower()
                    if b"<html" in prefix or b"<!doctype" in prefix:
                        raise RuntimeError("Overpass returned HTML")
                    payload = json.loads(content)
                    if not isinstance(payload.get("elements"), list):
                        raise RuntimeError("Overpass JSON lacks elements")
                    return content, {
                        "selectedEndpoint": endpoint,
                        "selectedAttempt": attempt_number,
                        "attempts": attempts,
                    }
            except urllib.error.HTTPError as exc:
                code = int(exc.code)
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                attempts.append(
                    {
                        "targetId": target_id,
                        "endpoint": endpoint,
                        "attempt": attempt_number,
                        "error": "HTTPError",
                        "httpStatus": code,
                        "detail": str(exc),
                        "retryAfter": retry_after,
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                delay = pause_429 if code == 429 else pause_other
                if retry_after:
                    try:
                        delay = max(delay, float(retry_after))
                    except ValueError:
                        pass
                time.sleep(delay)
            except Exception as exc:
                attempts.append(
                    {
                        "targetId": target_id,
                        "endpoint": endpoint,
                        "attempt": attempt_number,
                        "error": type(exc).__name__,
                        "detail": str(exc),
                        "durationSeconds": time.monotonic() - started,
                    }
                )
                time.sleep(pause_other)
    raise RuntimeError(f"all Overpass endpoints failed for {target_id}: {attempts}")


def element_coordinate(element: dict[str, Any]) -> tuple[float, float] | None:
    if element.get("type") == "node" and "lon" in element and "lat" in element:
        return float(element["lon"]), float(element["lat"])
    center = element.get("center")
    if isinstance(center, dict) and "lon" in center and "lat" in center:
        return float(center["lon"]), float(center["lat"])
    return None


def candidate_score(
    target: dict[str, Any],
    tags: dict[str, str],
    match_keys: list[str],
    element_type: str,
) -> tuple[int, dict[str, int]]:
    alias_set = {normalize(alias) for alias in target["aliases"]}
    display = normalize(target["displayLabel"])
    components: dict[str, int] = {}
    components["tag"] = max(TAG_WEIGHTS[key] for key in match_keys)
    exact_display = any(
        display in tag_tokens(tags[key])
        for key in match_keys
        if key in tags
    )
    components["displayLabelExact"] = 25 if exact_display else 0
    place = tags.get("place")
    components["placeKind"] = PLACE_WEIGHTS.get(place, 0)
    expected = 0
    for kind in target.get("expectedKinds", []):
        tag_pair = EXPECTED_KIND_TAGS.get(kind)
        if tag_pair and tags.get(tag_pair[0]) == tag_pair[1]:
            expected = max(expected, 30)
    components["expectedKind"] = expected
    components["administrative"] = 18 if tags.get("boundary") == "administrative" else 0
    components["island"] = 45 if tags.get("natural") in {"island", "islet"} else 0
    components["node"] = 8 if element_type == "node" else 0
    has_exact_alias = any(
        token in alias_set
        for key in match_keys
        for token in tag_tokens(tags.get(key, ""))
    )
    components["exactAlias"] = 40 if has_exact_alias else -1000
    return sum(components.values()), components


def geojson_collection(features: list[dict[str, Any]], crs: str, metadata: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": metadata,
    }
    if crs != "EPSG:4326":
        result["crs"] = {"type": "name", "properties": {"name": crs}}
    return result


def main() -> int:
    generated = datetime.now(timezone.utc).isoformat()
    acquisition: dict[str, Any] = {
        "schema": "wenzhou_osm_places_acquisition@1.0.0",
        "generatedAtUtc": generated,
        "passed": False,
        "manualCoordinatesUsed": False,
        "edgeClampingUsed": False,
    }
    qa: dict[str, Any] = {
        "schema": "wenzhou_osm_places_qa@1.0.0",
        "generatedAtUtc": generated,
        "passed": False,
        "manualCoordinateCount": 0,
        "edgeClampingCount": 0,
    }

    try:
        from pyproj import Transformer

        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        source = config["source"]
        domain = config["domain"]
        query_config = config["query"]
        retry = config["retry"]
        selection = config["selection"]
        targets = config["targets"]

        if selection.get("allowManualCoordinates") is not False:
            raise RuntimeError("manual coordinates must remain disabled")
        if selection.get("allowEdgeClamping") is not False:
            raise RuntimeError("edge clamping must remain disabled")

        if DATA_ROOT.exists():
            import shutil

            shutil.rmtree(DATA_ROOT)
        REPORT_ROOT.mkdir(parents=True, exist_ok=True)
        for path in (ACQUISITION_REPORT, QA_REPORT):
            path.unlink(missing_ok=True)

        endpoints = [source["primaryEndpoint"], *source["fallbackEndpoints"]]
        transformer = Transformer.from_crs("EPSG:4326", domain["projectedCrs"], always_xy=True)
        west, south, east, north = [float(value) for value in domain["wgs84Bounds"]]
        min_x, min_y, max_x, max_y = [float(value) for value in domain["projectedBounds"]]

        target_records: list[dict[str, Any]] = []
        raw_files: list[dict[str, Any]] = []
        candidate_features: list[dict[str, Any]] = []
        resolved_wgs84_features: list[dict[str, Any]] = []
        resolved_projected_features: list[dict[str, Any]] = []

        for target_index, target in enumerate(targets):
            query = overpass_query(
                domain["wgs84Bounds"],
                target["aliases"],
                query_config["tagKeys"],
                int(query_config["timeoutSeconds"]),
            )
            content, transfer = request_overpass(
                target["id"],
                endpoints,
                query,
                int(retry["attemptsPerEndpoint"]),
                float(retry["http429PauseSeconds"]),
                float(retry["otherRetryPauseSeconds"]),
            )
            payload = json.loads(content)
            raw_path = RAW_ROOT / f"overpass_{target['id']}.json.gz"
            query_path = RAW_ROOT / f"overpass_{target['id']}.query.overpassql"
            write_deterministic_gzip(raw_path, content)
            atomic_write(query_path, query.encode("utf-8"))
            raw_record = file_record(raw_path, "raw_overpass_json_gzip")
            query_record = file_record(query_path, "overpass_query")
            raw_files.extend([raw_record, query_record])

            aliases = {normalize(alias) for alias in target["aliases"]}
            deduped: dict[tuple[str, int], dict[str, Any]] = {}
            for element in payload["elements"]:
                element_type = str(element.get("type"))
                if element_type not in {"node", "way", "relation"}:
                    continue
                coordinate = element_coordinate(element)
                if coordinate is None:
                    continue
                lon, lat = coordinate
                tags = {str(key): str(value) for key, value in (element.get("tags") or {}).items()}
                match_keys = []
                for key in query_config["tagKeys"]:
                    if key not in tags:
                        continue
                    if any(token in aliases for token in tag_tokens(tags[key])):
                        match_keys.append(key)
                if not match_keys:
                    continue
                inside_wgs84 = west <= lon <= east and south <= lat <= north
                x, y = transformer.transform(lon, lat)
                inside_projected = min_x - 1e-6 <= x <= max_x + 1e-6 and min_y - 1e-6 <= y <= max_y + 1e-6
                score, components = candidate_score(target, tags, match_keys, element_type)
                key = (element_type, int(element["id"]))
                candidate = {
                    "targetId": target["id"],
                    "displayLabel": target["displayLabel"],
                    "sourceElementType": element_type,
                    "sourceElementId": int(element["id"]),
                    "sourceName": tags.get("name") or tags.get("name:zh") or tags.get("official_name"),
                    "matchedTagKeys": match_keys,
                    "tags": tags,
                    "wgs84": [lon, lat],
                    "projected": [x, y],
                    "insideWgs84Aoi": inside_wgs84,
                    "insideProjectedAoi": inside_projected,
                    "score": score,
                    "scoreComponents": components,
                    "manualCoordinate": False,
                    "edgeClamped": False,
                }
                previous = deduped.get(key)
                if previous is None or candidate["score"] > previous["score"]:
                    deduped[key] = candidate

            candidates = sorted(
                deduped.values(),
                key=lambda item: (-item["score"], item["sourceElementType"], item["sourceElementId"]),
            )
            eligible = [
                candidate
                for candidate in candidates
                if candidate["insideWgs84Aoi"] and candidate["insideProjectedAoi"]
            ]

            status = "unresolved"
            selected: dict[str, Any] | None = None
            if eligible:
                top_score = eligible[0]["score"]
                top = [candidate for candidate in eligible if candidate["score"] == top_score]
                if len(top) == 1:
                    status = "resolved"
                    selected = top[0]
                else:
                    status = "ambiguous"

            target_record = {
                "targetId": target["id"],
                "displayLabel": target["displayLabel"],
                "aliases": target["aliases"],
                "expectedKinds": target.get("expectedKinds", []),
                "status": status,
                "candidateCount": len(candidates),
                "eligibleCandidateCount": len(eligible),
                "selected": selected,
                "candidates": candidates,
                "querySha256": sha256_bytes(query.encode("utf-8")),
                "rawUncompressedBytes": len(content),
                "rawUncompressedSha256": sha256_bytes(content),
                "rawCompressed": raw_record,
                "queryFile": query_record,
                "osmGenerator": payload.get("generator"),
                "osmVersion": payload.get("version"),
                "osm3s": payload.get("osm3s"),
                "transfer": transfer,
            }
            target_records.append(target_record)

            for candidate in candidates:
                candidate_features.append(
                    {
                        "type": "Feature",
                        "id": f"{candidate['sourceElementType']}/{candidate['sourceElementId']}/{target['id']}",
                        "properties": {key: value for key, value in candidate.items() if key not in {"wgs84", "projected"}},
                        "geometry": {"type": "Point", "coordinates": candidate["wgs84"]},
                    }
                )

            if selected is not None:
                properties = {
                    "target_id": target["id"],
                    "display_label": target["displayLabel"],
                    "source_name": selected["sourceName"],
                    "source_element_type": selected["sourceElementType"],
                    "source_element_id": selected["sourceElementId"],
                    "matched_tag_keys": selected["matchedTagKeys"],
                    "score": selected["score"],
                    "tags": selected["tags"],
                    "manual_coordinate": False,
                    "edge_clamped": False,
                }
                resolved_wgs84_features.append(
                    {
                        "type": "Feature",
                        "id": target["id"],
                        "properties": properties,
                        "geometry": {"type": "Point", "coordinates": selected["wgs84"]},
                    }
                )
                resolved_projected_features.append(
                    {
                        "type": "Feature",
                        "id": target["id"],
                        "properties": properties,
                        "geometry": {"type": "Point", "coordinates": selected["projected"]},
                    }
                )

            if target_index < len(targets) - 1:
                time.sleep(float(retry["secondsBetweenTargets"]))

        common_metadata = {
            "source": "OpenStreetMap Overpass API",
            "license": source["license"],
            "attribution": source["attribution"],
            "generatedAtUtc": generated,
            "truthCogSha256": domain["truthCogSha256"],
            "manualCoordinatesUsed": False,
            "edgeClampingUsed": False,
        }
        write_json(
            CANDIDATES_WGS84,
            geojson_collection(candidate_features, "EPSG:4326", common_metadata),
        )
        write_json(
            RESOLVED_WGS84,
            geojson_collection(resolved_wgs84_features, "EPSG:4326", common_metadata),
        )
        write_json(
            RESOLVED_PROJECTED,
            geojson_collection(resolved_projected_features, domain["projectedCrs"], common_metadata),
        )
        resolution = {
            "schema": "wenzhou_requested_labels_resolution@1.0.0",
            "generatedAtUtc": generated,
            "truthCogSha256": domain["truthCogSha256"],
            "manualCoordinatesUsed": False,
            "edgeClampingUsed": False,
            "targets": target_records,
        }
        write_json(RESOLUTION_PATH, resolution)

        output_files = [
            file_record(CANDIDATES_WGS84, "place_candidates_wgs84"),
            file_record(RESOLVED_WGS84, "resolved_places_wgs84"),
            file_record(RESOLVED_PROJECTED, "resolved_places_projected"),
            file_record(RESOLUTION_PATH, "requested_labels_resolution"),
        ]
        resolved = [record for record in target_records if record["status"] == "resolved"]
        ambiguous = [record for record in target_records if record["status"] == "ambiguous"]
        unresolved = [record for record in target_records if record["status"] == "unresolved"]
        unresolved_ids = [record["targetId"] for record in unresolved]
        ambiguous_ids = [record["targetId"] for record in ambiguous]
        required_unresolved = [
            record["targetId"]
            for record in target_records
            if record["status"] != "resolved" and record["targetId"] != "natural_island"
        ]
        out_of_bounds_resolved = [
            record["targetId"]
            for record in resolved
            if not record["selected"]["insideProjectedAoi"]
        ]
        source_id_missing = [
            record["targetId"]
            for record in resolved
            if record["selected"].get("sourceElementId") is None
        ]
        acquisition_passed = len(target_records) == len(targets) and len(raw_files) == 2 * len(targets)
        qa_passed = (
            acquisition_passed
            and not required_unresolved
            and not out_of_bounds_resolved
            and not source_id_missing
            and not ambiguous_ids
        )

        acquisition.update(
            {
                "passed": acquisition_passed,
                "project": config["project"],
                "source": source,
                "domain": domain,
                "targetCount": len(targets),
                "targets": target_records,
                "rawFiles": raw_files,
                "outputFiles": output_files,
                "license": source["license"],
                "attribution": source["attribution"],
            }
        )
        qa.update(
            {
                "passed": qa_passed,
                "project": config["project"],
                "truthCogSha256": domain["truthCogSha256"],
                "requestedTargetCount": len(targets),
                "resolvedCount": len(resolved),
                "resolvedTargetIds": [record["targetId"] for record in resolved],
                "unresolvedCount": len(unresolved),
                "unresolvedTargetIds": unresolved_ids,
                "ambiguousCount": len(ambiguous),
                "ambiguousTargetIds": ambiguous_ids,
                "requiredUnresolvedTargetIds": required_unresolved,
                "outOfBoundsResolvedTargetIds": out_of_bounds_resolved,
                "sourceIdMissingTargetIds": source_id_missing,
                "naturalIslandMayRemainUnresolved": config["qa"]["naturalIslandMayRemainUnresolved"],
                "manualCoordinateCount": 0,
                "edgeClampingCount": 0,
                "files": output_files,
            }
        )
    except Exception as exc:
        acquisition["error"] = type(exc).__name__
        acquisition["detail"] = str(exc)
        qa["error"] = "osm_places_acquisition_or_resolution_failed"
        qa["detail"] = str(exc)

    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    write_json(ACQUISITION_REPORT, acquisition)
    write_json(QA_REPORT, qa)
    print(json.dumps({"acquisition": acquisition, "qa": qa}, ensure_ascii=False, indent=2))
    return 0 if acquisition.get("passed") and qa.get("passed") else 2


if __name__ == "__main__":
    sys.exit(main())
