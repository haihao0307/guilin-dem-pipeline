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
        raise SystemExit('usage: coral_r07_massive_p02_patch.py <build-dir>')
    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    html = index.read_text(encoding='utf-8')

    html = html.replace('NOAA Massive Coral P01', 'NOAA Massive Coral P02')
    html = html.replace('Massive Coral P01', 'Massive Coral P02')
    html = html.replace('R07-P01', 'R07-P02')
    html = html.replace("version:'R07-P01'", "version:'R07-P02'")

    # The P00/P01 dome quads were wound inward.  The upward-facing P00 bottom
    # cap hid that defect; once P01 corrected the cap, the near surface was
    # culled and appeared as a black cavity.  P02 reverses every dome quad to
    # outward counter-clockwise winding.
    html = replace_once(
        html,
        'indices.push(a,d,c,a,c,b)',
        'indices.push(a,b,c,a,c,d)',
        'outward dome winding',
    )

    html = replace_once(
        html,
        "baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceCoverageProfile:'apex/base guard only',microscopeGeometry:true,",
        "baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceWinding:'outward-ccw',surfaceCoverageProfile:'apex/base guard only',microscopeGeometry:true,",
        'runtime QA surface winding evidence',
    )
    html = replace_once(
        html,
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',baseCapOrientation:'downward',runtimeGLB:0,",
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',baseCapOrientation:'downward',surfaceWinding:'outward-ccw',runtimeGLB:0,",
        'build marker surface winding evidence',
    )
    html = html.replace(
        'P01 修正底部封口遮挡并把 Microscope 延伸到可见侧壁。',
        'P02 修正底部封口与主体向外绕序，并把 Microscope 延伸到可见侧壁。',
    )

    if 'indices.push(a,d,c,a,c,b)' in html:
        raise RuntimeError('inward dome winding remains')
    if "surfaceWinding:'outward-ccw'" not in html:
        raise RuntimeError('surface winding marker missing')

    index.write_text(html, encoding='utf-8')

    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['schema'] = 'CORAL_MOTHER_R07_MASSIVE_P02_BUILD'
    build['releaseId'] = 'CORAL_R07_P02_NOAA_MASSIVE_PORITES_OUTWARD_SURFACE'
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry']['surfaceWinding'] = 'outward-ccw'
    build['geometry']['backfaceCullingCompatible'] = True
    build['supersedes'] = {
        'releaseId': 'CORAL_R07_P01_NOAA_MASSIVE_PORITES_VISUAL_FIX',
        'reason': 'P01 exposed inward dome winding after the upward bottom cap was removed.',
    }
    build['visualAcceptance'] = False
    build['productionReady'] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (root / 'P02_OUTWARD_SURFACE_ZH.md').write_text(
        '# Coral Mother R07-P02 向外表面修复\n\n'
        '- P00：底盖朝上，遮住近侧穹顶。\n'
        '- P01：底盖改对后暴露主体三角形向内，近侧被背面剔除成黑洞。\n'
        '- P02：全部穹顶四边形改为 outward CCW，法线按新绕序重新累计。\n'
        '- 底盖继续朝下，只用于不可见的底部闭合。\n'
        '- NOAA 分类仍为 Hard / stony coral → Massive coral。\n'
        '- visualAcceptance=false；productionReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
