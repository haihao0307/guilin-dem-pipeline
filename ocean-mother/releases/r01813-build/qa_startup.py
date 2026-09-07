#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html as html_lib
import json
import math
import re
import struct
import subprocess
import sys
import zlib
from pathlib import Path

EXPECTED_VERSION = "0.3.13-island-r018-startup-recovery"


def unfilter_png(path: Path) -> tuple[int, int, int, bytes]:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"{path} is not a PNG")
    pos = 8
    width = height = bit_depth = color_type = interlace = None
    compressed = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _compression, _filter, interlace = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
    if None in (width, height, bit_depth, color_type, interlace):
        raise RuntimeError("PNG IHDR missing")
    if bit_depth != 8 or interlace != 0 or color_type not in (2, 6):
        raise RuntimeError(f"unsupported PNG format depth={bit_depth} color={color_type} interlace={interlace}")
    channels = 3 if color_type == 2 else 4
    stride = width * channels
    raw = zlib.decompress(bytes(compressed))
    expected = height * (stride + 1)
    if len(raw) != expected:
        raise RuntimeError(f"unexpected PNG payload {len(raw)} != {expected}")
    rows: list[bytearray] = []
    offset = 0
    for _y in range(height):
        filter_type = raw[offset]
        offset += 1
        scan = bytearray(raw[offset : offset + stride])
        offset += stride
        prev = rows[-1] if rows else bytearray(stride)
        for x in range(stride):
            left = scan[x - channels] if x >= channels else 0
            up = prev[x]
            upper_left = prev[x - channels] if x >= channels else 0
            if filter_type == 1:
                scan[x] = (scan[x] + left) & 255
            elif filter_type == 2:
                scan[x] = (scan[x] + up) & 255
            elif filter_type == 3:
                scan[x] = (scan[x] + ((left + up) // 2)) & 255
            elif filter_type == 4:
                p = left + up - upper_left
                pa = abs(p - left)
                pb = abs(p - up)
                pc = abs(p - upper_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else upper_left
                scan[x] = (scan[x] + predictor) & 255
            elif filter_type != 0:
                raise RuntimeError(f"unsupported PNG filter {filter_type}")
        rows.append(scan)
    return width, height, channels, b"".join(rows)


def visual_probe(path: Path, mobile: bool) -> dict[str, float | int]:
    width, height, channels, pixels = unfilter_png(path)
    x0 = int(width * (0.16 if mobile else 0.22))
    x1 = int(width * (0.84 if mobile else 0.72))
    y0 = int(height * 0.18)
    y1 = int(height * 0.80)
    values: list[float] = []
    non_dark = colored = 0
    quantized: set[tuple[int, int, int]] = set()
    step = max(1, int(math.sqrt(max(1, (x1 - x0) * (y1 - y0) / 180000))))
    for y in range(y0, y1, step):
        row = y * width * channels
        for x in range(x0, x1, step):
            i = row + x * channels
            r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
            luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
            values.append(luminance)
            if luminance > 0.025:
                non_dark += 1
            if max(r, g, b) - min(r, g, b) > 8:
                colored += 1
            quantized.add((r // 16, g // 16, b // 16))
    mean = sum(values) / max(1, len(values))
    variance = sum((value - mean) ** 2 for value in values) / max(1, len(values))
    return {
        "width": width,
        "height": height,
        "samples": len(values),
        "meanLuminance": mean,
        "luminanceStdDev": math.sqrt(variance),
        "nonDarkRatio": non_dark / max(1, len(values)),
        "coloredRatio": colored / max(1, len(values)),
        "quantizedColors": len(quantized),
    }


def extract_qa(dom: str) -> dict:
    match = re.search(r'<pre[^>]*id=["\']qaProbe["\'][^>]*>(.*?)</pre>', dom, re.S | re.I)
    if not match:
        raise RuntimeError("qaProbe missing from dumped DOM")
    payload = html_lib.unescape(match.group(1)).strip()
    if not payload:
        raise RuntimeError("qaProbe remained empty")
    return json.loads(payload)


def panel_is_closed(dom: str) -> bool:
    match = re.search(r'<aside[^>]*id=["\']panel["\'][^>]*class=["\']([^"\']*)["\']', dom, re.I)
    return bool(match and "closed" in match.group(1).split())


def run_case(chrome: str, url: str, output: Path, width: int, height: int, mobile: bool) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    name = "mobile" if mobile else "desktop"
    screenshot = output / f"{name}.png"
    profile = output / f"profile-{name}"
    command = [
        chrome,
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-gpu-sandbox",
        "--disable-background-networking",
        "--no-first-run",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        f"--user-data-dir={profile}",
        f"--window-size={width},{height}",
        "--virtual-time-budget=65000",
        f"--screenshot={screenshot}",
        "--dump-dom",
        url,
    ]
    completed = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=150, check=False)
    dom = completed.stdout.decode("utf-8", errors="replace")
    log = completed.stderr.decode("utf-8", errors="replace")
    (output / f"{name}-dom.html").write_text(dom, encoding="utf-8")
    (output / f"{name}-chrome.log").write_text(log, encoding="utf-8")
    if completed.returncode != 0:
        raise RuntimeError(f"Chrome {name} exited {completed.returncode}: {log[-3000:]}")
    if not screenshot.is_file() or screenshot.stat().st_size < 20000:
        raise RuntimeError(f"Chrome {name} screenshot missing or too small")
    qa = extract_qa(dom)
    visual = visual_probe(screenshot, mobile)
    errors: list[str] = []
    if qa.get("version") != EXPECTED_VERSION:
        errors.append(f"version={qa.get('version')}")
    if qa.get("sceneReady") is not True or qa.get("ready") is not True:
        errors.append("scene did not become ready")
    if not qa.get("bootFrameDrawn"):
        errors.append("boot frame was not drawn")
    if int(qa.get("completedFrames") or 0) < 1:
        errors.append("no complete scene frame")
    if qa.get("error"):
        errors.append(f"runtime error: {qa.get('error')}")
    if qa.get("contextLost"):
        errors.append("WebGL context remained lost")
    if qa.get("queryAvailable") is not True:
        errors.append("surface query unavailable")
    if not isinstance(qa.get("firstFrameMs"), (int, float)) or qa.get("firstFrameMs", 0) <= 0:
        errors.append("firstFrameMs missing")
    if qa.get("startupStage") in {"context-ready", "boot-visible", "main-compile", "scene-render", "safe-render"}:
        errors.append(f"startup remained at {qa.get('startupStage')}")
    if visual["meanLuminance"] <= 0.035:
        errors.append(f"central canvas too dark: {visual['meanLuminance']:.4f}")
    if visual["luminanceStdDev"] <= 0.025:
        errors.append(f"central canvas lacks structure: {visual['luminanceStdDev']:.4f}")
    if visual["nonDarkRatio"] <= 0.45:
        errors.append(f"central canvas non-dark ratio low: {visual['nonDarkRatio']:.4f}")
    if visual["coloredRatio"] <= 0.20:
        errors.append(f"central canvas color ratio low: {visual['coloredRatio']:.4f}")
    if visual["quantizedColors"] <= 40:
        errors.append(f"central canvas color diversity low: {visual['quantizedColors']}")
    closed = panel_is_closed(dom)
    if mobile and not closed:
        errors.append("mobile panel did not default to closed")
    result = {
        "name": name,
        "url": url,
        "chromeReturnCode": completed.returncode,
        "qa": qa,
        "visual": visual,
        "panelClosed": closed,
        "errors": errors,
        "passed": not errors,
    }
    (output / f"{name}-report.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if errors:
        raise RuntimeError(f"{name} QA failed: " + "; ".join(errors))
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chrome", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    desktop = run_case(args.chrome, args.url, args.output, 1536, 1024, False)
    mobile = run_case(args.chrome, args.url, args.output, 390, 844, True)
    summary = {
        "status": "PASS",
        "version": EXPECTED_VERSION,
        "normalEntryTested": True,
        "desktop": desktop,
        "mobile": mobile,
        "hardwareGpuVerified": False,
        "visualAcceptance": False,
    }
    (args.output / "STARTUP_QA.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "PASS",
        "desktopStage": desktop["qa"].get("startupStage"),
        "desktopSafeMode": desktop["qa"].get("safeMode"),
        "desktopQueryVerified": desktop["qa"].get("queryVerified"),
        "mobileStage": mobile["qa"].get("startupStage"),
        "mobileSafeMode": mobile["qa"].get("safeMode"),
        "mobilePanelClosed": mobile["panelClosed"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"QA ERROR: {exc}", file=sys.stderr)
        raise
