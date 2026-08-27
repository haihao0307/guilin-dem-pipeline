#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create Kunming V006 from the published V005 browser site.

V006 keeps the verified north orientation and orbit controls, replaces the surface
with a fine-detail Yunnan plateau color system, rebuilds the OSM centerline mask at
narrow display scale, and disables animated water shading.
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
    text = text.replace("V005", "V006")
    text = text.replace("styles.css?v=5", "styles.css?v=6").replace("app.js?v=5", "app.js?v=6")
    text = one(
        text,
        '<div id="fallback" hidden><img id="fallbackImage" src="assets/fallback_yunnan_water_v004.jpg" alt="昆明 DEM 云南卫星图式二维预览" draggable="false"></div>',
        '<div id="fallback" hidden><img id="fallbackImage" src="assets/fallback_yunnan_static_v006.jpg" alt="昆明 DEM 云南高原精细卫星图式二维预览" draggable="false"></div>',
        "fallback image",
    )
    text = sub_one(
        text,
        r"<p class=\"lead\">.*?</p>",
        '<p class="lead">沿用冻结的无压缩 12.5 米 DEM。V006 重点重建云南高原地表色彩，以高程、坡度、坡向、曲率、局部起伏、谷地湿润度和多光向明暗共同驱动。河道与湖泊仍来自现代 OpenStreetMap，河道中心线已收窄，水面保持静态。</p>',
        "lead",
        flags=re.S,
    )
    text = text.replace("云南卫星图", "云南高原卫星图")
    text = text.replace("卫星色彩层次", "地表细节层次")
    text = text.replace("湿润绿色", "谷地与林地绿色")
    text = text.replace("裸岩与红土", "红土与裸岩层次")
    text = text.replace("水色深浅", "静态水色深浅")
    text = text.replace("河道宽度", "河道显示宽度")
    text = sub_one(text, r'(<input id="richness"[^>]*value=")62(")', r"\g<1>78\2", "richness default")
    text = sub_one(text, r'(<output id="richnessOut">)62%(</output>)', r"\g<1>78%\2", "richness output")
    text = sub_one(text, r'(<input id="moisture"[^>]*value=")50(")', r"\g<1>58\2", "moisture default")
    text = sub_one(text, r'(<output id="moistureOut">)50%(</output>)', r"\g<1>58%\2", "moisture output")
    text = sub_one(text, r'(<input id="rock"[^>]*value=")48(")', r"\g<1>64\2", "rock default")
    text = sub_one(text, r'(<output id="rockOut">)48%(</output>)', r"\g<1>64%\2", "rock output")
    text = sub_one(text, r'(<input id="waterColor"[^>]*value=")58(")', r"\g<1>42\2", "water default")
    text = sub_one(text, r'(<output id="waterColorOut">)58%(</output>)', r"\g<1>42%\2", "water output")
    text = sub_one(text, r'(<input id="riverWidth"[^>]*value=")10(")', r"\g<1>4\2", "river default")
    text = sub_one(text, r'(<output id="riverWidthOut">)10%(</output>)', r"\g<1>4%\2", "river output")
    text = sub_one(
        text,
        r'\s*<label><span>河流速度</span><output id="flowSpeedOut">52%</output></label><input id="flowSpeed"[^>]*>\s*',
        "\n",
        "remove flow control",
    )
    text = sub_one(
        text,
        r'\s*<label><span>湖面波浪</span><output id="waveOut">46%</output></label><input id="wave"[^>]*>\s*',
        "\n",
        "remove wave control",
    )
    text = sub_one(
        text,
        r"<details>.*?</details>",
        """<details>
    <summary>数据与操作说明</summary>
    <p>左键拖动旋转，右键拖动或按住 Shift 拖动用于平移，滚轮连续缩放。页面不提供相机预设，镜头完全由你自行控制。</p>
    <p>河流中心线固定，河宽滑块只改变中心线两侧的横向显示宽度。默认只显示主要水路，次级沟渠保持关闭。湖岸边界固定，水面采用静态颜色，本版不生成波纹、流动高光或动画。</p>
    <p>V006 地表色彩使用云南高原知识规则生成，网页资产可重新构建，权威 DEM 保持无压缩且不被回写。© OpenStreetMap contributors，ODbL 1.0。</p>
  </details>""",
        "details",
        flags=re.S,
    )
    text = text.replace("正在载入昆明 V004 三维地形与真实 OSM 水系…", "正在载入昆明 V006 云南高原精细地表与静态 OSM 水系…")
    target.write_text(text, encoding="utf-8")


