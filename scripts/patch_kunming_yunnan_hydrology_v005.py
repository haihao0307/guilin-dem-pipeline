#!/usr/bin/env python3
"""Build Kunming Yunnan Hydrology V005 from the published V004 site.

V005 is an additive browser correction. It keeps every V004 data asset and fixes:
1. north/east world orientation,
2. orbit and pan sensitivity,
3. default river width and minor-drain visibility.

The authoritative float32 DEM is never opened or modified by this script.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def patch_index(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    text = text.replace(
        "昆明 DEM 云南卫星图式与真实 OSM 水系 V004",
        "昆明 DEM 云南卫星图式与真实 OSM 水系 V005",
    )
    text = text.replace("styles.css?v=4", "styles.css?v=5")
    text = text.replace("app.js?v=4", "app.js?v=5")
    text = replace_once(
        text,
        "手绘水系为 0。",
        "手绘水系为 0。V005 已校正北向、鼠标轨道关系和河道显示尺度。",
        "lead correction",
    )
    text = replace_once(
        text,
        '<div class="badges"><span>现代 OSM 参考</span><span>历史真值 0</span><span>手绘水系 0</span></div>',
        '<div class="badges"><span>现代 OSM 参考</span><span>北向已校正</span><span>历史真值 0</span><span>手绘水系 0</span></div>',
        "badges",
    )
    text = replace_once(
        text,
        "<body>",
        '<body>\n<div id="compass" class="compass" aria-label="北向指示"><div id="compassNeedle" class="compass-needle">↑</div><b>N</b></div>',
        "compass",
    )
    text = replace_once(
        text,
        '<output id="hydroDetailOut">18%</output></label><input id="hydroDetail" type="range" min="0" max="100" value="18">',
        '<output id="hydroDetailOut">0%</output></label><input id="hydroDetail" type="range" min="0" max="100" value="0">',
        "minor drainage default",
    )
    text = replace_once(
        text,
        '<output id="riverWidthOut">28%</output></label><input id="riverWidth" type="range" min="0" max="100" value="28">',
        '<output id="riverWidthOut">10%</output></label><input id="riverWidth" type="range" min="0" max="100" value="10">',
        "river width default",
    )
    text = text.replace(
        "左键拖动旋转，右键拖动或按住 Shift 平移，滚轮连续缩放。",
        "左键拖动旋转，右键拖动或按住 Shift 平移，滚轮连续缩放。交互速度按画布尺寸计算，方向与标准 OrbitControls 一致。",
    )
    text = text.replace(
        "正在载兕昆明 V004 三维地形与真实 OSM 水系…",
        "正在载入昆明 V005 三维地形与真实 OSM 水系…",
    )
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
    text = replace_once(text, "manifest.json?v=4", "manifest.json?v=5", "manifest version")
    text = replace_once(
        text,
        "statusEl.textContent = `${message} · 已切换二维云南卫星图式预览`;",
        "document.documentElement.dataset.viewer = 'fallback';\n  document.documentElement.dataset.orientation = 'east-positive-x_north-negative-z';\n  statusEl.textContent = `${message} · 已切换二维云南卫星图式预览`;",
        "fallback state",
    )
    text = replace_once(
        text,
        "const v = Math.max(0, Math.min(1, 0.5 - z / worldDepth));",
        "const v = Math.max(0, Math.min(1, z / worldDepth + 0.5));",
        "ground inverse orientation",
    )
    text = replace_once(
        text,
        "vec3 p=vec3((aUV.x-.5)*uWorldSize.x,elevation-uMeanElevation,(.5-aUV.y)*uWorldSize.y);",
        "vec3 p=vec3((aUV.x-.5)*uWorldSize.x,elevation-uMeanElevation,(aUV.y-.5)*uWorldSize.y);",
        "vertex orientation",
    )
    text = replace_once(
        text,
        "vec3 normal=normalize(vec3(-dx,1,dz));",
        "vec3 normal=normalize(vec3(-dx,1,-dz));",
        "normal orientation",
    )
    text = replace_once(
        text,
        """  float mainThreshold=mix(.94,.50,uRiverWidth);
  float minorThreshold=mix(.98,.70,uRiverWidth);
  float mainRiver=smoothstep(mainThreshold,min(1.0,mainThreshold+.09),waterMask.r);
  float minorRiver=smoothstep(minorThreshold,min(1.0,minorThreshold+.08),waterMask.g)*uHydroDetail;""",
        """  float widthCurve=pow(clamp(uRiverWidth,0.0,1.0),1.45);
  float mainThreshold=mix(.995,.905,widthCurve);
  float minorThreshold=mix(.998,.955,widthCurve);
  float mainRiver=smoothstep(mainThreshold,min(1.0,mainThreshold+.004),waterMask.r);
  float minorRiver=smoothstep(minorThreshold,min(1.0,minorThreshold+.003),waterMask.g)*uHydroDetail;""",
        "river width shader",
    )
    text = replace_once(
        text,
        "float opacity=mix(.62,.91,uWaterColor);",
        "float opacity=mix(.46,.78,uWaterColor);",
        "water opacity",
    )
    text = replace_once(
        text,
        "    hydroDetail: 0.18,\n    riverWidth: 0.28,",
        "    hydroDetail: 0.00,\n    riverWidth: 0.10,",
        "default hydrology parameters",
    )
    text = replace_once(
        text,
        "  const camera = { yaw: -0.62, pitch: 0.72, distance: 104000, x: 0, z: 0 };",
        "  const camera = { yaw: 0.0, pitch: 0.72, distance: 104000, x: 0, z: 0 };\n  const compassNeedle = document.getElementById('compassNeedle');\n  const fovRadians = Math.PI / 4;\n  const rotateSpeed = 0.86;",
        "camera initialization",
    )
    text = replace_once(
        text,
        """    if (panning) {
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
    }""",
        """    if (panning) {
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
    }""",
        "OrbitControls-compatible interaction",
    )
    text = replace_once(
        text,
        "    canvas.setPointerCapture(event.pointerId);",
        "    canvas.setPointerCapture(event.pointerId);\n    canvas.classList.add('dragging');",
        "drag cursor start",
    )
    text = replace_once(
        text,
        "    canvas.releasePointerCapture(event.pointerId);\n  });",
        "    canvas.releasePointerCapture(event.pointerId);\n    canvas.classList.remove('dragging');\n  });\n  canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('dragging'); });",
        "drag cursor end",
    )
    text = replace_once(
        text,
        "    perspective(projection, Math.PI / 4, canvas.width / canvas.height, near, far);",
        "    perspective(projection, fovRadians, canvas.width / canvas.height, near, far);",
        "shared FOV",
    )
    text = replace_once(
        text,
        "    statusEl.textContent = `V004 · ${desktopHigh ? '4096 级色彩' : '2048 级色彩'}",
        "    if (compassNeedle) compassNeedle.style.transform = `rotate(${camera.yaw}rad)`;\n    statusEl.textContent = `V005 · 北向已校正 · ${desktopHigh ? '4096 级色彩' : '2048 级色彩'}",
        "status and compass",
    )
    text = replace_once(
        text,
        "  render();\n}",
        "  document.documentElement.dataset.viewer = 'ready';\n  document.documentElement.dataset.orientation = 'east-positive-x_north-negative-z';\n  document.documentElement.dataset.controls = 'orbit-standard';\n  render();\n}",
        "ready state",
    )
    target.write_text(text, encoding="utf-8")


def patch_manifest(source: Path, target: Path) -> None:
    manifest = json.loads(source.read_text(encoding="utf-8"))
    manifest["schemaVersion"] = "kunming_yunnan_hydrology_web@5.0.0"
    manifest["title"] = "昆明 DEM 云�s卫星图式与真实 OSM 水系 V005"
    manifest["status"] = "orientation_controls_river_scale_corrected_user_review_pending"
    display = manifest.setdefault("displayRules", {})
    display.update({
        "orientation": "east-positive-x_north-negative-z",
        "northUpRaster": True,
        "mouseControls": "OrbitControls-compatible: left orbit, right/Shift pan, wheel zoom",
        "defaultRiverWidthPercent": 10,
        "defaultMinorDrainagePercent": 0,
        "riverOpacityRange": [0.46, 0.78],
    })
    manifest["v005Corrections"] = {
        "northSouthAxis": "raster north maps to world -Z",
        "groundSampling": "inverse mapping updated to v=z/depth+0.5",
        "terrainNormal": "Z derivative sign corrected",
        "orbitSensitivity": "canvas-height normalized",
        "panSensitivity": "perspective/FOV normalized",
        "riverWidth": "conservative nonlinear threshold with minor drainage hidden by default",
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

    readme = (args.source / "README.md").read_text(encoding="utf-8").replace("V004", "V005")
    readme += "\n\n## V005 corrections\n\nNorth maps to world -Z, east to +X. Mouse orbit and pan use canvas-size/FOV-normalized formulas matching standard orbit-viewer conventions. River display uses a conservative nonlinear width curve, with minor drains hidden by default.\n"
    (args.output / "README.md").write_text(readme, encoding="utf-8")

    for name in ["DEPLOYMENT_REPORT.json", "BROWSER_QA.json", "KUNMING_V004_DESKTOP.png", "KUNMING_V004_MOBILE.png"]:
        path = args.output / name
        if path.exists():
            path.unlink()

    print(json.dumps({
        "status": "complete",
        "source": str(args.source),
        "output": str(args.output),
        "authoritativeDemModified": False,
        "orientation": "east-positive-x_north-negative-z",
        "defaultRiverWidthPercent": 10,
        "defaultMinorDrainagePercent": 0,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
