from pathlib import Path
import hashlib
import json
import runpy

ROOT = Path(__file__).resolve().parents[2]
BASE_BUILDER = ROOT / "workbenches/landscape-karst-dem-field-r2-6-1-driver-safe/build_r261.py"
BASE_OUT = ROOT / "workbenches/landscape-karst-dem-field-r2-6-1-driver-safe/index.html"
OUT_DIR = ROOT / "workbenches/landscape-karst-dem-field-r2-6-1b-final"
OUT = OUT_DIR / "index.html"
BUILD = OUT_DIR / "build.json"

runpy.run_path(str(BASE_BUILDER), run_name="__main__")
source = BASE_OUT.read_text(encoding="utf-8")
source_sha = hashlib.sha256(source.encode("utf-8")).hexdigest()

if "spread+=abs(v-last)" not in source:
    raise RuntimeError("R2.6.1b expected visibility probe token missing")
source = source.replace("spread+=abs(v-last)", "spread+=Math.abs(v-last)", 1)
source = source.replace("PALAU_KARST_DEM_FIELD_R261_DRIVER_SAFE", "PALAU_KARST_DEM_FIELD_R261B_FINAL")
source = source.replace("卡斯特 DEM 函数场 R2.6.1 · 显卡兼容", "卡斯特 DEM 函数场 R2.6.1b · 稳定版", 2)
source = source.replace(
    "R2.6.1 · DEM 连续函数场 · 真实裂隙 · 驱动安全渲染",
    "R2.6.1b · DEM 连续函数场 · 真实裂隙 · 浏览器稳定",
)
source = source.replace(
    'renderer:"two-pass-r261-rgba8-packed-dem-field-driver-safe"',
    'renderer:"two-pass-r261b-rgba8-packed-dem-field-stable"',
)
source = source.replace(
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 真实裂隙 · 驱动安全`',
    'document.getElementById("badge").textContent=`首帧 ${loadMs} ms · DEM 连续场 · 真实裂隙 · 浏览器稳定`',
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(source, encoding="utf-8")
report = {
    "schema": "LANDSCAPE_KARST_DEM_FIELD_R261B_FINAL",
    "source": str(BASE_OUT.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "output": str(OUT.relative_to(ROOT)),
    "outputSha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
    "defaultMode": "DEM_CONTINUOUS_FIELD",
    "runtimeFix": "Math.abs visibility-spread probe",
    "geometryOperatorsUnchanged": True,
    "renderer": "WebGL2 RGBA8 packed three-target stable path",
    "visualApproved": False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
