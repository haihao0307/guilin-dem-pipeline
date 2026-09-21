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


FIELD_P07 = r'''function hash11(x){const n=Math.sin(x*127.1+311.7)*43758.5453123;return n-Math.floor(n)}
function field(phi,t){
  const baseFade=1-smooth((t-.80)/.20),w=cfg.warp*baseFade,
    wp=.16*w*(Math.sin(phi*2.1+t*5.7)+.38*Math.sin(phi*4.3-t*2.2)),
    wt=.030*w*(Math.sin(phi*3.2-t*4.6)+.42*Math.sin(phi*.9+t*7.1)),
    p=phi+wp,tt=clamp(t+wt,0,1),th=tt*Math.PI*.5,
    sx=Math.sin(th)*Math.cos(p),sy=Math.cos(th),sz=Math.sin(th)*Math.sin(p),
    fade=smooth(t/.060)*(1-smooth((t-.970)/.030)),
    macro=cfg.lobes*fade*(.012*Math.sin(sx*3.3+sy*2.1+sz*1.7)+.008*Math.sin(sx*5.2-sy*3.4+sz*4.1+1.2)),
    med=cfg.undulation*fade*(.0045*Math.sin(sx*8.7+sy*5.9-sz*7.3)+.0030*Math.sin(sx*13.1-sy*9.2+sz*11.7+2.4));
  return{p,tt,macro,med,micro:0};
}
'''

