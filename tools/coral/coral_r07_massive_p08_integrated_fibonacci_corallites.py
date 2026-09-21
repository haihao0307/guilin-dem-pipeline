from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


GENERATE_P08 = r'''function generate(){
  const start=performance.now(),LAT=160,LON=320,grid=[],basePositions=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();
  let warpSq=0,warpCount=0;
  for(let i=0;i<=LAT;i++){
    const row=[],t=i/LAT;
    for(let j=0;j<LON;j++){
      const phi=j/LON*TAU,f=field(phi,t),th=f.tt*Math.PI*.5,
        domePow=mix(1.55,.62,clamp((cfg.dome-.55)/1.15,0,1)),
        radialBase=cfg.width*Math.pow(Math.sin(th),mix(.86,1.22,cfg.base)),
        baseSpread=1+cfg.base*.22*Math.pow(t,5),radius=radialBase*baseSpread*(1+f.macro+f.med),
        y=cfg.height*Math.pow(Math.cos(th),domePow)*(1-.055*cfg.base*Math.pow(t,4)),
        x=radius*Math.cos(f.p),z=radius*Math.sin(f.p),p=[x,Math.max(0,y),z],idx=basePositions.length;
      basePositions.push(p);row.push(idx);colors.push(col);
      const wp=Math.abs(f.p-phi)+Math.abs(f.tt-t);warpSq+=wp*wp;warpCount++;
    }
    grid.push(row);
  }
  const baseCenter=basePositions.length;basePositions.push([0,0,0]);colors.push(col);
  for(let i=0;i<LAT;i++)for(let j=0;j<LON;j++){
    const k=(j+1)%LON,a=grid[i][j],b=grid[i][k],c=grid[i+1][k],d=grid[i+1][j];indices.push(a,b,c,a,c,d);
  }
  for(let j=0;j<LON;j++){const k=(j+1)%LON;indices.push(baseCenter,grid[LAT][j],grid[LAT][k])}

  const baseNormals=basePositions.map(()=>[0,0,0]);
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2],fn=cross(sub(basePositions[ib],basePositions[ia]),sub(basePositions[ic],basePositions[ia]));
    for(const id of[ia,ib,ic]){baseNormals[id][0]+=fn[0];baseNormals[id][1]+=fn[1];baseNormals[id][2]+=fn[2]}
  }
  for(let i=0;i<baseNormals.length;i++){
    let n=norm(baseNormals[i]);
    if(i<baseCenter){const p=basePositions[i],out=norm([p[0],Math.max(.001,p[1]*1.15),p[2]]);if(n[0]*out[0]+n[1]*out[1]+n[2]*out[2]<0)n=[-n[0],-n[1],-n[2]]}
    else n=[0,-1,0];baseNormals[i]=n;
  }

  const scaleNorm=clamp((cfg.microScale-.45)/1.65,0,1),targetCenters=Math.round(mix(1750,3000,scaleNorm)),
    golden=Math.PI*(3-Math.sqrt(5)),centers=[],seen=new Set();
  for(let n=0;n<targetCenters*2&&centers.length<targetCenters;n++){
    const q=(centers.length+.5)/targetCenters,cosTheta=mix(.995,.075,q),theta=Math.acos(clamp(cosTheta,0,1)),t=theta/(Math.PI*.5),
      phi=(n*golden+(hash11(n*17.3)-.5)*.22)%TAU,ii=clamp(Math.round(t*LAT),1,LAT-2),jj=((Math.round(phi/TAU*LON)%LON)+LON)%LON,id=grid[ii][jj];
    if(seen.has(id))continue;seen.add(id);
    const p=basePositions[id],normal=baseNormals[id],up=Math.abs(normal[1])<.90?[0,1,0]:[1,0,0],tangent=norm(cross(up,normal)),bitangent=cross(normal,tangent),
      radius=.039*mix(1.16,.82,scaleNorm)*(.88+.24*hash11(n*31.7+2.4));
    centers.push({p,normal,tangent,bitangent,radius,seed:n});
  }

  const maxRadius=centers.reduce((m,c)=>Math.max(m,c.radius),.04),cellSize=maxRadius*1.18,hash=new Map(),key=(x,y,z)=>x+','+y+','+z;
  for(let i=0;i<centers.length;i++){
    const p=centers[i].p,k=key(Math.floor(p[0]/cellSize),Math.floor(p[1]/cellSize),Math.floor(p[2]/cellSize));
    if(!hash.has(k))hash.set(k,[]);hash.get(k).push(i);
  }

  positions.length=0;let microSq=0,microAffected=0,microMax=0,activeCoralliteHits=new Set();
  for(let i=0;i<baseCenter;i++){
    const p=basePositions[i],cx=Math.floor(p[0]/cellSize),cy=Math.floor(p[1]/cellSize),cz=Math.floor(p[2]/cellSize);let best=-1,bestD=1e9;
    for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const ids=hash.get(key(cx+dx,cy+dy,cz+dz));if(!ids)continue;
      for(const id of ids){const c=centers[id],d=len(sub(p,c.p));if(d<bestD){bestD=d;best=id}}
    }
    let disp=0;
    if(best>=0){
      const c=centers[best],x=bestD/Math.max(c.radius,1e-6);
      if(x<1.06&&cfg.microDepth>0){
        const delta=sub(p,c.p),tu=delta[0]*c.tangent[0]+delta[1]*c.tangent[1]+delta[2]*c.tangent[2],
          bv=delta[0]*c.bitangent[0]+delta[1]*c.bitangent[1]+delta[2]*c.bitangent[2],ang=Math.atan2(bv,tu),
          pit=-.105*c.radius*Math.exp(-Math.pow(x/.27,2)),
          rim=.070*c.radius*Math.exp(-Math.pow((x-.58)/.14,2)),
          shared=.018*c.radius*Math.exp(-Math.pow((x-.94)/.10,2)),
          septa=cfg.grain*.024*c.radius*Math.pow(Math.max(0,Math.cos(6*ang)),3)*Math.exp(-Math.pow((x-.31)/.21,2));
        disp=cfg.microDepth*(pit+rim+shared+septa);activeCoralliteHits.add(best);
      }
    }
    const n=baseNormals[i],q=[p[0]+n[0]*disp,Math.max(0,p[1]+n[1]*disp),p[2]+n[2]*disp];positions.push(q);
    microSq+=disp*disp;if(Math.abs(disp)>.00045)microAffected++;microMax=Math.max(microMax,Math.abs(disp));
  }
  positions.push([0,0,0]);

  normals.length=positions.length;for(let i=0;i<normals.length;i++)normals[i]=[0,0,0];
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2],fn=cross(sub(positions[ib],positions[ia]),sub(positions[ic],positions[ia]));
    for(const id of[ia,ib,ic]){normals[id][0]+=fn[0];normals[id][1]+=fn[1];normals[id][2]+=fn[2]}
  }
  let normalDeviationSq=0,min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
  for(let i=0;i<normals.length;i++){
    let n=norm(normals[i]),o=baseNormals[i]||[0,-1,0];if(n[0]*o[0]+n[1]*o[1]+n[2]*o[2]<0)n=[-n[0],-n[1],-n[2]];normals[i]=n;
    if(i<baseCenter){const delta=1-clamp(n[0]*o[0]+n[1]*o[1]+n[2]*o[2],-1,1);normalDeviationSq+=delta*delta}
    const p=positions[i];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}
  }

  const data=new Float32Array(positions.length*10);for(let i=0;i<positions.length;i++){const o=i*10;data.set(positions[i],o);data.set(normals[i],o+3);data.set(colors[i],o+6)}
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);indexCount=indices.length;
  geometrySignature=0;for(let i=0;i<data.length;i+=97)geometrySignature+=Math.abs(data[i]||0)*.73+Math.abs(data[i+1]||0)*1.31+Math.abs(data[i+2]||0)*2.17;geometrySignature=Number(geometrySignature.toFixed(6));lastBuild=performance.now()-start;
  const ext=max.map((v,i)=>v-min[i]),microRms=Math.sqrt(microSq/Math.max(1,baseCenter)),microCoverage=100*microAffected/Math.max(1,baseCenter),warpRms=Math.sqrt(warpSq/(warpCount||1)),baseErr=Math.abs(min[1]);
  $('extent').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('meshCount').textContent=positions.length+' / '+(indices.length/3);$('microCoverage').textContent=microCoverage.toFixed(1)+'%';$('warpRms').textContent=warpRms.toFixed(4);$('baseError').textContent=baseErr.toExponential(1);$('meshStats').textContent=(indices.length/3)+' TRIANGLES';
  window.__CORAL_R07_QA__={ready:true,errors:window.__qaErrors||[],noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false,runtimeGLB:0,runtimeTextures:0,networkFetches:0,uniformSpeciesColor:true,meshColorCount:1,vertexCount:positions.length,triangleCount:indices.length/3,extent:ext,baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'160x320-integrated-fibonacci',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteDistribution:'jittered-fibonacci-hemisphere',latitudeBanding:false,coralliteCenterCount:centers.length,activeCoralliteCount:cfg.microDepth>0?activeCoralliteHits.size:0,coralliteTopology:'integrated-pit-rim-shared-wall-septa',baseSurfaceMicroNoise:false,microscopeGeometry:true,microDisplacementSpace:'integrated-surface-normal',microRadialOnly:false,microTangentialLeakRms:0,microNormalDisplacementRms:microRms,maxMicroNormalDisplacement:microMax,microDisplacementRms:microRms,microCoveragePct:microCoverage,warpGeometry:true,warpDisplacementRms:warpRms,normalDeviationRms:Math.sqrt(normalDeviationSq/Math.max(1,baseCenter)),geometrySignature,rebuildMs:lastBuild,visualAcceptance:false,productionReady:false};
}
'''


