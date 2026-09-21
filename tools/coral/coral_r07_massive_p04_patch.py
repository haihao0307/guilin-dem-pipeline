from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


OLD_FIELD = r'''function field(phi,t){
  const fade=smooth(t/.055)*(1-smooth((t-.965)/.035)),baseFade=1-smooth((t-.80)/.20),
    w=cfg.warp*baseFade,
    wp=.18*w*(Math.sin(phi*2.1+t*5.7)+.45*Math.sin(phi*4.3-t*2.2)),
    wt=.035*w*(Math.sin(phi*3.2-t*4.6)+.5*Math.sin(phi*.9+t*7.1)),
    p=phi+wp,tt=clamp(t+wt,0,1),
    macro=cfg.lobes*fade*(.048*Math.sin(p*3+tt*4.1)+.030*Math.sin(p*5-tt*6.4+1.2)+.016*Math.sin(p*8+tt*3.3)),
    med=cfg.undulation*fade*(.020*Math.sin(p*7+tt*13.0)+.011*Math.sin(p*11-tt*9.0+2.4)),
    k=46*cfg.microScale,
    c0=.5+.5*Math.cos(p*k+tt*k*.53),c1=.5+.5*Math.cos(p*k*.52-tt*k*1.13+2.1),
    cell=Math.pow(clamp(c0*c1,0,1),2.25),rim=Math.pow(clamp(1-Math.abs(Math.sqrt(cell)-.56)/.19,0,1),1.8),
    ridge=cfg.ridges*.020*Math.sin(p*k*1.41+tt*k*.77),
    grain=cfg.grain*.010*Math.sin(p*k*3.2-tt*k*2.1)*Math.sin(p*k*1.3+tt*k*2.7),
    micro=cfg.microDepth*fade*(.060*rim-.070*cell+ridge+grain);
  return{p,tt,macro,med,micro};
}
'''

