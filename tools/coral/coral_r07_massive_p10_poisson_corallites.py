from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


P09_INDEX_SHA256 = "71c8704a2b0bc488e7ca60de8e92d228403f2468598405cc2ba109a358cf2c1e"
P09_RELEASE_ID = "CORAL_R07_P09_NOAA_MASSIVE_PORITES_SHARED_WALL_VORONOI"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    require(count == 1, f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    require(count == 1, f"{label}: expected exactly one match, found {count}")
    return updated


POISSON_SITE_AND_SEARCH = r"""
const scaleNorm=clamp((cfg.microScale-.45)/1.65,0,1),requestedSites=Math.round(mix(4200,6200,scaleNorm)),
      spacing=Math.sqrt(2*Math.PI/requestedSites),primaryMinSpacing=spacing*.70,relaxedMinSpacing=spacing*.57,
      SITE_BIN=56,sites=[],bins=new Map();
    let radiusSum=0,radiusSq=0,acceptedRelaxed=0;
    const binCoord=v=>clamp(Math.floor((v+1)*.5*SITE_BIN),0,SITE_BIN-1),binKey=(x,y,z)=>(x*SITE_BIN+y)*SITE_BIN+z,
      candidateQ=attempt=>{
        const y=mix(.055,.995,hash11(attempt*37.719+5.31)),phi=TAU*hash11(attempt*91.337+17.9),r=Math.sqrt(Math.max(0,1-y*y));
        return[r*Math.cos(phi),y,r*Math.sin(phi)];
      },
      canPlace=(q,minD)=>{
        const bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
          const x=bx+dx,y=by+dy,z=bz+dz;if(x<0||x>=SITE_BIN||y<0||y>=SITE_BIN||z<0||z>=SITE_BIN)continue;
          const bucket=bins.get(binKey(x,y,z));if(!bucket)continue;
          for(const id of bucket)if(len(sub(q,sites[id].q))<minD)return false;
        }
        return true;
      },
      addSite=(q,seed,relaxed)=>{
        const up=Math.abs(q[1])<.92?[0,1,0]:[1,0,0],tangent=norm(cross(up,q)),bitangent=cross(q,tangent),
          radiusScale=mix(.84,1.16,hash11(seed*83.11+1.9)),depthScale=mix(.88,1.14,hash11(seed*59.37+7.3)),
          rimScale=mix(.86,1.16,hash11(seed*101.9+11.1)),phase=TAU*hash11(seed*131.7+17.9),
          site={q,tangent,bitangent,radiusScale,depthScale,rimScale,phase},id=sites.length,
          bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]),key=binKey(bx,by,bz);
        sites.push(site);let bucket=bins.get(key);if(!bucket){bucket=[];bins.set(key,bucket)}bucket.push(id);
        radiusSum+=radiusScale;radiusSq+=radiusScale*radiusScale;if(relaxed)acceptedRelaxed++;
      };
    for(let attempt=0;attempt<requestedSites*70&&sites.length<requestedSites;attempt++){
      const q=candidateQ(attempt);if(canPlace(q,primaryMinSpacing))addSite(q,attempt,false);
    }
    for(let attempt=requestedSites*70;attempt<requestedSites*180&&sites.length<requestedSites;attempt++){
      const q=candidateQ(attempt);if(canPlace(q,relaxedMinSpacing))addSite(q,attempt,true);
    }
    coralliteSiteCount=sites.length;poissonMinSpacing=relaxedMinSpacing;
    siteAcceptanceRatio=coralliteSiteCount/Math.max(1,requestedSites);relaxedSiteFraction=acceptedRelaxed/Math.max(1,coralliteSiteCount);
    const radiusMean=radiusSum/Math.max(1,coralliteSiteCount);
    siteRadiusCv=Math.sqrt(Math.max(0,radiusSq/Math.max(1,coralliteSiteCount)-radiusMean*radiusMean))/Math.max(radiusMean,1e-6);

    const nearestTwo=q=>{
      const bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]);
      let best1=-2,best2=-2,id1=-1,id2=-1;
      const test=id=>{const s=sites[id],d=q[0]*s.q[0]+q[1]*s.q[1]+q[2]*s.q[2];if(d>best1){best2=best1;id2=id1;best1=d;id1=id}else if(d>best2){best2=d;id2=id}};
      const search=range=>{for(let dx=-range;dx<=range;dx++)for(let dy=-range;dy<=range;dy++)for(let dz=-range;dz<=range;dz++){
        const x=bx+dx,y=by+dy,z=bz+dz;if(x<0||x>=SITE_BIN||y<0||y>=SITE_BIN||z<0||z>=SITE_BIN)continue;
        const bucket=bins.get(binKey(x,y,z));if(bucket)for(const id of bucket)test(id);
      }};
      search(1);if(id2<0)search(2);if(id2<0){best1=-2;best2=-2;id1=-1;id2=-1;for(let id=0;id<sites.length;id++)test(id)}
      return{id1,id2,d1:Math.sqrt(Math.max(0,2*(1-best1))),d2:Math.sqrt(Math.max(0,2*(1-best2)))};
    };
    let nnSum=0,nnSq=0;
    for(let id=0;id<sites.length;id++){
      const near=nearestTwo(sites[id].q),d=near.id1===id?near.d2:near.d1;nnSum+=d;nnSq+=d*d;
    }
    const nnMean=nnSum/Math.max(1,sites.length);
    siteNearestNeighborCv=Math.sqrt(Math.max(0,nnSq/Math.max(1,sites.length)-nnMean*nnMean))/Math.max(nnMean,1e-6);
""".strip()


NEW_MICRO_LOOP = r"""
for(let i=0;i<baseCenter;i++){
      const t=surfaceT[i],fade=smooth(t/.055)*(1-smooth((t-.955)/.045));if(fade<=0)continue;
      const q=surfaceDirs[i],near=nearestTwo(q);if(near.id1<0)continue;
      const site=sites[near.id1],cellRadius=spacing*.60*site.radiusScale,
        u=near.d1/Math.max(cellRadius,1e-6),boundary=(near.d2-near.d1)/Math.max(spacing,1e-6),
        pit=Math.pow(clamp(1-u/.35,0,1),2.10),rim=Math.pow(clamp(1-Math.abs(u-.46)/.135,0,1),2.0),
        wall=Math.pow(clamp(1-boundary/.125,0,1),2.35),tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],
        ty=q[0]*site.bitangent[0]+q[1]*site.bitangent[1]+q[2]*site.bitangent[2],angle=Math.atan2(ty,tx),
        septa=Math.cos(angle*6+site.phase)*Math.pow(clamp(1-u/.70,0,1),2.0),
        grain=Math.sin(angle*11+site.phase*1.7)*Math.pow(clamp(1-u/.92,0,1),1.45),
        offset=cfg.microDepth*fade*(.0090*cfg.ridges*site.rimScale*wall+.0062*cfg.ridges*site.rimScale*rim-.0102*site.depthScale*pit+.0020*cfg.grain*septa+.0008*cfg.grain*grain),
        n=baseNormals[i],p=basePositions[i];
      positions[i]=[p[0]+n[0]*offset,p[1]+n[1]*offset,p[2]+n[2]*offset];microOffsetSq+=offset*offset;microOffsetMax=Math.max(microOffsetMax,Math.abs(offset));if(Math.abs(offset)>.00055)microAffected++;
    }
""".strip()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p10_poisson_corallites.py <build-dir>")

    root = Path(sys.argv[1])
    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    require(index_path.is_file(), "P09 index missing")
    require(build_path.is_file(), "P09 build manifest missing")

    html = index_path.read_text(encoding="utf-8")
    source_hash = hashlib.sha256(html.encode("utf-8")).hexdigest()
    require(source_hash == P09_INDEX_SHA256, f"unexpected P09 index hash: {source_hash}")
    build = json.loads(build_path.read_text(encoding="utf-8"))
    require(build.get("releaseId") == P09_RELEASE_ID, "unexpected P09 release baseline")

    html = html.replace("NOAA Massive Coral P09", "NOAA Massive Coral P10")
    html = html.replace("Massive Coral P09", "Massive Coral P10")
    html = html.replace("R07-P09", "R07-P10")
    html = html.replace("version:'R07-P09'", "version:'R07-P10'")
    html = replace_once(
        html,
        "const start=performance.now(),LAT=192,LON=384,grid=[],basePositions=[],surfaceDirs=[],surfaceT=[],positions=[],orientationNormals=[],normals=[],colors=[],indices=[],col=baseColor();",
        "const start=performance.now(),LAT=224,LON=448,grid=[],basePositions=[],surfaceDirs=[],surfaceT=[],positions=[],orientationNormals=[],normals=[],colors=[],indices=[],col=baseColor();",
        "P10 mesh resolution",
    )
    html = regex_once(
        html,
        r"const scaleNorm=clamp\(\(cfg\.microScale-\.45\)/1\.65,0,1\),requestedSites=.*?siteNearestNeighborCv=.*?;\n\n    for\(let i=0;i<baseCenter;i\+\+\)\{.*?microAffected\+\+;\n    \}",
        POISSON_SITE_AND_SEARCH + "\n\n    " + NEW_MICRO_LOOP,
        "P10 Poisson sites and subtle integrated corallites",
    )
    html = replace_once(html, "const c=[.62,.55,.35]", "const c=[.53,.48,.30]", "P10 uniform cream-olive colour")
    html = replace_once(
        html,
        "P09 保留半球／头盔状平滑母体，同时淘汰 P07 的规则纬向圆环和已发布 P08 的弱最近中心形变。Microscope 使用黄金角扰动站点并同时读取最近与次近站点：杯坑、杯缘、共享壁和细微隔片直接沿母体法线进入同一张连续表面。",
        "P10 保留半球／头盔状且通常平滑的母体，并淘汰 P09 仍可见的黄金角螺旋纹。Microscope 使用确定性 Poisson dart 站点；更小的杯坑、杯缘、共享薄壁和杯内隔片沿母体法线整合进同一连续表面。",
        "P10 workbench explanation",
    )
    html = replace_once(
        html,
        "let coralliteSiteCount=0,microOffsetSq=0,microOffsetMax=0,microAffected=0,siteRadiusCv=0,siteJitterRms=0;",
        "let coralliteSiteCount=0,microOffsetSq=0,microOffsetMax=0,microAffected=0,siteRadiusCv=0,siteNearestNeighborCv=0,siteAcceptanceRatio=0,relaxedSiteFraction=0,poissonMinSpacing=0;",
        "P10 site statistics",
    )
    html = replace_once(
        html,
        "coralliteSiteCount,siteDistribution:'golden-angle-jittered-hemisphere',siteRadiusCv,siteJitterRms,rowBandCount:0,explicitCoralliteCups:false,integratedCoralliteField:true,",
        "coralliteSiteCount,siteDistribution:'deterministic-poisson-dart-hemisphere',siteRadiusCv,siteNearestNeighborCv,siteAcceptanceRatio,relaxedSiteFraction,poissonMinSpacing,rowBandCount:0,spiralLattice:false,explicitCoralliteCups:false,integratedCoralliteField:true,",
        "P10 runtime distribution evidence",
    )
    html = replace_once(
        html,
        "meshResolution:'192x384-integrated-field',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'golden-angle-integrated-voronoi',coralliteTopology:'shared-wall-rim-pit-septa',sharedWallUsesSecondNearest:true,visibleReliefTuned:true,",
        "meshResolution:'224x448-integrated-field',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'poisson-fine-integrated-voronoi',coralliteTopology:'subtle-shared-wall-rim-pit-septa',siteDistribution:'deterministic-poisson-dart-hemisphere',spiralLattice:false,sharedWallUsesSecondNearest:true,visibleReliefTuned:true,",
        "P10 build marker distribution evidence",
    )

    for forbidden in (
        "golden-angle-jittered-hemisphere",
        "golden-angle-integrated-voronoi",
        "siteJitterRms",
        "LAT=192,LON=384",
    ):
        require(forbidden not in html, f"P10 stale marker remains: {forbidden}")
    for required in (
        "deterministic-poisson-dart-hemisphere",
        "spiralLattice:false",
        "siteNearestNeighborCv",
        "poissonMinSpacing",
        "meshResolution:'224x448-integrated-field'",
    ):
        require(required in html, f"P10 marker missing: {required}")

    index_path.write_text(html, encoding="utf-8")

    build.pop("browserQA", None)
    build.pop("functionalGates", None)
    build["schema"] = "CORAL_MOTHER_R07_MASSIVE_P10_BUILD"
    build["releaseId"] = "CORAL_R07_P10_NOAA_MASSIVE_PORITES_POISSON_FINE_CORALLITES"
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["geometry"].update(
        {
            "meshResolution": {"latitude": 224, "longitude": 448},
            "siteDistribution": "deterministic-poisson-dart-hemisphere",
            "spiralLattice": False,
            "coralliteFrequency": "poisson-fine-integrated-voronoi",
            "coralliteTopology": "subtle-shared-wall-rim-pit-septa",
            "surfaceProfile": "usually-smooth",
            "reliefCoefficients": {
                "sharedWall": 0.009,
                "rim": 0.0062,
                "pit": -0.0102,
                "septa": 0.002,
                "grain": 0.0008,
            },
            "constantTopologyAcrossMicroscope": True,
            "explicitCoralliteCups": False,
            "microDisplacementSpace": "surface-normal-integrated-voronoi",
            "microTangentialLeak": 0,
        }
    )
    build["supersedes"] = {
        "releaseId": P09_RELEASE_ID,
        "reason": "P09 passed geometry gates but visual review showed golden-angle spiral bands and excessive rock-like relief. P10 uses deterministic Poisson dart sites, smaller cells, and lower-amplitude integrated skeletal relief.",
    }
    build["visualAcceptance"] = False
    build["productionReady"] = False
    build["ecologicalPlacementReady"] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (root / "P10_POISSON_FINE_CORALLITES_ZH.md").write_text(
        "# Coral Mother R07-P10 Poisson 小尺度珊瑚杯\n\n"
        "- P09 技术门禁通过，但视觉自审失败：黄金角站点留下斜向螺旋纹，强化位移后表面像风化石皮。\n"
        "- P10 改用确定性 Poisson dart 半球站点，拒绝纬向行列和 Fibonacci 螺旋晶格。\n"
        "- 默认站点约 4,800 个，尺寸差异受控；网格提高到 224×448。\n"
        "- 杯坑、杯缘、共享薄壁和细微隔片全部在同一母体网格上执行法线位移。\n"
        "- 位移幅度显著低于 P09，以保持 Porites lutea 通常平滑的群体表面。\n"
        "- Microscope 变化不改变顶点数或三角形数。\n"
        "- NOAA NCEI 已关闭帕劳群岛区域出现证据；Airai / Stone Money Island 局地投放仍未关闭。\n"
        "- visualAcceptance=false；productionReady=false。\n",
        encoding="utf-8",
    )

    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
