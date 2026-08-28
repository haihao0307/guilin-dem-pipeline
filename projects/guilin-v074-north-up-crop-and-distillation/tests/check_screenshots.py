from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image, ImageStat


def inspect(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        stat = ImageStat.Stat(rgb)
        mean = sum(stat.mean) / 3
        extrema = rgb.getextrema()
        spread = sum(high - low for low, high in extrema) / 3
        return {
            "file": path.name,
            "width": image.width,
            "height": image.height,
            "mean_luminance_proxy": mean,
            "channel_spread": spread,
            "bytes": path.stat().st_size,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    results = [inspect(path) for path in args.images]
    for result in results:
        assert result["width"] >= 390
        assert result["height"] >= 700
        assert result["bytes"] > 20_000
        assert 75 < result["mean_luminance_proxy"] < 248
        assert result["channel_spread"] > 80
    payload = {"schema": "guilin-v074-screenshot-qa/v1", "passed": True, "screenshots": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
