from __future__ import annotations

import argparse
import hashlib
import http.cookiejar
import json
import math
import os
import re
import shutil
import ssl
import sys
import tarfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

from common import read_json, sha256_file, utc_now, write_json

USER_AGENT = "Haihao-DEM-Pipeline/1.0 (+ASF ALOS PALSAR RTC reference DEM)"
CHUNK_SIZE = 4 * 1024 * 1024
NUMBER_RE = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?")
DEM_RE = re.compile(r"(?i)(?:\.dem\.tif|_dem\.tif)(?:$|[?#])")
XML_RE = re.compile(r"(?i)(?:\.iso\.xml|\.xml)(?:$|[?#])")
ARCHIVE_RE = re.compile(r"(?i)\.(?:zip|tar|tgz|tar\.gz)(?:$|[?#])")


class PipelineError(RuntimeError):
    pass


@dataclass
class Candidate:
    key: str
    item: dict[str, Any]
    polygon: list[tuple[float, float]]
    coverage: set[int]
    urls: dict[str, Any]
    excluded_existing: bool


def safe_filename_from_url(url: str, fallback: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    name = urllib.parse.unquote(Path(parsed.path).name).strip()
    if not name:
        name = fallback
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip(" .")
    return name or fallback


def iter_strings(value: Any) -> Iterator[str]:
    if value is None:
        return
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from iter_strings(item)
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            yield from iter_strings(item)


def is_url(value: str) -> bool:
    return value.startswith(("https://", "http://"))


def is_dem_url(value: str) -> bool:
    return is_url(value) and DEM_RE.search(value) is not None


def is_metadata_url(value: str) -> bool:
    return is_url(value) and XML_RE.search(value) is not None


def is_archive_url(value: str) -> bool:
    return is_url(value) and ARCHIVE_RE.search(value) is not None


def is_dem_name(value: str) -> bool:
    return DEM_RE.search(value) is not None


def item_urls(item: dict[str, Any]) -> dict[str, Any]:
    granule = str(item.get("gn") or item.get("granuleName") or item.get("granule_name") or "")
    dem: list[str] = []
    metadata: list[str] = []
    archives: list[str] = []
    other_downloads: list[str] = []

    for raw in iter_strings(item):
        value = raw.replace("{gn}", granule).strip()
        if not is_url(value):
            continue
        if is_dem_url(value):
            dem.append(value)
        elif is_metadata_url(value):
            metadata.append(value)
        elif is_archive_url(value):
            archives.append(value)
        elif any(token in value.lower() for token in ("download", "datapool.asf.alaska.edu", "urs.earthdata.nasa.gov")):
            other_downloads.append(value)

    for key in ("url", "downloadUrl", "download_url", "du", "u"):
        value = item.get(key)
        if isinstance(value, str) and is_url(value):
            expanded = value.replace("{gn}", granule)
            if expanded not in dem and expanded not in metadata and expanded not in archives:
                if is_dem_url(expanded):
                    dem.append(expanded)
                elif is_metadata_url(expanded):
                    metadata.append(expanded)
                elif is_archive_url(expanded):
                    archives.append(expanded)
                else:
                    other_downloads.append(expanded)

    archive = archives[0] if archives else (other_downloads[0] if other_downloads else None)
    return {
        "dem": sorted(set(dem)),
        "metadata": sorted(set(metadata)),
        "archives": sorted(set(archives)),
        "archive": archive,
        "otherDownloads": sorted(set(other_downloads)),
    }


def parse_wkt_polygon(value: Any) -> list[tuple[float, float]]:
    if not isinstance(value, str):
        return []
    numbers = [float(token) for token in NUMBER_RE.findall(value)]
    if len(numbers) < 6:
        return []
    points = list(zip(numbers[0::2], numbers[1::2]))
    clean: list[tuple[float, float]] = []
    for point in points:
        if not clean or point != clean[-1]:
            clean.append(point)
    if len(clean) >= 3 and clean[0] != clean[-1]:
        clean.append(clean[0])
    return clean


def point_in_polygon(point: tuple[float, float], polygon: Sequence[tuple[float, float]]) -> bool:
    if len(polygon) < 3:
        return False
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)):
            denominator = yj - yi
            if abs(denominator) < 1e-15:
                denominator = 1e-15
            x_cross = (xj - xi) * (y - yi) / denominator + xi
            if x < x_cross:
                inside = not inside
        j = i
    return inside


