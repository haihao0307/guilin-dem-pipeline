#!/usr/bin/env python3
"""Static audition of symbios-texture's weathering layer contract at one pinned commit."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).parent / "symbios-texture-audition"
SOURCE = ROOT / "src" / "weathering.rs"
PINNED_COMMIT = "0a873d279c5535723d4dad9160816f0682fe6524"


def function_body(text: str, name: str) -> str:
    match = re.search(rf"\n\s*(?:pub\s+)?fn {re.escape(name)}\s*\(", text)
    if not match:
        raise AssertionError(f"missing function {name}")
    brace = text.index("{", match.start())
    depth = 0
    for idx in range(brace, len(text)):
        if text[idx] == "{":
            depth += 1
        elif text[idx] == "}":
            depth -= 1
            if depth == 0:
                return text[brace + 1 : idx]
    raise AssertionError(f"unterminated function {name}")


def writes(body: str) -> set[str]:
    found = set(re.findall(r"f\.(color|roughness|metallic|occlusion)\s*=", body))
    if re.search(r"heights\s*\[[^\]]+\]\s*\+=", body):
        found.add("height")
    return found


text = SOURCE.read_text(encoding="utf-8")
expected = {
    "apply_edge_wear": {"color", "roughness", "metallic"},
    "apply_corrosion": {"color", "roughness", "metallic", "height"},
    "apply_crevice_dirt": {"color", "roughness", "occlusion"},
    "apply_streaks": {"color", "roughness"},
}

observed = {name: sorted(writes(function_body(text, name))) for name in expected}
assert {name: set(channels) for name, channels in observed.items()} == expected

apply_body = function_body(text, "apply")
positions = [
    apply_body.index("apply_edge_wear("),
    apply_body.index("apply_corrosion("),
    apply_body.index("apply_crevice_dirt("),
    apply_body.index("apply_streaks("),
]
assert positions == sorted(positions), "weathering layer order drifted"

noop_body = function_body(text, "is_noop")
for amount in [
    "edge_wear.amount",
    "corrosion.amount",
    "crevice_dirt.amount",
    "streaks.amount",
]:
    assert amount in noop_body, f"no-op predicate omits {amount}"

required_tests = [
    "fn default_config_is_a_noop()",
    "fn every_layer_changes_the_surface_alone()",
    "fn only_corrosion_adds_relief()",
    "fn geometric_masks_wrap_at_the_tile_edge()",
    "fn weathering_is_seed_deterministic()",
]
for test in required_tests:
    assert test in text, f"missing upstream regression {test}"

seed_domains = sorted(set(re.findall(r"wrapping_add\((0x[0-9A-F]+)\)", text)))
assert len(seed_domains) >= 5, "unrelated processes do not have distinct seed domains"

result = {
    "status": "PASS_STATIC_SOURCE_AUDITION",
    "teacherRepository": "TheJanusStream/symbios-texture",
    "pinnedCommit": PINNED_COMMIT,
    "sourceSha256": hashlib.sha256(text.encode()).hexdigest(),
    "layerOrder": ["edge_wear", "corrosion", "crevice_dirt", "streaks"],
    "observedChannelOwnership": observed,
    "distinctSeedDomains": seed_domains,
    "upstreamTestsObserved": required_tests,
    "runtimeStatus": "UPSTREAM_GITHUB_ACTIONS_SUCCESS; LOCAL_CARGO_UNAVAILABLE",
    "productionMotherRun": False,
}
print(json.dumps(result, indent=2, sort_keys=True))