def main() -> None:
    if len(sys.argv)!=2:raise SystemExit('usage: coral_r07_massive_p08_integrated_fibonacci_corallites.py <build-dir>')
    root=Path(sys.argv[1]);index=root/'index.html';build_path=root/'BUILD_R07_P00.json';html=index.read_text(encoding='utf-8')
    html=html.replace('NOAA Massive Coral P07','NOAA Massive Coral P08').replace('Massive Coral P07','Massive Coral P08').replace('R07-P07','R07-P08').replace("version:'R07-P07'","version:'R07-P08'")
    html,gen_count=re.subn(r'function generate\(\)\{.*?\n}\s*function m4mul',GENERATE_P08+'\nfunction m4mul',html,count=1,flags=re.S)
    require(gen_count==1,f'P08 generate replacement failed: {gen_count}')
    html=html.replace(
        'P07 保留半球／头盔状平滑母体，并放弃连续噪声位移：Microscope 直接生成一颗颗独立杯体，由外缘融合环、抬升杯缘、内环和杯内骨骼中心组成。',
        'P08 保留半球／头盔状平滑母体，杯心使用无纬线的抖动 Fibonacci 分布；杯坑、细杯缘、共享壁与六向杯内骨骼直接整合进母体表面，不再叠加吸盘状独立圆片。',
    )
    html=replace_once(
        html,
        "meshResolution:'128x256+explicit-cups',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'explicit-quasi-uniform',coralliteTopology:'outer-blend-rim-inner-filled-center',baseSurfaceMicroNoise:false,microDisplacementSpace:'explicit-surface-normal-cup-mesh',microRadialOnly:false,runtimeGLB:0,",
        "meshResolution:'160x320-integrated-fibonacci',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteDistribution:'jittered-fibonacci-hemisphere',latitudeBanding:false,coralliteTopology:'integrated-pit-rim-shared-wall-septa',baseSurfaceMicroNoise:false,microDisplacementSpace:'integrated-surface-normal',microRadialOnly:false,runtimeGLB:0,",
        'P08 build marker',
    )
    for required in ("coralliteDistribution:'jittered-fibonacci-hemisphere'","latitudeBanding:false","microDisplacementSpace:'integrated-surface-normal'","meshResolution:'160x320-integrated-fibonacci'","activeCoralliteCount"):
        require(required in html,f'P08 marker missing: {required}')
    require('cupVertexCount' not in html,'P07 overlay cup geometry remains')
    index.write_text(html,encoding='utf-8')
    build=json.loads(build_path.read_text(encoding='utf-8'))
    build['schema']='CORAL_MOTHER_R07_MASSIVE_P08_BUILD';build['releaseId']='CORAL_R07_P08_NOAA_MASSIVE_PORITES_INTEGRATED_FIBONACCI_CORALLITES';build['bytes']=len(html.encode('utf-8'));build['sha256']=hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry'].update({'meshResolution':{'latitude':160,'longitude':320},'coralliteDistribution':'jittered-fibonacci-hemisphere','latitudeBanding':False,'coralliteTopology':'integrated-pit-rim-shared-wall-septa','baseSurfaceMicroNoise':False,'microDisplacementSpace':'integrated-surface-normal','microRadialOnly':False,'explicitCoralliteCups':False,'integratedCoralliteField':True})
    build['supersedes']={'releaseId':'CORAL_R07_P07_NOAA_MASSIVE_PORITES_EXPLICIT_CORALLITE_CUPS','reason':'P07 proved discrete cups but their overlay geometry read as regularly banded suction cups rather than integrated Porites corallites.'}
    build['visualAcceptance']=False;build['productionReady']=False
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'P08_INTEGRATED_FIBONACCI_CORALLITES_ZH.md').write_text(
        '# Coral Mother R07-P08 · Integrated Fibonacci Corallites\n\n'
        '- P07 的独立杯体形成规则纬环和吸盘感，视觉否决。\n'
        '- P08 使用抖动 Fibonacci 半球分布杯心，明确禁止纬线分带。\n'
        '- 杯坑、杯缘、共享壁与六向杯内骨骼直接沿母体法线写入同一网格。\n'
        '- 母体仍保持通常平滑，不叠加连续微噪声，也不叠加独立圆片。\n'
        '- 网格为 160×320，目标是在近景可见独立杯体，同时降低 P07 的 181K 三角形成本。\n'
        '- Palau 群岛出现已由 NOAA NCEI 确认；Airai / Stone Money Island 局地投放仍未解决。\n'
        '- visualAcceptance=false；productionReady=false；ecologicalPlacementReady=false。\n',encoding='utf-8')
    print(json.dumps(build,ensure_ascii=False))


if __name__=='__main__':main()
