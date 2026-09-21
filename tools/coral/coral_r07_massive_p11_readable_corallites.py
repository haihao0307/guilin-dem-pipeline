from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


P10_INDEX_SHA256 = "13993c4d9f016dcf0f5e913fc90f758fc2e4f1cb2c0b267bfbbd3b7046c03847"
P10_RELEASE_ID = "CORAL_R07_P10_NOAA_MASSIVE_PORITES_POISSON_FINE_CORALLITES"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    require(count == 1, f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def replace_exact_count(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    require(count == expected, f"{label}: expected {expected} matches, found {count}")
    return text.replace(old, new)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p11_readable_corallites.py <build-dir>")

    root = Path(sys.argv[1])
    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    html = index_path.read_text(encoding="utf-8")
    require(hashlib.sha256(html.encode("utf-8")).hexdigest() == P10_INDEX_SHA256, "unexpected P10 index baseline")
    build = json.loads(build_path.read_text(encoding="utf-8"))
    require(build.get("releaseId") == P10_RELEASE_ID, "unexpected P10 release baseline")

    html = html.replace("NOAA Massive Coral P10", "NOAA Massive Coral P11")
    html = html.replace("Massive Coral P10", "Massive Coral P11")
    html = html.replace("R07-P10", "R07-P11")
    html = html.replace("version:'R07-P10'", "version:'R07-P11'")

    old_fs = """const FS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vP;in vec4 vC;out vec4 outColor;uniform vec3 uLight;uniform vec3 uEye;void main(){vec3 n=normalize(vN),l=normalize(uLight-vP),v=normalize(uEye-vP),h=normalize(l+v);float diff=max(dot(n,l),0.),spec=pow(max(dot(n,h),0.),32.),rim=pow(1.-max(dot(n,v),0.),2.2);vec3 c=vC.rgb*(.20+.78*diff)+vec3(.17,.22,.22)*rim*.42+vec3(1.,.78,.52)*spec*.20;outColor=vec4(pow(max(c,0.),vec3(.86)),1.);}`;"""
    new_fs = """const FS=`#version 300 es
precision highp float;in vec3 vN;in vec3 vP;in vec4 vC;out vec4 outColor;uniform vec3 uLight;uniform vec3 uEye;void main(){vec3 n=normalize(vN),l=normalize(uLight-vP),v=normalize(uEye-vP),h=normalize(l+v);float diff=max(dot(n,l),0.),spec=pow(max(dot(n,h),0.),32.),rim=pow(1.-max(dot(n,v),0.),2.2),microSignal=clamp(vC.a,0.,1.),microShade=clamp(1.+(microSignal-.5)*.38,.84,1.16),microSpec=mix(.14,.23,microSignal);vec3 c=vC.rgb*(.20+.78*diff)*microShade+vec3(.17,.22,.22)*rim*.38+vec3(1.,.78,.52)*spec*microSpec;outColor=vec4(pow(max(c,0.),vec3(.86)),1.);}`;"""
    html = replace_once(html, old_fs, new_fs, "P11 micro-lighting shader")

    html = replace_exact_count(
        html,
        "colors.push(col);",
        "colors.push([col[0],col[1],col[2],.5]);",
        2,
        "P11 independent RGBA vertex records",
    )
    html = replace_once(
        html,
        "let coralliteSiteCount=0,microOffsetSq=0,microOffsetMax=0,microAffected=0,siteRadiusCv=0,siteNearestNeighborCv=0,siteAcceptanceRatio=0,relaxedSiteFraction=0,poissonMinSpacing=0;",
        "let coralliteSiteCount=0,microOffsetSq=0,microOffsetMax=0,microAffected=0,microSignalMin=.5,microSignalMax=.5,microSignalSq=0,siteRadiusCv=0,siteNearestNeighborCv=0,siteAcceptanceRatio=0,relaxedSiteFraction=0,poissonMinSpacing=0;",
        "P11 micro signal statistics",
    )

    old_micro = """pit=Math.pow(clamp(1-u/.35,0,1),2.10),rim=Math.pow(clamp(1-Math.abs(u-.46)/.135,0,1),2.0),
        wall=Math.pow(clamp(1-boundary/.125,0,1),2.35),tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],
        ty=q[0]*site.bitangent[0]+q[1]*site.bitangent[1]+q[2]*site.bitangent[2],angle=Math.atan2(ty,tx),
        septa=Math.cos(angle*6+site.phase)*Math.pow(clamp(1-u/.70,0,1),2.0),
        grain=Math.sin(angle*11+site.phase*1.7)*Math.pow(clamp(1-u/.92,0,1),1.45),
        offset=cfg.microDepth*fade*(.0090*cfg.ridges*site.rimScale*wall+.0062*cfg.ridges*site.rimScale*rim-.0102*site.depthScale*pit+.0020*cfg.grain*septa+.0008*cfg.grain*grain),
        n=baseNormals[i],p=basePositions[i];
      positions[i]=[p[0]+n[0]*offset,p[1]+n[1]*offset,p[2]+n[2]*offset];microOffsetSq+=offset*offset;microOffsetMax=Math.max(microOffsetMax,Math.abs(offset));if(Math.abs(offset)>.00055)microAffected++;"""
    new_micro = """pit=Math.pow(clamp(1-u/.30,0,1),1.78),rim=Math.pow(clamp(1-Math.abs(u-.42)/.105,0,1),1.72),
        wall=Math.pow(clamp(1-boundary/.095,0,1),2.55),tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],
        ty=q[0]*site.bitangent[0]+q[1]*site.bitangent[1]+q[2]*site.bitangent[2],angle=Math.atan2(ty,tx),
        septa=Math.cos(angle*6+site.phase)*Math.pow(clamp(1-u/.62,0,1),2.15),
        grain=Math.sin(angle*11+site.phase*1.7)*Math.pow(clamp(1-u/.82,0,1),1.65),
        offset=cfg.microDepth*fade*(.0068*cfg.ridges*site.rimScale*wall+.0065*cfg.ridges*site.rimScale*rim-.0092*site.depthScale*pit+.0014*cfg.grain*septa+.0006*cfg.grain*grain),
        microSignal=clamp(.5+.36*wall+.24*rim-.52*pit+.075*septa,0,1),n=baseNormals[i],p=basePositions[i];
      positions[i]=[p[0]+n[0]*offset,p[1]+n[1]*offset,p[2]+n[2]*offset];colors[i][3]=microSignal;microOffsetSq+=offset*offset;microOffsetMax=Math.max(microOffsetMax,Math.abs(offset));if(Math.abs(offset)>.00045)microAffected++;const signalDelta=microSignal-.5;microSignalMin=Math.min(microSignalMin,microSignal);microSignalMax=Math.max(microSignalMax,microSignal);microSignalSq+=signalDelta*signalDelta;"""
    html = replace_once(html, old_micro, new_micro, "P11 readable pit-rim-wall field")

    html = replace_once(
        html,
        "const ext=max.map((v,i)=>v-min[i]),microNormalRms=Math.sqrt(microOffsetSq/Math.max(1,baseCenter)),microCoverage=100*microAffected/Math.max(1,baseCenter),",
        "const ext=max.map((v,i)=>v-min[i]),microNormalRms=Math.sqrt(microOffsetSq/Math.max(1,baseCenter)),microCoverage=100*microAffected/Math.max(1,baseCenter),microSignalRms=Math.sqrt(microSignalSq/Math.max(1,baseCenter)),",
        "P11 signal RMS",
    )
    html = replace_once(
        html,
        "microTangentialLeakRms:0,microNormalDisplacementRms:microNormalRms,maxMicroNormalDisplacement:microOffsetMax,microDisplacementRms:microNormalRms,microCoveragePct:microCoverage,",
        "microTangentialLeakRms:0,microSignalEncoding:'vertex-alpha-lighting-only',uniformRgbColor:true,microSignalRange:[microSignalMin,microSignalMax],microSignalRms,microNormalDisplacementRms:microNormalRms,maxMicroNormalDisplacement:microOffsetMax,microDisplacementRms:microNormalRms,microCoveragePct:microCoverage,",
        "P11 runtime signal evidence",
    )
    html = replace_exact_count(
        html,
        "microDisplacementSpace:'surface-normal-integrated-voronoi',microRadialOnly:false,",
        "microDisplacementSpace:'surface-normal-integrated-voronoi',microSignalEncoding:'vertex-alpha-lighting-only',uniformRgbColor:true,microRadialOnly:false,",
        2,
        "P11 build signal contract",
    )
    html = replace_once(
        html,
        "camera.target=[0,.92,0];camera.yaw=.30;camera.pitch=.16;camera.dist=2.45;",
        "camera.target=[0,.96,0];camera.yaw=.30;camera.pitch=.16;camera.dist=1.82;",
        "P11 closer microscope camera",
    )
    html = replace_once(
        html,
        "P10 保留半球／头盔状且通常平滑的母体，并淘汰 P09 仍可见的黄金角螺旋纹。Microscope 使用确定性 Poisson dart 站点；更小的杯坑、杯缘、共享薄壁和杯内隔片沿母体法线整合进同一连续表面。",
        "P11 保留 P10 的无螺旋 Poisson 站点与平滑巨石母体。Microscope 继续真实改变几何，同时把同一杯坑—杯缘—共享壁信号写入非颜色通道，只用于局部光照响应，使近景结构可读但整株仍保持一个 RGB 主色。",
        "P11 workbench explanation",
    )

    require("R07-P10" not in html, "stale P10 version marker remains")
    require("microSignalEncoding:'vertex-alpha-lighting-only'" in html, "P11 signal encoding marker missing")
    require("colors[i][3]=microSignal" in html, "P11 micro signal write missing")
    require("microShade=clamp" in html, "P11 shader response missing")
    index_path.write_text(html, encoding="utf-8")

    build.pop("browserQA", None)
    build.pop("functionalGates", None)
    build["schema"] = "CORAL_MOTHER_R07_MASSIVE_P11_BUILD"
    build["releaseId"] = "CORAL_R07_P11_NOAA_MASSIVE_PORITES_READABLE_CORALLITES"
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["geometry"].update(
        {
            "microSignalEncoding": "vertex-alpha-lighting-only",
            "uniformRgbColor": True,
            "readableCoralliteLighting": True,
            "pitRadiusNormalized": 0.30,
            "rimCenterNormalized": 0.42,
            "rimHalfWidthNormalized": 0.105,
            "sharedWallBoundaryNormalized": 0.095,
            "reliefCoefficients": {
                "sharedWall": 0.0068,
                "rim": 0.0065,
                "pit": -0.0092,
                "septa": 0.0014,
                "grain": 0.0006,
            },
        }
    )
    build["supersedes"] = {
        "releaseId": P10_RELEASE_ID,
        "reason": "P10 removed spiral and latitude artifacts but close-up review still read as uniform fine wrinkles. P11 retains real geometry and adds a non-RGB cavity/rim lighting signal so individual integrated corallites are legible without creating multiple species colours.",
    }
    build["visualAcceptance"] = False
    build["productionReady"] = False
    build["ecologicalPlacementReady"] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (root / "P11_READABLE_CORALLITES_ZH.md").write_text(
        "# Coral Mother R07-P11 可读珊瑚杯\n\n"
        "- P10 已消除纬线和 Fibonacci 螺旋，但近景仍像均匀细皱皮，杯坑—杯缘—共享壁不够可辨。\n"
        "- P11 保留 P10 的 Poisson 站点、真实法线位移和固定拓扑。\n"
        "- 杯坑、杯缘和共享壁的作用域重新收窄，避免重新变成岩石大褶皱。\n"
        "- 同一个微结构信号写入顶点 alpha，仅参与明暗和高光，不改变 RGB 主色；整株仍是一种颜色。\n"
        "- Microscope=0 时 alpha 回到中性 0.5；Microscope>0 时才出现结构明暗。\n"
        "- 近景镜头进一步靠近，以便真实检查小尺度杯体。\n"
        "- visualAcceptance=false；productionReady=false。\n",
        encoding="utf-8",
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
