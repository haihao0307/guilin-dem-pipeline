from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


P11_INDEX_SHA256 = "fc57d8208007bd0c7a87f40b9d26865d3a5e852897199c9b16b40a791fa4341a"
P11_RELEASE_ID = "CORAL_R07_P11_NOAA_MASSIVE_PORITES_READABLE_CORALLITES"


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


NEW_GENERATE = r"""function generate(){
  const start=performance.now(),SUBDIV=8,unitVerts=[[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1]];
  let faces=[[0,2,1],[0,3,2],[0,4,3],[0,1,4]];
  for(let level=0;level<SUBDIV;level++){
    const edgeMid=new Map(),mid=(a,b)=>{
      const lo=Math.min(a,b),hi=Math.max(a,b),key=lo+','+hi,cached=edgeMid.get(key);if(cached!==undefined)return cached;
      const A=unitVerts[a],B=unitVerts[b],q=norm([(A[0]+B[0])*.5,(A[1]+B[1])*.5,(A[2]+B[2])*.5]),id=unitVerts.length;
      unitVerts.push(q);edgeMid.set(key,id);return id;
    },next=[];
    for(const f of faces){const a=f[0],b=f[1],c=f[2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca])}
    faces=next;
  }
  let triangleAspectSum=0,triangleAspectMax=0,triangleAspectSamples=0;
  for(let fi=0;fi<faces.length;fi+=23){const f=faces[fi],a=len(sub(unitVerts[f[0]],unitVerts[f[1]])),b=len(sub(unitVerts[f[1]],unitVerts[f[2]])),c=len(sub(unitVerts[f[2]],unitVerts[f[0]])),mn=Math.max(1e-9,Math.min(a,b,c)),aspect=Math.max(a,b,c)/mn;triangleAspectSum+=aspect;triangleAspectMax=Math.max(triangleAspectMax,aspect);triangleAspectSamples++}
  const triangleAspectMean=triangleAspectSum/Math.max(1,triangleAspectSamples),basePositions=[],surfaceDirs=[],surfaceT=[],positions=[],orientationNormals=[],normals=[],colors=[],indices=[],col=baseColor();
  let warpSq=0,warpCount=0;
  for(const q0 of unitVerts){
    const t=Math.acos(clamp(q0[1],0,1))/(Math.PI*.5),phi=Math.atan2(q0[2],q0[0]),f=field(phi,t),th=f.tt*Math.PI*.5,
      domePow=mix(1.55,.62,clamp((cfg.dome-.55)/1.15,0,1)),radialBase=cfg.width*Math.pow(Math.sin(th),mix(.86,1.22,cfg.base)),
      baseSpread=1+cfg.base*.22*Math.pow(t,5),radius=radialBase*baseSpread*(1+f.macro+f.med),
      y=cfg.height*Math.pow(Math.cos(th),domePow)*(1-.055*cfg.base*Math.pow(t,4)),p=[radius*Math.cos(f.p),Math.max(0,y),radius*Math.sin(f.p)],
      q=norm([Math.sin(th)*Math.cos(f.p),Math.cos(th),Math.sin(th)*Math.sin(f.p)]);
    basePositions.push(p);positions.push(p.slice());surfaceDirs.push(q);surfaceT.push(t);colors.push([col[0],col[1],col[2],.5]);
    const wp=Math.abs(f.p-phi)+Math.abs(f.tt-t);warpSq+=wp*wp;warpCount++;
  }
  const surfaceVertexCount=basePositions.length,baseCenter=surfaceVertexCount;
  for(const f of faces)indices.push(f[0],f[1],f[2]);
  const boundary=[];for(let i=0;i<unitVerts.length;i++)if(Math.abs(unitVerts[i][1])<1e-8)boundary.push(i);
  boundary.sort((a,b)=>Math.atan2(unitVerts[a][2],unitVerts[a][0])-Math.atan2(unitVerts[b][2],unitVerts[b][0]));
  basePositions.push([0,0,0]);positions.push([0,0,0]);surfaceDirs.push([0,-1,0]);surfaceT.push(1);colors.push([col[0],col[1],col[2],.5]);
  for(let j=0;j<boundary.length;j++)indices.push(baseCenter,boundary[j],boundary[(j+1)%boundary.length]);

  const baseNormals=basePositions.map(()=>[0,0,0]);
  for(let i=0;i<indices.length;i+=3){const ia=indices[i],ib=indices[i+1],ic=indices[i+2],n=cross(sub(basePositions[ib],basePositions[ia]),sub(basePositions[ic],basePositions[ia]));for(const id of[ia,ib,ic]){baseNormals[id][0]+=n[0];baseNormals[id][1]+=n[1];baseNormals[id][2]+=n[2]}}
  for(let i=0;i<baseNormals.length;i++){
    let n=norm(baseNormals[i]);if(i<baseCenter){const p=basePositions[i],out=norm([p[0],Math.max(.001,p[1]*1.15),p[2]]);if(n[0]*out[0]+n[1]*out[1]+n[2]*out[2]<0)n=[-n[0],-n[1],-n[2]]}else n=[0,-1,0];baseNormals[i]=n;orientationNormals.push(n.slice());
  }

  let coralliteSiteCount=0,microOffsetSq=0,microOffsetMax=0,microAffected=0,microSignalMin=.5,microSignalMax=.5,microSignalSq=0,siteRadiusCv=0,siteNearestNeighborCv=0,siteAcceptanceRatio=0,relaxedSiteFraction=0,poissonMinSpacing=0;
  if(cfg.microDepth>0){
    const scaleNorm=clamp((cfg.microScale-.45)/1.65,0,1),requestedSites=Math.round(mix(3200,4500,scaleNorm)),spacing=Math.sqrt(2*Math.PI/requestedSites),primaryMinSpacing=spacing*.72,relaxedMinSpacing=spacing*.59,SITE_BIN=52,sites=[],bins=new Map();
    let radiusSum=0,radiusSq=0,acceptedRelaxed=0;
    const binCoord=v=>clamp(Math.floor((v+1)*.5*SITE_BIN),0,SITE_BIN-1),binKey=(x,y,z)=>(x*SITE_BIN+y)*SITE_BIN+z,
      candidateQ=attempt=>{const y=mix(.055,.995,hash11(attempt*37.719+5.31)),phi=TAU*hash11(attempt*91.337+17.9),r=Math.sqrt(Math.max(0,1-y*y));return[r*Math.cos(phi),y,r*Math.sin(phi)]},
      canPlace=(q,minD)=>{const bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const x=bx+dx,y=by+dy,z=bz+dz;if(x<0||x>=SITE_BIN||y<0||y>=SITE_BIN||z<0||z>=SITE_BIN)continue;const bucket=bins.get(binKey(x,y,z));if(!bucket)continue;for(const id of bucket)if(len(sub(q,sites[id].q))<minD)return false}return true},
      addSite=(q,seed,relaxed)=>{const up=Math.abs(q[1])<.92?[0,1,0]:[1,0,0],tangent=norm(cross(up,q)),bitangent=cross(q,tangent),radiusScale=mix(.82,1.18,hash11(seed*83.11+1.9)),depthScale=mix(.88,1.14,hash11(seed*59.37+7.3)),rimScale=mix(.86,1.16,hash11(seed*101.9+11.1)),phase=TAU*hash11(seed*131.7+17.9),site={q,tangent,bitangent,radiusScale,depthScale,rimScale,phase},id=sites.length,bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]),key=binKey(bx,by,bz);sites.push(site);let bucket=bins.get(key);if(!bucket){bucket=[];bins.set(key,bucket)}bucket.push(id);radiusSum+=radiusScale;radiusSq+=radiusScale*radiusScale;if(relaxed)acceptedRelaxed++};
    for(let attempt=0;attempt<requestedSites*70&&sites.length<requestedSites;attempt++){const q=candidateQ(attempt);if(canPlace(q,primaryMinSpacing))addSite(q,attempt,false)}
    for(let attempt=requestedSites*70;attempt<requestedSites*180&&sites.length<requestedSites;attempt++){const q=candidateQ(attempt);if(canPlace(q,relaxedMinSpacing))addSite(q,attempt,true)}
    coralliteSiteCount=sites.length;poissonMinSpacing=relaxedMinSpacing;siteAcceptanceRatio=coralliteSiteCount/Math.max(1,requestedSites);relaxedSiteFraction=acceptedRelaxed/Math.max(1,coralliteSiteCount);
    const radiusMean=radiusSum/Math.max(1,coralliteSiteCount);siteRadiusCv=Math.sqrt(Math.max(0,radiusSq/Math.max(1,coralliteSiteCount)-radiusMean*radiusMean))/Math.max(radiusMean,1e-6);
    const nearestTwo=q=>{const bx=binCoord(q[0]),by=binCoord(q[1]),bz=binCoord(q[2]);let best1=-2,best2=-2,id1=-1,id2=-1;const test=id=>{const s=sites[id],d=q[0]*s.q[0]+q[1]*s.q[1]+q[2]*s.q[2];if(d>best1){best2=best1;id2=id1;best1=d;id1=id}else if(d>best2){best2=d;id2=id}};const search=range=>{for(let dx=-range;dx<=range;dx++)for(let dy=-range;dy<=range;dy++)for(let dz=-range;dz<=range;dz++){const x=bx+dx,y=by+dy,z=bz+dz;if(x<0||x>=SITE_BIN||y<0||y>=SITE_BIN||z<0||z>=SITE_BIN)continue;const bucket=bins.get(binKey(x,y,z));if(bucket)for(const id of bucket)test(id)}};search(1);if(id2<0)search(2);if(id2<0){best1=-2;best2=-2;id1=-1;id2=-1;for(let id=0;id<sites.length;id++)test(id)}return{id1,id2,d1:Math.sqrt(Math.max(0,2*(1-best1))),d2:Math.sqrt(Math.max(0,2*(1-best2)))}};
    let nnSum=0,nnSq=0;for(let id=0;id<sites.length;id++){const near=nearestTwo(sites[id].q),d=near.id1===id?near.d2:near.d1;nnSum+=d;nnSq+=d*d}const nnMean=nnSum/Math.max(1,sites.length);siteNearestNeighborCv=Math.sqrt(Math.max(0,nnSq/Math.max(1,sites.length)-nnMean*nnMean))/Math.max(nnMean,1e-6);
    for(let i=0;i<baseCenter;i++){
      const t=surfaceT[i],fade=smooth(t/.045)*(1-smooth((t-.965)/.035));if(fade<=0)continue;const q=surfaceDirs[i],near=nearestTwo(q);if(near.id1<0)continue;
      const site=sites[near.id1],cellRadius=spacing*.61*site.radiusScale,u=near.d1/Math.max(cellRadius,1e-6),boundary=(near.d2-near.d1)/Math.max(spacing,1e-6),
        pit=Math.pow(clamp(1-u/.31,0,1),1.85),rim=Math.pow(clamp(1-Math.abs(u-.43)/.11,0,1),1.75),wall=Math.pow(clamp(1-boundary/.10,0,1),2.45),
        tx=q[0]*site.tangent[0]+q[1]*site.tangent[1]+q[2]*site.tangent[2],ty=q[0]*site.bitangent[0]+q[1]*site.bitangent[1]+q[2]*site.bitangent[2],angle=Math.atan2(ty,tx),
        septa=Math.cos(angle*6+site.phase)*Math.pow(clamp(1-u/.65,0,1),2.1),grain=Math.sin(angle*11+site.phase*1.7)*Math.pow(clamp(1-u/.84,0,1),1.6),
        offset=cfg.microDepth*fade*(.0065*cfg.ridges*site.rimScale*wall+.0068*cfg.ridges*site.rimScale*rim-.0098*site.depthScale*pit+.0015*cfg.grain*septa+.0006*cfg.grain*grain),
        microSignal=clamp(.5+.34*wall+.27*rim-.54*pit+.08*septa,0,1),n=baseNormals[i],p=basePositions[i];
      positions[i]=[p[0]+n[0]*offset,p[1]+n[1]*offset,p[2]+n[2]*offset];colors[i][3]=microSignal;microOffsetSq+=offset*offset;microOffsetMax=Math.max(microOffsetMax,Math.abs(offset));if(Math.abs(offset)>.00045)microAffected++;const sd=microSignal-.5;microSignalMin=Math.min(microSignalMin,microSignal);microSignalMax=Math.max(microSignalMax,microSignal);microSignalSq+=sd*sd;
    }
  }

  normals.length=positions.length;for(let i=0;i<normals.length;i++)normals[i]=[0,0,0];
  for(let i=0;i<indices.length;i+=3){const ia=indices[i],ib=indices[i+1],ic=indices[i+2],fn=cross(sub(positions[ib],positions[ia]),sub(positions[ic],positions[ia]));for(const id of[ia,ib,ic]){normals[id][0]+=fn[0];normals[id][1]+=fn[1];normals[id][2]+=fn[2]}}
  let normalDeviationSq=0,min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
  for(let i=0;i<normals.length;i++){let n=norm(normals[i]),o=orientationNormals[i]||[0,-1,0];if(n[0]*o[0]+n[1]*o[1]+n[2]*o[2]<0)n=[-n[0],-n[1],-n[2]];normals[i]=n;if(i!==baseCenter){const d=1-clamp(n[0]*o[0]+n[1]*o[1]+n[2]*o[2],-1,1);normalDeviationSq+=d*d}const p=positions[i];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}}
  const data=new Float32Array(positions.length*10);for(let i=0;i<positions.length;i++){const o=i*10;data.set(positions[i],o);data.set(normals[i],o+3);data.set(colors[i],o+6)}
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);indexCount=indices.length;
  geometrySignature=0;for(let i=0;i<data.length;i+=97)geometrySignature+=Math.abs(data[i]||0)*.73+Math.abs(data[i+1]||0)*1.31+Math.abs(data[i+2]||0)*2.17;geometrySignature=Number(geometrySignature.toFixed(6));lastBuild=performance.now()-start;
  const ext=max.map((v,i)=>v-min[i]),microNormalRms=Math.sqrt(microOffsetSq/Math.max(1,baseCenter)),microCoverage=100*microAffected/Math.max(1,baseCenter),microSignalRms=Math.sqrt(microSignalSq/Math.max(1,baseCenter)),warpRms=Math.sqrt(warpSq/(warpCount||1)),baseErr=Math.abs(min[1]);
  $('extent').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('meshCount').textContent=positions.length+' / '+(indices.length/3);$('microCoverage').textContent=microCoverage.toFixed(1)+'%';$('warpRms').textContent=warpRms.toFixed(4);$('baseError').textContent=baseErr.toExponential(1);$('meshStats').textContent=(indices.length/3)+' TRIANGLES';
  window.__CORAL_R07_QA__={ready:true,errors:window.__qaErrors||[],noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false,runtimeGLB:0,runtimeTextures:0,networkFetches:0,uniformSpeciesColor:true,meshColorCount:1,vertexCount:positions.length,triangleCount:indices.length/3,baseVertexCount:baseCenter+1,surfaceVertexCount,surfaceTopology:'geodesic-octahedron-hemisphere',subdivisionLevel:SUBDIV,latLongSingularity:false,apexDuplicateCount:1,boundaryVertexCount:boundary.length,triangleAspectMean,triangleAspectMax,coralliteSiteCount,siteDistribution:'deterministic-poisson-dart-hemisphere',siteRadiusCv,siteNearestNeighborCv,siteAcceptanceRatio,relaxedSiteFraction,poissonMinSpacing,rowBandCount:0,spiralLattice:false,explicitCoralliteCups:false,integratedCoralliteField:true,extent:ext,baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'geodesic-subdivision-8',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'poisson-geodesic-integrated-voronoi',coralliteTopology:'shared-wall-rim-pit-septa',sharedWallUsesSecondNearest:true,baseSurfaceMicroNoise:false,microscopeGeometry:true,microDisplacementSpace:'surface-normal-geodesic-voronoi',microSignalEncoding:'vertex-alpha-lighting-only',uniformRgbColor:true,microRadialOnly:false,microTangentialLeakRms:0,microSignalRange:[microSignalMin,microSignalMax],microSignalRms,microNormalDisplacementRms:microNormalRms,maxMicroNormalDisplacement:microOffsetMax,microDisplacementRms:microNormalRms,microCoveragePct:microCoverage,warpGeometry:true,warpDisplacementRms:warpRms,normalDeviationRms:Math.sqrt(normalDeviationSq/Math.max(1,positions.length-1)),geometrySignature,rebuildMs:lastBuild,visualAcceptance:false,productionReady:false};
}"""


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p12_geodesic_surface.py <build-dir>")

    root = Path(sys.argv[1])
    index_path = root / "index.html"
    build_path = root / "BUILD_R07_P00.json"
    html = index_path.read_text(encoding="utf-8")
    require(hashlib.sha256(html.encode("utf-8")).hexdigest() == P11_INDEX_SHA256, "unexpected P11 index baseline")
    build = json.loads(build_path.read_text(encoding="utf-8"))
    require(build.get("releaseId") == P11_RELEASE_ID, "unexpected P11 release baseline")

    html = html.replace("NOAA Massive Coral P11", "NOAA Massive Coral P12")
    html = html.replace("Massive Coral P11", "Massive Coral P12")
    html = html.replace("R07-P11", "R07-P12")
    html = html.replace("version:'R07-P11'", "version:'R07-P12'")
    html = regex_once(
        html,
        r"function generate\(\)\{.*?\n\}\n\nfunction m4mul",
        NEW_GENERATE + "\n\nfunction m4mul",
        "P12 geodesic generator",
    )
    html = replace_once(
        html,
        "meshResolution:'224x448-integrated-field',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'poisson-fine-integrated-voronoi',coralliteTopology:'subtle-shared-wall-rim-pit-septa',siteDistribution:'deterministic-poisson-dart-hemisphere',spiralLattice:false,sharedWallUsesSecondNearest:true,visibleReliefTuned:true,baseSurfaceMicroNoise:false,integratedCoralliteField:true,explicitCoralliteCups:false,siteDistribution:'deterministic-poisson-dart-hemisphere',rowBandCount:0,microDisplacementSpace:'surface-normal-integrated-voronoi',microSignalEncoding:'vertex-alpha-lighting-only',uniformRgbColor:true,microRadialOnly:false,",
        "meshResolution:'geodesic-subdivision-8',surfaceTopology:'geodesic-octahedron-hemisphere',subdivisionLevel:8,latLongSingularity:false,apexDuplicateCount:1,colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'poisson-geodesic-integrated-voronoi',coralliteTopology:'shared-wall-rim-pit-septa',siteDistribution:'deterministic-poisson-dart-hemisphere',spiralLattice:false,sharedWallUsesSecondNearest:true,baseSurfaceMicroNoise:false,integratedCoralliteField:true,explicitCoralliteCups:false,rowBandCount:0,microDisplacementSpace:'surface-normal-geodesic-voronoi',microSignalEncoding:'vertex-alpha-lighting-only',uniformRgbColor:true,microRadialOnly:false,",
        "P12 build marker",
    )
    html = replace_once(
        html,
        "P11 保留 P10 的无螺旋 Poisson 站点与平滑巨石母体。Microscope 继续真实改变几何，同时把同一杯坑—杯缘—共享壁信号写入非颜色通道，只用于局部光照响应，使近景结构可读但整株仍保持一个 RGB 主色。",
        "P12 淘汰经纬表皮网格，改用均匀测地半球三角网，消除穹顶附近的长条三角形和方向性拉丝。Poisson 杯坑、杯缘、共享壁与隔片继续沿真实法线进入同一连续表面；RGB 主色保持统一。",
        "P12 explanation",
    )
    html = replace_once(
        html,
        "camera.target=[0,.96,0];camera.yaw=.30;camera.pitch=.16;camera.dist=1.82;",
        "camera.target=[.62,.78,.42];camera.yaw=.72;camera.pitch=.08;camera.dist=1.45;",
        "P12 flank microscope camera",
    )

    require("surfaceTopology:'geodesic-octahedron-hemisphere'" in html, "P12 topology marker missing")
    require("latLongSingularity:false" in html, "P12 singularity marker missing")
    require("meshResolution:'224x448-integrated-field'" not in html, "stale P11 lat-long resolution remains")
    index_path.write_text(html, encoding="utf-8")

    build.pop("browserQA", None)
    build.pop("functionalGates", None)
    build["schema"] = "CORAL_MOTHER_R07_MASSIVE_P12_BUILD"
    build["releaseId"] = "CORAL_R07_P12_NOAA_MASSIVE_PORITES_GEODESIC_SURFACE"
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["geometry"].update(
        {
            "meshResolution": {"topology": "geodesic-octahedron-hemisphere", "subdivisionLevel": 8},
            "surfaceTopology": "geodesic-octahedron-hemisphere",
            "latLongSingularity": False,
            "apexDuplicateCount": 1,
            "coralliteFrequency": "poisson-geodesic-integrated-voronoi",
            "microDisplacementSpace": "surface-normal-geodesic-voronoi",
        }
    )
    build["supersedes"] = {
        "releaseId": P11_RELEASE_ID,
        "reason": "P11 improved contrast but the latitude-longitude mesh stretched local corallites into directional streaks near the dome. P12 replaces the base skin with a uniform geodesic hemisphere.",
    }
    build["visualAcceptance"] = False
    build["productionReady"] = False
    build["ecologicalPlacementReady"] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (root / "P12_GEODESIC_SURFACE_ZH.md").write_text(
        "# Coral Mother R07-P12 测地半球表皮\n\n"
        "- P11 的 Microscope 和非 RGB 光照信号都有效，但经纬网格在穹顶附近把局部杯体拉成长条。\n"
        "- P12 用八级细分八面体测地半球取代经纬表皮：穹顶只有一个顶点，不存在经线汇聚重复点。\n"
        "- 三角形在半球上近似均匀，Microscope 杯坑、杯缘、共享壁和隔片不再继承经纬方向。\n"
        "- Poisson 站点、真实法线位移、统一 RGB 主色和非 RGB 局部光照信号继续保留。\n"
        "- 底部边界按方位角排序并向下封口，保持固定附着基底。\n"
        "- visualAcceptance=false；productionReady=false。\n",
        encoding="utf-8",
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
