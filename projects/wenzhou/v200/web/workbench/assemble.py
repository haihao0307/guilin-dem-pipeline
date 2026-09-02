"""Build the first single-scene Wenzhou and Weather Mother research workbench.

The complete Wenzhou numerical overview, the Weather Mother V1.1.0 field
worker, the Wenzhou adapter, terrain, sea, cloud pass and controls are shipped
in one public directory. Weather Mother source files are copied byte for byte.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

VERSION = "wenzhou-workbench-0.3.0-single-scene-weather110"
WEATHER_ZIP_SHA256 = "ac1cd919b007eff60f2288106ca32cb8ff7f96ea8e02e52cec16d8045bb6ae6e"
WEATHER_MANIFEST_SHA256 = "a4a09dc8096b93f940381efcad2bddd021ed73010e268c24b563bf9f3a721a5b"
WEATHER_FIELD_WORKER_SHA256 = "a93ed87ddda5e656e377b95719571cd334a167047931bcfe2e584f068227ce2d"
AUTHORITATIVE_COG_SHA256 = "c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43"
VECTOR_GZIP_SHA256 = "30c3411dea02dfa85482772a1f3afdcd8fff487907786310c5415476370cad39"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_weather_package(weather: Path, archive: Path) -> dict:
    archive_data = archive.read_bytes()
    assert len(archive_data) == 46075, len(archive_data)
    assert sha(archive_data) == WEATHER_ZIP_SHA256
    with zipfile.ZipFile(archive) as package:
        assert package.testzip() is None

    manifest_path = weather / "MANIFEST.json"
    assert sha(manifest_path.read_bytes()) == WEATHER_MANIFEST_SHA256
    manifest = read_json(manifest_path)
    assert manifest["version"] == "1.1.0-clean"
    assert manifest["fileCount"] == 12
    for name, identity in manifest["files"].items():
        data = (weather / name).read_bytes()
        assert len(data) == identity["bytes"], name
        assert sha(data) == identity["sha256"], name
    assert sha((weather / "field-worker.js").read_bytes()) == WEATHER_FIELD_WORKER_SHA256
    return manifest


def verify_single_scene_sources(implementation: Path) -> None:
    required = [
        "terrain-index.html",
        "terrain-runtime.js",
        "terrain-shaders.js",
        "weather-scene.mjs",
        "ADOPTION.json",
        "qa_workbench.py",
        "SINGLE_SCENE_ARCHITECTURE.md",
    ]
    for name in required:
        assert (implementation / name).is_file(), name

    html = (implementation / "terrain-index.html").read_text(encoding="utf-8")
    runtime = (implementation / "terrain-runtime.js").read_text(encoding="utf-8")
    shaders = (implementation / "terrain-shaders.js").read_text(encoding="utf-8")
    adapter = (implementation / "weather-scene.mjs").read_text(encoding="utf-8")
    adoption = read_json(implementation / "ADOPTION.json")

    assert html.lower().count("<canvas") == 1
    assert "<iframe" not in html.lower()
    assert "sameWebGLContext" in runtime and "sharedDepth" in runtime
    assert "getContext('webgl2'" in runtime
    assert "createWeatherScene(g" in runtime
    assert "sampler3D" in shaders and "cloudShadow" in shaders
    assert "sea cloud-reflection candidate" in json.dumps(adoption)
    assert "new Worker(workerUrl)" in adapter
    assert "gl.texImage3D" in adapter
    assert "field-worker.js" in adapter
    assert "coast" in adapter and "rain" in adapter and "typhoon" in adapter
    assert adoption["renderArchitecture"]["mainCanvasCount"] == 1
    assert adoption["renderArchitecture"]["sharedDepthBuffer"] is True
    assert adoption["truthInvariants"]["fullNativeOnline"] is False
    assert adoption["visualApproved"] is False
    assert adoption["productionApproved"] is False


def build_wenzhou(inputs: Path, out: Path) -> dict:
    original_source = inputs / "wenzhou-full-source"
    vectors = inputs / "wenzhou-vectors.json.gz"
    assert sha(vectors.read_bytes()) == VECTOR_GZIP_SHA256
    with tempfile.TemporaryDirectory(prefix="wenzhou-single-scene-") as temporary:
        source = Path(temporary) / "source"
        shutil.copytree(original_source, source)
        shutil.copyfile(vectors, source / "data/vectors.json.gz")
        subprocess.run([sys.executable, str(source / "build.py"), str(source), str(out)], check=True)
    manifest = read_json(out / "manifest.json")
    assert manifest["version"] == "v7-full-review-r3"
    assert manifest["grid"] == [276, 281]
    assert manifest["sourceGrid"] == [17555, 17918]
    assert manifest["visualApproved"] is False
    assert manifest["productionApproved"] is False
    return manifest


def copy_single_scene_sources(implementation: Path, out: Path) -> None:
    mapping = {
        "terrain-index.html": "index.html",
        "terrain-runtime.js": "runtime.js",
        "terrain-shaders.js": "shaders.js",
        "weather-scene.mjs": "weather-scene.mjs",
        "ADOPTION.json": "ADOPTION.json",
        "SINGLE_SCENE_ARCHITECTURE.md": "SINGLE_SCENE_ARCHITECTURE.md",
    }
    for source, target in mapping.items():
        shutil.copyfile(implementation / source, out / target)


def copy_weather_read_only(weather: Path, out: Path, manifest: dict) -> None:
    destination = out / "modules/weather-mother"
    destination.mkdir(parents=True, exist_ok=True)
    for name, identity in manifest["files"].items():
        shutil.copyfile(weather / name, destination / name)
        copied = (destination / name).read_bytes()
        assert len(copied) == identity["bytes"], name
        assert sha(copied) == identity["sha256"], name
    assert sha((destination / "field-worker.js").read_bytes()) == WEATHER_FIELD_WORKER_SHA256


def verify_output(out: Path) -> None:
    html = (out / "index.html").read_text(encoding="utf-8")
    runtime = (out / "runtime.js").read_text(encoding="utf-8")
    shaders = (out / "shaders.js").read_text(encoding="utf-8")
    adapter = (out / "weather-scene.mjs").read_text(encoding="utf-8")
    assert html.lower().count("<canvas") == 1
    assert "<iframe" not in html.lower()
    assert "wenzhou-workbench-0.3.0-single-scene-weather110" in runtime
    assert "oneCanvas" in runtime and "iframeCount" in runtime
    assert "sampler3D" in shaders and "cloudShadow" in shaders
    assert "TEXTURE_3D" in adapter and "field-worker.js" in adapter

    image_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ktx", ".ktx2", ".dds"}
    image_files = [path for path in out.rglob("*") if path.is_file() and path.suffix.lower() in image_extensions]
    assert not image_files, image_files

    for path in [out / "runtime.js", out / "shaders.js", out / "weather-scene.mjs"]:
        subprocess.run(["node", "--check", str(path)], check=True)


def build_receipt(out: Path, weather_zip: Path, terrain_manifest: dict) -> dict:
    files = {}
    for path in sorted(out.rglob("*")):
        if not path.is_file() or path.name in {"BUILD.json", "PUBLIC_QA.json"}:
            continue
        data = path.read_bytes()
        files[path.relative_to(out).as_posix()] = {"bytes": len(data), "sha256": sha(data)}

    return {
        "schema": "wenzhou-single-scene-weather-build-1",
        "version": VERSION,
        "sourceCommit": os.environ.get("GITHUB_SHA", "local-unpublished"),
        "repository": "haihao0307/guilin-dem-pipeline",
        "branch": "project/wenzhou-v200-17tile-truth-hydrology-rebuild",
        "weatherReadRef": "fa69b5c7fed1a71339127776d0f3e44f9152c5a0",
        "weatherZipSha256": sha(weather_zip.read_bytes()),
        "weatherManifestSha256": WEATHER_MANIFEST_SHA256,
        "weatherFieldWorkerSha256": WEATHER_FIELD_WORKER_SHA256,
        "weatherKernelModified": False,
        "fieldWorkerReusedByteIdentically": True,
        "renderArchitecture": {
            "mainCanvasCount": 1,
            "mainCameraCount": 1,
            "rendererCount": 1,
            "iframeCount": 0,
            "sameWebGL2Context": True,
            "sharedWebGLDepth": True,
            "sameWorldCoordinates": True,
            "visibleWeatherViewport": True,
            "hiddenWeatherIframe": False,
            "mountainOcclusionCandidate": True,
            "terrainCloudShadowCandidate": True,
            "seaCloudReflectionCandidate": True,
        },
        "weatherCases": ["coast", "rain", "typhoon"],
        "explicitUnits": {
            "worldLength": "metre",
            "cloudSourceLength": "kilometre",
            "cloudBaseTop": "metre",
            "windDirection": "meteorological degree from north",
            "windSpeed": "metre per second",
            "cloudSpeed": "metre per second",
            "simulationClock": "second",
        },
        "truth": {
            "authoritativeCogName": "WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif",
            "authoritativeCogBytes": 136760745,
            "authoritativeCogSha256": AUTHORITATIVE_COG_SHA256,
            "authoritativeGrid": [17555, 17918],
            "sourceNativeSpacingM": 12.5,
            "mapOverviewSpacingM": 800,
            "overviewGrid": terrain_manifest["grid"],
            "wholeDomain": True,
            "fullNativeOnline": False,
            "authoritativeCogIncluded": False,
            "sourceDeleted": False,
            "oldQingjiangTruthUsed": False,
            "syntheticGapFill": False,
            "manualRivers": False,
            "manualCoastline": False,
        },
        "noPersistedImageAssets": True,
        "calibratedWeatherOrHydrodynamics": False,
        "physicalTargetMachineVerified": False,
        "visualApproved": False,
        "productionApproved": False,
        "files": files,
    }


def main(inputs: Path, implementation: Path, out: Path) -> None:
    weather = inputs / "weather/Weather_Mother_Full_Clean_V1.1.0"
    archive = inputs / "Weather_Mother_Full_Clean_V1.1.0.zip"
    verify_single_scene_sources(implementation)
    weather_manifest = verify_weather_package(weather, archive)

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    terrain_manifest = build_wenzhou(inputs, out)
    copy_single_scene_sources(implementation, out)
    copy_weather_read_only(weather, out, weather_manifest)
    verify_output(out)

    receipt = build_receipt(out, archive, terrain_manifest)
    (out / "BUILD.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "version": VERSION,
        "fileCount": len(receipt["files"]),
        "oneCanvas": True,
        "oneCamera": True,
        "rendererCount": 1,
        "sharedWebGLDepth": True,
        "weatherKernelModified": False,
        "visibleCases": receipt["weatherCases"],
        "overviewGrid": terrain_manifest["grid"],
        "fullNativeOnline": False,
        "visualApproved": False,
        "productionApproved": False,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", type=Path)
    parser.add_argument("implementation", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()
    main(args.inputs, args.implementation, args.out)