GENERATE_P07 = r'''function generate(){
  const start=performance.now(),LAT=128,LON=256,CUP_SIDES=12,grid=[],basePositions=[],positions=[],orientationNormals=[],normals=[],colors=[],indices=[],col=baseColor();
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
      basePositions.push(p);positions.push(p.slice());row.push(idx);colors.push(col);
      const wp=Math.abs(f.p-phi)+Math.abs(f.tt-t);warpSq+=wp*wp;warpCount++;
    }
    grid.push(row);
  }
  const baseCenter=basePositions.length;basePositions.push([0,0,0]);positions.push([0,0,0]);colors.push(col);
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

  let cupCount=0,cupVertexCount=0,cupTriangleCount=0,microOffsetSq=0,microOffsetMax=0;
  if(cfg.microDepth>0){
    const scaleNorm=clamp((cfg.microScale-.45)/1.65,0,1),bands=Math.round(mix(34,44,scaleNorm)),
      cupRadius=.040*mix(1.18,.82,scaleNorm),rimHeight=.020*cfg.microDepth*mix(.72,1.12,cfg.ridges),
      outerHeight=.0018*cfg.microDepth,innerHeight=.004*cfg.microDepth,centerHeight=.0012*cfg.microDepth;
    for(let band=0;band<bands;band++){
      const t=.065+.865*(band+.5)/bands,theta=t*Math.PI*.5,
        count=Math.max(10,Math.round((18+54*Math.sin(theta))*mix(.88,1.18,scaleNorm)));
      for(let j=0;j<count;j++){
        const jitter=(hash11(band*913+j*37)-.5)*.22/count,
          phi=TAU*((j+.5*(band%2))/count+jitter),ii=clamp(Math.round(t*LAT),1,LAT-1),jj=((Math.round((phi/TAU)*LON)%LON)+LON)%LON,
          baseId=grid[ii][jj],center=basePositions[baseId],n=baseNormals[baseId],up=Math.abs(n[1])<.90?[0,1,0]:[1,0,0],
          tangent=norm(cross(up,n)),bitangent=cross(n,tangent),outer=[],rim=[],inner=[],cupSeed=band*4099+j*131;
        const addRing=(radius,height,target)=>{
          for(let s=0;s<CUP_SIDES;s++){
            const a=s/CUP_SIDES*TAU,irregular=1+cfg.grain*.09*Math.sin(a*3+cupSeed*.017)+cfg.grain*.035*Math.sin(a*5-cupSeed*.011),r=radius*irregular,
              p=[center[0]+tangent[0]*Math.cos(a)*r+bitangent[0]*Math.sin(a)*r+n[0]*height,
                 center[1]+tangent[1]*Math.cos(a)*r+bitangent[1]*Math.sin(a)*r+n[1]*height,
                 center[2]+tangent[2]*Math.cos(a)*r+bitangent[2]*Math.sin(a)*r+n[2]*height],id=positions.length;
            positions.push(p);colors.push(col);orientationNormals.push(n.slice());target.push(id);microOffsetSq+=height*height;microOffsetMax=Math.max(microOffsetMax,Math.abs(height));cupVertexCount++;
          }
        };
        addRing(cupRadius,outerHeight,outer);addRing(cupRadius*.61,rimHeight,rim);addRing(cupRadius*.27,innerHeight,inner);
        const spoke=.0025*cfg.microDepth*(.5+.5*Math.sin(cupSeed*.031)),centerId=positions.length,
          cp=[center[0]+n[0]*(centerHeight+spoke),center[1]+n[1]*(centerHeight+spoke),center[2]+n[2]*(centerHeight+spoke)];
        positions.push(cp);colors.push(col);orientationNormals.push(n.slice());cupVertexCount++;microOffsetSq+=(centerHeight+spoke)*(centerHeight+spoke);microOffsetMax=Math.max(microOffsetMax,centerHeight+spoke);
        for(let s=0;s<CUP_SIDES;s++){
          const k=(s+1)%CUP_SIDES;
          indices.push(outer[s],outer[k],rim[k],outer[s],rim[k],rim[s]);
          indices.push(rim[s],rim[k],inner[k],rim[s],inner[k],inner[s]);
          indices.push(inner[s],inner[k],centerId);cupTriangleCount+=5;
        }
        cupCount++;
      }
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
  const ext=max.map((v,i)=>v-min[i]),microNormalRms=Math.sqrt(microOffsetSq/Math.max(1,cupVertexCount)),
    cupCoverage=clamp(100*cupCount*Math.PI*.040*.040/(2*Math.PI*cfg.width*cfg.height),0,100),warpRms=Math.sqrt(warpSq/(warpCount||1)),baseErr=Math.abs(min[1]);
  $('extent').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('meshCount').textContent=positions.length+' / '+(indices.length/3);$('microCoverage').textContent=cupCoverage.toFixed(1)+'%';$('warpRms').textContent=warpRms.toFixed(4);$('baseError').textContent=baseErr.toExponential(1);$('meshStats').textContent=(indices.length/3)+' TRIANGLES';
  window.__CORAL_R07_QA__={ready:true,errors:window.__qaErrors||[],noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false,runtimeGLB:0,runtimeTextures:0,networkFetches:0,uniformSpeciesColor:true,meshColorCount:1,vertexCount:positions.length,triangleCount:indices.length/3,baseVertexCount:baseCenter+1,cupCount,cupVertexCount,cupTriangleCount,cupSides:CUP_SIDES,extent:ext,baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'128x256+explicit-cups',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'explicit-quasi-uniform',coralliteTopology:'outer-blend-rim-inner-filled-center',baseSurfaceMicroNoise:false,microscopeGeometry:true,microDisplacementSpace:'explicit-surface-normal-cup-mesh',microRadialOnly:false,microTangentialLeakRms:0,microNormalDisplacementRms:microNormalRms,maxMicroNormalDisplacement:microOffsetMax,microDisplacementRms:microNormalRms,microCoveragePct:cupCoverage,warpGeometry:true,warpDisplacementRms:warpRms,normalDeviationRms:Math.sqrt(normalDeviationSq/Math.max(1,positions.length-1)),geometrySignature,rebuildMs:lastBuild,visualAcceptance:false,productionReady:false};
}
'''


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p07_explicit_corallite_cups.py <build-dir>')
    root=Path(sys.argv[1]);index=root/'index.html';build_path=root/'BUILD_R07_P00.json';html=index.read_text(encoding='utf-8')
    html=html.replace('NOAA Massive Coral P06','NOAA Massive Coral P07').replace('Massive Coral P06','Massive Coral P07').replace('R07-P06','R07-P07').replace("version:'R07-P06'","version:'R07-P07'")
    html,field_count=re.subn(r'function cellHash\(.*?\n}\nfunction field\(phi,t\)\{.*?\n}\nfunction baseColor',FIELD_P07+'function baseColor',html,count=1,flags=re.S)
    require(field_count==1,f'P07 field replacement failed: {field_count}')
    html,gen_count=re.subn(r'function generate\(\)\{.*?\n}\nfunction m4mul',GENERATE_P07+'\nfunction m4mul',html,count=1,flags=re.S)
    require(gen_count==1,f'P07 generate replacement failed: {gen_count}')
    html=html.replace(
        'P06 保留 Porites lutea 的半球／头盔状平滑母体；Microscope 不再只改水平半径，而是沿真实穹顶表面法线生成密集浅杯坑、细杯缘与杯内骨骼元素。',
        'P07 保留半球／头盔状平滑母体，并放弃连续噪声位移：Microscope 直接生成一颗颗独立杯体，由外缘融合环、抬升杯缘、内环和杯内骨骼中心组成。',
    )
    html=replace_once(
        html,
        "meshResolution:'192x384',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'dense-cellular-14',coralliteTopology:'shallow-pit-fine-rim-filled-elements',microDisplacementSpace:'surface-normal',microRadialOnly:false,runtimeGLB:0,",
        "meshResolution:'128x256+explicit-cups',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'explicit-quasi-uniform',coralliteTopology:'outer-blend-rim-inner-filled-center',baseSurfaceMicroNoise:false,microDisplacementSpace:'explicit-surface-normal-cup-mesh',microRadialOnly:false,runtimeGLB:0,",
        'P07 build marker',
    )
    for required in ("microDisplacementSpace:'explicit-surface-normal-cup-mesh'","baseSurfaceMicroNoise:false","cupCount","cupSides:CUP_SIDES","meshResolution:'128x256+explicit-cups'"):
        require(required in html,f'P07 marker missing: {required}')
    require('function cellular3' not in html,'continuous cellular noise remains in P07')
    index.write_text(html,encoding='utf-8')
    build=json.loads(build_path.read_text(encoding='utf-8'))
    build['schema']='CORAL_MOTHER_R07_MASSIVE_P07_BUILD';build['releaseId']='CORAL_R07_P07_NOAA_MASSIVE_PORITES_EXPLICIT_CORALLITE_CUPS';build['bytes']=len(html.encode('utf-8'));build['sha256']=hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry'].update({'meshResolution':{'baseLatitude':128,'baseLongitude':256,'cupSides':12},'coralliteFrequency':'explicit-quasi-uniform','coralliteTopology':'outer-blend-rim-inner-filled-center','baseSurfaceMicroNoise':False,'microDisplacementSpace':'explicit-surface-normal-cup-mesh','microRadialOnly':False,'explicitCoralliteCups':True})
    build['supersedes']={'releaseId':'CORAL_R07_P06_NOAA_MASSIVE_PORITES_SURFACE_NORMAL_CORALLITES','reason':'P06 corrected displacement direction but continuous fields still read as wrinkles rather than discrete Porites corallites.'}
    build['visualAcceptance']=False;build['productionReady']=False
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'P07_EXPLICIT_CORALLITE_CUPS_ZH.md').write_text(
        '# Coral Mother R07-P07 · Explicit Corallite Cups\n\n'
        '- P06 修复了位移方向，但连续场仍表现为皱纹。\n'
        '- P07 删除母体上的 cellular 微噪声，保持通常平滑的 Massive 母体。\n'
        '- Microscope 改为显式独立杯体：外缘融合环、抬升杯缘、低内环和杯内骨骼中心。\n'
        '- 杯体以准均匀纬环错位方式铺设，并以母体真实法线定向。\n'
        '- 同一母体仍保持单一主色，未使用贴图或外部模型。\n'
        '- Palau 群岛出现已由 NOAA NCEI 确认；Airai / Stone Money Island 局地投放仍未解决。\n'
        '- visualAcceptance=false；productionReady=false；ecologicalPlacementReady=false。\n',encoding='utf-8')
    print(json.dumps(build,ensure_ascii=False))


if __name__=='__main__':main()
