from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dom", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    text = args.dom.read_text(encoding="utf-8", errors="replace")
    match = re.search(r'<pre[^>]+id="qaJson"[^>]*>(.*?)</pre>', text, re.S)
    if not match:
        raise SystemExit("qaJson not found in browser DOM dump")
    payload_text = html.unescape(match.group(1)).strip()
    if not payload_text:
        raise SystemExit("qaJson is empty")
    payload = json.loads(payload_text)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    assert payload["schema"] == "guilin-v074-browser-qa/v1", payload
    assert payload["passed"] is True, payload
    assert payload["failed"] == [], payload
    assert payload["runtime_errors"] == [], payload
    assert payload["aoi_status"] == "UNCONFIRMED", payload
    assert payload["source_sha256"] == "9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4", payload
    required = {
        "image_loaded",
        "north_up_contract",
        "no_rotation_control",
        "no_external_runtime_dependency",
        "four_landmarks",
        "landmark_accuracy_under_50m",
        "landmark_accuracy_under_1m",
        "labels_transparent",
        "one_coordinate_line_per_label",
        "north_south_order",
        "polygon_draw",
        "geojson_export",
        "wkt_export",
        "vertex_edit",
        "delete_and_clear",
        "rectangle_draw",
        "single_active_aoi",
        "source_hash_locked",
        "source_read_only",
        "preview_visual_reference_only",
        "status_unconfirmed",
        "default_light",
        "console_errors_zero",
        "li_xiang_layer",
    }
    assert required.issubset(payload["checks"]), payload
    assert all(payload["checks"][name] is True for name in required), payload
    print(json.dumps({"passed": True, "checks": len(payload["checks"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
