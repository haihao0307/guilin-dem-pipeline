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
        raise SystemExit('usage: coral_r07_massive_p01_patch.py <build-dir>')
    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    html = index.read_text(encoding='utf-8')

    html = html.replace('NOAA Massive Coral P00', 'NOAA Massive Coral P01')
    html = html.replace('Massive Coral P00', 'Massive Coral P01')
    html = html.replace('R07-P00', 'R07-P01')
    html = html.replace("version:'R07-P00'", "version:'R07-P01'")

    # P00 accidentally wound the bottom cap upward.  From the normal camera it
    # occluded the near half of the dome and produced a smooth cut-face.  P01
    # reverses the fan so the cap faces down and remains an underside closure.
    html = replace_once(
        html,
        'indices.push(baseCenter,grid[LAT][k],grid[LAT][j])',
        'indices.push(baseCenter,grid[LAT][j],grid[LAT][k])',
        'downward bottom-cap winding',
    )

    # Keep microscope relief over the visible flanks.  Only the exact apex and
    # attachment seam are guarded against UV convergence/pinching.
    html = replace_once(
        html,
        'const fade=Math.pow(Math.sin(Math.PI*t),.72),baseFade=1-smooth((t-.80)/.20),',
        'const fade=smooth(t/.055)*(1-smooth((t-.965)/.035)),baseFade=1-smooth((t-.80)/.20),',
        'full-flank microscope coverage',
    )

    # Move the prototype away from the bright bread-like orange of P00 while
    # retaining one uniform production colour for the whole colony.
    html = replace_once(html, 'const c=[.67,.47,.25]', 'const c=[.50,.40,.24]', 'massive prototype colour')

    html = replace_once(
        html,
        'baseAnchorError:baseErr,microscopeGeometry:true,',
        "baseAnchorError:baseErr,baseCapOrientation:'downward',surfaceCoverageProfile:'apex/base guard only',microscopeGeometry:true,",
        'runtime QA orientation evidence',
    )
    html = replace_once(
        html,
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',runtimeGLB:0,",
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',baseCapOrientation:'downward',runtimeGLB:0,",
        'build marker orientation evidence',
    )
    html = html.replace(
        '球状或巨石状稳定轮廓；当前只是 Porites lutea 形态候选，不宣称帕劳出现记录。',
        '球状或巨石状稳定轮廓；P01 修正底部封口遮挡并把 Microscope 延伸到可见侧壁。当前仍只是 Porites lutea 形态候选。',
    )

    if "baseCapOrientation:'downward'" not in html:
        raise RuntimeError('P01 base orientation marker missing')
    if 'indices.push(baseCenter,grid[LAT][k],grid[LAT][j])' in html:
        raise RuntimeError('upward cap winding remains')

    index.write_text(html, encoding='utf-8')

    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['schema'] = 'CORAL_MOTHER_R07_MASSIVE_P01_BUILD'
    build['releaseId'] = 'CORAL_R07_P01_NOAA_MASSIVE_PORITES_VISUAL_FIX'
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry']['bottomCapOrientation'] = 'downward'
    build['geometry']['microscopeVisibleFlankCoverage'] = True
    build['geometry']['apexAndAttachmentGuards'] = True
    build['supersedes'] = {
        'releaseId': 'CORAL_R07_P00_NOAA_MASSIVE_PORITES',
        'reason': 'P00 bottom cap faced upward and visually occluded the near dome surface.',
    }
    build['visualAcceptance'] = False
    build['productionReady'] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (root / 'P01_VISUAL_FIX_ZH.md').write_text(
        '# Coral Mother R07-P01 视觉修复\n\n'
        '- P00 自动门禁通过，但实际截图出现大面积光滑切面。\n'
        '- 原因：底部封口三角扇朝上，从正常观察角度遮挡近侧穹顶。\n'
        '- P01 将底盖改为向下，只作为不可见的底部闭合。\n'
        '- Microscope 覆盖扩展至全部可见侧壁，只在顶点和附着缝保留收敛保护。\n'
        '- 主色从偏亮橙褐收敛为较深的统一暖褐候选。\n'
        '- NOAA 分类仍为 Hard / stony coral → Massive coral。\n'
        '- visualAcceptance=false；productionReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
