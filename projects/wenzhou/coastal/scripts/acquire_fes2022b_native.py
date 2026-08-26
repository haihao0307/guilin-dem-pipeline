#!/usr/bin/env python3
"""Acquire and inspect the licensed FES2022b native ocean-tide mesh.

The licensed source file is kept outside the repository.  Only metadata,
hashes and a PyFES configuration derived from the file's actual NetCDF
structure may be written to the repository.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SOURCE_URL = (
    "https://tds-odatis.aviso.altimetry.fr/thredds/fileServer/"
    "dataset-auxiliary-fes-tide-model/fes2022b/ocean_tide_non_structured/"
    "FES2022b_OceanTide_NSgrid.nc"
)
CATALOG_URL = (
    "https://tds-odatis.aviso.altimetry.fr/thredds/catalog/"
    "dataset-auxiliary-fes-tide-model/fes2022b/ocean_tide_non_structured/catalog.xml"
)
SOURCE_DIRECTORY = (
    "dataset-auxiliary-fes-tide-model/fes2022b/ocean_tide_non_structured"
)
SOURCE_FILENAME = "FES2022b_OceanTide_NSgrid.nc"
DOI = "10.24400/527896/A01-2024.004"
LICENSE_URL = "https://www.aviso.altimetry.fr/fileadmin/documents/data/License_Aviso.pdf"
LICENSE_VERSION = "AVISO+ User Licence Issue 20, effective 2026-08-10"
CREDENTIAL_VARIABLE_NAMES = ("AVISO_FES_USERNAME", "AVISO_FES_PASSWORD")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DOMAIN_PATH = PROJECT_ROOT / "config/coastal_domain_v100.json"
POINTS_PATH = PROJECT_ROOT / "config/tide_points_v100.json"
EXPECTED_CONSTITUENTS = (
    "2N2",
    "Eps2",
    "J1",
    "K1",
    "K2",
    "L2",
    "Lambda2",
    "M2",
    "M3",
    "M4",
    "M6",
    "M8",
    "MKS2",
    "MN4",
    "MS4",
    "MSf",
    "Mf",
    "Mm",
    "Msqm",
    "Mtm",
    "Mu2",
    "N2",
    "N4",
    "Nu2",
    "O1",
    "P1",
    "Q1",
    "R2",
    "S1",
    "S2",
    "S4",
    "Sa",
    "Ssa",
    "T2",
)
TRANSIENT_HTTP = {408, 429, 500, 502, 503, 504}


class AcquisitionError(RuntimeError):
    """A source acquisition or structural validation failure."""

    def __init__(self, message: str, *, http_status: int | None = None) -> None:
        super().__init__(message)
        self.http_status = http_status


class SameHostRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Forward AVISO authorization only within the exact HTTPS authority."""

    def redirect_request(
        self,
        request: Any,
        file_pointer: Any,
        code: int,
        message: str,
        headers: Any,
        new_url: str,
    ) -> Any:
        old = urllib.parse.urlsplit(request.full_url)
        new = urllib.parse.urlsplit(new_url)
        same_https_authority = (
            old.scheme.lower() == "https"
            and new.scheme.lower() == "https"
            and old.netloc.lower() == new.netloc.lower()
        )
        if not same_https_authority:
            raise AcquisitionError(
                "Refusing authenticated redirect outside the exact HTTPS authority",
                http_status=code,
            )
        return super().redirect_request(
            request, file_pointer, code, message, headers, new_url
        )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def safe_header_subset(headers: Any) -> dict[str, str | None]:
    return {
        "contentType": headers.get("Content-Type"),
        "contentLength": headers.get("Content-Length"),
        "contentRange": headers.get("Content-Range"),
        "etag": headers.get("ETag"),
        "lastModified": headers.get("Last-Modified"),
        "acceptRanges": headers.get("Accept-Ranges"),
    }


