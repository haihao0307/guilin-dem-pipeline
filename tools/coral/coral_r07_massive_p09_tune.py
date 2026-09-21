from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p09_tune.py <build-dir>")

    root = Path(sys.argv[1])
    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    html = index_path.read_text(encoding="utf-8")

    html = replace_once(
        html,
        "pit=Math.pow(clamp(1-u/.43,0,1),2.15),rim=Math.pow(clamp(1-Math.abs(u-.52)/.145,0,1),2.0),",
        "pit=Math.pow(clamp(1-u/.48,0,1),1.90),rim=Math.pow(clamp(1-Math.abs(u-.58)/.180,0,1),1.80),",
        "broaden integrated pit and rim",
    )
    html = replace_once(
        html,
        "wall=Math.pow(clamp(1-boundary/.18,0,1),2.25),tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],",
        "wall=Math.pow(clamp(1-boundary/.24,0,1),1.90),tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],",
        "broaden second-nearest shared wall",
    )
    html = replace_once(
        html,
        "offset=cfg.microDepth*fade*(.0085*cfg.ridges*site.rimScale*wall+.0060*cfg.ridges*site.rimScale*rim-.0105*site.depthScale*pit+.0017*cfg.grain*spokes+.0011*cfg.grain*grain),",
        "offset=cfg.microDepth*fade*(.0230*cfg.ridges*site.rimScale*wall+.0160*cfg.ridges*site.rimScale*rim-.0290*site.depthScale*pit+.0035*cfg.grain*spokes+.0022*cfg.grain*grain),",
        "strengthen P09 visible corallite relief",
    )
    html = replace_once(
        html,
        "P08 保留半球／头盔状平滑母体，淘汰 P07 的规则纬向杯体行列。Microscope 改为黄金角扰动站点驱动的整合式共享壁场：杯坑、杯缘、共享壁和细微隔片直接沿母体法线进入同一张连续表面。",
        "P09 保留半球／头盔状平滑母体，同时淘汰 P07 的规则纬向圆环和已发布 P08 的弱最近中心形变。Microscope 使用黄金角扰动站点并同时读取最近与次近站点：杯坑、杯缘、共享壁和细微隔片直接沿母体法线进入同一张连续表面。",
        "P09 workbench explanation",
    )
    html = replace_once(
        html,
        "coralliteTopology:'shared-wall-rim-pit-septa',baseSurfaceMicroNoise:false,microscopeGeometry:true,",
        "coralliteTopology:'shared-wall-rim-pit-septa',sharedWallUsesSecondNearest:true,visibleReliefTuned:true,baseSurfaceMicroNoise:false,microscopeGeometry:true,",
        "runtime P09 tuning evidence",
    )
    html = replace_once(
        html,
        "coralliteTopology:'shared-wall-rim-pit-septa',baseSurfaceMicroNoise:false,integratedCoralliteField:true,",
        "coralliteTopology:'shared-wall-rim-pit-septa',sharedWallUsesSecondNearest:true,visibleReliefTuned:true,baseSurfaceMicroNoise:false,integratedCoralliteField:true,",
        "build marker P09 tuning evidence",
    )

    if "P08 保留半球" in html:
        raise RuntimeError("stale P08 explanation remains")
    if "visibleReliefTuned:true" not in html:
        raise RuntimeError("P09 tuning marker missing")

    index_path.write_text(html, encoding="utf-8")

    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["geometry"]["visibleReliefTuned"] = True
    build["geometry"]["pitRadiusNormalized"] = 0.48
    build["geometry"]["rimCenterNormalized"] = 0.58
    build["geometry"]["rimHalfWidthNormalized"] = 0.18
    build["geometry"]["sharedWallBoundaryNormalized"] = 0.24
    build["geometry"]["reliefCoefficients"] = {
        "sharedWall": 0.023,
        "rim": 0.016,
        "pit": -0.029,
        "septa": 0.0035,
        "grain": 0.0022,
    }
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
