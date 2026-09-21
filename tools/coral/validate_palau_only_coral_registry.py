from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ALLOWED_SOURCE_DOMAINS = {
    "www.ncei.noaa.gov",
    "ncei.noaa.gov",
    "apps.aims.gov.au",
    "www.livingoceansfoundation.org",
    "livingoceansfoundation.org",
    "coralreefpalau.org",
    "www.coralreefpalau.org",
    "picrc.org",
    "www.picrc.org",
    "doi.org",
}

BLOCKED_CHINESE_SUFFIXES = (
    ".cn",
    ".com.cn",
    ".net.cn",
    ".org.cn",
)

BINOMIAL_RE = re.compile(r"^[A-Z][a-z-]+\s+[a-z][a-z-]+$")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def source_urls(entry: dict) -> list[str]:
    urls: list[str] = []
    occurrence = entry.get("palauOccurrence", {})
    if isinstance(occurrence, dict) and occurrence.get("sourceUrl"):
        urls.append(str(occurrence["sourceUrl"]))
    for evidence in entry.get("palauEvidence", []) or []:
        if isinstance(evidence, dict) and evidence.get("sourceUrl"):
            urls.append(str(evidence["sourceUrl"]))
    return urls


def validate_url(url: str, label: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    require(parsed.scheme == "https", f"{label}: source must use https: {url}")
    require(host, f"{label}: source has no hostname: {url}")
    require(not host.endswith(BLOCKED_CHINESE_SUFFIXES), f"{label}: Chinese source domain is forbidden: {host}")
    require(host in ALLOWED_SOURCE_DOMAINS, f"{label}: unapproved authority domain: {host}")


def validate_species_entry(entry: dict, label: str, active: bool) -> None:
    name = str(entry.get("scientificName", ""))
    require(BINOMIAL_RE.match(name) is not None, f"{label}: species-level binomial required, got {name!r}")
    status = (
        entry.get("palauOccurrence", {}).get("status")
        if active
        else entry.get("palauOccurrenceStatus")
    )
    require(status == "CONFIRMED_PALAU", f"{label}: occurrence must be CONFIRMED_PALAU, got {status!r}")
    require(entry.get("palauOnlyProductionEligible") is True, f"{label}: palauOnlyProductionEligible must be true")
    urls = source_urls(entry)
    require(urls, f"{label}: at least one Palau authority source URL is required")
    for url in urls:
        validate_url(url, label)

    serialized = json.dumps(entry, ensure_ascii=False).upper()
    require("OTHER_REGION_ONLY" not in serialized, f"{label}: other-region-only evidence cannot enter production")
    require("GENERIC_INDO_PACIFIC_ONLY" not in serialized, f"{label}: generic Indo-Pacific evidence cannot enter production")
    if active:
        require("UNRESOLVED" not in str(entry.get("palauOccurrence", {}).get("status", "")).upper(), f"{label}: unresolved regional occurrence")


def validate_build(root: Path) -> dict:
    build_path = root / "BUILD_R07_P00.json"
    evidence_path = root / "PALAU_OCCURRENCE_EVIDENCE.json"
    classification_path = root / "NOAA_CLASSIFICATION.json"
    require(build_path.is_file(), f"build manifest missing: {build_path}")
    require(evidence_path.is_file(), f"Palau evidence manifest missing: {evidence_path}")
    require(classification_path.is_file(), f"classification manifest missing: {classification_path}")

    build = json.loads(build_path.read_text(encoding="utf-8"))
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    classification = json.loads(classification_path.read_text(encoding="utf-8"))

    species = (
        classification.get("scientificName")
        or classification.get("candidateSpecies")
        or build.get("classification", {}).get("scientificName")
        or build.get("classification", {}).get("candidateSpecies")
    )
    require(species == "Porites lutea", f"P13 must remain Porites lutea, got {species!r}")
    require(evidence.get("species") == "Porites lutea", "evidence species mismatch")
    require(evidence.get("regionalStatus") in {"CONFIRMED", "CONFIRMED_PALAU"}, "Palau regional evidence not confirmed")
    require(evidence.get("productionAdmission") == "PALAU_ONLY_ADMITTED", "Palau-only production admission missing")
    require(evidence.get("palauAssetLibraryEligible") is True, "Palau asset-library eligibility missing")
    require(build.get("classification", {}).get("palauOccurrenceStatus") == "CONFIRMED_PALAU", "build Palau status missing")
    require(build.get("classification", {}).get("palauOnlyProductionEligible") is True, "build Palau-only eligibility missing")
    require(build.get("classification", {}).get("localSitePlacementReady") is False, "local site must remain independently gated")
    validate_url(str(evidence.get("sourceUrl", "")), "P13 build evidence")
    return {
        "releaseId": build.get("releaseId"),
        "species": species,
        "palauOccurrenceStatus": "CONFIRMED_PALAU",
        "palauOnlyProductionEligible": True,
        "localSitePlacementReady": False,
        "visualAcceptance": bool(build.get("visualAcceptance")),
        "productionReady": bool(build.get("productionReady")),
    }


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("usage: validate_palau_only_coral_registry.py <registry.json> [build-dir]")

    registry_path = Path(sys.argv[1])
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    policy = registry.get("policy", {})
    require(policy.get("productionMode") == "PALAU_ONLY", "registry productionMode must be PALAU_ONLY")
    require(policy.get("minimumOccurrenceStatus") == "CONFIRMED_PALAU", "registry minimum status mismatch")
    require(policy.get("speciesLevelNameRequired") is True, "species-level names must be mandatory")
    require(policy.get("genericIndoPacificDistributionRejected") is True, "generic Indo-Pacific evidence must be rejected")
    require(policy.get("otherRegionOnlyEvidenceRejected") is True, "other-region-only evidence must be rejected")

    active = registry.get("activeAssets", [])
    queued = registry.get("verifiedNextCandidates", [])
    require(active, "Palau active asset list is empty")
    require(queued, "Palau verified candidate queue is empty")
    seen: set[str] = set()
    for i, entry in enumerate(active):
        validate_species_entry(entry, f"activeAssets[{i}]", True)
        name = entry["scientificName"]
        require(name not in seen, f"duplicate species: {name}")
        seen.add(name)
    queue_orders: list[int] = []
    for i, entry in enumerate(queued):
        validate_species_entry(entry, f"verifiedNextCandidates[{i}]", False)
        name = entry["scientificName"]
        require(name not in seen, f"species duplicated across active and queue: {name}")
        seen.add(name)
        queue_orders.append(int(entry.get("queueOrder", 0)))
    require(queue_orders == sorted(queue_orders) and len(set(queue_orders)) == len(queue_orders), "candidate queue order invalid")

    receipt = {
        "schema": "CORAL_MOTHER_PALAU_ONLY_GATE_RECEIPT_V1",
        "registry": str(registry_path),
        "productionMode": "PALAU_ONLY",
        "activeSpecies": [x["scientificName"] for x in active],
        "queuedSpecies": [x["scientificName"] for x in queued],
        "activeCount": len(active),
        "queueCount": len(queued),
        "blockedEvidenceClasses": ["OTHER_REGION_ONLY", "GENERIC_INDO_PACIFIC_ONLY", "UNRESOLVED_SPECIES_OR_SP"],
        "passed": True,
    }
    if len(sys.argv) == 3:
        root = Path(sys.argv[2])
        receipt["build"] = validate_build(root)
        (root / "PALAU_ONLY_GATE_RECEIPT.json").write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
