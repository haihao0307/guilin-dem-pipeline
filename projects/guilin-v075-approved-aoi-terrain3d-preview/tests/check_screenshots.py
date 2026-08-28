from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageStat


def inspect(path: Path, expected_size: tuple[int, int]) -> dict:
    image = Image.open(path).convert("RGB")
    width, height = image.size
    sample = image.resize((160, 100))
    colors = sample.getcolors(maxcolors=160 * 100) or []
    stat = ImageStat.Stat(sample)
    channel_ranges = [extreme[1] - extreme[0] for extreme in sample.getextrema()]
    center = sample.crop((20, 18, 140, 92))
    center_colors = center.getcolors(maxcolors=120 * 74) or []
    result = {
        "path": str(path),
        "size": [width, height],
        "expected_size": list(expected_size),
        "size_ok": (width, height) == expected_size,
        "unique_color_count": len(colors),
        "center_unique_color_count": len(center_colors),
        "channel_ranges": channel_ranges,
        "mean": stat.mean,
    }
    result["passed"] = (
        result["size_ok"]
        and result["unique_color_count"] > 350
        and result["center_unique_color_count"] > 180
        and max(channel_ranges) > 75
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("desktop", type=Path)
    parser.add_argument("mobile", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = {
        "schema": "guilin-v075-screenshot-qa/v1",
        "desktop": inspect(args.desktop, (1600, 1000)),
        "mobile": inspect(args.mobile, (390, 844)),
    }
    payload["passed"] = payload["desktop"]["passed"] and payload["mobile"]["passed"]
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))
    if not payload["passed"]:
        raise SystemExit(1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