def make_samples(polygon: Sequence[tuple[float, float]], grid_size: int) -> list[tuple[float, float]]:
    xs = [point[0] for point in polygon]
    ys = [point[1] for point in polygon]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    samples: list[tuple[float, float]] = []
    for row in range(grid_size):
        y = miny + (row + 0.5) / grid_size * (maxy - miny)
        for column in range(grid_size):
            x = minx + (column + 0.5) / grid_size * (maxx - minx)
            if point_in_polygon((x, y), polygon):
                samples.append((x, y))
    if not samples:
        raise PipelineError("AOI sampling produced no points")
    return samples


def footprint_sample_set(polygon: Sequence[tuple[float, float]], samples: Sequence[tuple[float, float]]) -> set[int]:
    if len(polygon) < 3:
        return set()
    xs = [point[0] for point in polygon]
    ys = [point[1] for point in polygon]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    result = set()
    for index, point in enumerate(samples):
        if minx <= point[0] <= maxx and miny <= point[1] <= maxy and point_in_polygon(point, polygon):
            result.add(index)
    return result


def candidate_key(item: dict[str, Any]) -> str:
    path = item.get("p") or item.get("path") or ""
    frame = item.get("f") or item.get("frame") or ""
    if path or frame:
        return f"{path}:{frame}"
    return str(item.get("gn") or item.get("granuleName") or item.get("granule_name") or id(item))


def granule_name(item: dict[str, Any]) -> str:
    return str(item.get("gn") or item.get("granuleName") or item.get("granule_name") or candidate_key(item))


def choose_group_representative(items: list[dict[str, Any]]) -> dict[str, Any]:
    def score(item: dict[str, Any]) -> tuple[int, int, str]:
        urls = item_urls(item)
        return (1 if urls["dem"] else 0, 1 if urls["metadata"] else 0, str(item.get("st") or ""))
    return max(items, key=score)


def normalized_stem(name: str) -> str:
    lower = name.lower()
    for suffix in (".dem.tif", "_dem.tif", ".tif", ".zip"):
        if lower.endswith(suffix):
            return name[: -len(suffix)].lower()
    return lower


def candidate_matches_existing(item: dict[str, Any], urls: dict[str, Any], existing_stems: set[str]) -> bool:
    values = [granule_name(item)]
    values.extend(urls.get("dem", []))
    values.extend(urls.get("archives", []))
    for value in values:
        basename = safe_filename_from_url(value, value) if is_url(value) else Path(value).name
        stem = normalized_stem(basename)
        if any(existing in stem or stem in existing for existing in existing_stems):
            return True
    return False


def select_products(
    results: list[dict[str, Any]],
    aoi_polygon: list[tuple[float, float]],
    existing_polygons: list[list[tuple[float, float]]],
    existing_stems: set[str],
    target_fraction: float,
    max_selected: int,
    grid_size: int,
) -> tuple[list[Candidate], dict[str, Any]]:
    samples = make_samples(aoi_polygon, grid_size)
    all_ids = set(range(len(samples)))
    existing_coverage: set[int] = set()
    for polygon in existing_polygons:
        existing_coverage.update(footprint_sample_set(polygon, samples))

    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in results:
        grouped.setdefault(candidate_key(item), []).append(item)
    representatives = [choose_group_representative(group) for group in grouped.values()]

    candidates: list[Candidate] = []
    for item in representatives:
        polygon = parse_wkt_polygon(item.get("w") or item.get("wkt") or item.get("footprint"))
        urls = item_urls(item)
        excluded = candidate_matches_existing(item, urls, existing_stems)
        candidates.append(
            Candidate(
                key=candidate_key(item),
                item=item,
                polygon=polygon,
                coverage=footprint_sample_set(polygon, samples),
                urls=urls,
                excluded_existing=excluded,
            )
        )

    covered = set(existing_coverage)
    selected: list[Candidate] = []
    while len(selected) < max_selected:
        current_fraction = len(covered) / len(all_ids)
        if current_fraction >= target_fraction:
            break
        best: Candidate | None = None
        best_gain = 0
        for candidate in candidates:
            if candidate.excluded_existing or candidate in selected:
                continue
            gain = len(candidate.coverage - covered)
            if gain > best_gain:
                best = candidate
                best_gain = gain
        if best is None or best_gain <= 0:
            break
        selected.append(best)
        covered.update(best.coverage)
        print(
            f"新增选片 {len(selected)}：{granule_name(best.item)}，"
            f"累计近似覆盖 {len(covered) / len(all_ids):.3%}"
        )

    diagnostics = {
        "sampleCount": len(samples),
        "searchResultCount": len(results),
        "uniquePathFrameCount": len(grouped),
        "representativeCount": len(representatives),
        "existingCoverageFraction": len(existing_coverage) / len(all_ids),
        "selectedNewCount": len(selected),
        "selectedCoverageFraction": len(covered) / len(all_ids),
        "targetCoverageFraction": target_fraction,
        "uncoveredSampleCount": len(all_ids - covered),
        "excludedExistingCandidateCount": sum(1 for candidate in candidates if candidate.excluded_existing),
        "gridSize": grid_size,
    }
    if diagnostics["selectedCoverageFraction"] < target_fraction:
        raise PipelineError(
            "ASF 搜索结果无法达到目标覆盖率。"
            f"当前 {diagnostics['selectedCoverageFraction']:.3%}，"
            f"目标 {target_fraction:.3%}。"
        )
    return selected, diagnostics


class BearerRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, token: str):
        super().__init__()
        self.authorization = f"Bearer {token}"

    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> Any:
        request = super().redirect_request(req, fp, code, msg, headers, newurl)
        if request is not None:
            request.add_unredirected_header("Authorization", self.authorization)
            request.add_header("User-Agent", USER_AGENT)
        return request


def build_opener(token: str) -> urllib.request.OpenerDirector:
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookie_jar),
        BearerRedirectHandler(token),
    )
    opener.addheaders = [
        ("Authorization", f"Bearer {token}"),
        ("User-Agent", USER_AGENT),
        ("Accept", "*/*"),
    ]
    return opener


def request_json(url: str, timeout: int = 300) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
        text = response.read().decode("utf-8")
    parsed = json.loads(text)
    if isinstance(parsed, list):
        return {"results": parsed}
    if not isinstance(parsed, dict):
        raise PipelineError("ASF search response has an unexpected JSON type")
    return parsed


def validate_downloaded_file(path: Path, expected_kind: str) -> None:
    if not path.exists() or path.stat().st_size <= 0:
        raise PipelineError(f"Downloaded file is empty: {path.name}")
    with path.open("rb") as stream:
        head = stream.read(16)
    if expected_kind == "dem":
        signatures = (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+")
        if not any(head.startswith(signature) for signature in signatures):
            raise PipelineError(f"Downloaded response is not a TIFF DEM: {path.name}")
    elif expected_kind == "archive":
        if not (head.startswith(b"PK\x03\x04") or tarfile.is_tarfile(path)):
            raise PipelineError(f"Downloaded response is not a supported archive: {path.name}")


def download_file(
    opener: urllib.request.OpenerDirector,
    url: str,
    target: Path,
    expected_kind: str,
    timeout: int,
) -> dict[str, Any]:
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part")
    if target.exists() and target.stat().st_size > 0:
        validate_downloaded_file(target, expected_kind)
        return {
            "url": url,
            "file": str(target),
            "bytes": target.stat().st_size,
            "sha256": sha256_file(target),
            "resumed": False,
            "skippedExisting": True,
        }

    existing = partial.stat().st_size if partial.exists() else 0
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    authorization = next((value for key, value in opener.addheaders if key.lower() == "authorization"), "")
    if authorization:
        headers["Authorization"] = authorization
    if existing:
        headers["Range"] = f"bytes={existing}-"
    request = urllib.request.Request(url, headers=headers)
    try:
        response = opener.open(request, timeout=timeout)
    except urllib.error.HTTPError as exc:
        if exc.code == 416 and partial.exists():
            partial.replace(target)
            validate_downloaded_file(target, expected_kind)
            return {
                "url": url,
                "file": str(target),
                "bytes": target.stat().st_size,
                "sha256": sha256_file(target),
                "resumed": True,
                "skippedExisting": False,
            }
        details = exc.read(4096).decode("utf-8", errors="replace")
        if exc.code in (401, 403):
            raise PipelineError(f"Earthdata authorization failed for {target.name}, HTTP {exc.code}") from exc
        raise PipelineError(f"Download HTTP {exc.code}: {details}") from exc
    except urllib.error.URLError as exc:
        raise PipelineError(f"Download connection failed for {target.name}: {exc.reason}") from exc

    with response:
        status = getattr(response, "status", response.getcode())
        append = existing > 0 and status == 206
        if existing and not append:
            existing = 0
        mode = "ab" if append else "wb"
        remaining = response.headers.get("Content-Length")
        total = (int(remaining) if remaining and remaining.isdigit() else 0) + existing
        downloaded = existing
        started = time.monotonic()
        last_display = 0.0
        with partial.open(mode) as stream:
            while True:
                block = response.read(CHUNK_SIZE)
                if not block:
                    break
                stream.write(block)
                downloaded += len(block)
                now = time.monotonic()
                if now - last_display >= 0.8:
                    elapsed = max(now - started, 0.001)
                    rate = max(downloaded - existing, 0) / elapsed / (1024 * 1024)
                    if total:
                        percent = downloaded / total * 100
                        message = f"\r下载 {target.name}: {percent:6.2f}% {downloaded / (1024 * 1024):,.1f} MiB {rate:,.1f} MiB/s"
                    else:
                        message = f"\r下载 {target.name}: {downloaded / (1024 * 1024):,.1f} MiB {rate:,.1f} MiB/s"
                    sys.stdout.write(message)
                    sys.stdout.flush()
                    last_display = now
        sys.stdout.write("\n")
        sys.stdout.flush()
    partial.replace(target)
    validate_downloaded_file(target, expected_kind)
    return {
        "url": url,
        "file": str(target),
        "bytes": target.stat().st_size,
        "sha256": sha256_file(target),
        "resumed": append,
        "skippedExisting": False,
    }


def extract_dem_from_archive(archive_path: Path, dem_dir: Path, excluded_names: set[str]) -> list[Path]:
    dem_dir.mkdir(parents=True, exist_ok=True)
    extracted: list[Path] = []

    def copy_member(name: str, source: Any) -> None:
        basename = Path(name).name
        if not is_dem_name(basename) or basename.lower() in excluded_names:
            return
        target = dem_dir / basename
        if target.exists() and target.stat().st_size > 0:
            validate_downloaded_file(target, "dem")
            extracted.append(target)
            return
        with target.open("wb") as destination:
            shutil.copyfileobj(source, destination)
        validate_downloaded_file(target, "dem")
        extracted.append(target)

    if zipfile.is_zipfile(archive_path):
        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.infolist():
                if member.is_dir() or ".." in Path(member.filename).parts or Path(member.filename).is_absolute():
                    continue
                if is_dem_name(Path(member.filename).name):
                    with archive.open(member) as source:
                        copy_member(member.filename, source)
    elif tarfile.is_tarfile(archive_path):
        with tarfile.open(archive_path) as archive:
            for member in archive.getmembers():
                if not member.isfile() or ".." in Path(member.name).parts or Path(member.name).is_absolute():
                    continue
                if not is_dem_name(Path(member.name).name):
                    continue
                source = archive.extractfile(member)
                if source is not None:
                    with source:
                        copy_member(member.name, source)
    return extracted


def build_search_url(config: dict[str, Any], resolved_aoi: dict[str, Any]) -> str:
    params = {
        "dataset": config["source"]["dataset"],
        "processingLevel": ",".join(config["source"]["processingLevel"]),
        "intersectsWith": resolved_aoi["search"]["envelopeWkt"],
        "maxResults": int(config["search"]["maxResults"]),
        "output": "jsonlite2",
    }
    return str(config["search"]["endpoint"]) + "?" + urllib.parse.urlencode(params)


def selected_record(order: int, candidate: Candidate) -> dict[str, Any]:
    item = candidate.item
    return {
        "selectionOrder": order,
        "key": candidate.key,
        "granuleName": granule_name(item),
        "path": item.get("p") or item.get("path"),
        "frame": item.get("f") or item.get("frame"),
        "beamMode": item.get("bm") or item.get("beamMode"),
        "flightDirection": item.get("fd") or item.get("flightDirection"),
        "startTime": item.get("st") or item.get("startTime"),
        "wkt": item.get("w") or item.get("wkt"),
        "directDemUrls": candidate.urls["dem"],
        "metadataUrls": candidate.urls["metadata"],
        "archiveUrl": candidate.urls["archive"],
        "sampleCoverageCount": len(candidate.coverage),
    }


def run(config_path: Path, root: Path, search_fixture: Path | None, plan_only: bool) -> int:
    config = read_json(config_path)
    resolved_aoi = read_json(root / config["outputs"]["resolvedAoiJson"])
    if resolved_aoi.get("status") != "exact_boundary_resolved":
        raise PipelineError(
            "The exact Yangshuo Pingle shared boundary has not been resolved. "
            "Run build_boundary_stdlib.py online before creating an ASF plan."
        )
    existing_manifest = read_json(config_path.parent / "existing_five_manifest.json")
    existing_resolved_path = root / config["outputs"]["existingResolved"]
    existing_resolved = read_json(existing_resolved_path) if existing_resolved_path.exists() else None

    target_polygon = [(float(x), float(y)) for x, y in resolved_aoi["final"]["wgs84Polygon"]]
    resolved_entries = []
    if bool(config.get("search", {}).get("initialCoverageFromExistingFive", True)) and isinstance(existing_resolved, dict):
        for entry in existing_resolved.get("files", []):
            resolved_path = Path(str(entry.get("resolvedPath", "")))
            if resolved_path.is_file():
                resolved_entries.append(entry)
    resolved_names = {str(entry.get("file", "")).lower() for entry in resolved_entries}
    manifest_by_name = {str(entry["file"]).lower(): entry for entry in existing_manifest["files"]}
    existing_polygons = [
        [(float(x), float(y)) for x, y in manifest_by_name[name]["wgs84Polygon"]]
        for name in sorted(resolved_names)
        if name in manifest_by_name
    ]
    existing_names = set(resolved_names)
    existing_stems = {normalized_stem(name) for name in existing_names}

    search_url = build_search_url(config, resolved_aoi)
    print("开始 ASF SearchAPI 检索。")
    if search_fixture is not None:
        payload = read_json(search_fixture)
    else:
        payload = request_json(search_url, timeout=360)
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        raise PipelineError("ASF search returned no RTC_HI_RES products for the task AOI")

    metadata_dir = root / "metadata"
    raw_dem_dir = root / "data" / "raw" / "dem"
    archive_dir = root / "data" / "raw" / "archives"
    metadata_download_dir = root / "data" / "raw" / "metadata"
    for directory in (metadata_dir, raw_dem_dir, archive_dir, metadata_download_dir, root / "reports"):
        directory.mkdir(parents=True, exist_ok=True)
    write_json(metadata_dir / "asf_search_results_jsonlite2.json", payload)

    selected, diagnostics = select_products(
        results=results,
        aoi_polygon=target_polygon,
        existing_polygons=existing_polygons,
        existing_stems=existing_stems,
        target_fraction=float(config["search"]["minimumCoverageFraction"]),
        max_selected=int(config["search"]["maxSelectedProducts"]),
        grid_size=int(config["search"]["gridSize"]),
    )
    records = [selected_record(index, candidate) for index, candidate in enumerate(selected, start=1)]
    plan = {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now(),
        "searchUrlWithoutToken": search_url,
        "searchDiagnostics": diagnostics,
        "existingFiveExcludedFromDownload": sorted(existing_names),
        "selectedNewProducts": records,
    }
    plan_path = root / config["outputs"]["downloadPlan"]
    write_json(plan_path, plan)
    print(f"新增下载计划：{plan_path}")

    if plan_only:
        return 0

    token_name = config["download"]["tokenEnvironmentVariable"]
    token = os.environ.get(token_name, "").strip()
    if not token:
        raise PipelineError(f"Environment variable {token_name} is empty")
    opener = build_opener(token)
    timeout = int(config["download"].get("timeoutSeconds", 900))

    print(f"准备下载 {len(selected)} 个新增覆盖产品。")
    download_records: list[dict[str, Any]] = []
    extracted_records: list[dict[str, Any]] = []
    attempted_targets: set[str] = set()
    attempted_metadata: set[str] = set()

    for candidate_index, candidate in enumerate(selected, start=1):
        candidate_name = granule_name(candidate.item)
        print(f"[{candidate_index}/{len(selected)}] 新增产品：{candidate_name}")
        direct_success = False
        direct_errors: list[dict[str, str]] = []

        for url in candidate.urls["dem"]:
            name = safe_filename_from_url(url, f"{candidate_name}.dem.tif")
            lower_name = name.lower()
            if lower_name in existing_names:
                continue
            target = raw_dem_dir / name
            if lower_name in attempted_targets and target.exists():
                direct_success = True
                continue
            attempted_targets.add(lower_name)
            print(f"准备下载新增 DEM：{name}")
            try:
                record = download_file(opener, url, target, "dem", timeout)
                record["kind"] = "dem"
                record["granuleName"] = candidate_name
                download_records.append(record)
                direct_success = True
            except Exception as exc:
                error = {"url": url, "file": str(target), "error": str(exc)}
                direct_errors.append(error)
                download_records.append({"kind": "dem_error", "granuleName": candidate_name, **error})
                print(f"直接 DEM 下载失败，准备使用产品包回退：{exc}")

        if config["download"].get("downloadMetadataXml", True):
            for url in candidate.urls["metadata"]:
                name = safe_filename_from_url(url, f"{candidate_name}.xml")
                lower_name = name.lower()
                if lower_name in attempted_metadata:
                    continue
                attempted_metadata.add(lower_name)
                print(f"准备下载元数据：{name}")
                try:
                    record = download_file(opener, url, metadata_download_dir / name, "metadata", timeout)
                    record["kind"] = "metadata"
                    record["granuleName"] = candidate_name
                    download_records.append(record)
                except Exception as exc:
                    print(f"元数据下载失败，DEM 主流程继续：{exc}")
                    download_records.append(
                        {
                            "kind": "metadata_error",
                            "granuleName": candidate_name,
                            "url": url,
                            "file": str(metadata_download_dir / name),
                            "error": str(exc),
                        }
                    )

        if not direct_success:
            archive_url = candidate.urls.get("archive")
            if not archive_url:
                detail = direct_errors[-1]["error"] if direct_errors else "no direct DEM URL was exposed"
                raise PipelineError(f"{candidate_name} has no usable DEM transfer path: {detail}")
            fallback_name = candidate_name
            if not fallback_name.lower().endswith((".zip", ".tar", ".tgz", ".tar.gz")):
                fallback_name += ".zip"
            archive_name = safe_filename_from_url(archive_url, fallback_name)
            archive_target = archive_dir / archive_name
            print(f"准备下载新增产品包：{archive_name}")
            record = download_file(opener, archive_url, archive_target, "archive", timeout)
            record["kind"] = "archive"
            record["granuleName"] = candidate_name
            download_records.append(record)
            extracted = extract_dem_from_archive(archive_target, raw_dem_dir, existing_names)
            if not extracted:
                raise PipelineError(f"产品包中没有可用的新增 DEM：{archive_name}")
            for path in extracted:
                attempted_targets.add(path.name.lower())
                extracted_records.append(
                    {
                        "granuleName": candidate_name,
                        "archive": str(archive_target),
                        "file": str(path),
                        "bytes": path.stat().st_size,
                        "sha256": sha256_file(path),
                    }
                )

    new_dem_files = sorted(
        path for path in raw_dem_dir.glob("*") if path.is_file() and is_dem_name(path.name) and path.name.lower() not in existing_names
    )
    if selected and not new_dem_files:
        raise PipelineError("选中了新增产品，但没有得到任何新增 *.dem.tif")

    manifest = {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now(),
        "project": config["project"],
        "source": config["source"],
        "search": diagnostics,
        "selectedProducts": records,
        "existingFive": existing_resolved,
        "downloads": download_records,
        "extractedFromArchives": extracted_records,
        "newDemFiles": [
            {
                "file": str(path),
                "name": path.name,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
            for path in new_dem_files
        ],
    }
    write_json(root / config["outputs"]["sourceManifest"], manifest)
    write_json(
        root / "reports" / "DOWNLOAD_STATUS.json",
        {
            "generatedAt": utc_now(),
            "status": "new_dem_download_complete",
            "newDemFileCount": len(new_dem_files),
            "selectedCoverageFraction": diagnostics["selectedCoverageFraction"],
            "rawDemDirectory": str(raw_dem_dir),
        },
    )
    write_json(
        root / "metadata" / "runtime_source.json",
        {
            "mode": "asf_rtc_hi_res",
            "status": "authoritative_project_reference_source",
            "productLabel": "ASF RTC 12.5米参考DEM",
            "provider": "NASA ASF DAAC",
            "dataset": "ALOS PALSAR RTC_HI_RES ancillary DEM",
            "outputPixelSpacingMeters": float(config["processing"]["outputPixelSpacingMeters"]),
            "native12_5mSurveyClaim": False,
            "temporaryFallback": False,
        },
    )
    print(f"新增 DEM 下载完成，共 {len(new_dem_files)} 张。")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Incremental ASF RTC DEM downloader")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--search-fixture")
    parser.add_argument("--plan-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run(
            Path(args.config).resolve(),
            Path(args.root).resolve(),
            Path(args.search_fixture).resolve() if args.search_fixture else None,
            bool(args.plan_only),
        )
    except KeyboardInterrupt:
        print("\n任务被用户中断。", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
