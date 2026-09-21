from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


APPROVED_AT = '2026-09-21'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit('usage: coral_r06_t08_builder.py <t07-index.html> <override.js> <output-dir>')
    source = Path(sys.argv[1])
    override_path = Path(sys.argv[2])
    out = Path(sys.argv[3])
    html = source.read_text(encoding='utf-8')
    override = override_path.read_text(encoding='utf-8')
    require('Microscope Geometry T07' in html, 'unexpected T07 source')
    require('window.__CORAL_R06_T07_BUILD__' in html, 'T07 build marker missing')
    require('continuousTube' in override and 'warpPoint' in override and 'rebuild=function' in override, 'T08 override incomplete')

    # Keep a hard statement boundary before the runtime IIFE.
    require('\n(function(){' in override, 'T08 initialization IIFE missing')
    override = override.replace('\n(function(){', '\n;\n(function(){', 1)

    # User approved the complete T08 visual result on 2026-09-21.  Palau
    # ecological placement remains a separate unresolved evidence gate.
    override = override.replace(
        'visualAcceptance:false,productionReady:false',
        'visualAcceptance:true,productionReady:true',
    )
    require('visualAcceptance:false,productionReady:false' not in override, 'stale T08 approval flags remain')

    replacements = {
        '<title>Coral Mother R06 · Microscope Geometry T07</title>': '<title>Coral Mother R06 · Uniform Microscope + Warp T08 · Approved</title>',
        'PROCEDURAL · R06-T07': 'PROCEDURAL · R06-T08',
        'FUNCTION · R06-T07': 'FUNCTION · R06-T08',
        'Coral Mother R06 · T07': 'Coral Mother R06 · T08 · APPROVED',
        'Pocillopora 微尺度形体工作台 T07': 'Pocillopora 单色 Microscope + Warp 工作台 T08',
        '连续管状生长 + Microscope 真实形体位移；0 GLB / 0 texture': '全表面 Microscope + 连续域 Warp；0 GLB / 0 texture',
        '继续保持标本／函数 A/B。T07 在连续管环上加入杯体、杯缘／细脊与骨骼颗粒三频真实位移，并以附着根连通遍历删除悬空枝。': 'T08 统一同一母体的物种主色；Microscope 覆盖全部管环并重算法线；Warp 连续影响中心线、接点与疣突。',
        'CONTINUOUS TUBE / MICROSCOPE GEOMETRY · visualAcceptance=false': 'UNIFORM COLOR / FULL-SURFACE MICROSCOPE / WARP · APPROVED',
        'Living color / 高饱和活组织视觉候选': 'Species color / 单一物种主色候选',
        '<strong>显示边界：</strong>高饱和色用于活组织视觉候选，白化与裸骨独立。它们不是 NOAA 分类颜色，也不替代后续物种和水下光谱校准。': '<strong>显示边界：</strong>普通形体模式只使用一个物种主色；颜色用于生产识别，不作为物种分类依据。枝序多色只存在于显式诊断。',
        '<strong>当前边界：</strong>T07 已把 Microscope 从纯明暗推进到连续管环真实位移，并在细枝筛选后执行 root-connected traversal。所有显示枝体必须可沿父路径回到共同附着基底；仍需用户视觉批准。': '<strong>冻结状态：</strong>T08 已获用户视觉批准并归档为 NOAA Hard / stony coral → Branching coral。Palau 出现证据仍为 UNRESOLVED，因此生态投放必须继续单独审核。',
    }
    for old, new in replacements.items():
        require(old in html, f'missing source marker: {old[:72]}')
        html = html.replace(old, new)

    script = '<script id="t08-uniform-microscope-warp-runtime">\n' + override + '\n</script>\n'
    require('</body>' in html, 'body close missing')
    html = html.replace('</body>', script + '</body>', 1)
    require(html.count('id="gl"') == 1, 'canvas contract changed')
    require('window.__CORAL_R06_T08_BUILD__' in html, 'T08 marker missing after insert')
    require('visualAcceptance:true' in html and 'productionReady:true' in html, 'approval flags missing from runtime')

    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html, encoding='utf-8')

    classification = {
        'schema': 'CORAL_NOAA_CLASSIFICATION_V1',
        'assetId': 'CORAL_R06_T08_POCILLOPORA_DAMICORNIS',
        'scientificName': 'Pocillopora damicornis',
        'formalTaxonomy': {
            'kingdom': 'Animalia',
            'phylum': 'Cnidaria',
            'class': 'Anthozoa',
            'subclass': 'Hexacorallia',
            'order': 'Scleractinia',
            'family': 'Pocilloporidae',
            'genus': 'Pocillopora',
            'species': 'Pocillopora damicornis',
        },
        'noaa': {
            'broadType': 'Hard / stony coral',
            'growthForm': 'Branching coral',
            'morphologyId': 'HARD_BRANCHING',
            'classificationLevel': 'growth form, not species',
        },
        'commonLanguageNote': '鹿角状只是外观类比；NOAA staghorn coral 特指 Acropora cervicornis，不等于本资产。',
        'palauOccurrenceEvidence': 'UNRESOLVED',
        'ecologicalPlacementReady': False,
        'visualAcceptance': True,
        'productionReady': True,
        'approvedAt': APPROVED_AT,
    }

    build = {
        'schema': 'CORAL_MOTHER_R06_T08_UNIFORM_MICROSCOPE_WARP_BUILD',
        'source': str(source),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'bytes': len(html.encode('utf-8')),
        'sha256': hashlib.sha256(html.encode('utf-8')).hexdigest(),
        'species': 'Pocillopora damicornis',
        'classification': {
            'formalOrder': 'Scleractinia',
            'family': 'Pocilloporidae',
            'noaaBroadType': 'Hard / stony coral',
            'noaaGrowthForm': 'Branching coral',
            'noaaMorphologyId': 'HARD_BRANCHING',
            'palauOccurrenceEvidence': 'UNRESOLVED',
            'ecologicalPlacementReady': False,
        },
        'geometry': {
            'continuousTube': True,
            'parallelTransport': True,
            'rootConnectedPruning': True,
            'uniformSpeciesColor': True,
            'microscopeWholeSurface': True,
            'recomputedSurfaceNormals': True,
            'sharedDomainWarp': True,
            'tubeSides': 18,
            'pathSubdivision': 5,
        },
        'approval': {
            'status': 'USER_VISUAL_APPROVED_AND_FROZEN',
            'approvedAt': APPROVED_AT,
            'scope': ['colony silhouette', 'uniform color', 'full-surface microscope', 'warp', 'root-connected geometry'],
            'exclusions': ['Palau occurrence', 'real-world size calibration', 'ecological placement'],
        },
        'adjustableControls': 12,
        'runtimeGLB': 0,
        'runtimeTextures': 0,
        'networkFetchCalls': 0,
        'visualAcceptance': True,
        'productionReady': True,
        'ecologicalPlacementReady': False,
    }
    (out / 'BUILD_T08.json').write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'NOAA_CLASSIFICATION.json').write_text(json.dumps(classification, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'FREEZE_MANIFEST.json').write_text(
        json.dumps(
            {
                'schema': 'CORAL_MOTHER_FREEZE_MANIFEST_V1',
                'releaseId': 'CORAL_R06_T08_BRANCHING_APPROVED_20260921',
                'approvedAt': APPROVED_AT,
                'classification': 'Hard / stony coral → Branching coral',
                'asset': 'Pocillopora damicornis',
                'immutableSourceSha256': build['sha256'],
                'visualAcceptance': True,
                'productionReady': True,
                'ecologicalPlacementReady': False,
                'nextNoaaGrowthForm': 'Massive coral',
                'nextCandidate': 'Porites lutea morphology prototype; Palau evidence unresolved',
            },
            ensure_ascii=False,
            indent=2,
        ) + '\n',
        encoding='utf-8',
    )
    (out / 'T08_IMPLEMENTATION_ZH.md').write_text(
        '# Coral Mother R06-T08 冻结回执\n\n'
        '- 用户于 2026-09-21 明确视觉批准，本版已固化。\n'
        '- NOAA 生产分类：Hard / stony coral → Branching coral。\n'
        '- 正式分类：Scleractinia → Pocilloporidae → Pocillopora → P. damicornis。\n'
        '- “像鹿角”仅是外观类比；不得登记成 Acropora cervicornis。\n'
        '- 默认显示统一为单一物种主色；枝序多色只在显式诊断模式出现。\n'
        '- Microscope 覆盖全部连续管环，位移后重新计算几何法线。\n'
        '- Warp 使用共享世界坐标场，连续影响中心线、接点、枝端和疣突。\n'
        '- 细枝补齐至共同附着根，禁止悬空枝进入网格。\n'
        '- 运行时保持 0 GLB、0 外部贴图、0 fetch。\n'
        '- visualAcceptance=true；productionReady=true。\n'
        '- Palau occurrence=UNRESOLVED；ecologicalPlacementReady=false。\n',
        encoding='utf-8',
    )
    (out / 'COST_COMPARISON_ZH.md').write_text(
        '# Microscope 与 Brick Mother V2.6 成本边界\n\n'
        'Coral T08 只在参数改变时由 CPU 重建几何并上传；稳定观察阶段是普通三角形绘制。\n'
        'Brick Mother V2.6 是全屏隐式场 raymarch：每帧每像素最多 118 步，并在步进中重复执行 3D noise、FBM、Worley 与 domain warp。\n'
        '因此稳定观察阶段 Coral T08 通常更省 GPU；Brick V2.6 的 Warp 更显著，是因为它在 SDF 取样前扭曲整个连续场。\n'
        'Coral T08 的代价集中在滑条变化瞬间的 CPU 网格重建。没有同一设备、同一分辨率的配对采样，不宣称绝对倍数。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