NEW_FIELD = r'''function cellHash(x,y,z,s){const n=Math.sin(x*127.1+y*311.7+z*74.7+s*53.3)*43758.5453123;return n-Math.floor(n)}
function cellular3(x,y,z){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let d1=1e9,d2=1e9;
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const cx=ix+dx+cellHash(ix+dx,iy+dy,iz+dz,0),
      cy=iy+dy+cellHash(ix+dx,iy+dy,iz+dz,1),
      cz=iz+dz+cellHash(ix+dx,iy+dy,iz+dz,2),
      qx=x-cx,qy=y-cy,qz=z-cz,d=Math.sqrt(qx*qx+qy*qy+qz*qz);
    if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d;
  }
  return[d1,d2];
}
function field(phi,t){
  const fade=smooth(t/.060)*(1-smooth((t-.970)/.030)),baseFade=1-smooth((t-.80)/.20),
    w=cfg.warp*baseFade,
    wp=.16*w*(Math.sin(phi*2.1+t*5.7)+.38*Math.sin(phi*4.3-t*2.2)),
    wt=.030*w*(Math.sin(phi*3.2-t*4.6)+.42*Math.sin(phi*.9+t*7.1)),
    p=phi+wp,tt=clamp(t+wt,0,1),th=tt*Math.PI*.5,
    sx=Math.sin(th)*Math.cos(p),sy=Math.cos(th),sz=Math.sin(th)*Math.sin(p),
    macro=cfg.lobes*fade*(.030*Math.sin(sx*3.3+sy*2.1+sz*1.7)+.021*Math.sin(sx*5.2-sy*3.4+sz*4.1+1.2)),
    med=cfg.undulation*fade*(.012*Math.sin(sx*8.7+sy*5.9-sz*7.3)+.008*Math.sin(sx*13.1-sy*9.2+sz*11.7+2.4)),
    k=6.5+6.5*cfg.microScale,cells=cellular3(sx*k+3.17,sy*k+7.31,sz*k+11.73),
    d=cells[0],edge=cells[1]-cells[0],
    pit=1-smooth((d-.055)/.190),
    wall=1-smooth((edge-.010)/.090),
    crown=Math.pow(clamp(1-Math.abs(d-.235)/.095,0,1),1.7),
    grain=cfg.grain*.006*Math.sin((sx*17.3+sy*23.1+sz*19.7)*k)*Math.sin((sx*29.1-sy*13.7+sz*31.3)*k),
    corallite=.044*cfg.ridges*wall+.026*crown-.052*pit+grain,
    micro=cfg.microDepth*fade*clamp(corallite,-.070,.072);
  return{p,tt,macro,med,micro};
}
'''


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p04_patch.py <build-dir>')
    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    html = index.read_text(encoding='utf-8')

    html = html.replace('NOAA Massive Coral P03', 'NOAA Massive Coral P04')
    html = html.replace('Massive Coral P03', 'Massive Coral P04')
    html = html.replace('R07-P03', 'R07-P04')
    html = html.replace("version:'R07-P03'", "version:'R07-P04'")

    html = replace_once(
        html,
        'const start=performance.now(),LAT=112,LON=192,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();',
        'const start=performance.now(),LAT=128,LON=224,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();',
        'P04 mesh resolution',
    )
    html = replace_once(html, OLD_FIELD, NEW_FIELD, 'cellular corallite field')
    html = replace_once(html, 'const c=[.43,.38,.25]', 'const c=[.39,.36,.25]', 'muted living-brown candidate')

    html = replace_once(
        html,
        "meshResolution:'112x192',coralliteFrequency:'dense',microscopeGeometry:true,",
        "meshResolution:'128x224',coralliteFrequency:'cellular-worley',coralliteTopology:'pit-rim-wall',microscopeGeometry:true,",
        'runtime QA P04 evidence',
    )
    html = replace_once(
        html,
        "meshResolution:'112x192',coralliteFrequency:'dense',runtimeGLB:0,",
        "meshResolution:'128x224',coralliteFrequency:'cellular-worley',coralliteTopology:'pit-rim-wall',runtimeGLB:0,",
        'build marker P04 evidence',
    )
    html = html.replace(
        'P03 保持正确封口与向外绕序，并将大皱褶收敛为更密集的小尺度珊瑚杯候选。',
        'P04 保持正确封口与向外绕序，使用无经纬接缝的三维 cellular 场形成独立杯坑、杯缘与共享壁。',
    )

    for forbidden in ('LAT=112,LON=192', 'k=46*cfg.microScale', 'c0=.5+.5*Math.cos'):
        if forbidden in html:
            raise RuntimeError(f'P04 stale field remains: {forbidden}')
    for required in ('function cellular3', "coralliteFrequency:'cellular-worley'", "coralliteTopology:'pit-rim-wall'"):
        if required not in html:
            raise RuntimeError(f'P04 marker missing: {required}')

    index.write_text(html, encoding='utf-8')

    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['schema'] = 'CORAL_MOTHER_R07_MASSIVE_P04_BUILD'
    build['releaseId'] = 'CORAL_R07_P04_NOAA_MASSIVE_PORITES_CELLULAR_CORALLITES'
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry']['meshResolution'] = {'latitude': 128, 'longitude': 224}
    build['geometry']['coralliteFrequency'] = 'cellular-worley'
    build['geometry']['coralliteTopology'] = 'pit-rim-wall'
    build['geometry']['seamlessSurfaceField'] = True
    build['geometry']['broadDirectionalRipplesRemoved'] = True
    build['supersedes'] = {
        'releaseId': 'CORAL_R07_P03_NOAA_MASSIVE_PORITES_DENSE_CORALLITES',
        'reason': 'P03 reduced broad folds but retained directional saw-tooth bands rather than discrete corallites.',
    }
    build['visualAcceptance'] = False
    build['productionReady'] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (root / 'P04_CELLULAR_CORALLITES_ZH.md').write_text(
        '# Coral Mother R07-P04 Cellular 珊瑚杯\n\n'
        '- P03 的高频正弦仍形成方向性锯齿带，不符合 Porites 密集独立珊瑚杯的目标。\n'
        '- P04 改用三维 cellular/Worley 最近点场，不依赖经纬 UV，因此没有纵向接缝。\n'
        '- 每个单元由杯坑、杯缘冠与共享细壁三部分构成。\n'
        '- 网格提高到 128×224；宏观团块和中尺度起伏继续保持低幅。\n'
        '- 主色保持统一的低饱和暖褐候选。\n'
        '- 本轮仍是 Porites lutea morphology prototype；Palau occurrence=UNRESOLVED。\n'
        '- visualAcceptance=false；productionReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
