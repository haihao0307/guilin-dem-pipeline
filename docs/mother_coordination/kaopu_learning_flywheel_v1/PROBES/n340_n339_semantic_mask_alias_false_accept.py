#!/usr/bin/env python3
"""Adversarial replay against N339's static weathering-source audition.

The mutation makes four unrelated processes derive their working mask from the
same generic noise expression while preserving N339's syntactic evidence:
declared function order, channel writes, no-op fields, test names, and at least
five distinct seed literals elsewhere in the source.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


SOURCE = Path("/workspace/scratch/a0bbfc7ad8f6/symbios-texture-audition/src/weathering.rs")


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


def n339_static_audit(text: str) -> dict[str, object]:
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
    assert positions == sorted(positions)

    noop_body = function_body(text, "is_noop")
    for amount in [
        "edge_wear.amount",
        "corrosion.amount",
        "crevice_dirt.amount",
        "streaks.amount",
    ]:
        assert amount in noop_body

    required_tests = [
        "fn default_config_is_a_noop()",
        "fn every_layer_changes_the_surface_alone()",
        "fn only_corrosion_adds_relief()",
        "fn geometric_masks_wrap_at_the_tile_edge()",
        "fn weathering_is_seed_deterministic()",
    ]
    for test in required_tests:
        assert test in text

    seed_domains = sorted(set(re.findall(r"wrapping_add\((0x[0-9A-F]+)\)", text)))
    assert len(seed_domains) >= 5
    return {"observedChannelOwnership": observed, "seedDomains": seed_domains}


original = SOURCE.read_text(encoding="utf-8")
mutated = original

# All four processes now derive their working mask from the same seed, scale,
# octave count, and generator. Old unrelated seed literals remain elsewhere in
# executable tests/helpers, so a whole-file literal count still looks diverse.
mutated = mutated.replace(
    "let breakup = noise_grid(w, h, cfg.seed.wrapping_add(0x5EA1), c.breakup_scale, 3);",
    "let breakup = noise_grid(w, h, cfg.seed.wrapping_add(0xABCD), 4.0, 2);",
)
mutated = mutated.replace(
    "let barrier = noise_grid(w, h, cfg.seed.wrapping_add(0x7005), c.barrier_scale, 3);\n    let mask = corrosion_mask(hollow, &barrier, w, h, cfg);",
    "let barrier = noise_grid(w, h, cfg.seed.wrapping_add(0xABCD), 4.0, 2);\n    let mask: Vec<f64> = barrier.iter().map(|v| normalize(*v)).collect();",
)
mutated = mutated.replace(
    "let facing = upward_facing(heights, w, h);",
    "let facing = noise_grid(w, h, cfg.seed.wrapping_add(0xABCD), 4.0, 2);",
    1,
)
mutated = mutated.replace(
    "let recess = hollow[i].max(0.0);",
    "let recess = normalize(facing[i]);",
    1,
)
mutated = mutated.replace(
    "let mask = streak_mask(convex, heights, w, h, cfg);",
    "let mask: Vec<f64> = noise_grid(w, h, cfg.seed.wrapping_add(0xABCD), 4.0, 2)\n        .iter().map(|v| normalize(*v)).collect();",
    1,
)

assert mutated != original
assert mutated.count("cfg.seed.wrapping_add(0xABCD), 4.0, 2") == 4

audit = n339_static_audit(mutated)
result = {
    "caseId": "N340-N339-SEMANTIC-MASK-ALIAS-FALSE-ACCEPT",
    "expected": "HOLD_CROSS_PROCESS_MASK_ALIASING",
    "actual": "PASS_STATIC_SOURCE_AUDITION",
    "falseAccept": True,
    "sharedMaskExpressionCount": 4,
    "n339EvidenceStillSatisfied": audit,
    "rootCause": (
        "N339 counts distinct seed literals anywhere in the file but does not bind each "
        "declared process to its actual mask-construction digest or compare observed masks."
    ),
}
print(json.dumps(result, indent=2, sort_keys=True))
