from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one replacement, got {count}")
    return updated


def patch_pipeline() -> None:
    path = ROOT / "pipeline" / "build_online_assets.py"
    text = path.read_text(encoding="utf-8")

    name_block = '''def feature_name_values(properties: dict[str, Any]) -> list[str]:
    values: list[str] = []
    for key, value in properties.items():
        lowered = str(key).lower()
        if lowered == "name" or lowered.startswith("name:") or lowered in {
            "alt_name", "official_name", "short_name", "local_name", "old_name",
            "name_zh", "name_en", "river_name",
        }:
            if value not in (None, ""):
                values.append(str(value).strip())
    return values


def normalize_river_name(value: str) -> str:
    return " ".join(value.strip().lower().replace("_", " ").split())


def feature_name_blob(properties: dict[str, Any]) -> str:
    return " | ".join(feature_name_values(properties))


def mainstem_code(properties: dict[str, Any]) -> int:
    values = {normalize_river_name(value) for value in feature_name_values(properties)}
    for code, patterns in MAJOR_MAINSTEM_PATTERNS.items():
        aliases = {normalize_river_name(pattern) for pattern in patterns}
        if values.intersection(aliases):
            return code
    marker = str(properties.get("mainstem") or properties.get("is_mainstem") or "").strip().lower()
    system = str(properties.get("system") or "").strip().lower()
    if marker in {"1", "true", "yes", "main", "mainstem"}:
        if system in {"li", "lijiang", "li-jiang"}:
            return 1
        if system in {"xiang", "xiangjiang", "xiang-jiang"}:
            return 2
        if system in {"zi", "zijiang", "zi-jiang", "zishui", "fuyi"}:
            return 3
    return 0


def node_rank'''
    text = replace_once(
        text,
        r"def feature_name_blob\(properties: dict\[str, Any\]\) -> str:.*?def node_rank",
        name_block,
        "exact mainstem name classifier",
        re.S,
    )

    text = text.replace(
        '    adjacent: dict[tuple[float, float], list[int]] = {}\n',
        '',
        1,
    )
    text = text.replace(
        '        adjacent.setdefault(start_key, []).append(edge_index)\n        adjacent.setdefault(end_key, []).append(edge_index)\n',
        '',
        1,
    )

    text = replace_once(
        text,
        r"\n    # Extend named main-stem styling across short unnamed OSM way breaks\..*?\n    mainstem_segment_counts =",
        '''
    # Width and deep colour are reserved for explicitly named OSM main-stem features.
    # Unnamed gaps remain visible as ordinary river segments, so no tributary can inherit
    # main-stem styling through a branching graph. Source geometry stays unchanged.

    mainstem_segment_counts =''',
        "remove branching mainstem style propagation",
        re.S,
    )

    guard_anchor = '''    if missing_mainstems:
        examples = sorted(named_rivers_seen)[:80]
        raise RuntimeError(f"missing named main-stem systems {missing_mainstems}; named rivers seen: {examples}")
'''
    guard_replacement = guard_anchor + '''
    explicit_mainstem_segment_count = sum(mainstem_segment_counts.values())
    if not 1_000 <= explicit_mainstem_segment_count <= 10_000:
        raise RuntimeError(
            f"explicit main-stem segment count outside reviewed range: {explicit_mainstem_segment_count}"
        )
'''
    if guard_anchor not in text:
        raise RuntimeError("mainstem count guard anchor missing")
    text = text.replace(guard_anchor, guard_replacement, 1)

    text = text.replace(
        '            "style_only_mainstem_gap_propagation": True,',
        '            "mainstem_classification": "exact-match-on-individual-OSM-name-values",\n            "style_only_mainstem_gap_propagation": False,\n            "explicit_mainstem_segment_count": explicit_mainstem_segment_count,',
        1,
    )
    path.write_text(text, encoding="utf-8")


def patch_browser_qa() -> None:
    path = ROOT / "tests" / "browser_full_map_cdp.py"
    text = path.read_text(encoding="utf-8")
    old_detector = '        const water = blue >= 145 && blue - green >= 22 && green - red >= 42;'
    new_detector = '        const water = blue >= 82 && blue - green >= 5 && green - red >= 16;'
    if old_detector not in text:
        if new_detector not in text:
            raise RuntimeError("water-colour pixel detector anchor missing")
    else:
        text = text.replace(old_detector, new_detector, 1)

    count_anchor = '''    mainstem_counts = style.get("mainstem_segment_counts") or {}
    for name in ("li", "xiang", "zi"):
        if int(mainstem_counts.get(name, 0)) <= 0:
            failures.append(f"missing {name} mainstem segments")
'''
    count_replacement = count_anchor + '''    explicit_mainstem_total = sum(int(mainstem_counts.get(name, 0)) for name in ("li", "xiang", "zi"))
    if not 1_000 <= explicit_mainstem_total <= 10_000:
        failures.append(f"explicit mainstem segment count outside reviewed range: {explicit_mainstem_total}")
'''
    if count_anchor not in text:
        raise RuntimeError("browser mainstem count anchor missing")
    text = text.replace(count_anchor, count_replacement, 1)
    path.write_text(text, encoding="utf-8")


def patch_profile() -> None:
    path = ROOT / "viewer" / "HYDROLOGY_RENDER_V2.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["schema"] = "guilin-hydrology-render-profile/v3.1"
    payload["profile"] = "basin-hierarchy-mainstem-gradient-v3"
    payload["mainstem_classification"] = "exact-match-on-individual-OSM-name-values"
    payload["mainstem_style_propagation"] = False
    payload["explicit_mainstem_segment_count_range"] = [1000, 10000]
    payload["pixel_detector"] = {
        "minimum_blue": 82,
        "minimum_blue_minus_green": 5,
        "minimum_green_minus_red": 16,
    }
    payload["visualAcceptance"] = False
    payload["productionReady"] = False
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    patch_pipeline()
    patch_browser_qa()
    patch_profile()
    print("Restricted Guilin major-river styling to exact named OSM main stems")


if __name__ == "__main__":
    main()
