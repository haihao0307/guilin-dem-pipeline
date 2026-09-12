from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile

SOURCE_COMMIT = "039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90"
EXPECTED_WORKBENCH_SHA256 = "ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2"
PACKAGE_NAME = "Landscape_Mother_Current_Unique_Full_Handoff_2026-09-12.zip"
ROOT_NAME = PACKAGE_NAME[:-4]
WORKBENCH = Path("workbenches/landscape-surface-r5/index.html")
TEMPLATE = Path("package_sources/landscape-mother-current")
OUTPUT = Path("handoffs/landscape-mother/CURRENT")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def copy_item(source: Path, destination: Path) -> None:
    if not source.exists():
        raise SystemExit(f"missing required source: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, destination)
    else:
        shutil.copy2(source, destination)


if digest(WORKBENCH.read_bytes()) != EXPECTED_WORKBENCH_SHA256:
    raise SystemExit("accepted workbench identity mismatch")

with tempfile.TemporaryDirectory(prefix="landscape-current-") as temp_dir:
    stage = Path(temp_dir) / ROOT_NAME
    stage.mkdir(parents=True)

    for path in TEMPLATE.iterdir():
        if path.name == "build_package.py":
            continue
        copy_item(path, stage / path.name)

    sources = [
        Path("workbenches/landscape-surface-r5"),
        Path("workbenches/landscape-function"),
        Path("workbenches/landscape-microscope-r2"),
        Path("workbenches/landscape-microscope-r3"),
        Path("landscape-mother"),
        Path("contracts/PRODUCTION_RULES.json"),
        Path("AGENTS.md"),
        Path("handoffs/landscape-mother/LEARNING_CURRENT.md"),
        Path("handoffs/landscape-mother/TERRAIN_RECORD.json"),
    ]
    for source in sources:
        copy_item(source, stage / "source" / source)

    files = []
    for path in sorted(stage.rglob("*")):
        if path.is_file() and path.name != "MANIFEST.json":
            data = path.read_bytes()
            files.append({
                "path": path.relative_to(stage).as_posix(),
                "bytes": len(data),
                "sha256": digest(data),
            })

    manifest = {
        "schema": "landscape-mother-package-manifest/1",
        "root": ROOT_NAME,
        "sourceCommit": SOURCE_COMMIT,
        "acceptedWorkbench": {
            "path": "source/workbenches/landscape-surface-r5/index.html",
            "sha256": EXPECTED_WORKBENCH_SHA256,
        },
        "files": files,
    }
    (stage / "MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    subprocess.run([sys.executable, str(stage / "verify_package.py")], check=True)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for old_zip in OUTPUT.glob("*.zip"):
        old_zip.unlink()

    zip_path = OUTPUT / PACKAGE_NAME
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(stage.rglob("*")):
            if not path.is_file():
                continue
            archive_name = f"{ROOT_NAME}/{path.relative_to(stage).as_posix()}"
            info = zipfile.ZipInfo(archive_name, (2026, 9, 12, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

zip_sha256 = digest(zip_path.read_bytes())
preview = (
    "https://raw.githack.com/haihao0307/guilin-dem-pipeline/"
    f"{SOURCE_COMMIT}/workbenches/landscape-surface-r5/index.html"
)
current = {
    "schema": "landscape-mother-canonical-pointer/1",
    "date": "2026-09-12",
    "onlyActivePackage": PACKAGE_NAME,
    "packageSha256": zip_sha256,
    "packageBytes": zip_path.stat().st_size,
    "canonicalBranch": "handoff/landscape-mother-current",
    "sourceCommit": SOURCE_COMMIT,
    "acceptedWorkbenchSha256": EXPECTED_WORKBENCH_SHA256,
    "publicPreview": preview,
    "historicalPackages": "archival-only",
}
(OUTPUT / "CURRENT.json").write_text(
    json.dumps(current, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
(OUTPUT / "PACKAGE_SHA256.txt").write_text(
    f"{zip_sha256}  {PACKAGE_NAME}\n",
    encoding="utf-8",
)
(OUTPUT / "START_HERE.md").write_text(
    "# Landscape Mother 当前唯一全量包\n\n"
    f"只使用：`{PACKAGE_NAME}`\n\n"
    f"SHA-256：`{zip_sha256}`\n\n"
    f"固定母版提交：`{SOURCE_COMMIT}`\n\n"
    f"固定工作台：`{preview}`\n\n"
    "本目录不得出现第二个 ZIP；历史包只作档案。\n",
    encoding="utf-8",
)

if len(list(OUTPUT.glob("*.zip"))) != 1:
    raise SystemExit("canonical folder must contain exactly one ZIP")

print(json.dumps(current, ensure_ascii=False, indent=2))
