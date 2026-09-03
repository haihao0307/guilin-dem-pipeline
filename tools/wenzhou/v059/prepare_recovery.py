from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def visible_control_counts(html: str) -> dict[str, int]:
    return {
        "panel_buttons": len(re.findall(r"<button\b", html)),
        "cloud_profile_buttons": len(re.findall(r"data-weather=\"(?:ci|cc|cs|ac|as|ns|sc|st|cu|cb)\"", html)),
        "view_buttons": len(re.findall(r"id=\"(?:home|top|coast|stormView|ground|cloudView|flightView|orbit)\"", html)),
        "tab_buttons": len(re.findall(r"data-tab-button=\"(?:view|weather|world|info)\"", html)),
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: prepare_recovery.py <gh-pages checkout>")

    site = Path(sys.argv[1]).resolve()
    source = site / "wenzhou-v7-full" / "workbench-v056"
    target = site / "wenzhou-v7-full" / "workbench-v059"

    if not (source / "index.html").is_file():
        raise SystemExit(f"stable baseline missing: {source}")

    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)

    # Evidence from the old release must never masquerade as evidence for the new one.
    for name in (
        "ADOPTION.json",
        "BUILD.json",
        "BROWSER_QA.json",
        "PUBLICATION_PROOF.json",
        "SINGLE_SCENE_ARCHITECTURE.md",
    ):
        path = target / name
        if path.exists():
            path.unlink()
    for pattern in ("QA_*.png", "QA_*.json", "PUBLIC_*.png"):
        for path in target.glob(pattern):
            path.unlink()

    index_path = target / "index.html"
    html = index_path.read_text("utf-8")

    required_anchors = (
        "小温州 V0.5.6 · 温州手机优先地理工作台",
        "WENZHOU · 0.5.6",
        "id=\"menuButton\"",
        "id=\"panel\"",
        "十个云属",
        "data-tab-button=\"weather\"",
        "./runtime.js?v=056",
    )
    missing = [anchor for anchor in required_anchors if anchor not in html]
    if missing:
        raise SystemExit(f"stable baseline anchors missing: {missing}")

    html = html.replace("小温州 V0.5.6 · 温州手机优先地理工作台", "小温州 V0.5.9 · 温州完整功能恢复工作台")
    html = html.replace("WENZHOU · 0.5.6", "WENZHOU · 0.5.9")
    html = html.replace("aria-label=\"打开温州控制菜单\"", "aria-label=\"打开温州完整控制菜单\"")
    html = html.replace("./runtime.js?v=056", "./runtime.js?v=059-full-recovery")

    # Keep the user's requested single persistent button. The full feature set stays inside the sheet.
    recovery_css = "\n/* V0.5.9 recovery shell: one persistent menu button, full controls inside. */\n#touchToolbar,.minimal-brand{display:none!important}\n#menuButton{display:block!important}\n"
    html = html.replace("</style>", recovery_css + "</style>", 1)

    release_script = """
<script>
window.__WZ_RELEASE__ = Object.freeze({
  version: 'wenzhou-workbench-0.5.9-full-feature-recovery',
  baseline: 'wenzhou-workbench-0.5.6-mobile-view-stream',
  recoveryPolicy: 'restore-first-then-integrate-one-system-at-a-time',
  singlePersistentMenuButton: true,
  fullControlPanelPreserved: true,
  visualAcceptance: false,
  productionReady: false
});
</script>
"""
    html = html.replace("<script type=\"module\" src=\"./runtime.js?v=059-full-recovery\"></script>", release_script + "<script type=\"module\" src=\"./runtime.js?v=059-full-recovery\"></script>")
    index_path.write_text(html, encoding="utf-8")

    counts = visible_control_counts(html)
    minimums = {
        "panel_buttons": 35,
        "cloud_profile_buttons": 10,
        "view_buttons": 8,
        "tab_buttons": 4,
    }
    failed = {key: (counts[key], minimum) for key, minimum in minimums.items() if counts[key] < minimum}
    if failed:
        raise SystemExit(f"full-feature recovery control floor failed: {failed}")

    # The world renderer, weather system, hydrology, sea mask and all numerical assets remain byte-identical
    # to the last stable workbench. Only the HTML shell is intentionally changed.
    mismatches: list[str] = []
    checked_files = 0
    checked_bytes = 0
    for source_file in source.rglob("*"):
        if not source_file.is_file():
            continue
        relative = source_file.relative_to(source)
        if relative.as_posix() in {
            "index.html",
            "ADOPTION.json",
            "BUILD.json",
            "BROWSER_QA.json",
            "PUBLICATION_PROOF.json",
            "SINGLE_SCENE_ARCHITECTURE.md",
        }:
            continue
        target_file = target / relative
        if not target_file.is_file() or sha256(source_file) != sha256(target_file):
            mismatches.append(relative.as_posix())
        else:
            checked_files += 1
            checked_bytes += target_file.stat().st_size
    if mismatches:
        raise SystemExit(f"stable core changed unexpectedly: {mismatches[:20]}")

    build_report = {
        "schema": "wenzhou_full_feature_recovery_build@1",
        "version": "0.5.9",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "baseline": {
            "path": "wenzhou-v7-full/workbench-v056",
            "policy": "byte-identical world core",
        },
        "output": "wenzhou-v7-full/workbench-v059",
        "index": {
            "bytes": index_path.stat().st_size,
            "sha256": sha256(index_path),
        },
        "stableCore": {
            "checkedFiles": checked_files,
            "checkedBytes": checked_bytes,
            "mismatches": mismatches,
            "rendererUnchanged": True,
            "weatherUnchanged": True,
            "cloudRendererUnchanged": True,
            "hydrologyUnchanged": True,
            "seaMaskLogicUnchanged": True,
            "cameraSafetyUnchanged": True,
        },
        "ui": {
            "singlePersistentMenuButton": True,
            "touchToolbarHidden": True,
            "persistentBrandHidden": True,
            "fullPanelPreserved": True,
            "counts": counts,
        },
        "truth": {
            "overviewSpacingMeters": 800,
            "nativeSourceIdentityMeters": 12.5,
            "fullNativeOnline": False,
            "cloudAltitudeOffsetMeters": 0,
            "terrainVerticalScale": 1,
            "cloudVerticalScale": 1,
        },
        "approval": {
            "visualAcceptance": False,
            "productionReady": False,
        },
    }
    (target / "RECOVERY_BUILD.json").write_text(json.dumps(build_report, ensure_ascii=False, indent=2), encoding="utf-8")

    notes = """# 小温州 V0.5.9 完整功能恢复版

本版从 V0.5.6 稳定工作台完整恢复。地形、真实海域掩膜、水文、天气、十个云属、共享深度、相机安全、手机手势与全部数值资产保持字节级一致。

界面只做一项明确调整：画面长期只保留一个“菜单”按钮。原有完整按钮群全部保留在菜单面板内。V0.5.8 的矩形海面、随机 Sprite 云片、散碎局部补丁和大标题栏均未进入本版。

后续技术改进必须一次只接入一个系统，并通过视觉回归以后才可进入下一版。
"""
    (target / "RELEASE_NOTES.md").write_text(notes, encoding="utf-8")
    print(json.dumps(build_report, ensure_ascii=False))


if __name__ == "__main__":
    main()
