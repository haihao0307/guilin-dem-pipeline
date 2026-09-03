from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
import shutil
import stat
import sys
import zipfile
from pathlib import Path

PACKAGE_NAME = "Weather_Mother_Full_Clean_Handoff_2026-09-03_V1.2.0"
OBSOLETE_DIRS = [
    "clean-v1",
    "clean-v110",
    "easy-rain-lab-v010",
    "rain-puddle-study-v010",
    "rain-puddle-study-v020",
    "rain-puddle-study-v030",
    "rain-v020",
    "rain-v030",
    "rain-v040",
    "release-clean-v1",
    "restart-v110",
    "studio",
    "studio-v040",
    "v060",
    "v061-hq",
    "v062-loop",
    "v063-optics",
    "v110-full-src",
    "packaging",
    "distributions",
    "handoffs",
]
OBSOLETE_FILES = [
    "qa-v051.json",
    "cloud.glsl",
    "engine.js",
    "field-worker.js",
    "motion.js",
    "optics.js",
    "reuse.js",
]
FORBIDDEN_TOKENS = [
    "rain-puddle-study-v010",
    "rain-puddle-study-v020",
    "rain-puddle-study-v030",
    "easy-rain-lab-v010",
    "rain-v020",
    "rain-v030",
    "rain-v040",
    "studio-v040",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_path(source: Path, target: Path) -> None:
    if not source.exists():
        return
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: builder.py PATH_TO_GH_PAGES_WORKTREE")
    repo = Path(sys.argv[1]).resolve()
    wm = repo / "weather-mother"
    if not wm.is_dir():
        raise SystemExit(f"Weather Mother directory missing: {wm}")

    for relative in OBSOLETE_DIRS:
        path = wm / relative
        if path.exists():
            shutil.rmtree(path)
    for relative in OBSOLETE_FILES:
        path = wm / relative
        if path.exists():
            path.unlink()

    required = [
        wm / "index.html",
        wm / "studio-v060" / "index.html",
        wm / "v110-full" / "index.html",
        wm / "liquid-rain-v100" / "index.html",
    ]
    missing = [str(path.relative_to(repo)) for path in required if not path.exists()]
    if missing:
        raise SystemExit(f"current runtime is incomplete: {missing}")

    shell_path = wm / "studio-v060" / "index.html"
    shell = shell_path.read_text(encoding="utf-8")
    if "../liquid-rain-v100/" not in shell:
        raise SystemExit("Rain is not routed to liquid-rain-v100")
    stale = [token for token in FORBIDDEN_TOKENS if token in shell]
    if stale:
        raise SystemExit(f"legacy Rain token remains in shell: {stale}")

    package_stage_parent = repo / ".weather-mother-package-stage"
    package_stage = package_stage_parent / PACKAGE_NAME
    if package_stage_parent.exists():
        shutil.rmtree(package_stage_parent)
    package_stage.mkdir(parents=True)

    include = [
        "index.html",
        "UNIFIED_STUDIO_POLICY.json",
        "QUALITY_GATES.json",
        "README.md",
        "RESTART_START_HERE.md",
        "HANDOFF.json",
        "OCEAN_START_HERE.md",
        "WEATHER_REUSE_START.md",
        "studio-v060",
        "v110-full",
        "liquid-rain-v100",
        "rain",
        "snow",
        "fog",
        "research",
        "method-v100",
    ]
    for relative in include:
        copy_path(wm / relative, package_stage / "web" / "weather-mother" / relative)

    liquid = wm / "liquid-rain-v100"
    payload_files = [liquid / f"payload-{index:02d}.txt" for index in range(6)]
    if not all(path.exists() for path in payload_files):
        raise SystemExit("Liquid Rain six-part payload is incomplete")
    encoded = "".join(path.read_text(encoding="utf-8") for path in payload_files)
    source_html = gzip.decompress(base64.b64decode("".join(encoded.split())))
    source_dir = package_stage / "source" / "liquid-rain-v100"
    source_dir.mkdir(parents=True)
    (source_dir / "index.html").write_bytes(source_html)
    copy_path(liquid / "LIQUID_CORE_V1.md", package_stage / "research" / "LIQUID_CORE_V1.md")
    copy_path(liquid / "QA.json", package_stage / "qa" / "LIQUID_RAIN_V1_QA.json")
    copy_path(wm / "v110-full" / "QA.json", package_stage / "qa" / "WORLD_V110_QA.json")

    readme = """# Weather Mother Full Clean Handoff V1.2.0

这是 Weather Mother 当前干净全量交接包。

公开入口只有 Weather Mother。根入口默认进入 World。Rain、Snow、Fog、Cloud、Storm 都在统一壳层中切换。

当前 Rain 使用 liquid-rain-v100，保留用户确认可以继续发展的三维村院方向。旧平面村落、旧 Rain 实验、旧壳层和旧发布包均不进入当前路由与本包。

运行方式：在本目录执行 python3 serve.py，然后打开终端显示的地址。

当前质量状态：visualApproved=false，aaaQualityApproved=false，productionReady=false。
"""
    (package_stage / "README.md").write_text(readme, encoding="utf-8")

    start_here = """# START HERE

1. 阅读 HANDOFF.json。
2. 阅读 CLEANUP_RECEIPT.json。
3. 阅读 research/LIQUID_CORE_V1.md。
4. 从 source/liquid-rain-v100/index.html 继续 Liquid 与 Rain 开发。
5. 从 web/weather-mother/index.html 检查统一平台。
6. 保持根入口默认 World。
7. 每个模块只保留一个当前候选。

后续真实环境验证：
https://guilin-dem-terrain.sunhaihao.chatgpt.site
https://guilin-dem-terrain.sunhaihao.chatgpt.site/guilin/gaea-proof
"""
    (package_stage / "START_HERE.md").write_text(start_here, encoding="utf-8")

    serve = """from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser
root = Path(__file__).resolve().parent / 'web'
os.chdir(root)
url = 'http://127.0.0.1:8000/weather-mother/'
print(url)
try:
    webbrowser.open(url)
except Exception:
    pass
ThreadingHTTPServer(('127.0.0.1', 8000), SimpleHTTPRequestHandler).serve_forever()
"""
    (package_stage / "serve.py").write_text(serve, encoding="utf-8")
    (package_stage / "START_WINDOWS.bat").write_text("@echo off\r\npy -3 serve.py\r\npause\r\n", encoding="utf-8")
    mac = package_stage / "START_MAC_LINUX.command"
    mac.write_text("#!/bin/sh\ncd \"$(dirname \"$0\")\"\npython3 serve.py\n", encoding="utf-8")
    mac.chmod(0o755)

    cleanup = {
        "packageVersion": "1.2.0-full-clean-handoff",
        "date": "2026-09-03",
        "removedRuntimeDirectories": OBSOLETE_DIRS,
        "removedDuplicateRootFiles": OBSOLETE_FILES,
        "preservedCurrentRuntimes": ["studio-v060", "v110-full", "liquid-rain-v100"],
        "preservedKnowledge": ["research", "method-v100"],
        "legacyRainRouteCount": 0,
        "oldExecutableCandidatesIncludedInPackage": [],
        "historyPolicy": "Superseded work remains only in Git history.",
    }
    write_json(package_stage / "CLEANUP_RECEIPT.json", cleanup)

    handoff = {
        "productionLine": "Weather Mother",
        "packageVersion": "1.2.0-full-clean-handoff",
        "date": "2026-09-03",
        "canonicalOnlineEntry": "https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/",
        "defaultModule": "world",
        "currentStudio": {"version": "0.6.1-unified-immersive-studio", "directory": "web/weather-mother/studio-v060"},
        "currentWorld": {"version": "1.1.0-world", "directory": "web/weather-mother/v110-full"},
        "currentRain": {"version": "1.0.0-liquid-core-candidate", "directory": "web/weather-mother/liquid-rain-v100", "forwardVisualBaseline": "3D 1940s village courtyard"},
        "liquidScope": ["rain", "wetness", "puddles", "ripples", "splashes", "eave drainage", "surface liquid appearance", "procedural audio", "future sweat and external wetting"],
        "nextPriorities": ["light and atmosphere", "raindrop size speed and direction distributions", "cloud precipitation source coupling", "roof eave and receiver water transfer", "human sweat and wet-surface receiver interfaces", "Guilin and GAEA integration"],
        "validationEntrypoints": ["https://guilin-dem-terrain.sunhaihao.chatgpt.site", "https://guilin-dem-terrain.sunhaihao.chatgpt.site/guilin/gaea-proof"],
        "visualApproved": False,
        "aaaQualityApproved": False,
        "productionReady": False,
    }
    write_json(package_stage / "HANDOFF.json", handoff)

    files = []
    for path in sorted(item for item in package_stage.rglob("*") if item.is_file()):
        files.append({
            "path": path.relative_to(package_stage).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    write_json(
        package_stage / "MANIFEST.json",
        {
            "package": PACKAGE_NAME,
            "version": "1.2.0",
            "fileCountBeforeManifest": len(files),
            "totalBytesBeforeManifest": sum(item["bytes"] for item in files),
            "files": files,
        },
    )
    checksum_lines = []
    for path in sorted(item for item in package_stage.rglob("*") if item.is_file()):
        checksum_lines.append(f"{sha256(path)}  {path.relative_to(package_stage).as_posix()}")
    (package_stage / "CHECKSUMS.sha256").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    handoffs = wm / "handoffs"
    handoffs.mkdir(parents=True, exist_ok=True)
    zip_path = handoffs / f"{PACKAGE_NAME}.zip"
    fixed = (2026, 9, 3, 0, 0, 0)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(item for item in package_stage.rglob("*") if item.is_file()):
            arcname = f"{PACKAGE_NAME}/{path.relative_to(package_stage).as_posix()}"
            info = zipfile.ZipInfo(arcname, fixed)
            mode = 0o755 if os.access(path, os.X_OK) else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    with zipfile.ZipFile(zip_path) as archive:
        bad = archive.testzip()
        if bad:
            raise SystemExit(f"corrupt package member: {bad}")
        forbidden = [name for name in archive.namelist() if any(token in name for token in FORBIDDEN_TOKENS)]
        if forbidden:
            raise SystemExit(f"obsolete runtime entered package: {forbidden[:10]}")

    package_sha = sha256(zip_path)
    receipt = {
        "package": zip_path.name,
        "bytes": zip_path.stat().st_size,
        "sha256": package_sha,
        "fileCount": len([path for path in package_stage.rglob("*") if path.is_file()]),
        "sourceBranch": "gh-pages",
        "cleanupApplied": True,
        "legacyRainRouteCount": 0,
        "archiveIntegrityVerified": True,
        "visualApproved": False,
        "aaaQualityApproved": False,
        "productionReady": False,
    }
    write_json(handoffs / f"{PACKAGE_NAME}.receipt.json", receipt)

    root_cleanup = dict(cleanup)
    root_cleanup.update({
        "fullPackage": f"handoffs/{zip_path.name}",
        "fullPackageSHA256": package_sha,
        "fullPackageBytes": zip_path.stat().st_size,
    })
    write_json(wm / "CLEANUP_RECEIPT.json", root_cleanup)

    root_handoff = dict(handoff)
    root_handoff.update({
        "packagePath": f"weather-mother/handoffs/{zip_path.name}",
        "packageSHA256": package_sha,
        "packageBytes": zip_path.stat().st_size,
        "archiveIntegrityVerified": True,
    })
    write_json(wm / "HANDOFF.json", root_handoff)

    restart = start_here.replace("web/weather-mother/", "")
    restart = restart.replace("source/liquid-rain-v100/index.html", "liquid-rain-v100/ 以及全量包内 source/liquid-rain-v100/index.html")
    (wm / "RESTART_START_HERE.md").write_text(restart, encoding="utf-8")
    write_json(
        wm / "PUBLICATION_RECEIPT.json",
        {
            "productionLine": "Weather Mother",
            "version": "1.2.0-full-clean-handoff",
            "date": "2026-09-03",
            "canonicalEntry": "https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/",
            "package": f"weather-mother/handoffs/{zip_path.name}",
            "packageSHA256": package_sha,
            "packageBytes": zip_path.stat().st_size,
            "cleanupApplied": True,
            "archiveIntegrityVerified": True,
            "visualApproved": False,
            "aaaQualityApproved": False,
            "productionReady": False,
        },
    )

    shutil.rmtree(package_stage_parent)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
