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


GENERATE_P06 = r'''function generate(){
  const start=performance.now(),LAT=192,LON=384,grid=[],basePositions=[],microValues=[],positions=[],baseNormals=[],normals=[],colors=[],indices=[],col=baseColor();
  let microSq=0,microAffected=0,warpSq=0,warpCount=0;
  for(let i=0;i<=LAT;i++){
    const row=[],t=i/LAT;
    for(let j=0;j<LON;j++){
      const phi=j/LON*TAU,f=field(phi,t),th=f.tt*Math.PI*.5,
        domePow=mix(1.55,.62,clamp((cfg.dome-.55)/1.15,0,1)),
        radialBase=cfg.width*Math.pow(Math.sin(th),mix(.86,1.22,cfg.base)),
        baseSpread=1+cfg.base*.22*Math.pow(t,5),
        radius=radialBase*baseSpread*(1+f.macro+f.med),
        y=cfg.height*Math.pow(Math.cos(th),domePow)*(1-.055*cfg.base*Math.pow(t,4)),
        x=radius*Math.cos(f.p),z=radius*Math.sin(f.p),p=[x,Math.max(0,y),z],idx=basePositions.length;
      basePositions.push(p);microValues.push(f.micro);row.push(idx);colors.push(col);
      microSq+=f.micro*f.micro;if(Math.abs(f.micro)>.0015)microAffected++;
      const wp=Math.abs(f.p-phi)+Math.abs(f.tt-t);warpSq+=wp*wp;warpCount++;
    }
    grid.push(row);
  }
  const baseCenter=basePositions.length;basePositions.push([0,0,0]);microValues.push(0);colors.push(col);
  for(let i=0;i<LAT;i++)for(let j=0;j<LON;j++){
    const k=(j+1)%LON,a=grid[i][j],b=grid[i][k],c=grid[i+1][k],d=grid[i+1][j];indices.push(a,b,c,a,c,d);
  }
  for(let j=0;j<LON;j++){const k=(j+1)%LON;indices.push(baseCenter,grid[LAT][j],grid[LAT][k])}

  baseNormals.length=basePositions.length;for(let i=0;i<baseNormals.length;i++)baseNormals[i]=[0,0,0];
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2],n=cross(sub(basePositions[ib],basePositions[ia]),sub(basePositions[ic],basePositions[ia]));
    for(const id of[ia,ib,ic]){baseNormals[id][0]+=n[0];baseNormals[id][1]+=n[1];baseNormals[id][2]+=n[2]}
  }
  for(let i=0;i<baseNormals.length;i++){
    let n=norm(baseNormals[i]);
    if(i<baseCenter){
      const p=basePositions[i],out=norm([p[0],Math.max(.001,p[1]*1.15),p[2]]),d=n[0]*out[0]+n[1]*out[1]+n[2]*out[2];
      if(d<0)n=[-n[0],-n[1],-n[2]];
    }else n=[0,-1,0];
    baseNormals[i]=n;
  }

  const displacementScale=Math.min(cfg.width,cfg.height)*.95;
  let microNormalSq=0,microNormalMax=0,microTangentialSq=0;
  for(let i=0;i<baseCenter;i++){
    const p=basePositions[i],n=baseNormals[i],disp=microValues[i]*displacementScale,
      q=[p[0]+n[0]*disp,Math.max(0,p[1]+n[1]*disp),p[2]+n[2]*disp];
    positions.push(q);microNormalSq+=disp*disp;microNormalMax=Math.max(microNormalMax,Math.abs(disp));
  }
  positions.push([0,0,0]);

  normals.length=positions.length;for(let i=0;i<normals.length;i++)normals[i]=[0,0,0];
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2],n=cross(sub(positions[ib],positions[ia]),sub(positions[ic],positions[ia]));
    for(const id of[ia,ib,ic]){normals[id][0]+=n[0];normals[id][1]+=n[1];normals[id][2]+=n[2]}
  }
  let normalDeviationSq=0,min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
  for(let i=0;i<normals.length;i++){
    let n=norm(normals[i]);
    if(i<baseCenter){
      const bn=baseNormals[i],d=n[0]*bn[0]+n[1]*bn[1]+n[2]*bn[2];
      if(d<0)n=[-n[0],-n[1],-n[2]];
      const delta=1-clamp(n[0]*bn[0]+n[1]*bn[1]+n[2]*bn[2],-1,1);normalDeviationSq+=delta*delta;
    }else n=[0,-1,0];
    normals[i]=n;
    const p=positions[i];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}
  }

  const data=new Float32Array(positions.length*10);for(let i=0;i<positions.length;i++){
    const o=i*10;data.set(positions[i],o);data.set(normals[i],o+3);data.set(colors[i],o+6);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.DYNAMIC_DRAW);indexCount=indices.length;
  geometrySignature=0;for(let i=0;i<data.length;i+=97)geometrySignature+=Math.abs(data[i]||0)*.73+Math.abs(data[i+1]||0)*1.31+Math.abs(data[i+2]||0)*2.17;geometrySignature=Number(geometrySignature.toFixed(6));lastBuild=performance.now()-start;
  const ext=max.map((v,i)=>v-min[i]),microRms=Math.sqrt(microSq/(warpCount||1)),microCoverage=100*microAffected/(warpCount||1),
    microNormalRms=Math.sqrt(microNormalSq/Math.max(1,baseCenter)),warpRms=Math.sqrt(warpSq/(warpCount||1)),baseErr=Math.abs(min[1]);
  $('extent').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('meshCount').textContent=positions.length+' / '+(indices.length/3);$('microCoverage').textContent=microCoverage.toFixed(1)+'%';$('warpRms').textContent=warpRms.toFixed(4);$('baseError').textContent=baseErr.toExponential(1);$('meshStats').textContent=(indices.length/3)+' TRIANGLES';
  window.__CORAL_R07_QA__={ready:true,errors:window.__qaErrors||[],noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Massive coral',noaaMorphologyId:'HARD_MASSIVE',candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false,runtimeGLB:0,runtimeTextures:0,networkFetches:0,uniformSpeciesColor:true,meshColorCount:1,vertexCount:positions.length,triangleCount:indices.length/3,extent:ext,baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',surfaceCoverageProfile:'apex/base guard only',meshResolution:'192x384',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'dense-cellular-14',coralliteTopology:'shallow-pit-fine-rim-filled-elements',microscopeGeometry:true,microDisplacementSpace:'surface-normal',microRadialOnly:false,microTangentialLeakRms:Math.sqrt(microTangentialSq/Math.max(1,baseCenter)),microNormalDisplacementRms:microNormalRms,maxMicroNormalDisplacement:microNormalMax,microDisplacementRms:microRms,microCoveragePct:microCoverage,warpGeometry:true,warpDisplacementRms:warpRms,normalDeviationRms:Math.sqrt(normalDeviationSq/Math.max(1,baseCenter)),geometrySignature,rebuildMs:lastBuild,visualAcceptance:false,productionReady:false};
}
'''


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p06_surface_normal_corallites.py <build-dir>')
    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    html = index.read_text(encoding='utf-8')

    html = html.replace('NOAA Massive Coral P05', 'NOAA Massive Coral P06')
    html = html.replace('Massive Coral P05', 'Massive Coral P06')
    html = html.replace('R07-P05', 'R07-P06')
    html = html.replace("version:'R07-P05'", "version:'R07-P06'")
    html = replace_once(html, 'k=10.5+7.5*cfg.microScale,', 'k=8.0+6.0*cfg.microScale,', 'P06 cellular sampling frequency')
    html = replace_once(html, 'microDepth:.44', 'microDepth:.62', 'P06 default microscope depth')
    html = replace_once(html, '<output id="microDepthO">0.44</output>', '<output id="microDepthO">0.62</output>', 'P06 microscope output')
    html = replace_once(html, 'id="microDepth" type="range" min="0" max="1" step="0.01" value="0.44"', 'id="microDepth" type="range" min="0" max="1" step="0.01" value="0.62"', 'P06 microscope slider')
    html = html.replace(
        'P05 按 Porites lutea 的半球／头盔状、通常平滑母体收敛：低幅整体起伏，密集而浅的杯坑、杯缘与杯内骨骼元素。',
        'P06 保留 Porites lutea 的半球／头盔状平滑母体；Microscope 不再只改水平半径，而是沿真实穹顶表面法线生成密集浅杯坑、细杯缘与杯内骨骼元素。',
    )

    html, count = re.subn(r'function generate\(\)\{.*?\n\}\nfunction m4mul', GENERATE_P06 + '\nfunction m4mul', html, count=1, flags=re.S)
    require(count == 1, f'P06 generate replacement failed: {count}')

    html = replace_once(
        html,
        "meshResolution:'160x320',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'dense-cellular',coralliteTopology:'shallow-pit-fine-rim-filled-elements',cellularCoverageTuned:true,runtimeGLB:0,",
        "meshResolution:'192x384',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'dense-cellular-14',coralliteTopology:'shallow-pit-fine-rim-filled-elements',microDisplacementSpace:'surface-normal',microRadialOnly:false,runtimeGLB:0,",
        'P06 build marker',
    )

    for required in ("microDisplacementSpace:'surface-normal'", "microRadialOnly:false", "meshResolution:'192x384'", "microNormalDisplacementRms"):
        require(required in html, f'P06 marker missing: {required}')
    require('radius=radialBase*baseSpread*(1+f.macro+f.med+f.micro)' not in html, 'stale radial-only microscope remains')

    index.write_text(html, encoding='utf-8')
    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['schema'] = 'CORAL_MOTHER_R07_MASSIVE_P06_BUILD'
    build['releaseId'] = 'CORAL_R07_P06_NOAA_MASSIVE_PORITES_SURFACE_NORMAL_CORALLITES'
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry'].update({
        'meshResolution': {'latitude': 192, 'longitude': 384},
        'coralliteFrequency': 'dense-cellular-14',
        'microDisplacementSpace': 'surface-normal',
        'microRadialOnly': False,
        'baseSurfaceNormalsBeforeMicroscope': True,
        'finalNormalsAfterMicroscope': True,
    })
    build['defaults']['microDepth'] = 0.62
    build['supersedes'] = {
        'releaseId': 'CORAL_R07_P05_NOAA_MASSIVE_PORITES_PALAU_SMOOTH_FILLED',
        'reason': 'P05 passed numeric gates but displaced only horizontal radius, producing directional wrinkles instead of true corallite relief across the dome.',
    }
    build['visualAcceptance'] = False
    build['productionReady'] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (root / 'P06_SURFACE_NORMAL_CORALLITES_ZH.md').write_text(
        '# Coral Mother R07-P06 · Surface-normal Corallites\n\n'
        '- P05 自动门禁通过，但视觉近景仍为沿水平半径拉伸的皱纹。\n'
        '- 根因：P05 将 Microscope 乘到水平 radius，顶部位移接近零，侧壁形成方向性条纹。\n'
        '- P06 先生成无微观位移的穹顶并计算基础表面法线，再沿该法线施加杯坑／杯缘位移，之后重新计算最终法线。\n'
        '- 网格提高到 192×384；默认 cellular 频率降低到 14，以保证每个珊瑚杯有足够采样点。\n'
        '- Palau 群岛区域出现证据保持 NOAA NCEI CONFIRMED；Airai / Stone Money Island 局地投放仍未解决。\n'
        '- visualAcceptance=false；productionReady=false；ecologicalPlacementReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
