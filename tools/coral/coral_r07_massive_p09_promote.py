from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import coral_r07_massive_p08_patch as p08


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p09_promote.py <build-dir>")

    root = Path(sys.argv[1])

    # Build the clean integrated shared-wall implementation from the exact P07
    # publication baseline, then promote it to P09 so the already-published P08
    # weak nearest-center experiment remains preserved as failure evidence.
    p08.main()

    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    html = index_path.read_text(encoding="utf-8")

    require("R07-P08" in html, "P08 intermediate runtime marker missing")
    html = html.replace("R07-P08", "R07-P09")
    html = html.replace("Massive Coral P08", "Massive Coral P09")
    html = html.replace("NOAA Massive Coral P08", "NOAA Massive Coral P09")
    html = html.replace("version:'R07-P08'", "version:'R07-P09'")
    html = html.replace(
        "P09 保留半球／头盔状平滑母体，淘汰 P07 的规则纬向杯体行列。Microscope 改为黄金角扰动站点驱动的整合式共享壁场：杯坑、杯缘、共享壁和细微隔片直接沿母体法线进入同一张连续表面。",
        "P09 保留半球／头盔状平滑母体，同时淘汰 P07 的规则纬向圆环和已发布 P08 的弱最近中心形变。Microscope 使用黄金角扰动站点，并同时读取最近与次近站点：杯坑、杯缘、共享壁和细微隔片直接沿母体法线进入同一张连续表面。",
    )
    require("R07-P08" not in html, "stale P08 runtime marker remains")
    require("R07-P09" in html, "P09 runtime marker missing")
    index_path.write_text(html, encoding="utf-8")

    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["schema"] = "CORAL_MOTHER_R07_MASSIVE_P09_BUILD"
    build["releaseId"] = "CORAL_R07_P09_NOAA_MASSIVE_PORITES_SHARED_WALL_VORONOI"
    build["implementationBaseline"] = "P07-clean-base"
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["geometry"]["nearestSitePair"] = True
    build["geometry"]["sharedWallUsesSecondNearest"] = True
    build["geometry"]["preservesPublishedP08AsFailureEvidence"] = True
    build["supersedes"] = {
        "releaseId": "CORAL_R07_P08_NOAA_MASSIVE_PORITES_INTEGRATED_FIBONACCI_CORALLITES",
        "reason": "Published P08 removed latitude bands but used only the nearest center, produced weak 0.0012 RMS relief, and did not create true shared walls. P09 uses nearest-plus-second-nearest integrated cells with stronger visible relief.",
    }
    build["visualAcceptance"] = False
    build["productionReady"] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    p08_doc = root / "P08_INTEGRATED_VORONOI_ZH.md"
    text = p08_doc.read_text(encoding="utf-8") if p08_doc.is_file() else ""
    if p08_doc.is_file():
        p08_doc.unlink()
    (root / "P09_SHARED_WALL_VORONOI_ZH.md").write_text(
        "# Coral Mother R07-P09 共享壁 Voronoi 珊瑚杯\n\n"
        "- 已发布 P08 作为失败证据保留：它取消了纬线，但只读取最近中心，默认 Microscope RMS 仅约 0.0012，视觉变化太弱，也没有真正共享壁。\n"
        "- P09 从干净 P07 母体重新构建，不覆盖 P08 证据。\n"
        "- 黄金角半球站点加入各向同性切平面扰动、半径差异、深度差异与相位差异。\n"
        "- 每个表面点同时读取最近与次近站点，次近距离参与共享壁形成。\n"
        "- 杯坑、杯缘、共享壁、六向细微隔片全部整合进同一母体网格，不增加吸盘式独立圆片。\n"
        "- Microscope 变化前后顶点数和三角形数保持不变。\n"
        "- NOAA 分类保持 Hard / stony coral → Massive coral。\n"
        "- Palau 群岛区域出现证据已关闭；Airai / Stone Money Island 局地投放仍未关闭。\n"
        "- visualAcceptance=false；productionReady=false。\n\n"
        + text.replace("P08", "P09"),
        encoding="utf-8",
    )

    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
