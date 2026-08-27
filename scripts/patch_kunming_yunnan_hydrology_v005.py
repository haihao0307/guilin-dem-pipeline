#!/usr/bin/env python3
"""Create Kunming V005 from the published V004 browser site.

ASCII-only source. V005 changes display orientation, orbit/pan controls, and river
rendering defaults. It copies browser assets and never opens the authoritative DEM.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


def one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one exact match, found {count}")
    return text.replace(old, new, 1)


def sub_one(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")
    return text


def patch_index(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    text = sub_one(text, r"(<title>[^<]*?)V004(</title>)", r"\1V005\2", "title")
    text = sub_one(text, r"(<h1>[^<]*?)V004(</h1>)", r"\1V005\2", "heading")
    text = text.replace("styles.css?v=4", "styles.css?v=5").replace("app.js?v=4", "app.js?v=5")
    text = one(
        text,
        "<body>",
        '<body>\n<div id="compass" class="compass" aria-label="North"><div id="compassNeedle" class="compass-needle">&#8593;</div><b>N</b></div>',
        "compass",
    )
    text = sub_one(text, r'(<input id="hydroDetail"[^>]*value=")18(")', r"\g<1>0\2", "minor default")
    text = sub_one(text, r'(<input id="riverWidth"[^>]*value=")28(")', r"\g<1>10\2", "width default")
    text = sub_one(text, r'(<output id="hydroDetailOut">)18%(</output>)', r"\g<1>0%\2", "minor output")
    text = sub_one(text, r'(<output id="riverWidthOut">)28%(</output>)', r"\g<1>10%\2", "width output")
    target.write_text(text, encoding="utf-8")


def patch_styles(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    text += """
#terrain{cursor:grab;touch-action:none}
#terrain.dragging{cursor:grabbing}
.compass{position:fixed;right:18px;top:18px;z-index:8;width:54px;height:62px;border-radius:14px;background:rgba(14,20,22,.78);border:1px solid rgba(255,255,255,.16);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;backdrop-filter:blur(10px);box-shadow:0 10px 28px rgba(0,0,0,.22);pointer-events:none}
.compass-needle{font-size:27px;line-height:24px;color:#e8efc4;transform-origin:50% 58%}
.compass b{font-size:10px;letter-spacing:.12em;color:#fff}
@media(max-width:720px){.compass{right:10px;top:10px;width:46px;height:54px}}
"""
    target.write_text(text, encoding="utf-8")


def patch_app(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    text = text.replace("manifest.json?v=4", "manifest.json?v=5")
    text = one(
        text,
        "  statusEl.textContent = `${message} · 已切换二维云南卫星图式预览`;",
        "  document.documentElement.dataset.viewer = 'fallback';\n  document.documentElement.dataset.orientation = 'east-positive-x_north-negative-z';\n  statusEl.textContent = `${message} · 已切换二维云南卫星图式预览`;",
        "fallback state",
    )
    text = one(text, "const v = Math.max(0, Math.min(1, 0.5 - z / worldDepth));", "const v = Math.max(0, Math.min(1, z / worldDepth + 0.5));", "ground orientation")
    text = one(text, "vec3 p=vec3((aUV.x-.5)*uWorldSize.x,elevation-uMeanElevation,(.5-aUV.y)*uWorldSize.y);", "vec3 p=vec3((aUV.x-.5)*uWorldSize.x,elevation-uMeanElevation,(aUV.y-.5)*uWorldSize.y);", "vertex orientation")
    text = one(text, "vec3 normal=normalize(vec3(-dx,1.0,dz));", "vec3 normal=normalize(vec3(-dx,1.0,-dz));", "normal orientation")
    text = sub_one(
        text,
        r"  float mainThreshold=mix\(\.94,\.50,uRiverWidth\);\n  float minorThreshold=mix\(\.98,\.70,uRiverWidth\);\n  float mainRiver=smoothstep\(mainThreshold,min\(1\.0,mainThreshold\+\.09\),waterMask\.r\);\n  float minorRiver=smoothstep\(minorThreshold,min\(1\.0,minorThreshold\+\.08\),waterMask\.g\)\*uHydroDetail;",
        "  float widthCurve=pow(clamp(uRiverWidth,0.0,1.0),1.45);\n  float mainThreshold=mix(.995,.905,widthCurve);\n  float minorThreshold=mix(.998,.955,widthCurve);\n  float mainRiver=smoothstep(mainThreshold,min(1.0,mainThreshold+.004),waterMask.r);\n  float minorRiver=smoothstep(minorThreshold,min(1.0,minorThreshold+.003),waterMask.g)*uHydroDetail;",
        "river shader",
    )
    text = one(text, "float opacity=mix(.62,.91,uWaterColor);", "float opacity=mix(.46,.78,uWaterColor);", "opacity")
    text = one(text, "    hydroDetail: 0.18,\n    riverWidth: 0.28,", "    hydroDetail: 0.00,\n    riverWidth: 0.10,", "defaults")
    text = one(
        text,
        "  const camera = { yaw: -0.62, pitch: 0.72, distance: 104000, x: 0, z: 0 };",
        "  const camera = { yaw: 0.0, pitch: 0.72, distance: 104000, x: 0, z: 0 };\n  const compassNeedle = document.getElementById('compassNeedle');\n  const fovRadians = Math.PI / 4;\n  const rotateSpeed = 0.86;",
        "camera",
    )
    old_move = """    if (panning) {
      const scale = Math.max(2, camera.distance * 0.00125);
      const rightX = Math.cos(camera.yaw);
      const rightZ = -Math.sin(camera.yaw);
      const forwardX = Math.sin(camera.yaw);
      const forwardZ = Math.cos(camera.yaw);
      camera.x -= dx * scale * rightX + dy * scale * forwardX;
      camera.z -= dx * scale * rightZ + dy * scale * forwardZ;
      camera.x = Math.max(-worldWidth / 2, Math.min(worldWidth / 2, camera.x));
      camera.z = Math.max(-worldDepth / 2, Math.min(worldDepth / 2, camera.z));
    } else {
      camera.yaw -= dx * 0.0055;
      camera.pitch = Math.max(0.035, Math.min(1.555, camera.pitch - dy * 0.0047));
    }"""
    new_move = """    if (panning) {
      const targetDistance = camera.distance * Math.tan(fovRadians / 2);
      const panX = 2 * dx * targetDistance / Math.max(1, canvas.clientHeight);
      const panY = 2 * dy * targetDistance / Math.max(1, canvas.clientHeight);
      const rightX = Math.cos(camera.yaw);
      const rightZ = -Math.sin(camera.yaw);
      const backwardX = Math.sin(camera.yaw);
      const backwardZ = Math.cos(camera.yaw);
      camera.x -= panX * rightX + panY * backwardX;
      camera.z -= panX * rightZ + panY * backwardZ;
      camera.x = Math.max(-worldWidth / 2, Math.min(worldWidth / 2, camera.x));
      camera.z = Math.max(-worldDepth / 2, Math.min(worldDepth / 2, camera.z));
    } else {
      const height = Math.max(1, canvas.clientHeight);
      camera.yaw -= 2 * Math.PI * dx / height * rotateSpeed;
      camera.pitch = Math.max(0.035, Math.min(1.555, camera.pitch - 2 * Math.PI * dy / height * rotateSpeed));
    }"""
    text = one(text, old_move, new_move, "mouse controls")
    text = one(text, "    canvas.setPointerCapture(event.pointerId);", "    canvas.setPointerCapture(event.pointerId);\n    canvas.classList.add('dragging');", "drag start")
    text = one(text, "    canvas.releasePointerCapture(event.pointerId);\n  });", "    canvas.releasePointerCapture(event.pointerId);\n    canvas.classList.remove('dragging');\n  });\n  canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('dragging'); });", "drag end")
    text = one(text, "    perspective(projection, Math.PI / 4, canvas.width / canvas.height, near, far);", "    perspective(projection, fovRadians, canvas.width / canvas.height, near, far);", "fov")
    text = text.replace("`V004 · ${desktopHigh", "`V005 · 北向已校正 · ${desktopHigh", 1)
    text = one(text, "    statusEl.textContent = `V005 · 北向已校正 · ${desktopHigh", "    if (compassNeedle) compassNeedle.style.transform = `rotate(${camera.yaw}rad)`;\n    statusEl.textContent = `V005 · 北向已校正 · ${desktopHigh", "compass update")
    marker = "  render();\n}"
    replacement = "  document.documentElement.dataset.viewer = 'ready';\n  document.documentElement.dataset.orientation = 'east-positive-x_north-negative-z';\n  document.documentElement.dataset.controls = 'orbit-standard';\n  render();\n}"
    text = one(text, marker, replacement, "ready state")
    target.write_text(text, encoding="utf-8")


def patch_manifest(source: Path, target: Path) -> None:
    manifest = json.loads(source.read_text(encoding="utf-8"))
    manifest["schemaVersion"] = "kunming_yunnan_hydrology_web@5.0.0"
    manifest["title"] = "Kunming DEM Yunnan OSM Hydrology V005"
    manifest["status"] = "orientation_controls_river_scale_corrected_user_review_pending"
    rules = manifest.setdefault("displayRules", {})
    rules.update({
        "orientation": "east-positive-x_north-negative-z",
        "northUpRaster": True,
        "mouseControls": "OrbitControls-compatible",
        "defaultRiverWidthPercent": 10,
        "defaultMinorDrainagePercent": 0,
        "riverOpacityRange": [0.46, 0.78],
    })
    manifest["v005Corrections"] = {
        "northSouthAxis": "raster north maps to world -Z",
        "groundSampling": "v=z/worldDepth+0.5",
        "terrainNormal": "Z derivative sign corrected",
        "orbit": "canvas-height normalized",
        "pan": "perspective/FOV normalized",
        "riverWidth": "conservative nonlinear threshold",
    }
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        shutil.rmtree(args.output)
    shutil.copytree(args.source, args.output)
    patch_index(args.source / "index.html", args.output / "index.html")
    patch_styles(args.source / "styles.css", args.output / "styles.css")
    patch_app(args.source / "app.js", args.output / "app.js")
    patch_manifest(args.source / "manifest.json", args.output / "manifest.json")
    readme = (args.source / "README.md").read_text(encoding="utf-8")
    (args.output / "README.md").write_text(readme + "\n\nV005 fixes north orientation, standard orbit/pan response, and river display scale.\n", encoding="utf-8")
    for name in ["DEPLOYMENT_REPORT.json", "BROWSER_QA.json", "KUNMING_V004_DESKTOP.png", "KUNMING_V004_MOBILE.png"]:
        stale = args.output / name
        if stale.exists():
            stale.unlink()
    print(json.dumps({"status": "complete", "orientation": "east-positive-x_north-negative-z", "defaultRiverWidthPercent": 10, "defaultMinorDrainagePercent": 0, "authoritativeDemModified": False}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
