from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


P07_INDEX_SHA256 = "ff9fe3cf45eaafd9d9c0b4e4f61cee5b0cfdd8c0d7980ad09a474c334acc9132"
P07_RELEASE_ID = "CORAL_R07_P07_NOAA_MASSIVE_PORITES_EXPLICIT_CORALLITE_CUPS"


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


NEW_GENERATE = r"""
function generate(){
  const start=performance.now(),LAT=192,LON=384,grid=[],basePositions=[],surfaceDirs=[],surfaceT=[],positions=[],orientationNormals=[],normals=[],colors=[],indices=[],col=baseColor();
  let warpSq=0,warpCount=0;
  for(let i=0;i<=LAT;i++){
    const row=[],t=i/LAT;
    for(let j=0;j<LON;j++){
      const phi=j/LON*TAU,f=field(phi,t),th=f.tt*Math.PI*.5,
        domePow=mix(1.55,.62,clamp((cfg.dome-.55)/1.15,0,1)),
        radialBase=cfg.width*Math.pow(Math.sin(th),mix(.86,1.22,cfg.base)),
        baseSpread=1+cfg.base*.22*Math.pow(t,5),radius=radialBase*baseSpread*(1+f.macro+f.med),
        y=cfg.height*Math.pow(Math.cos(th),domePow)*(1-.055*cfg.base*Math.pow(t,4)),
        x=radius*Math.cos(f.p),z=radius*Math.sin(f.p),p=[x,Math.max(0,y),z],idx=basePositions.length,
        q=norm([Math.sin(th)*Math.cos(f.p),Math.cos(th),Math.sin(th)*Math.sin(f.p)]);
      basePositions.push(p);positions.push(p.slice());surfaceDirs.push(q);surfaceT.push(t);row.push(idx);colors.push(col);
      const wp=Math.abs(f.p-phi)+Math.abs(f.tt-t);warpSq+=wp*wp;warpCount++;
    }
    grid.push(row);
  }
  const baseCenter=basePositions.length;basePositions.push([0,0,0]);positions.push([0,0,0]);surfaceDirs.push([0,-1,0]);surfaceT.push(1);colors.push(col);
  for(let i=0;i<LAT;i++)for(let j=0;j<LON;j++){
    const k=(j+1)%LON,a=grid[i][j],b=grid[i][k],c=grid[i+1][k],d=grid[i+1][j];indices.push(a,b,c,a,c,d);
  }
  for(let j=0;j<LON;j++){const k=(j+1)%LON;indices.push(baseCenter,grid[LAT][j],grid[LAT][k])}

  const baseNormals=basePositions.map(()=>[0,0,0]);
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2],n=cross(sub(basePositions[ib],basePositions[ia]),sub(basePositions[ic],basePositions[ia]));
    for(const id of[ia,ib,ic]){baseNormals[id][0]+=n[0];baseNormals[id][1]+=n[1];baseNormals[id][2]+=n[2]}
  }
  for(let i=0;i<baseNormals.length;i++){
    let n=norm(baseNormals[i]);
    if(i<baseCenter){const p=basePositions[i],out=norm([p[0],Math.max(.001,p[1]*1.15),p[2]]);if(n[0]*out[0]+n[1]*out[1]+n[2]*out[2]<0)n=[-n[0],-n[1],-n[2]]}
    else n=[0,-1,0];baseNormals[i]=n;orientationNormals.push(n.slice());
  }

  let coralliteSiteCount=0,microOffsetSq=0,microOffsetMax=0,microAffected=0,siteRadiusCv=0,siteJitterRms=0;
  if(cfg.microDepth>0){
    const scaleNorm=clamp((cfg.microScale-.45)/1.65,0,1),requestedSites=Math.round(mix(2000,3200,scaleNorm)),
      golden=Math.PI*(3-Math.sqrt(5)),spacing=Math.sqrt(2*Math.PI/requestedSites),BIN=28,sites=[],bins=new Map();
    let radiusSum=0,radiusSq=0,jitterSq=0;
    const binCoord=v=>clamp(Math.floor((v+1)*.5*BIN),0,BIN-1),binKey=(x,y,z)=>(x*BIN+y)*BIN+z;
    for(let i=0;i<requestedSites;i++){
      const areaU=(i+.5)/requestedSites,y0=mix(.995,.055,areaU),theta=Math.acos(y0),phi0=(i*golden)%TAU,
        q0=[Math.sin(theta)*Math.cos(phi0),Math.cos(theta),Math.sin(theta)*Math.sin(phi0)],
        up0=Math.abs(q0[1])<.92?[0,1,0]:[1,0,0],tu=norm(cross(up0,q0)),tv=cross(q0,tu),
        jx=(hash11(i*17.173+3.1)-.5)*spacing*.34,jy=(hash11(i*41.719+9.7)-.5)*spacing*.34,
        q=norm([q0[0]+tu[0]*jx+tv[0]*jy,q0[1]+tu[1]*jx+tv[1]*jy,q0[2]+tu[2]*jx+tv[2]*jy]),
        up=Math.abs(q[1])<.92?[0,1,0]:[1,0,0],tangent=norm(cross(up,q)),bitangent=cross(q,tangent),
        radiusScale=mix(.78,1.22,hash11(i*83.11+1.9)),depthScale=mix(.84,1.18,hash11(i*59.37+7.3)),
        rimScale=mix(.82,1.20,hash11(i*101.9+11.1)),phase=TAU*hash11(i*131.7+17.9),
        site={q,tangent,bitangent,radiusScale,depthScale,rimScale,phase},id=sites.length,
        bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]),key=binKey(bx,by,bz);
      sites.push(site);let bucket=bins.get(key);if(!bucket){bucket=[];bins.set(key,bucket)}bucket.push(id);
      radiusSum+=radiusScale;radiusSq+=radiusScale*radiusScale;jitterSq+=(jx*jx+jy*jy)/(spacing*spacing);
    }
    coralliteSiteCount=sites.length;
    const radiusMean=radiusSum/Math.max(1,coralliteSiteCount);
    siteRadiusCv=Math.sqrt(Math.max(0,radiusSq/Math.max(1,coralliteSiteCount)-radiusMean*radiusMean))/Math.max(radiusMean,1e-6);
    siteJitterRms=Math.sqrt(jitterSq/Math.max(1,coralliteSiteCount));

    const nearestTwo=q=>{
      const bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]);
      let best1=-2,best2=-2,id1=-1,id2=-1,candidates=0;
      const test=id=>{const s=sites[id],d=q[0]*s.q[0]+q[1]*s.q[1]+q[2]*s.q[2];candidates++;if(d>best1){best2=best1;id2=id1;best1=d;id1=id}else if(d>best2){best2=d;id2=id}};
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const x=bx+dx,y=by+dy,z=bz+dz;if(x<0||x>=BIN||y<0||y>=BIN||z<0||z>=BIN)continue;
        const bucket=bins.get(binKey(x,y,z));if(bucket)for(const id of bucket)test(id);
      }
      if(id2<0){best1=-2;best2=-2;id1=-1;id2=-1;candidates=0;for(let id=0;id<sites.length;id++)test(id)}
      return{id1,id2,d1:Math.sqrt(Math.max(0,2*(1-best1))),d2:Math.sqrt(Math.max(0,2*(1-best2))),candidates};
    };

    for(let i=0;i<baseCenter;i++){
      const t=surfaceT[i],fade=smooth(t/.055)*(1-smooth((t-.955)/.045));if(fade<=0)continue;
      const q=surfaceDirs[i],near=nearestTwo(q),site=sites[near.id1],cellRadius=spacing*.58*site.radiusScale,
        u=near.d1/Math.max(cellRadius,1e-6),boundary=(near.d2-near.d1)/Math.max(spacing,1e-6),
        pit=Math.pow(clamp(1-u/.43,0,1),2.15),rim=Math.pow(clamp(1-Math.abs(u-.52)/.145,0,1),2.0),
        wall=Math.pow(clamp(1-boundary/.18,0,1),2.25),tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],
        ty=q[0]*site.bitangent[0]+q[1]*site.bitangent[1]+q[2]*site.bitangent[2],angle=Math.atan2(ty,tx),
        spokes=Math.cos(angle*6+site.phase)*Math.pow(clamp(1-u/.82,0,1),1.65),
        grain=Math.sin((q[0]*37.1+q[1]*53.7+q[2]*41.3)*17.0+site.phase)*Math.sin((q[0]*61.9-q[1]*29.3+q[2]*73.1)*11.0-site.phase),
        offset=cfg.microDepth*fade*(.0085*cfg.ridges*site.rimScale*wall+.0060*cfg.ridges*site.rimScale*rim-.0105*site.depthScale*pit+.0017*cfg.grain*spokes+.0011*cfg.grain*grain),
        n=baseNormals[i],p=basePositions[i];
      positions[i]=[p[0]+n[0]*offset,p[1]+n[1]*offset,p[2]+n[2]*offset];microOffsetSq+=offset*offset;microOffsetMax=Math.max(microOffsetMax,Math.abs(offset));if(Math.abs(offset)>.0012)microAffected++;
    }
  }

  normals.length=positions.length;for(let i=0;i<normals.length;i++)normals[i]=[0,0,0];
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2],fn=cross(sub(positions[ib],positions[ia]),sub(positions[ic],positions[ia]));
    for(const id of[ia,ib,ic]){normals[id][0]+=fn[0];normals[id][1]+=fn[1];normals[id][2]+=fn[2]}
  }
  let normalDeviationSq=0,min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
  for(let i=0;i<normals.length;i++){
    let n=norm(normals[i]),o=orientationNormals[i]||[0,-1,0];if(n[0]*o[0]+n[1]*o[1]+n[2]*o[2]<0)n=[-n[0],-n[1],-n[2]];
    normals[i]=n;if(i!==baseCenter){const delta=1-clamp(n[0]*o[0]+n[1]*o[1]+n[2]*o[2],-1,1);normalDeviationSq+=delta*delta}
    const p=positions[i];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}
  }

  const data=new Float32Array(positions.length*10);for(let i=0;i<positions.length;i++){const o=i*10;data.set(positions[i],o);data.set(normals[i],o+3);data.set(colors[i],o+6)}
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);indexCount=indices.length;
  geometrySignature=0;for(let i=0;i<data.length;i+=97)geometrySignature+=Math.abs(data[i]||0)*.73+Math.abs(data[i+1]||0)*1.31+Math.abs(data[i+2]||0)*2.17;geometrySignature=Number(geometrySignature.toFixed(6));lastBuild=performance.now()-start;
  const ext=max.map((v,i)=>v-min[i]),microNormalRms=Math.sqrt(microOffsetSq/Math.max(1,baseCenter)),microCoverage=100*microAffected/Math.max(1,baseCenter),
    warpRms=Math.sqrt(warpSq/(warpCount||1)),baseErr=Math.abs(min[1]);
  $('extent').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('meshCount').textContent=positions.length+' / '+(indices.length/3);$('microCoverage').textContent=microCoverage.toFixed(1)+'%';$('warpRms').textContent=warpRms.toFixed(4);$('baseError').textContent=baseErr.toExponential(1);$('meshStats').textContent=(indices.length/3)+' TRIANGLES';
  window.__CORAL_R07_QA__={ready:true,errors:window.__qaErrors||[],noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false,runtimeGLB:0,runtimeTextures:0,networkFetches:0,uniformSpeciesColor:true,meshColorCount:1,vertexCount:positions.length,triangleCount:indices.length/3,baseVertexCount:baseCenter+1,coralliteSiteCount,siteDistribution:'golden-angle-jittered-hemisphere',siteRadiusCv,siteJitterRms,rowBandCount:0,explicitCoralliteCups:false,integratedCoralliteField:true,extent:ext,baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'192x384-integrated-field',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'golden-angle-integrated-voronoi',coralliteTopology:'shared-wall-rim-pit-septa',baseSurfaceMicroNoise:false,microscopeGeometry:true,microDisplacementSpace:'surface-normal-integrated-voronoi',microRadialOnly:false,microTangentialLeakRms:0,microNormalDisplacementRms:microNormalRms,maxMicroNormalDisplacement:microOffsetMax,microDisplacementRms:microNormalRms,microCoveragePct:microCoverage,warpGeometry:true,warpDisplacementRms:warpRms,normalDeviationRms:Math.sqrt(normalDeviationSq/Math.max(1,positions.length-1)),geometrySignature,rebuildMs:lastBuild,visualAcceptance:false,productionReady:false};
}
""".strip()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p08_patch.py <build-dir>")

    root = Path(sys.argv[1])
    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    require(index_path.is_file(), "P07 index.html missing")
    require(build_path.is_file(), "P07 build manifest missing")

    html = index_path.read_text(encoding="utf-8")
    source_hash = hashlib.sha256(html.encode("utf-8")).hexdigest()
    require(source_hash == P07_INDEX_SHA256, f"unexpected P07 index hash: {source_hash}")
    build = json.loads(build_path.read_text(encoding="utf-8"))
    require(build.get("releaseId") == P07_RELEASE_ID, "unexpected P07 release baseline")

    replacements = {
        "NOAA Massive Coral P07": "NOAA Massive Coral P08",
        "Massive Coral P07": "Massive Coral P08",
        "R07-P07": "R07-P08",
        "P07 保留半球／头盔状平滑母体，并放弃连续噪声位移：Microscope 直接生成一颗颗独立杯体，由外缘融合环、抬升杯缘、内环和杯内骨骼中心组成。NOAA NCEI 已确认其存在于帕劳群岛 Ulong Channel；Airai 本地投放仍待证。": "P08 保留半球／头盔状平滑母体，淘汰 P07 的规则纬向杯体行列。Microscope 改为黄金角扰动站点驱动的整合式共享壁场：杯坑、杯缘、共享壁和细微隔片直接沿母体法线进入同一张连续表面。NOAA NCEI 已确认其存在于帕劳群岛 Ulong Channel；Airai 本地投放仍待证。",
    }
    for old, new in replacements.items():
        require(old in html, f"missing P07 marker: {old[:80]}")
        html = html.replace(old, new)

    html = regex_once(
        html,
        r"function generate\(\)\{.*?\n\}\n\nfunction m4mul",
        NEW_GENERATE + "\n\nfunction m4mul",
        "P08 integrated corallite generator",
    )

    html = replace_once(
        html,
        "meshResolution:'128x256+explicit-cups',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'explicit-quasi-uniform',coralliteTopology:'outer-blend-rim-inner-filled-center',baseSurfaceMicroNoise:false,microDisplacementSpace:'explicit-surface-normal-cup-mesh',microRadialOnly:false",
        "meshResolution:'192x384-integrated-field',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'golden-angle-integrated-voronoi',coralliteTopology:'shared-wall-rim-pit-septa',baseSurfaceMicroNoise:false,integratedCoralliteField:true,explicitCoralliteCups:false,siteDistribution:'golden-angle-jittered-hemisphere',rowBandCount:0,microDisplacementSpace:'surface-normal-integrated-voronoi',microRadialOnly:false",
        "P08 build marker",
    )

    require("explicitCoralliteCups:false" in html, "P08 explicit-cup disable marker missing")
    require("integratedCoralliteField:true" in html, "P08 integrated field marker missing")
    require("siteDistribution:'golden-angle-jittered-hemisphere'" in html, "P08 site distribution marker missing")
    require("for(let band=0;band<bands;band++)" not in html, "P07 latitude-band cup generator remains")

    index_path.write_text(html, encoding="utf-8")

    build.pop("browserQA", None)
    build.pop("functionalGates", None)
    build["schema"] = "CORAL_MOTHER_R07_MASSIVE_P08_BUILD"
    build["releaseId"] = "CORAL_R07_P08_NOAA_MASSIVE_PORITES_INTEGRATED_VORONOI_CORALLITES"
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["geometry"] = {
        "parametricDome": True,
        "anchoredBase": True,
        "macroLobes": True,
        "sharedDomainWarp": True,
        "microscopeSurfaceDisplacement": True,
        "recomputedNormals": True,
        "uniformSpeciesColor": True,
        "bottomCapOrientation": "downward",
        "surfaceWinding": "outward-ccw",
        "backfaceCullingCompatible": True,
        "meshResolution": {"latitude": 192, "longitude": 384},
        "colonyForm": "hemispherical-or-helmet-shaped",
        "surfaceProfile": "usually-smooth",
        "integratedCoralliteField": True,
        "explicitCoralliteCups": False,
        "siteDistribution": "golden-angle-jittered-hemisphere",
        "rowBandCount": 0,
        "coralliteFrequency": "golden-angle-integrated-voronoi",
        "coralliteTopology": "shared-wall-rim-pit-septa",
        "microDisplacementSpace": "surface-normal-integrated-voronoi",
        "microTangentialLeak": 0,
        "baseSurfaceMicroNoise": False,
        "apexAndAttachmentGuards": True,
    }
    build["supersedes"] = {
        "releaseId": P07_RELEASE_ID,
        "reason": "P07 proved discrete cup geometry but exposed regular latitude rows, repeated circular donuts, and non-shared walls. P08 integrates irregular cells into one continuous surface.",
    }
    build["visualAcceptance"] = False
    build["productionReady"] = False
    build["ecologicalPlacementReady"] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (root / "P08_INTEGRATED_VORONOI_ZH.md").write_text(
        "# Coral Mother R07-P08 整合式不规则珊瑚杯\n\n"
        "- P07 的明确失败：杯体沿纬向排成规则行列，大小重复，并像粘在表面的独立圆环。\n"
        "- P08 不再生成独立杯体网格，而是在 192×384 母体表面上直接执行法线位移。\n"
        "- 站点采用黄金角半球分布，并加入各向同性切平面扰动、尺寸差异、深度差异和相位差异。\n"
        "- 最近与次近站点共同形成不规则杯坑、杯缘、共享壁和细微隔片；没有纬向 band 生成器。\n"
        "- 所有 Microscope 形体与母体共用顶点和法线，避免悬浮甜甜圈和底面穿插。\n"
        "- NOAA 分类保持 Hard / stony coral → Massive coral。\n"
        "- NOAA NCEI 只关闭帕劳群岛区域出现证据；Airai / Stone Money Island 局地投放仍未解决。\n"
        "- visualAcceptance=false；productionReady=false。\n",
        encoding="utf-8",
    )

    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
