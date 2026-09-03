from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

PACKAGE_NAME = "Ocean_Mother_Full_Restart_Handoff_2026-09-03_V0.3.0"
RUNTIME_VERSION = "0.3.0-island-r017"
RUNTIME_DIR = "ocean-mother/island-r017"
PUBLIC_URL = "https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/island-r017/"
SOURCE_BRANCH = "work/ocean-mother-handoff-20260901"
RUNTIME_INTRO_COMMIT = "e8faa14"
PUBLIC_COMMIT = "28d9206d5cb17a0e1400bf2f5cfa3d3ba9d6e2dc"
LOCAL_QA_RUN = 33731239195
PUBLIC_QA_RUN = 33732650013
ALLOWED_SUFFIXES = {
    ".md", ".json", ".js", ".mjs", ".glsl", ".vert", ".frag", ".css", ".html",
    ".py", ".txt", ".tap", ".yml", ".yaml", ".bat", ".sh", ".command", ".csv",
}
BANNED_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".hdr",
    ".exr", ".ktx", ".ktx2", ".dds", ".avif", ".glb", ".gltf", ".obj", ".fbx",
    ".zip", ".tar", ".gz", ".7z", ".rar", ".mp4", ".mov", ".webm",
}
SKIP_PARTS = {"__pycache__", ".git", ".github", "node_modules", "handoffs", "payload"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def should_copy(path: Path) -> bool:
    if any(part in SKIP_PARTS for part in path.parts):
        return False
    if path.name in {".DS_Store"} or path.suffix.lower() in BANNED_SUFFIXES:
        return False
    if path.suffix and path.suffix.lower() not in ALLOWED_SUFFIXES:
        return False
    return True


def copy_filtered(src: Path, dst: Path) -> int:
    if not src.exists():
        return 0
    copied = 0
    if src.is_file():
        if should_copy(src):
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            copied += 1
        return copied
    for path in sorted(src.rglob("*")):
        if not path.is_file() or not should_copy(path):
            continue
        rel = path.relative_to(src)
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        copied += 1
    return copied


def update_project_state(repo: Path, source_commit: str) -> None:
    working_state = f"""# Ocean Mother 当前工作状态

更新时间：2026-09-03。仓库 `haihao0307/guilin-dem-pipeline`，工作分支 `{SOURCE_BRANCH}`。

## 当前唯一续接入口

当前运行版：`{RUNTIME_VERSION}`。

当前源码目录：`{RUNTIME_DIR}/`。

公开在线工作台：`{PUBLIC_URL}`。

R017 已形成圆形无树沙岛、三层破浪显示、多源火焰、多股长烟、统一风场、三页共 102 项参数、动态液态玻璃界面、桌面与移动端布局。当前源快照提交：`{source_commit}`。运行目录首次落地提交：`{RUNTIME_INTRO_COMMIT}`。公开页面发布提交：`{PUBLIC_COMMIT}`。

本地浏览器门禁在工作流 `{LOCAL_QA_RUN}` 中通过 41 项检查。公开网址 Playwright 门禁在工作流 `{PUBLIC_QA_RUN}` 中通过 44 项检查，覆盖 HTTP 200、运行初始化、三页参数、暂停与继续、几何参数热更新、风场反向、三层破浪、多股烟火、动态玻璃、移动端、深海往返、请求、JavaScript 与 WebGL 错误检查。

## 用户锁定规则

用户验收只使用可直接点击、持续运行的在线 HTML。除非当轮明确要求，不以压缩包、报告、截图或离线文件代替网页成果。用户明确要求全量包时，生成包仍须以当前在线 HTML 和精确源码为基础。

Ocean Mother 永久关闭图像生成、图像增强和图片式细节补偿。运行时、公开页面与全量包保持零颜色贴图、零法线图片、零噪声图片、零环境图片、零截图背景和零外部模型。写实方向优先，卡通方向未解锁。

## 当前能力边界

R017 的海岛属于程序化试验域，没有接入实测海岛地形。三层卷浪使用受水深约束的运动学曲面和悬卷水片显示；泡沫、飞沫、火焰和烟雾使用数值输运与粒子近似。完整三维自由表面、守恒绕流、反射波、卷气、气泡、流固动量交换和体积燃烧仍待继续研发。

真实 iPhone Safari、真实移动 GPU 功耗和硬件帧率仍未完成设备侧验证。`visualApproved=false`、`productionApproved=false`、`fullReplication=false`。

## 下一轮

下一轮版本从 R017 原样向前演进，工作代号 R018。不得退回 R010 黑场、R012 破碎岸线或静态玻璃。第一阶段继续强化海岛构图、三层浪的空间关系、泡沫尺度、多股火焰与长烟的自然性、动态玻璃与按钮过渡，并维持 102 项参数的真实运行消费者。每次交付继续只给经过公开浏览器验证的在线 HTML。
"""
    next_round = f"""# Ocean Mother 下一轮启动入口：R018

1. 先阅读 `AGENTS.md`、`WORKING_STATE.md`、`HANDOFF.json`、`SOURCE_LOCK.json`。
2. 当前唯一运行基线为 `{RUNTIME_VERSION}`，源码位于 `{RUNTIME_DIR}/`。
3. 当前公开验收页为 `{PUBLIC_URL}`。
4. R017 已通过公开 Playwright 44 项检查，公开构建提交 `{PUBLIC_COMMIT}`。
5. R018 直接继承圆形无树海岛、三层破浪、多源火焰、多股长烟、统一风场、三页 102 项参数和动态玻璃。
6. 优先做画面与物理关系收敛，继续保持零图片资产和在线 HTML 唯一交付规则。
7. 用户视觉批准前，所有批准字段保持 false。
"""
    write_text(repo / "ocean-mother/WORKING_STATE.md", working_state)
    write_text(repo / "ocean-mother/NEXT_ROUND_START_HERE.md", next_round)


def create_package_docs(root: Path, source_commit: str) -> None:
    start_here = f"""# START HERE

这是 Ocean Mother 2026-09-03 V0.3.0 干净全量重启包。

阅读顺序：

1. `AGENTS.md`
2. `WORKING_STATE.md`
3. `OCEAN_HANDOFF.md`
4. `HANDOFF.json`
5. `SOURCE_LOCK.json`
6. `NEXT_ROUND_START_HERE.md`

当前运行入口：`ocean-mother/island-r017/index.html`。

在线验收入口：`{PUBLIC_URL}`。

本包只含代码、数值、几何、着色器、文档和测试文本，不含图片贴图、截图、外部模型或预烘焙环境图。下一轮从 R017 继续，工作代号 R018。
"""
    handoff_md = f"""# Ocean Mother 全量交接

当前基线为 `{RUNTIME_VERSION}`。页面呈现圆形无树海岛、沙滩与浅海、三层卷浪显示、多股火焰、多源长烟、统一风场、三页 102 项参数和动态液态玻璃界面。

公开地址：{PUBLIC_URL}

本地浏览器门禁：工作流 `{LOCAL_QA_RUN}`，41 项通过。

公开 Playwright 门禁：工作流 `{PUBLIC_QA_RUN}`，44 项通过。

公开发布提交：`{PUBLIC_COMMIT}`。

本包的当前源快照：`{source_commit}`。

保护规则：在线 HTML 是默认验收成果；零图片资产；写实方向优先；冻结深海与天气依赖；视觉、生产和完整复刻批准均保持 false。

R018 应继续强化海岛轮廓、浅海透明度、三层浪的先后与空间结构、泡沫尺度、岩石水线、多股火焰、长烟和流动玻璃交互。完整三维流体与体积燃烧不得提前申报完成。
"""
    readme = f"""# Ocean Mother V0.3.0 Full Restart Handoff

当前网页：{PUBLIC_URL}

本地查看：在本目录运行 `python tools/serve.py`，再打开终端显示的地址。直接双击 HTML 可能受到浏览器模块安全策略限制。

完整性检查：`python tools/verify.py`。

当前主运行目录：`ocean-mother/island-r017/`。历史保留目录只用于回溯，不覆盖当前状态。
"""
    handoff = {
        "format": "ocean-mother-full-restart-handoff",
        "packageVersion": "0.3.0",
        "date": "2026-09-03",
        "runtimeVersion": RUNTIME_VERSION,
        "runtimePath": RUNTIME_DIR,
        "publicUrl": PUBLIC_URL,
        "sourceBranch": SOURCE_BRANCH,
        "sourceCommit": source_commit,
        "runtimeIntroductionCommit": RUNTIME_INTRO_COMMIT,
        "publicCommit": PUBLIC_COMMIT,
        "verification": {
            "localWorkflowRun": LOCAL_QA_RUN,
            "localChecksPassed": 41,
            "publicWorkflowRun": PUBLIC_QA_RUN,
            "publicChecksPassed": 44,
            "publicChecksFailed": 0,
        },
        "capabilities": {
            "roundTreelessIsland": True,
            "threeCurlLayers": True,
            "threeParameterPages": True,
            "parameterCount": 102,
            "multipleFireSources": True,
            "multipleLongSmokeSources": True,
            "sharedWindField": True,
            "animatedLiquidGlass": True,
            "deepOceanRoundTrip": True,
        },
        "assetPolicy": {
            "persistentImageAssets": 0,
            "externalModels": 0,
            "externalCdn": 0,
            "imageGeneration": False,
        },
        "approvals": {
            "visualApproved": False,
            "productionApproved": False,
            "fullReplication": False,
        },
    }
    source_lock = {
        "repository": "haihao0307/guilin-dem-pipeline",
        "branch": SOURCE_BRANCH,
        "sourceCommit": source_commit,
        "runtimeIntroductionCommit": RUNTIME_INTRO_COMMIT,
        "publicCommit": PUBLIC_COMMIT,
        "publicWorkflowRun": PUBLIC_QA_RUN,
        "publicUrl": PUBLIC_URL,
        "frozenDependencies": ["ocean-mother/v001", "ocean-mother/v001/weather"],
        "nextRound": "R018",
    }
    write_text(root / "START_HERE.md", start_here)
    write_text(root / "OCEAN_HANDOFF.md", handoff_md)
    write_text(root / "README.md", readme)
    write_text(root / "HANDOFF.json", json.dumps(handoff, ensure_ascii=False, indent=2))
    write_text(root / "SOURCE_LOCK.json", json.dumps(source_lock, ensure_ascii=False, indent=2))
    write_text(root / "index.html", '<!doctype html><meta charset="utf-8"><title>Ocean Mother R017</title><meta http-equiv="refresh" content="0;url=ocean-mother/island-r017/index.html"><a href="ocean-mother/island-r017/index.html">打开 Ocean Mother R017</a>')
    write_text(root / "START_LOCAL.bat", "@echo off\npython tools\\serve.py\npause")
    write_text(root / "START_LOCAL.command", "#!/bin/sh\ncd \"$(dirname \"$0\")\"\npython3 tools/serve.py")
    os.chmod(root / "START_LOCAL.command", os.stat(root / "START_LOCAL.command").st_mode | stat.S_IXUSR)


def create_tools(root: Path) -> None:
    serve = """from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, webbrowser
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
url='http://127.0.0.1:8765/'
print(url, flush=True)
try:webbrowser.open(url)
except Exception:pass
ThreadingHTTPServer(('127.0.0.1',8765),SimpleHTTPRequestHandler).serve_forever()
"""
    verify = """from pathlib import Path
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'MANIFEST.json').read_text(encoding='utf-8'))
errors=[]
for rel,meta in manifest['files'].items():
 p=ROOT/rel
 if not p.is_file(): errors.append(rel+' missing');continue
 data=p.read_bytes()
 if len(data)!=meta['bytes']: errors.append(rel+' size')
 if hashlib.sha256(data).hexdigest()!=meta['sha256']: errors.append(rel+' sha256')
print(json.dumps({'status':'PASS' if not errors else 'FAIL','checked':len(manifest['files']),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
"""
    write_text(root / "tools/serve.py", serve)
    write_text(root / "tools/verify.py", verify)


def build_manifest(root: Path, source_commit: str) -> dict:
    files = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name == "MANIFEST.json":
            continue
        rel = path.relative_to(root).as_posix()
        files[rel] = {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
    manifest = {
        "format": "ocean-mother-full-restart-manifest",
        "packageName": PACKAGE_NAME,
        "packageVersion": "0.3.0",
        "runtimeVersion": RUNTIME_VERSION,
        "sourceCommit": source_commit,
        "publicCommit": PUBLIC_COMMIT,
        "publicWorkflowRun": PUBLIC_QA_RUN,
        "fileCount": len(files),
        "persistentImageAssets": 0,
        "files": files,
    }
    write_text(root / "MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest


def deterministic_zip(root: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            arcname = f"{PACKAGE_NAME}/{path.relative_to(root).as_posix()}"
            info = zipfile.ZipInfo(arcname, date_time=(2026, 9, 3, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def run_checks(repo: Path, package_root: Path, zip_path: Path) -> dict:
    banned = [p.relative_to(package_root).as_posix() for p in package_root.rglob("*") if p.is_file() and p.suffix.lower() in BANNED_SUFFIXES]
    if banned:
        raise RuntimeError(f"Banned assets in package: {banned[:10]}")
    subprocess.run([sys.executable, str(package_root / "tools/verify.py")], check=True, cwd=package_root)
    subprocess.run(["node", str(package_root / "ocean-mother/island-r017/core.test.mjs")], check=True, cwd=package_root)
    with tempfile.TemporaryDirectory(prefix="ocean-handoff-verify-") as td:
        with zipfile.ZipFile(zip_path) as zf:
            bad = zf.testzip()
            if bad:
                raise RuntimeError(f"ZIP CRC failed: {bad}")
            zf.extractall(td)
        extracted = Path(td) / PACKAGE_NAME
        subprocess.run([sys.executable, str(extracted / "tools/verify.py")], check=True, cwd=extracted)
        subprocess.run(["node", str(extracted / "ocean-mother/island-r017/core.test.mjs")], check=True, cwd=extracted)
    return {"status": "PASS", "zipCrc": "PASS", "runtimeTests": "PASS", "persistentImageAssets": 0}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("repo", nargs="?", default=".")
    args = parser.parse_args()
    repo = Path(args.repo).resolve()
    source_commit = os.environ.get("GITHUB_SHA") or subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip()
    update_project_state(repo, source_commit)

    build_dir = repo / "_ocean_handoff_build"
    if build_dir.exists():
        shutil.rmtree(build_dir)
    package_root = build_dir / PACKAGE_NAME
    package_root.mkdir(parents=True)

    selections = [
        ("ocean-mother/AGENTS.md", "AGENTS.md"),
        ("ocean-mother/WORKING_STATE.md", "WORKING_STATE.md"),
        ("ocean-mother/NEXT_ROUND_START_HERE.md", "NEXT_ROUND_START_HERE.md"),
        ("ocean-mother/README.md", "governance/README.md"),
        ("ocean-mother/HANDOFF_ACCEPTANCE.json", "governance/HANDOFF_ACCEPTANCE.json"),
        ("ocean-mother/island-r017", "ocean-mother/island-r017"),
        ("ocean-mother/island-r017-build/qa_runner.py", "ocean-mother/island-r017-tools/qa_runner.py"),
        ("ocean-mother/v001", "ocean-mother/v001"),
        ("ocean-mother/coast-glass-r015", "history/coast-glass-r015"),
        ("ocean-mother/coast-v012", "history/coast-v012"),
        ("ocean-mother/contracts", "knowledge/contracts"),
        ("ocean-mother/skills", "knowledge/skills"),
        ("ocean-mother/knowledge", "knowledge/distilled"),
        ("ocean-mother/research", "knowledge/research"),
        ("ocean-mother/adoption", "governance/adoption"),
        ("ocean-mother/bridge-v1", "governance/bridge-v1"),
        ("ocean-mother/tasks", "planning/tasks"),
        ("weather-mother/OCEAN_START_HERE.md", "dependencies/weather-mother/OCEAN_START_HERE.md"),
        ("weather-mother/HANDOFF.json", "dependencies/weather-mother/HANDOFF.json"),
        ("weather-mother/QUALITY_GATES.json", "dependencies/weather-mother/QUALITY_GATES.json"),
        ("weather-mother/PUBLICATION_RECEIPT.json", "dependencies/weather-mother/PUBLICATION_RECEIPT.json"),
        ("weather-mother/clean-v1", "dependencies/weather-mother/clean-v1"),
        (".github/workflows/ocean-island-r017-candidate.yml", "automation/ocean-island-r017-candidate.yml"),
        (".github/workflows/ocean-island-r017-publish-online-html.yml", "automation/ocean-island-r017-publish-online-html.yml"),
        (".github/workflows/ocean-island-r017-public-playwright-check.yml", "automation/ocean-island-r017-public-playwright-check.yml"),
    ]
    copied = 0
    for src, dst in selections:
        copied += copy_filtered(repo / src, package_root / dst)
    if not (package_root / "ocean-mother/island-r017/index.html").is_file():
        raise FileNotFoundError("Current R017 runtime was not copied")
    if not (package_root / "ocean-mother/v001/index.html").is_file():
        raise FileNotFoundError("Deep-ocean dependency was not copied")

    create_package_docs(package_root, source_commit)
    create_tools(package_root)
    write_text(package_root / "evidence/R017_PUBLIC_QA.json", json.dumps({
        "status": "ONLINE_HTML_VERIFIED",
        "workflowRun": PUBLIC_QA_RUN,
        "checksPassed": 44,
        "checksFailed": 0,
        "publicCommit": PUBLIC_COMMIT,
        "url": PUBLIC_URL,
        "desktopInteractive": True,
        "mobileViewportInteractive": True,
        "deepOceanRoundTrip": True,
        "persistentImageAssets": 0,
        "visualApproved": False,
        "productionApproved": False,
    }, ensure_ascii=False, indent=2))
    write_text(package_root / "evidence/R017_LOCAL_QA.json", json.dumps({
        "status": "PASS",
        "workflowRun": LOCAL_QA_RUN,
        "checksPassed": 41,
        "checksFailed": 0,
        "persistentImageAssets": 0,
    }, ensure_ascii=False, indent=2))
    manifest = build_manifest(package_root, source_commit)

    handoff_dir = repo / "ocean-mother/handoffs"
    zip_path = handoff_dir / f"{PACKAGE_NAME}.zip"
    deterministic_zip(package_root, zip_path)
    verification = run_checks(repo, package_root, zip_path)
    zip_meta = {
        "packageName": PACKAGE_NAME,
        "packagePath": zip_path.relative_to(repo).as_posix(),
        "version": "0.3.0",
        "runtimeVersion": RUNTIME_VERSION,
        "bytes": zip_path.stat().st_size,
        "sha256": sha256_file(zip_path),
        "fileCount": manifest["fileCount"] + 1,
        "sourceCommit": source_commit,
        "publicCommit": PUBLIC_COMMIT,
        "publicWorkflowRun": PUBLIC_QA_RUN,
        "publicUrl": PUBLIC_URL,
        "verification": verification,
        "visualApproved": False,
        "productionApproved": False,
    }
    manifest_path = handoff_dir / f"{PACKAGE_NAME}.manifest.json"
    write_text(manifest_path, json.dumps(zip_meta, ensure_ascii=False, indent=2))
    write_text(handoff_dir / f"{PACKAGE_NAME}.sha256", f"{zip_meta['sha256']}  {zip_path.name}")

    restart = f"""# Ocean Mother 新研发窗口启动入口

最新干净全量包：`{zip_meta['packagePath']}`

ZIP SHA256：`{zip_meta['sha256']}`

ZIP 字节数：`{zip_meta['bytes']}`

包内文件数：`{zip_meta['fileCount']}`

当前运行版：`{RUNTIME_VERSION}`

当前在线工作台：`{PUBLIC_URL}`

当前源快照：`{source_commit}`

公开发布提交：`{PUBLIC_COMMIT}`

公开 Playwright 工作流：`{PUBLIC_QA_RUN}`，44 项通过，0 项失败。

新窗口先读取本文件和 `WORKING_STATE.md`。需要完整接管时下载并解压上面的包，依次阅读 `START_HERE.md`、`AGENTS.md`、`WORKING_STATE.md`、`OCEAN_HANDOFF.md`、`HANDOFF.json`、`SOURCE_LOCK.json` 和 `NEXT_ROUND_START_HERE.md`。

下一轮代号 R018，直接继承 R017，不回退旧黑场、破碎岸线或静态玻璃方向。默认交付继续只使用经过公开浏览器验证的在线 HTML。
"""
    write_text(repo / "ocean-mother/RESTART_START_HERE.md", restart)
    print(json.dumps(zip_meta, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
