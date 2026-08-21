#!/usr/bin/env python3
"""Prepare, display, run, and verify auditable Gaea Build Swarm jobs."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from typing import Any


SCHEMA_VERSION = 1


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unique_existing(paths: list[Path]) -> list[Path]:
    seen: set[str] = set()
    result: list[Path] = []
    for path in paths:
        try:
            resolved = path.expanduser().resolve()
        except Exception:
            continue
        key = str(resolved).casefold()
        if resolved.is_file() and key not in seen:
            seen.add(key)
            result.append(resolved)
    return result


def registry_candidates() -> list[Path]:
    if os.name != "nt":
        return []
    try:
        import winreg  # type: ignore
    except Exception:
        return []
    candidates: list[Path] = []
    keys = [
        r"SOFTWARE\QuadSpinner\Gaea\2.0",
        r"SOFTWARE\QuadSpinner\Gaea\2",
        r"SOFTWARE\QuadSpinner\Gaea",
    ]
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        for key_name in keys:
            try:
                with winreg.OpenKey(hive, key_name) as key:
                    for value_name in (None, "InstallPath", "Path", "Location"):
                        try:
                            value, _ = winreg.QueryValueEx(key, value_name or "")
                        except OSError:
                            continue
                        base = Path(str(value))
                        candidates.extend([base / "Gaea.Swarm.exe", base / "Gaea.exe"])
            except OSError:
                continue
    return candidates


def common_candidates() -> list[Path]:
    candidates: list[Path] = []
    for variable in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
        root_text = os.environ.get(variable)
        if not root_text:
            continue
        root = Path(root_text)
        patterns = [
            root / "QuadSpinner" / "Gaea*" / "Gaea.Swarm.exe",
            root / "Programs" / "QuadSpinner" / "Gaea*" / "Gaea.Swarm.exe",
            root / "QuadSpinner" / "Gaea*" / "Gaea.exe",
            root / "Programs" / "QuadSpinner" / "Gaea*" / "Gaea.exe",
        ]
        for pattern in patterns:
            candidates.extend(Path(match) for match in glob.glob(str(pattern)))
    return candidates


def detect_gaea(explicit: str | None = None) -> dict[str, Any]:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    env_swarm = os.environ.get("GAEA_SWARM_EXE")
    if env_swarm:
        candidates.append(Path(env_swarm))
    for name in ("Gaea.Swarm.exe", "Gaea.Swarm", "Gaea.exe", "Gaea"):
        found = shutil.which(name)
        if found:
            candidates.append(Path(found))
    candidates.extend(registry_candidates())
    candidates.extend(common_candidates())
    existing = unique_existing(candidates)
    swarm = next((path for path in existing if path.name.casefold().startswith("gaea.swarm")), None)
    ui = next((path for path in existing if path.name.casefold() == "gaea.exe" or path.name.casefold() == "gaea"), None)
    if swarm is None and ui:
        sibling = ui.with_name("Gaea.Swarm.exe")
        if sibling.is_file():
            swarm = sibling.resolve()
    return {
        "status": "ready" if swarm else "not_found",
        "swarm_executable": str(swarm) if swarm else None,
        "ui_executable": str(ui) if ui else None,
        "searched_candidates": [str(path) for path in existing],
        "gdalinfo": shutil.which("gdalinfo"),
        "gdalwarp": shutil.which("gdalwarp"),
    }


def parse_value(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def parse_assignment(text: str) -> tuple[str, Any]:
    if "=" not in text:
        raise argparse.ArgumentTypeError("Expected NAME=VALUE")
    name, raw_value = text.split("=", 1)
    name = name.strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        raise argparse.ArgumentTypeError(f"Invalid variable name: {name!r}")
    return name, parse_value(raw_value.strip())


def ensure_output_name(name: str) -> str:
    if not name or name in {".", ".."} or Path(name).name != name or any(char in name for char in '<>:"/\\|?*'):
        raise ValueError("--output-name must be a plain filename stem without extension or path separators.")
    if Path(name).suffix:
        raise ValueError("--output-name must not include an extension; Gaea's Export node adds it.")
    return name


def save_json(path: Path, data: Any, pretty: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2 if pretty else None) + "\n", encoding="utf-8")


def load_manifest(path: Path) -> dict[str, Any]:
    manifest_path = path.expanduser().resolve()
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    if data.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(f"Unsupported manifest schema: {data.get('schema_version')!r}")
    data["_manifest_path"] = str(manifest_path)
    return data


def build_argv(manifest: dict[str, Any], ignore_cache: bool = False, verbose: bool = False) -> list[str]:
    detected = detect_gaea(manifest.get("swarm_executable"))
    executable = detected.get("swarm_executable") or manifest.get("swarm_executable") or "Gaea.Swarm.exe"
    argv = [str(executable), "--Filename", manifest["project"], "--vars", manifest["vars_file"]]
    if manifest.get("profile"):
        argv.extend(["--profile", str(manifest["profile"])])
    if manifest.get("region"):
        argv.extend(["--region", str(manifest["region"])])
    if manifest.get("seed") is not None:
        argv.extend(["--seed", str(manifest["seed"])])
    if ignore_cache:
        argv.append("--ignorecache")
    if verbose:
        argv.append("--verbose")
    return argv


def command_text(argv: list[str]) -> str:
    return subprocess.list2cmdline(argv)


def cmd_detect(args: argparse.Namespace) -> int:
    result = detect_gaea(args.swarm)
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0 if result["status"] == "ready" else 1


def cmd_prepare(args: argparse.Namespace) -> int:
    project = args.project.expanduser().resolve()
    input_path = args.input.expanduser().resolve()
    run_dir = args.run_dir.expanduser().resolve()
    if not project.is_file():
        raise FileNotFoundError(f"Gaea project not found: {project}")
    if project.suffix.lower() != ".terrain":
        raise ValueError(f"Expected a .terrain project, got: {project.name}")
    if not input_path.is_file():
        raise FileNotFoundError(f"Input heightfield not found: {input_path}")
    output_name = ensure_output_name(args.output_name)
    manifest_path = run_dir / "manifest.json"
    vars_path = run_dir / "vars.json"
    if not args.force and (manifest_path.exists() or vars_path.exists()):
        raise FileExistsError(f"Run directory already contains a job: {run_dir}. Use a new directory or --force.")
    output_dir = run_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_stem = (output_dir / output_name).resolve()

    variables: dict[str, Any] = {
        args.input_var: str(input_path),
        args.output_var: str(output_stem),
    }
    for name, value in args.set or []:
        variables[name] = value
    save_json(vars_path, variables)

    detected = detect_gaea(args.swarm)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "created_utc": utc_now(),
        "project": str(project),
        "project_sha256": sha256_file(project),
        "input": str(input_path),
        "input_size_bytes": input_path.stat().st_size,
        "run_dir": str(run_dir),
        "output_dir": str(output_dir),
        "output_stem": str(output_stem),
        "vars_file": str(vars_path),
        "variables": variables,
        "profile": args.profile,
        "region": args.region,
        "seed": args.seed,
        "swarm_executable": detected.get("swarm_executable") or (str(Path(args.swarm).resolve()) if args.swarm else None),
        "expected_outputs": args.expect or [str(output_stem) + ".*"],
        "notes": [
            "Output paths bound to Explicit Export nodes omit their extension.",
            "This manifest does not prove that variable names exist in the .terrain file; validate once in the Gaea UI.",
        ],
    }
    manifest["command_preview"] = command_text(build_argv(manifest))
    save_json(manifest_path, manifest)
    print(json.dumps({"status": "prepared", "manifest": str(manifest_path), "vars": str(vars_path), "command": manifest["command_preview"]}, ensure_ascii=False, indent=2))
    return 0


def cmd_command(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    argv = build_argv(manifest, args.ignore_cache, args.verbose)
    result = {"argv": argv, "command": command_text(argv)}
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else result["command"])
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    argv = build_argv(manifest, args.ignore_cache, args.verbose)
    if not args.execute:
        print(json.dumps({"status": "dry_run", "command": command_text(argv), "hint": "Pass --execute to start Build Swarm."}, ensure_ascii=False, indent=2))
        return 0
    executable = Path(argv[0])
    if not executable.is_file():
        print(json.dumps({"status": "error", "error": "Gaea.Swarm.exe was not found. Run detect or pass --swarm during prepare.", "command": command_text(argv)}, ensure_ascii=False, indent=2))
        return 2

    run_dir = Path(manifest["run_dir"])
    stdout_path = run_dir / "gaea-stdout.log"
    stderr_path = run_dir / "gaea-stderr.log"
    started_utc = utc_now()
    started = time.monotonic()
    completed: subprocess.CompletedProcess[str] | None = None
    timed_out = False
    try:
        completed = subprocess.run(
            argv,
            cwd=run_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=args.timeout,
            check=False,
        )
        stdout_path.write_text(completed.stdout, encoding="utf-8")
        stderr_path.write_text(completed.stderr, encoding="utf-8")
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        stdout_path.write_text(exc.stdout or "", encoding="utf-8")
        stderr_path.write_text(exc.stderr or "", encoding="utf-8")
    duration = time.monotonic() - started
    result = {
        "status": "timeout" if timed_out else "complete" if completed and completed.returncode == 0 else "failed",
        "started_utc": started_utc,
        "duration_seconds": round(duration, 3),
        "exit_code": None if timed_out or completed is None else completed.returncode,
        "command": command_text(argv),
        "stdout_log": str(stdout_path),
        "stderr_log": str(stderr_path),
    }
    save_json(run_dir / "run-result.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if timed_out:
        return 124
    return 0 if completed and completed.returncode == 0 else 2


def cmd_verify(args: argparse.Namespace) -> int:
    manifest = load_manifest(args.manifest)
    files: list[Path] = []
    for pattern in manifest.get("expected_outputs", []):
        files.extend(Path(match).resolve() for match in glob.glob(pattern))
    unique = unique_existing(files)
    records = []
    for path in unique:
        record: dict[str, Any] = {
            "path": str(path),
            "size_bytes": path.stat().st_size,
            "modified_utc": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
        }
        if args.hash:
            record["sha256"] = sha256_file(path)
        records.append(record)
    status = "pass" if records and all(item["size_bytes"] > 0 for item in records) else "fail"
    result = {
        "status": status,
        "manifest": manifest["_manifest_path"],
        "expected_patterns": manifest.get("expected_outputs", []),
        "files": records,
        "next": "Run dem_preflight.py on heightfield outputs and compare against the saved geospatial context." if status == "pass" else "Check the Export node variable binding, format extension, Build Profile, and Gaea logs.",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0 if status == "pass" else 2


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command_name", required=True)

    detect = sub.add_parser("detect", help="Locate Gaea and supporting commands")
    detect.add_argument("--swarm", help="Explicit Gaea.Swarm.exe path")
    detect.add_argument("--pretty", action="store_true")
    detect.set_defaults(func=cmd_detect)

    prepare = sub.add_parser("prepare", help="Create a variables file and immutable-style run manifest")
    prepare.add_argument("--project", type=Path, required=True)
    prepare.add_argument("--input", type=Path, required=True)
    prepare.add_argument("--run-dir", type=Path, required=True)
    prepare.add_argument("--output-name", default="processed-dem")
    prepare.add_argument("--input-var", default="InputHeightfield")
    prepare.add_argument("--output-var", default="OutputHeightfield")
    prepare.add_argument("--profile")
    prepare.add_argument("--region")
    prepare.add_argument("--seed", type=int)
    prepare.add_argument("--set", type=parse_assignment, action="append", metavar="NAME=VALUE")
    prepare.add_argument("--expect", action="append", help="Expected output glob; repeatable")
    prepare.add_argument("--swarm", help="Explicit Gaea.Swarm.exe path")
    prepare.add_argument("--force", action="store_true")
    prepare.set_defaults(func=cmd_prepare)

    command = sub.add_parser("command", help="Print the exact Build Swarm command")
    command.add_argument("manifest", type=Path)
    command.add_argument("--ignore-cache", action="store_true")
    command.add_argument("--verbose", action="store_true")
    command.add_argument("--json", action="store_true")
    command.set_defaults(func=cmd_command)

    run = sub.add_parser("run", help="Dry-run or execute Build Swarm")
    run.add_argument("manifest", type=Path)
    run.add_argument("--execute", action="store_true")
    run.add_argument("--ignore-cache", action="store_true")
    run.add_argument("--verbose", action="store_true")
    run.add_argument("--timeout", type=float, default=None, help="Optional timeout in seconds")
    run.set_defaults(func=cmd_run)

    verify = sub.add_parser("verify", help="Verify expected output files exist and are non-empty")
    verify.add_argument("manifest", type=Path)
    verify.add_argument("--hash", action="store_true")
    verify.add_argument("--pretty", action="store_true")
    verify.set_defaults(func=cmd_verify)
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        return args.func(args)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
