"""Build the Wenzhou V0.5.4 one-canvas real-unit cloud workbench."""
from __future__ import annotations

from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess

import assemble

VERSION = "wenzhou-workbench-0.5.4-real-cloud-units"
CLOUD_GENERA = ["ci", "cc", "cs", "ac", "as", "ns", "sc", "st", "cu", "cb"]
WEATHER_CASES = CLOUD_GENERA + ["typhoon"]


def copy_sources(implementation: Path, out: Path) -> None:
    shutil.copyfile(implementation / "terrain-index.html", out / "index.html")
    runtime = (implementation / "terrain-runtime.js").read_text(encoding="utf-8")
    runtime = runtime.replace("from'../weather-bridge.mjs'", "from'./weather-scene.mjs'")
    runtime = runtime.replace(
        "workerUrl:'../modules/weather-mother/field-worker.js'",
        "workerUrl:'./modules/weather-mother/field-worker.js'",
    )
    (out / "runtime.js").write_text(runtime, encoding="utf-8")
    shutil.copyfile(implementation / "terrain-shaders.js", out / "shaders.js")
    shutil.copyfile(implementation / "weather-scene.mjs", out / "weather-scene.mjs")
    shutil.copyfile(implementation / "ADOPTION.json", out / "ADOPTION.json")
    shutil.copyfile(
        implementation / "SINGLE_SCENE_ARCHITECTURE.md",
        out / "SINGLE_SCENE_ARCHITECTURE.md",
    )


def validate(out: Path) -> None:
    html = (out / "index.html").read_text(encoding="utf-8")
    runtime = (out / "runtime.js").read_text(encoding="utf-8")
    shaders = (out / "shaders.js").read_text(encoding="utf-8")
    weather = (out / "weather-scene.mjs").read_text(encoding="utf-8")

    assert html.lower().count("<canvas") == 1
    assert "<iframe" not in html.lower()
    assert "2560 × 1600" in html
    assert "高度偏移 0 m" in html
    assert "云底至云顶 AMSL" in html
    assert "cloudBase" not in html and "cloudTop" not in html
    for genus in CLOUD_GENERA:
        assert f'data-weather="{genus}"' in html
        assert f'value="{genus}"' in html

    assert VERSION in runtime
    assert "from'./weather-scene.mjs'" in runtime
    assert "workerUrl:'./modules/weather-mother/field-worker.js'" in runtime
    assert "uCloudSourceVerticalKm" in runtime
    assert "dpr=1" in runtime
    assert "altitudeOffsetM" in runtime
    assert "verticalScale" in runtime

    assert "precision highp sampler3D" in shaders
    assert "uCloudSourceVerticalKm" in shaders
    assert "cloudShadow" in shaders

    for genus in CLOUD_GENERA:
        assert f"{genus}: profile" in weather
    assert "verticalScale: 1" in weather
    assert "altitudeOffsetM: 0" in weather
    assert "physicalLayerM" in weather
    assert "uSourceVerticalKm" in weather
    assert "worldP.y<uCloudVerticalM.x" in weather
    assert "new Worker(workerUrl)" in weather

    for file in [out / "runtime.js", out / "shaders.js", out / "weather-scene.mjs"]:
        subprocess.run(["node", "--check", str(file)], check=True)


def build(inputs: Path, implementation: Path, out: Path) -> dict:
    weather_dir = inputs / "weather/Weather_Mother_Full_Clean_V1.1.0"
    weather_zip = inputs / "Weather_Mother_Full_Clean_V1.1.0.zip"
    assemble.verify_single_scene_sources(implementation)
    weather_manifest = assemble.verify_weather_package(weather_dir, weather_zip)

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    terrain_manifest = assemble.build_wenzhou(inputs, out)
    copy_sources(implementation, out)
    assemble.copy_weather_read_only(weather_dir, out, weather_manifest)
    validate(out)

    receipt = assemble.build_receipt(out, weather_zip, terrain_manifest)
    receipt["schema"] = "wenzhou-real-cloud-units-build-1"
    receipt["version"] = VERSION
    receipt["cloudGenera"] = CLOUD_GENERA
    receipt["weatherCases"] = WEATHER_CASES
    receipt["cloudVerticalContract"] = {
        "worldVerticalScale": 1,
        "terrainVerticalScale": 1,
        "altitudeOffsetM": 0,
        "baseTopUnit": "metre AMSL",
        "manualBaseTopControls": False,
        "sourceDensityRemappedInsidePhysicalLayer": True,
        "visualLift": False,
        "visualVerticalCompression": False,
    }
    receipt["displayContract"] = {
        "controllerViewport": [2560, 1600],
        "devicePixelRatio": 1,
        "drawingBuffer": [2560, 1600],
    }
    receipt["scientificStatus"] = {
        "wmoTemperateAltitudeLevelsApplied": True,
        "liveRadiosondeConnected": False,
        "historicalWeatherReanalysisConnected": False,
        "calibrated": False,
    }
    receipt["visualApproved"] = False
    receipt["productionApproved"] = False
    (out / "BUILD.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", type=Path)
    parser.add_argument("implementation", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()
    receipt = build(args.inputs, args.implementation, args.out)
    print(json.dumps({
        "version": receipt["version"],
        "cloudGenera": receipt["cloudGenera"],
        "verticalContract": receipt["cloudVerticalContract"],
        "displayContract": receipt["displayContract"],
        "visualApproved": receipt["visualApproved"],
        "productionApproved": receipt["productionApproved"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
