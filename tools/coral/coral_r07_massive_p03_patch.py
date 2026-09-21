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


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p03_patch.py <build-dir>')
    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    html = index.read_text(encoding='utf-8')

    html = html.replace('NOAA Massive Coral P02', 'NOAA Massive Coral P03')
    html = html.replace('Massive Coral P02', 'Massive Coral P03')
    html = html.replace('R07-P02', 'R07-P03')
    html = html.replace("version:'R07-P02'", "version:'R07-P03'")

    # P02 fixed topology but the visible displacement scale still read as a
    # weathered rock.  P03 increases tessellation and moves the energy from
    # broad wrinkles into many smaller corallite-scale cells.
    html = replace_once(
        html,
        'const start=performance.now(),LAT=72,LON=128,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();',
        'const start=performance.now(),LAT=112,LON=192,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();',
        'dense massive tessellation',
    )
    html = replace_once(
        html,
        "macro=cfg.lobes*fade*(.085*Math.sin(p*3+tt*4.1)+.055*Math.sin(p*5-tt*6.4+1.2)+.025*Math.sin(p*8+tt*3.3)),",
        "macro=cfg.lobes*fade*(.048*Math.sin(p*3+tt*4.1)+.030*Math.sin(p*5-tt*6.4+1.2)+.016*Math.sin(p*8+tt*3.3)),",
        'reduced macro wrinkles',
    )
    html = replace_once(
        html,
        "med=cfg.undulation*fade*(.050*Math.sin(p*7+tt*13.0)+.028*Math.sin(p*11-tt*9.0+2.4)),",
        "med=cfg.undulation*fade*(.020*Math.sin(p*7+tt*13.0)+.011*Math.sin(p*11-tt*9.0+2.4)),",
        'reduced medium wrinkles',
    )
    html = replace_once(html, 'k=18*cfg.microScale,', 'k=46*cfg.microScale,', 'dense corallite frequency')
    html = replace_once(
        html,
        "ridge=cfg.ridges*.040*Math.sin(p*k*1.41+tt*k*.77),",
        "ridge=cfg.ridges*.020*Math.sin(p*k*1.41+tt*k*.77),",
        'fine ridge amplitude',
    )
    html = replace_once(
        html,
        "grain=cfg.grain*.023*Math.sin(p*k*3.2-tt*k*2.1)*Math.sin(p*k*1.3+tt*k*2.7),",
        "grain=cfg.grain*.010*Math.sin(p*k*3.2-tt*k*2.1)*Math.sin(p*k*1.3+tt*k*2.7),",
        'fine skeletal grain amplitude',
    )
    html = replace_once(
        html,
        "micro=cfg.microDepth*fade*(.095*rim-.112*cell+ridge+grain);",
        "micro=cfg.microDepth*fade*(.060*rim-.070*cell+ridge+grain);",
        'dense corallite relief',
    )
    html = replace_once(html, 'const c=[.50,.40,.24]', 'const c=[.43,.38,.25]', 'olive warm-brown candidate')

    html = replace_once(
        html,
        "baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',surfaceCoverageProfile:'apex/base guard only',microscopeGeometry:true,",
        "baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',surfaceCoverageProfile:'apex/base guard only',meshResolution:'112x192',coralliteFrequency:'dense',microscopeGeometry:true,",
        'runtime QA P03 evidence',
    )
    html = replace_once(
        html,
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',baseCapOrientation:'downward',surfaceWinding:'outward-ccw',runtimeGLB:0,",
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'112x192',coralliteFrequency:'dense',runtimeGLB:0,",
        'build marker P03 evidence',
    )
    html = html.replace(
        'P02 修正底部封口与主体向外绕序，并把 Microscope 延伸到可见侧壁。',
        'P03 保持正确封口与向外绕序，并将大皱褶收敛为更密集的小尺度珊瑚杯候选。',
    )

    for forbidden in ('LAT=72,LON=128', 'k=18*cfg.microScale'):
        if forbidden in html:
            raise RuntimeError(f'P03 stale setting remains: {forbidden}')
    if "coralliteFrequency:'dense'" not in html:
        raise RuntimeError('P03 corallite marker missing')

    index.write_text(html, encoding='utf-8')

    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['schema'] = 'CORAL_MOTHER_R07_MASSIVE_P03_BUILD'
    build['releaseId'] = 'CORAL_R07_P03_NOAA_MASSIVE_PORITES_DENSE_CORALLITES'
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry']['meshResolution'] = {'latitude': 112, 'longitude': 192}
    build['geometry']['coralliteFrequency'] = 'dense'
    build['geometry']['macroWrinkleAmplitudeReduced'] = True
    build['geometry']['microDetailBias'] = 'small corallite-scale cells'
    build['supersedes'] = {
        'releaseId': 'CORAL_R07_P02_NOAA_MASSIVE_PORITES_OUTWARD_SURFACE',
        'reason': 'P02 topology is correct but the default displacement reads as broad weathered-rock folds.',
    }
    build['visualAcceptance'] = False
    build['productionReady'] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (root / 'P03_DENSE_CORALLITES_ZH.md').write_text(
        '# Coral Mother R07-P03 密集珊瑚杯收敛\n\n'
        '- 保留 P02 正确的向下底盖与 outward CCW 主体。\n'
        '- 网格从 72×128 提高到 112×192。\n'
        '- 宏观团块和中尺度皱褶幅度降低。\n'
        '- Microscope 频率由 18 提高到 46，能量转移到密集小尺度杯体、杯缘和骨骼颗粒。\n'
        '- 主色收敛为统一的橄榄暖褐候选。\n'
        '- 本轮仍是 Porites lutea morphology prototype，不等于帕劳出现证据。\n'
        '- visualAcceptance=false；productionReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
