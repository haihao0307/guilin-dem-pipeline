#!/usr/bin/env python3
"""Verifier for World Score / TLO OpenAI pilot round 01.

The fixture is deliberately synthetic. These checks validate semantic invariants,
not historical facts.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable


EXPECTED_FREEZE = "cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330"


class VerificationError(AssertionError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def index(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in items:
        item_id = item.get("id")
        require(isinstance(item_id, str) and item_id, f"Missing id in {item!r}")
        require(item_id not in result, f"Duplicate id within collection: {item_id}")
        result[item_id] = item
    return result


def load_fixture(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def run_checks(data: dict[str, Any]) -> list[tuple[str, str]]:
    objects = index(data["worldObjects"])
    source_events = index(data["sourceEvents"])
    assets = index(data["assets"])
    observations = index(data["observations"])
    claims = index(data["claims"])
    views = index(data["views"])

    all_ids: set[str] = set()
    for collection in (objects, source_events, assets, observations, claims, views):
        overlap = all_ids.intersection(collection)
        require(not overlap, f"IDs collide across collections: {sorted(overlap)}")
        all_ids.update(collection)

    tests: list[tuple[str, Callable[[], None]]] = []

    def test(name: str):
        def register(fn: Callable[[], None]) -> Callable[[], None]:
            tests.append((name, fn))
            return fn
        return register

    @test("01 frozen charter remains exactly addressable")
    def _() -> None:
        freeze = data["freeze"]["charter"]
        require(freeze["commit"] == EXPECTED_FREEZE, "Frozen R1 commit changed")
        require(freeze["policy"] == "append-only", "Freeze policy is not append-only")

    @test("02 fixture is explicitly synthetic and cannot masquerade as history")
    def _() -> None:
        require(data["fixture"]["synthetic"] is True, "Fixture must be marked synthetic")
        require("No record is asserted as real" in data["fixture"]["purpose"], "Fixture disclaimer missing")

    @test("03 world objects and evidence assets have separate identities")
    def _() -> None:
        require(set(objects).isdisjoint(assets), "World object and asset IDs overlap")
        require("world:building-historical-a" in objects, "Historical world object missing")
        require("asset:aerial-negative-1944" in assets, "Evidence asset missing")

    @test("04 source event, asset, observation, claim and view are separate layers")
    def _() -> None:
        for obs in observations.values():
            require(obs["sourceEvent"] in source_events, f"Unknown source event in {obs['id']}")
            require(obs["asset"] in assets, f"Unknown asset in {obs['id']}")
            require(obs["featureOfInterest"] in objects, f"Unknown world object in {obs['id']}")
        for claim in claims.values():
            require(claim["subject"] in objects, f"Unknown claim subject in {claim['id']}")
        for view in views.values():
            require(view["type"] == "current-best-view", f"View type invalid: {view['id']}")

    @test("05 multiple time roles are explicit")
    def _() -> None:
        require(all("worldTime" in e for e in source_events.values()), "Source event worldTime missing")
        require(all("assetCreatedTime" in a for a in assets.values()), "Asset creation time missing")
        require(all("observationTime" in o for o in observations.values()), "Observation time missing")
        require(all("processingTime" in o for o in observations.values()), "Observation processing time missing")
        require(all("validTime" in c for c in claims.values()), "Claim valid time missing")
        require(all("asOfTransactionTime" in v for v in views.values()), "View transaction time missing")
        forbidden = [x for x in (source_events, assets, observations, claims, views)
                     for item in x.values() if "time" in item]
        require(not forbidden, "Ambiguous bare 'time' key found")

    @test("06 every interpretive claim preserves method, assumptions and uncertainty")
    def _() -> None:
        for claim in claims.values():
            require("method" in claim, f"Method missing: {claim['id']}")
            require("assumptions" in claim, f"Assumptions missing: {claim['id']}")
            require("uncertainty" in claim, f"Uncertainty missing: {claim['id']}")
            if claim["claimType"] != "knowledge-status":
                require(len(claim["support"]) >= 1, f"Evidence support missing: {claim['id']}")

    @test("07 evidence references resolve and opposing claims stay visible")
    def _() -> None:
        for claim in claims.values():
            for obs_id in claim["support"]:
                require(obs_id in observations, f"Unknown supporting observation {obs_id}")
            for opposing_id in claim["oppose"]:
                require(opposing_id in claims, f"Unknown opposing claim {opposing_id}")
        position = claims["claim:historical-building-position-1944"]
        memory = claims["claim:memory-map-position-1944"]
        require(memory["id"] in position["oppose"], "Geometric claim does not retain memory conflict")
        require(position["id"] in memory["oppose"], "Memory claim does not retain geometric conflict")

    @test("08 copied files do not inflate independent observation count")
    def _() -> None:
        claim = claims["claim:historical-building-present-1944"]
        roots = {
            observations[obs_id]["independence"]["observationRoot"]
            for obs_id in claim["support"]
        }
        require(len(claim["support"]) == 3, "Test fixture must contain three supporting files")
        require(len(roots) == 2, "Copied aerial file was incorrectly counted as independent")
        require(claim["uncertainty"]["independentObservationRoots"] == 2,
                "Stored independent-root count disagrees with lineage graph")

    @test("09 shared calibration and systematic bias remain explicit")
    def _() -> None:
        aerial = observations["obs:aerial-footprint-1944"]
        duplicate = observations["obs:aerial-web-copy-duplicate"]
        require(aerial["independence"]["sharedCalibrationGroup"] ==
                duplicate["independence"]["sharedCalibrationGroup"],
                "Copied aerial observations lost shared calibration")
        for claim in claims.values():
            require("systematicBiases" in claim["uncertainty"] or
                    claim["uncertainty"].get("status") == "unknown",
                    f"Systematic-bias slot missing: {claim['id']}")

    @test("10 Unknown is explicit and is not encoded as zero or absence")
    def _() -> None:
        claim = claims["claim:west-facade-unknown-1944"]
        require(claim["value"] is None, "Unknown value must be null")
        require(claim["uncertainty"]["status"] == "unknown", "Unknown state missing")
        require("no observation covers" in claim["uncertainty"]["reason"],
                "Coverage reason missing")
        require(claim["claimType"] == "knowledge-status", "Unknown encoded as a factual absence")

    @test("11 quantity semantics bind unit and reference frame")
    def _() -> None:
        position = claims["claim:historical-building-position-1944"]["value"]
        require(position["unit"] == "m", "Position unit is not SI metre")
        require(position["referenceFrame"].startswith("frame:"), "Reference frame missing")
        require(claims["claim:historical-building-position-1944"]["uncertainty"]["unit"] == "m",
                "Position uncertainty unit missing")

    @test("12 modern construction remains a distinct object despite site reuse")
    def _() -> None:
        modern = objects["world:building-modern-b"]
        relations = {(r["type"], r["target"]) for r in modern["relations"]}
        require(("occupiesSameSiteAs", "world:building-historical-a") in relations,
                "Same-site relation missing")
        identity = claims["claim:modern-building-not-historical-a"]
        require(identity["predicate"] == "samePhysicalContinuant" and identity["value"] is False,
                "Modern reconstruction contaminated historical identity")

    @test("13 synthetic reconstruction is declared and excluded from direct historical evidence")
    def _() -> None:
        reconstruction = assets["asset:ai-reconstruction-2026"]
        require(reconstruction["type"] == "synthetic-reconstruction", "Synthetic type missing")
        require(reconstruction["authenticityStatus"] == "synthetic-declared",
                "Synthetic declaration missing")
        for view in views.values():
            require(reconstruction["id"] in view["excludedAssetsAsDirectHistoricalEvidence"],
                    "Synthetic reconstruction entered direct historical evidence")
        used_assets = {
            observations[obs_id]["asset"]
            for claim in claims.values()
            for obs_id in claim["support"]
        }
        require(reconstruction["id"] not in used_assets,
                "Synthetic reconstruction was used as an original observation")

    @test("14 Current Best View is reproducible and preserves conflict")
    def _() -> None:
        view = views["view:current-best-1944-r01"]
        require(view["generatedBy"]["policy"], "View policy missing")
        require(view["generatedBy"]["version"], "View policy version missing")
        require(view["asOfTransactionTime"], "View transaction time missing")
        for claim_id in view["acceptedClaims"] + view["retainedConflicts"]:
            require(claim_id in claims, f"View references unknown claim {claim_id}")
        require("claim:memory-map-position-1944" in view["retainedConflicts"],
                "Conflicting recollection was silently discarded")

    @test("15 social relations are kept as relations, not forced into spectrum fields")
    def _() -> None:
        social_claims = [
            claims["claim:zhang-next-door-1944"],
            claims["claim:restaurant-use-1944"],
        ]
        for claim in social_claims:
            require("spectrum" not in claim and "frequency" not in claim,
                    f"Discrete social claim was forced into spectrum: {claim['id']}")

    @test("16 asset lineage remains traversable to independent roots")
    def _() -> None:
        for asset in assets.values():
            require("lineageRoot" in asset, f"Lineage root missing: {asset['id']}")
            for edge in asset.get("lineage", []):
                require(edge["target"] in assets, f"Broken lineage target in {asset['id']}")
                require(edge["relation"] in {"copiedFrom", "transformedFrom", "derivedFrom"},
                        f"Unknown lineage relation in {asset['id']}")

    results: list[tuple[str, str]] = []
    for name, fn in tests:
        try:
            fn()
            results.append((name, "PASS"))
        except Exception as exc:
            results.append((name, f"FAIL: {exc}"))
    return results


def main() -> int:
    fixture_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name(
        "FIXTURE_CUIHU_SYNTHETIC_R01.json"
    )
    data = load_fixture(fixture_path)
    results = run_checks(data)
    width = max(len(name) for name, _ in results)
    for name, status in results:
        print(f"{name:<{width}}  {status}")
    passed = sum(status == "PASS" for _, status in results)
    print(f"\nRESULT {passed}/{len(results)} checks passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