def fetch_catalog(timeout_seconds: int) -> dict[str, Any]:
    request = urllib.request.Request(
        CATALOG_URL,
        headers={"User-Agent": "WenzhouCoastalPipeline/2.0", "Accept": "application/xml"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            content = response.read()
            status = int(getattr(response, "status", 200))
            if status != 200:
                raise AcquisitionError(
                    f"FES2022b public catalog returned HTTP {status}", http_status=status
                )
            try:
                root = ET.fromstring(content)
            except ET.ParseError as exc:
                raise AcquisitionError("FES2022b public catalog is not valid XML") from exc
            expected_path = f"{SOURCE_DIRECTORY}/{SOURCE_FILENAME}"
            datasets = [
                item
                for item in root.iter()
                if item.tag.rsplit("}", 1)[-1] == "dataset"
                and item.attrib.get("name") == SOURCE_FILENAME
                and item.attrib.get("urlPath") == expected_path
            ]
            if len(datasets) != 1:
                raise AcquisitionError(
                    "FES2022b public catalog does not contain exactly one expected dataset"
                )
            dataset = datasets[0]
            data_sizes = [
                item
                for item in dataset
                if item.tag.rsplit("}", 1)[-1] == "dataSize"
            ]
            modified_dates = [
                item
                for item in dataset
                if item.tag.rsplit("}", 1)[-1] == "date"
                and item.attrib.get("type") == "modified"
            ]
            if len(data_sizes) != 1 or len(modified_dates) != 1:
                raise AcquisitionError(
                    "FES2022b catalog lacks one exact dataSize or modified date"
                )
            size_text = (data_sizes[0].text or "").strip()
            size_units = data_sizes[0].attrib.get("units")
            modified = (modified_dates[0].text or "").strip()
            if not size_text or not size_units or not modified:
                raise AcquisitionError("FES2022b catalog file metadata is incomplete")
            datetime.fromisoformat(modified.replace("Z", "+00:00"))
            return {
                "url": CATALOG_URL,
                "finalUrl": response.geturl(),
                "httpStatus": status,
                "retrievedAtUtc": utc_now(),
                "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "responseHeaders": safe_header_subset(response.headers),
                "sourceFileListed": True,
                "datasetName": SOURCE_FILENAME,
                "datasetId": dataset.attrib.get("ID"),
                "datasetUrlPath": expected_path,
                "declaredDataSize": {
                    "value": float(size_text),
                    "text": size_text,
                    "units": size_units,
                },
                "sourceModifiedAtUtc": modified,
            }
    except urllib.error.HTTPError as exc:
        raise AcquisitionError(
            f"FES2022b public catalog failed with HTTP {int(exc.code)}",
            http_status=int(exc.code),
        ) from exc
    except urllib.error.URLError as exc:
        raise AcquisitionError(f"FES2022b public catalog request failed: {exc.reason}") from exc


def basic_authorization(username: str, password: str) -> str:
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def sanitized_failure_detail(exc: Exception, username: str, password: str) -> str:
    detail = str(exc)
    sensitive = [username, password]
    if username or password:
        sensitive.append(
            base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        )
    for value in sensitive:
        if not value:
            continue
        detail = detail.replace(value, "[REDACTED]")
        detail = detail.replace(urllib.parse.quote(value, safe=""), "[REDACTED]")
    detail = re.sub(
        r"(?i)basic\s+[a-z0-9+/=]+", "Basic [REDACTED]", detail
    )
    detail = re.sub(
        r"(https?://)[^/@\s]+@", r"\1[REDACTED]@", detail, flags=re.IGNORECASE
    )
    return detail[:1000]


def _content_range_start(value: str | None) -> int | None:
    if not value:
        return None
    match = re.fullmatch(r"bytes\s+(\d+)-\d+/(?:\d+|\*)", value.strip())
    return int(match.group(1)) if match else None


def _content_range_total(value: str | None) -> int | None:
    if not value:
        return None
    match = re.fullmatch(r"bytes\s+\d+-\d+/(\d+|\*)", value.strip())
    if not match or match.group(1) == "*":
        return None
    return int(match.group(1))


def download_with_resume(
    url: str,
    destination: Path,
    username: str,
    password: str,
    *,
    attempts: int,
    timeout_seconds: int,
) -> dict[str, Any]:
    """Download with bounded retries and an RFC 7233 resume file."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name + ".part")
    attempt_records: list[dict[str, Any]] = []
    authorization = basic_authorization(username, password)
    opener = urllib.request.build_opener(SameHostRedirectHandler())
    expected_total: int | None = None

    for attempt in range(1, attempts + 1):
        resume_at = partial.stat().st_size if partial.exists() else 0
        headers = {
            "User-Agent": "WenzhouCoastalPipeline/2.0",
            "Accept": "application/x-netcdf,application/octet-stream,*/*",
            "Authorization": authorization,
        }
        if resume_at:
            headers["Range"] = f"bytes={resume_at}-"
        request = urllib.request.Request(url, headers=headers)
        started = time.monotonic()
        try:
            with opener.open(request, timeout=timeout_seconds) as response:
                status = int(getattr(response, "status", 200))
                response_headers = safe_header_subset(response.headers)
                if status == 206:
                    actual_start = _content_range_start(response.headers.get("Content-Range"))
                    if actual_start != resume_at:
                        raise AcquisitionError(
                            "FES2022b range response did not begin at the requested byte",
                            http_status=status,
                        )
                    mode = "ab"
                    expected_total = _content_range_total(
                        response.headers.get("Content-Range")
                    )
                elif status == 200:
                    mode = "wb"
                    resume_at = 0
                    content_length = response.headers.get("Content-Length")
                    expected_total = int(content_length) if content_length else None
                else:
                    raise AcquisitionError(
                        f"FES2022b source returned HTTP {status}", http_status=status
                    )

                prefix = response.read(16)
                if prefix.lstrip().lower().startswith((b"<html", b"<!doctype")):
                    raise AcquisitionError(
                        "FES2022b source returned HTML instead of NetCDF",
                        http_status=status,
                    )
                with partial.open(mode) as target:
                    target.write(prefix)
                    for chunk in iter(lambda: response.read(8 * 1024 * 1024), b""):
                        target.write(chunk)
                    target.flush()
                    os.fsync(target.fileno())

                actual_size = partial.stat().st_size
                if expected_total is not None and actual_size != expected_total:
                    raise AcquisitionError(
                        f"FES2022b download ended at {actual_size} of {expected_total} bytes",
                        http_status=status,
                    )
                os.replace(partial, destination)
                attempt_records.append(
                    {
                        "attempt": attempt,
                        "resumeOffset": resume_at,
                        "httpStatus": status,
                        "durationSeconds": time.monotonic() - started,
                        "responseHeaders": response_headers,
                    }
                )
                return {
                    "requestedUrl": url,
                    "finalUrl": response.geturl(),
                    "httpStatus": status,
                    "downloadedAtUtc": utc_now(),
                    "bytes": destination.stat().st_size,
                    "sha256": sha256_file(destination),
                    "responseHeaders": response_headers,
                    "attempts": attempt_records,
                }
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            attempt_records.append(
                {
                    "attempt": attempt,
                    "resumeOffset": resume_at,
                    "httpStatus": status,
                    "error": "HTTPError",
                    "reason": str(exc.reason),
                    "wwwAuthenticate": exc.headers.get("WWW-Authenticate") if exc.headers else None,
                    "durationSeconds": time.monotonic() - started,
                }
            )
            if status not in TRANSIENT_HTTP or attempt == attempts:
                raise AcquisitionError(
                    f"FES2022b authorization or download failed with HTTP {status}",
                    http_status=status,
                ) from exc
        except (OSError, TimeoutError, urllib.error.URLError, AcquisitionError) as exc:
            status = exc.http_status if isinstance(exc, AcquisitionError) else None
            attempt_records.append(
                {
                    "attempt": attempt,
                    "resumeOffset": resume_at,
                    "httpStatus": status,
                    "error": type(exc).__name__,
                    "reason": str(exc),
                    "durationSeconds": time.monotonic() - started,
                }
            )
            if attempt == attempts or (
                isinstance(exc, AcquisitionError)
                and status is not None
                and status not in TRANSIENT_HTTP
            ):
                raise AcquisitionError(str(exc), http_status=status) from exc
        time.sleep(min(2**attempt, 30))

    raise AcquisitionError("FES2022b download exhausted its retry budget")


def json_scalar(value: Any) -> Any:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if hasattr(value, "item"):
        try:
            return json_scalar(value.item())
        except ValueError:
            pass
    if isinstance(value, (list, tuple)):
        return [json_scalar(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def variable_evidence(variable: Any) -> dict[str, Any]:
    return {
        "dimensions": list(variable.dimensions),
        "shape": list(variable.shape),
        "dtype": str(variable.dtype),
        "attributes": {
            name: json_scalar(variable.getncattr(name)) for name in variable.ncattrs()
        },
    }


def variable_text(name: str, variable: Any) -> str:
    attributes = " ".join(
        str(variable.getncattr(key))
        for key in variable.ncattrs()
        if key.lower() in {"long_name", "standard_name", "description", "comment", "units"}
    )
    return f"{name} {attributes}".lower()


def discover_axis(dataset: Any, standard_name: str) -> str:
    matches = [
        name
        for name, variable in dataset.variables.items()
        if str(getattr(variable, "standard_name", "")).strip().lower() == standard_name
        and len(variable.dimensions) == 1
    ]
    if len(matches) != 1:
        raise AcquisitionError(
            f"Expected exactly one 1-D {standard_name} variable, found {matches}"
        )
    return matches[0]


def constituent_variable_map(dataset: Any, role: str) -> dict[str, str]:
    if role == "amplitude":
        marker = re.compile(r"(?:^|[^a-z])(?:amp|amplitude)(?:$|[^a-z])")
    else:
        marker = re.compile(r"(?:^|[^a-z])(?:pha|phase)(?:$|[^a-z])")
    result: dict[str, str] = {}
    for constituent in EXPECTED_CONSTITUENTS:
        matches: list[str] = []
        token = re.compile(
            rf"(?<![A-Za-z0-9]){re.escape(constituent)}(?![A-Za-z0-9])",
            re.IGNORECASE,
        )
        for name, variable in dataset.variables.items():
            if not token.search(name):
                continue
            if marker.search(variable_text(name, variable)):
                matches.append(name)
        if len(matches) != 1:
            raise AcquisitionError(
                f"Could not uniquely identify {role} variable for {constituent}: {matches}"
            )
        result[constituent] = matches[0]
    if len(set(result.values())) != len(EXPECTED_CONSTITUENTS):
        raise AcquisitionError(f"FES2022b {role} variables are not one-per-constituent")
    return result


def derive_pattern(mapping: dict[str, str], role: str) -> str:
    first_constituent = EXPECTED_CONSTITUENTS[0]
    first_name = mapping[first_constituent]
    match = re.search(re.escape(first_constituent), first_name, re.IGNORECASE)
    if not match:
        raise AcquisitionError(f"Cannot derive {role} variable pattern from {first_name}")
    pattern = first_name[: match.start()] + "{constituent}" + first_name[match.end() :]
    for constituent, actual in mapping.items():
        if pattern.format(constituent=constituent).lower() != actual.lower():
            raise AcquisitionError(
                f"FES2022b {role} variables do not share one PyFES-compatible pattern"
            )
    return pattern


def discover_triangle(dataset: Any) -> str:
    explicit = [
        name
        for name, variable in dataset.variables.items()
        if str(getattr(variable, "cf_role", "")).lower() == "face_node_connectivity"
    ]
    if len(explicit) == 1:
        return explicit[0]
    candidates = [
        name
        for name, variable in dataset.variables.items()
        if len(variable.dimensions) == 2
        and variable.dtype.kind in "iu"
        and "triangle" in variable_text(name, variable)
    ]
    if len(candidates) != 1:
        raise AcquisitionError(
            f"Could not identify one triangle-connectivity variable: {candidates}"
        )
    return candidates[0]


def discover_codes(dataset: Any, triangle: str) -> str:
    candidates = [
        name
        for name, variable in dataset.variables.items()
        if name != triangle
        and variable.dtype.kind in "iu"
        and re.search(r"\b(?:code|codes|mask|lgp1|lgp2)\b", variable_text(name, variable))
    ]
    if len(candidates) != 1:
        raise AcquisitionError(f"Could not identify one LGP codes variable: {candidates}")
    return candidates[0]


def discover_lgp_type(dataset: Any, codes_name: str) -> str:
    codes = dataset.variables[codes_name]
    if len(codes.shape) != 2:
        raise AcquisitionError("FES2022b LGP codes variable is not two-dimensional")
    if codes.shape[1] == 3:
        raise AcquisitionError(
            "LGP1 structure is incompatible with the pinned PyFES 2026.5.2 loader"
        )
    if codes.shape[1] != 6:
        raise AcquisitionError(
            f"FES2022b LGP codes width is {codes.shape[1]}, expected six for LGP2"
        )
    evidence = [codes_name]
    evidence.extend(
        str(dataset.getncattr(name)) for name in dataset.ncattrs()
    )
    evidence.extend(str(codes.getncattr(name)) for name in codes.ncattrs())
    joined = " ".join(evidence).lower()
    found = [item for item in ("lgp1", "lgp2") if item in joined]
    if found != ["lgp2"]:
        raise AcquisitionError(
            "NetCDF metadata and six-column discrete structure do not jointly prove LGP2"
        )
    return "lgp2"


def integer_min_max(variable: Any) -> tuple[int, int]:
    import numpy as np

    minimum: int | None = None
    maximum: int | None = None
    chunk_rows = max(1, 1_000_000 // max(1, int(np.prod(variable.shape[1:]))))
    for start in range(0, variable.shape[0], chunk_rows):
        values = np.ma.asarray(variable[start : start + chunk_rows])
        if np.ma.isMaskedArray(values) and bool(np.ma.getmaskarray(values).any()):
            raise AcquisitionError(f"Integer topology variable {variable.name} is masked")
        array = np.asarray(values)
        if array.size == 0:
            continue
        item_min = int(array.min())
        item_max = int(array.max())
        minimum = item_min if minimum is None else min(minimum, item_min)
        maximum = item_max if maximum is None else max(maximum, item_max)
    if minimum is None or maximum is None:
        raise AcquisitionError(f"Integer topology variable {variable.name} is empty")
    return minimum, maximum


def topology_index_evidence(
    triangle: Any,
    codes: Any,
    coordinate_count: int,
    degree_of_freedom_count: int,
) -> dict[str, Any]:
    if triangle.dtype.kind not in "iu" or codes.dtype.kind not in "iu":
        raise AcquisitionError("FES2022b triangle and LGP codes must be integer variables")
    if len(triangle.shape) != 2 or triangle.shape[1] != 3:
        raise AcquisitionError("FES2022b triangle connectivity must have shape (n, 3)")
    if len(codes.shape) != 2 or codes.shape[1] != 6:
        raise AcquisitionError("FES2022b LGP2 codes must have shape (n, 6)")
    if triangle.shape[0] != codes.shape[0] or triangle.dimensions[0] != codes.dimensions[0]:
        raise AcquisitionError("FES2022b triangle and LGP2 codes do not share one face axis")
    triangle_start = int(getattr(triangle, "start_index", 0))
    codes_start = int(getattr(codes, "start_index", 0))
    if triangle_start != 0 or codes_start != 0:
        raise AcquisitionError("Pinned PyFES requires zero-based triangle and LGP2 indices")
    triangle_min, triangle_max = integer_min_max(triangle)
    codes_min, codes_max = integer_min_max(codes)
    if triangle_min < 0 or triangle_max >= coordinate_count:
        raise AcquisitionError("FES2022b triangle indices exceed the coordinate array")
    if codes_min < 0 or codes_max >= degree_of_freedom_count:
        raise AcquisitionError("FES2022b LGP2 indices exceed the harmonic degree-of-freedom array")
    return {
        "triangle": {
            "shape": list(triangle.shape),
            "dimensions": list(triangle.dimensions),
            "startIndex": triangle_start,
            "minimumIndex": triangle_min,
            "maximumIndex": triangle_max,
            "coordinateCount": coordinate_count,
        },
        "codes": {
            "shape": list(codes.shape),
            "dimensions": list(codes.dimensions),
            "startIndex": codes_start,
            "minimumIndex": codes_min,
            "maximumIndex": codes_max,
            "degreeOfFreedomCount": degree_of_freedom_count,
        },
    }


def canonical_unit(values: set[str], role: str) -> str:
    normalized = {value.strip().lower() for value in values}
    if len(normalized) != 1:
        raise AcquisitionError(f"FES2022b {role} units are inconsistent: {sorted(normalized)}")
    unit = next(iter(normalized))
    if role == "amplitude" and unit not in {
        "cm",
        "centimeter",
        "centimeters",
        "centimetre",
        "centimetres",
    }:
        raise AcquisitionError(
            f"FES2022b native amplitude unit must be centimeters for PyFES: {unit!r}"
        )
    if role == "phase" and unit not in {"degree", "degrees"}:
        raise AcquisitionError(
            f"FES2022b native phase unit must be degrees for PyFES: {unit!r}"
        )
    return unit


def inspect_native_netcdf(path: Path) -> dict[str, Any]:
    try:
        import netCDF4
    except ImportError as exc:
        raise AcquisitionError("netCDF4 is required to inspect FES2022b") from exc

    with netCDF4.Dataset(path, "r") as dataset:
        global_attributes = {
            name: json_scalar(dataset.getncattr(name)) for name in dataset.ncattrs()
        }
        identity_text = " ".join(str(value) for value in global_attributes.values()).lower()
        if not all(token in identity_text for token in ("fes2022", "ocean", "tide")):
            raise AcquisitionError(
                "NetCDF global metadata does not identify the FES2022 ocean-tide dataset"
            )
        longitude = discover_axis(dataset, "longitude")
        latitude = discover_axis(dataset, "latitude")
        if dataset.variables[longitude].dimensions != dataset.variables[latitude].dimensions:
            raise AcquisitionError("FES2022b longitude and latitude do not share a node dimension")
        if dataset.variables[longitude].shape != dataset.variables[latitude].shape:
            raise AcquisitionError("FES2022b longitude and latitude lengths differ")
        triangle = discover_triangle(dataset)
        codes = discover_codes(dataset, triangle)
        lgp_type = discover_lgp_type(dataset, codes)
        amplitudes = constituent_variable_map(dataset, "amplitude")
        phases = constituent_variable_map(dataset, "phase")
        amplitude_pattern = derive_pattern(amplitudes, "amplitude")
        phase_pattern = derive_pattern(phases, "phase")
        amplitude_unit = canonical_unit(
            {str(getattr(dataset.variables[name], "units", "")) for name in amplitudes.values()},
            "amplitude",
        )
        phase_unit = canonical_unit(
            {str(getattr(dataset.variables[name], "units", "")) for name in phases.values()},
            "phase",
        )
        degree_dimensions = {
            (
                dataset.variables[amplitudes[item]].dimensions,
                dataset.variables[amplitudes[item]].shape,
                dataset.variables[phases[item]].dimensions,
                dataset.variables[phases[item]].shape,
            )
            for item in EXPECTED_CONSTITUENTS
        }
        if len(degree_dimensions) != 1:
            raise AcquisitionError(
                "FES2022b amplitude and phase variables do not share one 1-D DOF axis"
            )
        amplitude_dimensions, amplitude_shape, phase_dimensions, phase_shape = next(
            iter(degree_dimensions)
        )
        if (
            len(amplitude_dimensions) != 1
            or amplitude_dimensions != phase_dimensions
            or amplitude_shape != phase_shape
            or not amplitude_shape
        ):
            raise AcquisitionError(
                "FES2022b amplitude and phase variables are not aligned 1-D arrays"
            )
        for item in EXPECTED_CONSTITUENTS:
            amplitude_variable = dataset.variables[amplitudes[item]]
            phase_variable = dataset.variables[phases[item]]
            if amplitude_variable.dtype.kind not in "f" or phase_variable.dtype.kind not in "f":
                raise AcquisitionError(
                    f"FES2022b {item} amplitude or phase is not floating point"
                )
        topology = topology_index_evidence(
            dataset.variables[triangle],
            dataset.variables[codes],
            dataset.variables[longitude].shape[0],
            amplitude_shape[0],
        )
        selected_names = {
            longitude,
            latitude,
            triangle,
            codes,
            *amplitudes.values(),
            *phases.values(),
        }
        return {
            "format": str(dataset.file_format),
            "dataModel": str(dataset.data_model),
            "dimensions": {name: len(value) for name, value in dataset.dimensions.items()},
            "globalAttributes": global_attributes,
            "datasetIdentityPassed": True,
            "variables": {
                name: variable_evidence(dataset.variables[name]) for name in sorted(selected_names)
            },
            "nativeGrid": {
                "discretization": lgp_type,
                "longitudeVariable": longitude,
                "latitudeVariable": latitude,
                "triangleVariable": triangle,
                "codesVariable": codes,
                "amplitudePattern": amplitude_pattern,
                "phasePattern": phase_pattern,
                "amplitudeUnit": amplitude_unit,
                "phaseUnit": phase_unit,
                "topologyIndexEvidence": topology,
            },
            "constituents": list(EXPECTED_CONSTITUENTS),
            "constituentCount": len(EXPECTED_CONSTITUENTS),
        }


def write_native_config(path: Path, inspection: dict[str, Any]) -> None:
    try:
        import yaml
    except ImportError as exc:
        raise AcquisitionError("PyYAML is required to write the PyFES configuration") from exc
    grid = inspection["nativeGrid"]
    payload = {
        "engine": "darwin",
        "tide": {
            "lgp": {
                "path": "${FES2022B_NATIVE_FILE}",
                "longitude": grid["longitudeVariable"],
                "latitude": grid["latitudeVariable"],
                "triangle": grid["triangleVariable"],
                "codes": grid["codesVariable"],
                "amplitude": grid["amplitudePattern"],
                "phase": grid["phasePattern"],
                "type": grid["discretization"],
                "max_distance": 0.0,
                "constituents": list(EXPECTED_CONSTITUENTS),
                "dynamic": ["A5"],
            }
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")


def validate_pyfes_runtime(config_path: Path, source_path: Path) -> dict[str, Any]:
    try:
        import numpy as np
        import pyfes
    except ImportError as exc:
        raise AcquisitionError("pyfes==2026.5.2 is required for native-grid validation") from exc
    if getattr(pyfes, "__version__", None) != "2026.5.2":
        raise AcquisitionError(
            f"PyFES {getattr(pyfes, '__version__', None)!r} is not pinned 2026.5.2"
        )
    domain = json.loads(DOMAIN_PATH.read_text(encoding="utf-8"))
    bounds = tuple(
        float(item)
        for item in domain["domains"]["bathymetryAndTideBoundaryWgs84"]["bounds"]
    )
    points = json.loads(POINTS_PATH.read_text(encoding="utf-8"))["points"]
    longitudes = np.asarray([float(item["longitude"]) for item in points])
    latitudes = np.asarray([float(item["latitude"]) for item in points])
    previous = os.environ.get("FES2022B_NATIVE_FILE")
    os.environ["FES2022B_NATIVE_FILE"] = str(source_path.resolve())
    try:
        configuration = pyfes.config.load(config_path, bbox=bounds)
    finally:
        if previous is None:
            os.environ.pop("FES2022B_NATIVE_FILE", None)
        else:
            os.environ["FES2022B_NATIVE_FILE"] = previous
    model = configuration.models.get("tide")
    if model is None:
        raise AcquisitionError("Pinned PyFES did not load a tide model")
    identifiers = list(model.identifiers())
    normalized = {
        re.sub(r"[^A-Za-z0-9]", "", str(item).split(".")[-1]).upper()
        for item in identifiers
    }
    expected = {
        re.sub(r"[^A-Za-z0-9]", "", item).upper()
        for item in EXPECTED_CONSTITUENTS
    }
    if len(identifiers) != 34 or normalized != expected:
        raise AcquisitionError("Pinned PyFES did not load the exact 34-constituent set")
    values, flags = model.interpolate(longitudes, latitudes)
    loaded_values = {
        re.sub(r"[^A-Za-z0-9]", "", str(item).split(".")[-1]).upper()
        for item in values
    }
    if loaded_values != expected:
        raise AcquisitionError("Pinned PyFES interpolation did not return all 34 constituents")
    flags = np.asarray(flags, dtype="int8")
    if flags.shape != longitudes.shape:
        raise AcquisitionError("Pinned PyFES interpolation returned an invalid flag shape")
    histogram = {
        str(item): int(np.count_nonzero(flags == item)) for item in np.unique(flags)
    }
    return {
        "passed": True,
        "pyfesVersion": pyfes.__version__,
        "modelType": type(model).__name__,
        "bboxWgs84": list(bounds),
        "probePointCount": int(longitudes.size),
        "constituentCount": len(identifiers),
        "constituents": [str(item).split(".")[-1] for item in identifiers],
        "qualityFlags": [int(item) for item in flags],
        "qualityFlagHistogram": histogram,
        "undefinedProbePointCount": int(np.count_nonzero(flags == 0)),
        "interpolationCallPassed": True,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--config-output", required=True, type=Path)
    parser.add_argument("--manifest-output", required=True, type=Path)
    parser.add_argument("--failure-report", required=True, type=Path)
    parser.add_argument("--attempts", type=int, default=5)
    parser.add_argument("--timeout-seconds", type=int, default=180)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    username = os.environ.get("AVISO_FES_USERNAME", "")
    password = os.environ.get("AVISO_FES_PASSWORD", "")
    missing = [
        name
        for name, value in zip(
            CREDENTIAL_VARIABLE_NAMES, (username, password), strict=True
        )
        if not value
    ]
    if missing:
        write_json(
            args.failure_report,
            {
                "schema": "wenzhou_fes2022b_acquisition_failure@1.1.0",
                "generatedAtUtc": utc_now(),
                "passed": False,
                "failureKind": "authorization_configuration",
                "credentialVariableNames": list(CREDENTIAL_VARIABLE_NAMES),
                "missingSecretNames": missing,
                "httpStatus": None,
                "authorizationError": "required_actions_secrets_missing",
                "sourceUrl": SOURCE_URL,
            },
        )
        print(f"Missing required Actions Secrets: {', '.join(missing)}", file=sys.stderr)
        return 3

    private_roots = [
        (name, Path(value).resolve())
        for name in ("RUNNER_TEMP", "FES_PRIVATE_MOUNT_ROOT")
        if (value := os.environ.get(name))
        and Path(value).resolve() != Path("/")
    ]
    output = args.output.resolve()
    output_allowed = False
    for _, root in private_roots:
        try:
            output.relative_to(root)
            output_allowed = True
            break
        except ValueError:
            continue
    try:
        output.relative_to(PROJECT_ROOT.parent.parent.parent.resolve())
        output_in_repository = True
    except ValueError:
        output_in_repository = False
    if not private_roots or not output_allowed or output_in_repository:
        write_json(
            args.failure_report,
            {
                "schema": "wenzhou_fes2022b_acquisition_failure@1.1.0",
                "generatedAtUtc": utc_now(),
                "passed": False,
                "failureKind": "runtime_path_policy",
                "credentialVariableNames": list(CREDENTIAL_VARIABLE_NAMES),
                "allowedRawRootVariableNames": [
                    "RUNNER_TEMP",
                    "FES_PRIVATE_MOUNT_ROOT",
                ],
                "missingSecretNames": [],
                "httpStatus": None,
                "authorizationError": None,
                "detail": "raw_source_path_is_not_in_an_approved_private_root",
                "sourceUrl": SOURCE_URL,
            },
        )
        return 4

    try:
        catalog = fetch_catalog(args.timeout_seconds)
        transfer = download_with_resume(
            SOURCE_URL,
            args.output,
            username,
            password,
            attempts=args.attempts,
            timeout_seconds=args.timeout_seconds,
        )
        inspection = inspect_native_netcdf(args.output)
        if inspection["constituentCount"] != 34:
            raise AcquisitionError("FES2022b native source did not expose all 34 constituents")
        write_native_config(args.config_output, inspection)
        pyfes_validation = validate_pyfes_runtime(args.config_output, args.output)
        source_modified = (
            transfer["responseHeaders"].get("lastModified")
            or catalog["sourceModifiedAtUtc"]
        )
        if not source_modified:
            raise AcquisitionError("FES2022b source modification time is unavailable")
        manifest = {
            "schema": "wenzhou_fes2022b_native_source_manifest@1.0.0",
            "dataset": "FES2022b ocean tide",
            "sourceVariant": "native_non_structured",
            "modelRole": "primary",
            "sourceUrl": SOURCE_URL,
            "sourceDirectory": SOURCE_DIRECTORY,
            "sourceFilename": SOURCE_FILENAME,
            "sourceSha256": transfer["sha256"],
            "sourceBytes": transfer["bytes"],
            "rawSourceCommitted": False,
            "retrievedAtUtc": transfer["downloadedAtUtc"],
            "sourceLastModified": source_modified,
            "transfer": transfer,
            "catalog": catalog,
            "doi": DOI,
            "licenseUrl": LICENSE_URL,
            "licenseVersion": LICENSE_VERSION,
            "runtimePathVariable": "FES2022B_NATIVE_FILE",
            "netcdf": inspection,
            "pyfesValidation": pyfes_validation,
            "config": {
                "path": str(args.config_output),
                "bytes": args.config_output.stat().st_size,
                "sha256": sha256_file(args.config_output),
            },
        }
        write_json(args.manifest_output, manifest)
        print(
            json.dumps(
                {
                    "sourceBytes": manifest["sourceBytes"],
                    "sourceSha256": manifest["sourceSha256"],
                    "constituentCount": inspection["constituentCount"],
                    "rawSourceCommitted": False,
                },
                indent=2,
            )
        )
        return 0
    except Exception as exc:
        http_status = exc.http_status if isinstance(exc, AcquisitionError) else None
        safe_detail = sanitized_failure_detail(exc, username, password)
        args.output.unlink(missing_ok=True)
        args.output.with_name(args.output.name + ".part").unlink(missing_ok=True)
        args.config_output.unlink(missing_ok=True)
        args.manifest_output.unlink(missing_ok=True)
        write_json(
            args.failure_report,
            {
                "schema": "wenzhou_fes2022b_acquisition_failure@1.1.0",
                "generatedAtUtc": utc_now(),
                "passed": False,
                "failureKind": (
                    "authorization" if http_status in {401, 403} else "acquisition"
                ),
                "credentialVariableNames": list(CREDENTIAL_VARIABLE_NAMES),
                "missingSecretNames": [],
                "httpStatus": http_status,
                "authorizationError": (
                    f"aviso_http_{http_status}" if http_status in {401, 403} else None
                ),
                "errorType": type(exc).__name__,
                "detail": safe_detail,
                "sourceUrl": SOURCE_URL,
            },
        )
        print(
            f"FES2022b acquisition failed: {type(exc).__name__}: {safe_detail}",
            file=sys.stderr,
        )
        return 5


if __name__ == "__main__":
    sys.exit(main())
