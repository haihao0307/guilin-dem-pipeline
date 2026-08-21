from __future__ import annotations

import argparse
import copy
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from common import read_json, utc_now, write_json


class PipelineError(RuntimeError):
    pass


def invoke(arguments: list[str], *, allow_failure: bool = False) -> int:
    print("\n$ " + " ".join(arguments), flush=True)
    completed = subprocess.run(arguments, check=False)
    if completed.returncode != 0 and not allow_failure:
        raise PipelineError(f"command failed with exit code {completed.returncode}: {' '.join(arguments)}")
    return completed.returncode


def make_runtime_config(original_path: Path, root: Path, fallback: bool) -> Path:
    config = read_json(original_path)
    if fallback:
        config = copy.deepcopy(config)
        config["project"]["targetPixelSpacingMeters"] = 30.0
        config["project"]["accuracyLabel"] = "AWS Terrain Tiles约30米临时完整范围DEM"
        config["processing"]["outputPixelSpacingMeters"] = 30.0
        config["processing"]["minimumValidFraction"] = 0.995
        config["processing"]["maxFillAreaKm2"] = 25.0
        config["outputs"]["finalDem"] = "outputs/DEM_Zhenbaoding15km_to_Yangshuo_Pingle_fallback_30m_COG.tif"
        config["outputs"]["sourceCount"] = "outputs/DEM_Zhenbaoding15km_to_Yangshuo_Pingle_fallback_source_count_COG.tif"
        config["outputs"]["fillClass"] = "outputs/DEM_Zhenbaoding15km_to_Yangshuo_Pingle_fallback_fill_class_COG.tif"
    runtime_path = root / "config" / "runtime_task_config.json"
    write_json(runtime_path, config)
    return runtime_path


def run(root: Path) -> int:
    python = sys.executable
    scripts = root / "scripts"
    config = root / "config" / "task_config.json"
    manifest = root / "config" / "existing_five_manifest.json"
    metadata = root / "metadata"
    reports = root / "reports"
    metadata.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True)

    invoke([python, str(scripts / "discover_existing.py"), "--config", str(config), "--manifest", str(manifest), "--root", str(root), "--allow-missing"])
    invoke([python, str(scripts / "build_boundary_stdlib.py"), "--config", str(config), "--root", str(root)])

    plan_code = invoke(
        [python, str(scripts / "asf_download_stdlib.py"), "--config", str(config), "--root", str(root), "--plan-only"],
        allow_failure=True,
    )
    token = os.environ.get("EARTHDATA_TOKEN", "").strip()
    data_mode = os.environ.get("DEM_DATA_MODE", "auto").strip().lower() or "auto"
    if data_mode not in {"auto", "asf", "fallback"}:
        raise PipelineError(f"unsupported DEM_DATA_MODE: {data_mode}")
    if data_mode == "asf" and not token:
        raise PipelineError("DEM_DATA_MODE=asf requires EARTHDATA_TOKEN")

    use_fallback = data_mode == "fallback" or (data_mode == "auto" and not bool(token))
    asf_download_code = None
    if data_mode in {"auto", "asf"} and token:
        print("EARTHDATA_TOKEN is available. Starting ASF RTC_HI_RES download.")
        asf_download_code = invoke(
            [python, str(scripts / "asf_download_stdlib.py"), "--config", str(config), "--root", str(root)],
            allow_failure=data_mode == "auto",
        )
        use_fallback = asf_download_code != 0
        if use_fallback and data_mode == "auto":
            print("ASF download did not complete. Switching to the public 30 metre preview source.")
    if use_fallback:
        print("Building the complete public 30 metre preview DEM.")
        invoke([python, str(scripts / "download_mapzen_fallback.py"), "--config", str(config), "--root", str(root)])

    runtime_config = make_runtime_config(config, root, fallback=use_fallback)
    invoke([python, str(scripts / "mosaic_dem.py"), "--config", str(runtime_config), "--root", str(root)])
    if read_json(runtime_config).get("webContext"):
        if not use_fallback:
            invoke([python, str(scripts / "download_mapzen_fallback.py"), "--config", str(runtime_config), "--root", str(root)])
        invoke([python, str(scripts / "build_web_context_dem.py"), "--config", str(runtime_config), "--root", str(root)])

    runtime_source = read_json(metadata / "runtime_source.json") if (metadata / "runtime_source.json").exists() else {}
    write_json(
        reports / "CLOUD_RUN_STATUS.json",
        {
            "generatedAt": utc_now(),
            "status": "complete",
            "asfPlanCreated": plan_code == 0,
            "asfDownloadExitCode": asf_download_code,
            "runtimeSource": runtime_source,
            "earthdataTokenPresent": bool(token),
            "dataMode": data_mode,
        },
    )
    invoke([python, str(scripts / "build_web_preview.py"), "--config", str(runtime_config), "--root", str(root), "--site", str(root / "web")])
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        return run(Path(args.root).resolve())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