def patch_styles(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    text += """
/* V006 surface-focused presentation */
.panel{background:rgba(12,18,18,.89)}
.controls input{accent-color:#c8d894}
.badges span{background:rgba(127,151,81,.16)}
"""
    target.write_text(text, encoding="utf-8")


def patch_app(source: Path, target: Path) -> None:
    text = source.read_text(encoding="utf-8")
    text = text.replace("manifest.json?v=5", "manifest.json?v=6")
    text = one(
        text,
        "  const surfacePath = desktopHigh ? 'assets/surface_yunnan_v004.png' : 'assets/surface_yunnan_v004_2048.png';",
        "  const surfacePath = desktopHigh ? 'assets/surface_yunnan_v006.png' : 'assets/surface_yunnan_v006_2048.png';",
        "surface path",
    )
    text = one(
        text,
        "  const [meshCols,meshRows]=qaRenderMode?[128,176]:[256,352];",
        "  const [meshCols,meshRows]=qaRenderMode?[160,220]:(desktopHigh?[640,879]:[448,615]);",
        "mesh density",
    )
    text = text.replace("assets/osm_water_mask_v004.png", "assets/osm_water_mask_v006.png")
    text = text.replace("正在载入 ${desktopHigh ? '4096 级' : '2048 级'}云南卫星图式、水系与高程纹理…", "正在载入 ${desktopHigh ? '4096 级' : '2048 级'}云南高原精细地表、静态水系与高程纹理…")

    mode_pattern = r"  if\(uMode==0\)\{.*?  \}else if\(uMode==1\)\{\n    color=surface\*\(\.88\+\.18\*diffuse\);\n  \}else if\(uMode==2\)\{\n    color=elevationPalette\(t\)\*illumination;\n  \}else\{\n    color=mix\(vec3\(\.20,\.25,\.22\),surface,\.30\)\*\(\.75\+\.25\*diffuse\);\n  \}"
    mode_replacement = """  if(uMode==0){
    vec3 yunnan=saturation(surface,.92+.22*uRichness);
    float valleyGreen=clamp((1.0-t)*flatTerrain*(.25+.75*uMoisture),0.0,1.0);
    yunnan=mix(yunnan,vec3(.14,.29,.14),valleyGreen*.08*uMoisture);
    float exposedRock=clamp(slope*.76+(t-.62)*.72,0.0,1.0);
    yunnan=mix(yunnan,vec3(.31,.27,.23),exposedRock*.08*uRock);
    color=yunnan*(.90+.12*diffuse);
  }else if(uMode==1){
    color=surface*(.92+.12*diffuse);
  }else if(uMode==2){
    color=elevationPalette(t)*illumination;
  }else{
    color=mix(vec3(.18,.23,.20),surface,.42)*(.82+.18*diffuse);
  }"""
    text = sub_one(text, mode_pattern, mode_replacement, "surface shader mode", flags=re.S)

    water_pattern = r"  vec4 waterMask=texture\(uWaterMask,vUV\);\n  vec3 flowTex=texture\(uFlow,vUV\)\.rgb;.*?  color\+=water\*vec3\(\.36,\.49,\.55\)\*glint\*uWave\*\.30;"
    water_replacement = """  vec4 waterMask=texture(uWaterMask,vUV);
  float widthCurve=pow(clamp(uRiverWidth,0.0,1.0),1.70);
  float mainThreshold=mix(.996,.42,widthCurve);
  float minorThreshold=mix(.998,.65,widthCurve);
  float mainRiver=smoothstep(mainThreshold,min(1.0,mainThreshold+.003),waterMask.r);
  float minorRiver=smoothstep(minorThreshold,min(1.0,minorThreshold+.003),waterMask.g)*uHydroDetail;
  float river=uShowRivers==1?max(mainRiver,minorRiver):0.0;
  float lake=uShowLakes==1?smoothstep(.22,.82,waterMask.b):0.0;
  float water=max(river,lake);
  vec3 deep=mix(vec3(.035,.16,.20),vec3(.055,.27,.31),uWaterColor);
  vec3 shallow=mix(vec3(.10,.28,.30),vec3(.16,.40,.42),uWaterColor);
  vec3 staticWater=mix(deep,shallow,.18+.20*lake);
  float opacity=mix(.42,.66,uWaterColor);
  color=mix(color,staticWater,water*opacity);"""
    text = sub_one(text, water_pattern, water_replacement, "static water shader", flags=re.S)

    text = one(
        text,
        "    richness: 0.62,\n    moisture: 0.50,\n    rock: 0.48,\n    waterColor: 0.58,\n    hydroDetail: 0.00,\n    riverWidth: 0.10,\n    flowSpeed: 0.52,\n    wave: 0.46,",
        "    richness: 0.78,\n    moisture: 0.58,\n    rock: 0.64,\n    waterColor: 0.42,\n    hydroDetail: 0.00,\n    riverWidth: 0.04,\n    flowSpeed: 0.00,\n    wave: 0.00,",
        "defaults",
    )
    text = one(text, "  bindRange('flowSpeed', 'flowSpeed', 'flowSpeedOut');\n", "", "remove flow binding")
    text = one(text, "  bindRange('wave', 'wave', 'waveOut');\n", "", "remove wave binding")
    text = text.replace("V005 · 北向已校正", "V006 · 云南高原精细地表 · 静态水面")
    target.write_text(text, encoding="utf-8")


def patch_manifest(source: Path, target: Path) -> None:
    manifest = json.loads(source.read_text(encoding="utf-8"))
    manifest["schemaVersion"] = "kunming_yunnan_surface_web@6.0.0"
    manifest["title"] = "Kunming DEM Yunnan Plateau Fine Surface V006"
    manifest["status"] = "fine_yunnan_surface_narrow_osm_static_water_user_review_pending"
    display = manifest.setdefault("displayRules", {})
    display.update(
        {
            "defaultRiverWidthPercent": 4,
            "defaultMinorDrainagePercent": 0,
            "waterAnimation": False,
            "waterSurface": "static color only",
            "surfaceDetail": "4096 desktop / 2048 compatibility",
            "manualCameraOnly": True,
        }
    )
    manifest["hydrology"]["waterSurfaceMethod"] = "fixed OSM shoreline with static display color; no ripple or animated glint"
    manifest["v006Corrections"] = {
        "riverMask": "OSM centerline fields skeletonized from the accepted V004 mask, no hand drawing",
        "riverDefault": "4 percent with minor drainage disabled",
        "surface": "Yunnan plateau warm olive, valley green, red soil and weathered rock multi-scale system",
        "waterAnimation": "disabled",
        "camera": "V005 verified orientation and orbit controls retained",
        "authoritativeDemModified": False,
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
    readme = (args.source / "README.md").read_text(encoding="utf-8") if (args.source / "README.md").exists() else ""
    (args.output / "README.md").write_text(
        readme
        + "\n\nV006 adds the Yunnan plateau fine-surface generator, narrow OSM centerline mask, static water, and higher normal-view mesh density.\n",
        encoding="utf-8",
    )
    for name in [
        "DEPLOYMENT_REPORT.json",
        "BROWSER_QA.json",
        "KUNMING_V005_DESKTOP.png",
        "KUNMING_V005_MOBILE.png",
    ]:
        stale = args.output / name
        if stale.exists():
            stale.unlink()
    print(json.dumps({"status": "complete", "version": "V006", "defaultRiverWidthPercent": 4, "waterAnimation": False, "authoritativeDemModified": False}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
