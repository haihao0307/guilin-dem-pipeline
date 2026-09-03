"""Build the Wenzhou V0.5.5 seasonal real-unit cloud workbench."""
from __future__ import annotations

from pathlib import Path, PurePosixPath
import argparse
import base64
import hashlib
import io
import json
import os
import shutil
import stat
import subprocess
import tarfile
import tempfile

import assemble

VERSION = "wenzhou-workbench-0.5.5-seasonal-real-units"
CLOUD_GENERA = ["ci", "cc", "cs", "ac", "as", "ns", "sc", "st", "cu", "cb"]
WEATHER_CASES = CLOUD_GENERA + ["typhoon"]
PAYLOAD_PARTS = [f"v055-source.part-{index:02d}.b64" for index in range(1, 6)]
PAYLOAD_SHA256 = "bd7bc09761284988f2186157712371b7286b1cf9aac34b8bcd1dc9b5d0cab012"
SOURCE_IDENTITIES = {
    "index.html": (13004, "d76fcc13f4a954aceaf85e8f12976ccc878c0aabab13d6f32c76d63592dd2761"),
    "runtime.js": (24502, "d07ef96449a0afa8abb75713deb0e0a1084a2eb8c6061bcbd6e37b4c16ea644a"),
    "weather-scene.mjs": (40067, "3146af0d3b1b0a80b150dbcd321dcf36e27c708dd89b647c50309043f997fafe"),
}
EXPECTED_LAYERS_M = {
    "ci": [8000, 12000],
    "cc": [7000, 11000],
    "cs": [6000, 12000],
    "ac": [3000, 6000],
    "as": [2500, 7000],
    "ns": [600, 6000],
    "sc": [600, 2200],
    "st": [80, 900],
    "cu": [700, 3500],
    "cb": [600, 14000],
    "typhoon": [400, 15500],
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode_sources(implementation: Path, destination: Path) -> None:
    encoded = "".join((implementation / name).read_text(encoding="ascii").strip() for name in PAYLOAD_PARTS)
    payload = base64.b64decode(encoded, validate=True)
    assert sha256(payload) == PAYLOAD_SHA256
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        for item in archive.getmembers():
            name = PurePosixPath(item.name)
            assert not name.is_absolute()
            assert ".." not in name.parts
            assert item.isfile()
            assert not item.issym() and not item.islnk()
            assert item.name in SOURCE_IDENTITIES
        archive.extractall(destination, filter="data")
    for name, (expected_bytes, expected_sha) in SOURCE_IDENTITIES.items():
        data = (destination / name).read_bytes()
        assert len(data) == expected_bytes, (name, len(data))
        assert sha256(data) == expected_sha, name


def validate_sources(source: Path) -> None:
    html = (source / "index.html").read_text(encoding="utf-8")
    runtime = (source / "runtime.js").read_text(encoding="utf-8")
    weather = (source / "weather-scene.mjs").read_text(encoding="utf-8")
    assert html.lower().count("<canvas") == 1
    assert "<iframe" not in html.lower()
    assert "小温州 V0.5.5" in html
    assert "真实大气循环" in html
    assert "云高偏移 0 m" in html
    assert "四季云系自动编排" in html
    assert "calendarRate" in html and "autoWeather" in html
    assert "cloudBase" not in html and "cloudTop" not in html
    for genus in CLOUD_GENERA:
        assert f'data-weather="{genus}"' in html
        assert f'value="{genus}"' in html
        assert f"{genus}: profile" in weather
    assert VERSION in runtime
    assert "from'./weather-scene.mjs'" in runtime
    assert "workerUrl:'./modules/weather-mother/field-worker.js'" in runtime
    assert "g.finish()" not in runtime
    assert "dpr=1" in runtime
    assert "setAutoWeather" in runtime and "setCalendarRate" in runtime
    assert "WEATHER_SCENE_VERSION = '0.5.5-seasonal-real-units'" in weather
    assert "automaticWeatherFor" in weather
    assert "verticalScale: 1" in weather
    assert "altitudeOffsetM: 0" in weather
    assert "uPrecipRate" in weather and "uLightning" in weather and "uVisibilityM" in weather
    for path in [source / "runtime.js", source / "weather-scene.mjs"]:
        subprocess.run(["node", "--check", str(path)], check=True)


def copy_sources(source: Path, implementation: Path, out: Path) -> None:
    for name in SOURCE_IDENTITIES:
        shutil.copyfile(source / name, out / name)
    shutil.copyfile(implementation / "terrain-shaders.js", out / "shaders.js")
    shutil.copyfile(implementation / "ADOPTION.json", out / "ADOPTION.json")
    shutil.copyfile(implementation / "SINGLE_SCENE_ARCHITECTURE.md", out / "SINGLE_SCENE_ARCHITECTURE.md")


def validate_output(out: Path) -> None:
    validate_sources(out)
    shaders = (out / "shaders.js").read_text(encoding="utf-8")
    assert "precision highp sampler3D" in shaders
    assert "cloudShadow" in shaders
    assert "uCloudSourceVerticalKm" in shaders
    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ktx", ".ktx2", ".dds"}
    assert not [path for path in out.rglob("*") if path.is_file() and path.suffix.lower() in image_extensions]
    for path in [out / "runtime.js", out / "shaders.js", out / "weather-scene.mjs"]:
        subprocess.run(["node", "--check", str(path)], check=True)


def build(inputs: Path, implementation: Path, out: Path) -> dict:
    weather_dir = inputs / "weather/Weather_Mother_Full_Clean_V1.1.0"
    weather_zip = inputs / "Weather_Mother_Full_Clean_V1.1.0.zip"
    weather_manifest = assemble.verify_weather_package(weather_dir, weather_zip)

    with tempfile.TemporaryDirectory(prefix="wenzhou-v055-source-") as temporary:
        source = Path(temporary)
        decode_sources(implementation, source)
        validate_sources(source)

        if out.exists():
            shutil.rmtree(out)
        out.mkdir(parents=True)
        terrain_manifest = assemble.build_wenzhou(inputs, out)
        copy_sources(source, implementation, out)

    assemble.copy_weather_read_only(weather_dir, out, weather_manifest)
    validate_output(out)

    receipt = assemble.build_receipt(out, weather_zip, terrain_manifest)
    receipt.update({
        "schema": "wenzhou-seasonal-real-cloud-units-build-1",
        "version": VERSION,
        "sourcePayloadSha256": PAYLOAD_SHA256,
        "sourceFiles": {
            name: {"bytes": identity[0], "sha256": identity[1]}
            for name, identity in SOURCE_IDENTITIES.items()
        },
        "cloudGenera": CLOUD_GENERA,
        "weatherCases": WEATHER_CASES,
        "cloudPhysicalLayersM": EXPECTED_LAYERS_M,
        "cloudVerticalContract": {
            "worldVerticalScale": 1,
            "terrainVerticalScale": 1,
            "altitudeOffsetM": 0,
            "baseTopUnit": "metre AMSL",
            "manualBaseTopControls": False,
            "sourceDensityRemappedInsidePhysicalLayer": True,
            "visualLift": False,
            "visualVerticalCompression": False,
        },
        "seasonalWeather": {
            "automaticSelection": True,
            "dateInput": True,
            "localSolarHour": True,
            "calendarCycle": True,
            "seasonWindows": ["winter", "spring", "plum-rain", "summer-typhoon", "autumn"],
            "deterministicCandidate": True,
            "liveObservationConnected": False,
            "historicalReanalysisConnected": False,
        },
        "phenomena": {
            "rain": True,
            "snow": True,
            "fog": True,
            "lightning": True,
            "windDrivenCloudMotion": True,
            "terrainCloudShadowCandidate": True,
            "seaResponseCandidate": True,
        },
        "displayContract": {
            "controllerViewport": [2560, 1600],
            "devicePixelRatio": 1,
            "drawingBuffer": [2560, 1600],
        },
        "scientificStatus": {
            "wmoTemperateAltitudeLevelsApplied": True,
            "liveRadiosondeConnected": False,
            "historicalWeatherReanalysisConnected": False,
            "calibrated": False,
        },
        "visualApproved": False,
        "productionApproved": False,
    })
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
        "cloudPhysicalLayersM": receipt["cloudPhysicalLayersM"],
        "verticalContract": receipt["cloudVerticalContract"],
        "seasonalWeather": receipt["seasonalWeather"],
        "displayContract": receipt["displayContract"],
        "visualApproved": receipt["visualApproved"],
        "productionApproved": receipt["productionApproved"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
