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


def replace_all_checked(text: str, old: str, new: str, minimum: int, label: str) -> str:
    count = text.count(old)
    if count < minimum:
        raise RuntimeError(f'{label}: expected at least {minimum} matches, found {count}')
    return text.replace(old, new)


OLD_SETVIEW = "function setView(v){document.querySelectorAll('#views [data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));if(v==='front'){camera.yaw=0;camera.pitch=.12;camera.dist=5.2;$('viewName').textContent='Front massive profile'}else if(v==='side'){camera.yaw=Math.PI/2;camera.pitch=.12;camera.dist=5.2;$('viewName').textContent='Side massive profile'}else if(v==='top'){camera.yaw=0;camera.pitch=1.46;camera.dist=5.2;$('viewName').textContent='Top massive profile'}else{camera.yaw=.72;camera.pitch=.38;camera.dist=5.4;$('viewName').textContent='45° massive profile'}}"

NEW_SETVIEW = "function setView(v){document.querySelectorAll('#views [data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));if(v==='front'){camera.target=[0,.72,0];camera.yaw=0;camera.pitch=.12;camera.dist=5.4;$('viewName').textContent='Front massive profile'}else if(v==='side'){camera.target=[0,.72,0];camera.yaw=Math.PI/2;camera.pitch=.12;camera.dist=5.4;$('viewName').textContent='Side massive profile'}else if(v==='top'){camera.target=[0,.72,0];camera.yaw=0;camera.pitch=1.46;camera.dist=5.4;$('viewName').textContent='Top massive profile'}else if(v==='micro'){camera.target=[0,.92,0];camera.yaw=.30;camera.pitch=.16;camera.dist=2.45;$('viewName').textContent='Surface microscope close-up'}else{camera.target=[0,.72,0];camera.yaw=.72;camera.pitch=.34;camera.dist=5.35;$('viewName').textContent='45° massive profile'}}"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p05_palua_smooth_filled.py <build-dir>')

    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    classification_path = root / 'NOAA_CLASSIFICATION.json'
    html = index.read_text(encoding='utf-8')

    html = replace_all_checked(html, 'NOAA Massive Coral P04', 'NOAA Massive Coral P05', 1, 'P05 title')
    html = replace_all_checked(html, 'Massive Coral P04', 'Massive Coral P05', 1, 'P05 heading')
    html = replace_all_checked(html, 'R07-P04', 'R07-P05', 1, 'P05 release label')
    html = html.replace("version:'R07-P04'", "version:'R07-P05'")

    # NOAA NCEI confirms Porites lutea in the Palau Archipelago at Ulong
    # Channel. This closes regional occurrence only; Airai / Stone Money Island
    # local ecological placement remains a separate unresolved gate.
    html = replace_once(
        html,
        '<div class="chip"><strong>PALAU</strong><br><small>UNRESOLVED</small></div>',
        '<div class="chip"><strong>PALAU REGION</strong><br><small>NCEI CONFIRMED</small></div>',
        'Palau regional evidence badge',
    )
    html = replace_once(
        html,
        'Porites lutea morphology prototype · NOAA Hard / stony coral → Massive coral',
        'Porites lutea · NOAA Hard / stony coral → Massive coral · morphology prototype',
        'species header',
    )
    html = replace_once(
        html,
        '球状或巨石状稳定轮廓；P04 保持正确封口与向外绕序，使用无经纬接缝的三维 cellular 场形成独立杯坑、杯缘与共享壁。当前仍只是 Porites lutea 形态候选。',
        'P05 按 Porites lutea 的半球／头盔状、通常平滑母体收敛：低幅整体起伏，密集而浅的杯坑、杯缘与杯内骨骼元素。NOAA NCEI 已确认其存在于帕劳群岛 Ulong Channel；Airai 本地投放仍待证。',
        'P05 production description',
    )
    html = replace_once(
        html,
        'Massive 是 NOAA 生长形态，不是属或种。Porites lutea 仅作本轮太平洋巨石形态候选；Palau occurrence 仍为 UNRESOLVED。',
        'Massive 是 NOAA 生长形态，不是物种。NOAA NCEI 已确认 Porites lutea 样本来自帕劳群岛 Ulong Channel（7.2859°N, 134.2503°E，12 m）；Stone Money Island / Airai 的局地投放仍为 UNRESOLVED。',
        'truth boundary note',
    )
    html = replace_once(
        html,
        '<button data-view="top">顶面</button><button id="resetCamera">重置镜头</button>',
        '<button data-view="top">顶面</button><button data-view="micro">表面近景</button><button id="resetCamera">重置镜头</button>',
        'microscope camera button',
    )
    html = replace_once(html, OLD_SETVIEW, NEW_SETVIEW, 'P05 view presets')

    # Species-level default silhouette: hemisphere/helmet rather than a low
    # flattened bun. Corals of the World describes the surface as usually
    # smooth, so broad folds become subordinate to dense fine corallites.
    html = replace_once(
        html,
        'const cfg={width:1.75,height:1.20,dome:1.05,base:.34,lobes:.52,warp:.24,undulation:.44,microScale:1,microDepth:.72,ridges:.58,grain:.34,saturation:1};',
        'const cfg={width:1.72,height:1.55,dome:1.22,base:.18,lobes:.16,warp:.12,undulation:.12,microScale:1,microDepth:.44,ridges:.66,grain:.22,saturation:.92};',
        'P05 default contract',
    )
    html = replace_once(html, 'value="1.75"', 'value="1.72"', 'width slider default')
    html = replace_once(html, '>1.75</output>', '>1.72</output>', 'width output default')
    html = replace_once(html, 'value="1.20"', 'value="1.55"', 'height slider default')
    html = replace_once(html, '>1.20</output>', '>1.55</output>', 'height output default')
    html = replace_once(html, 'value="1.05"', 'value="1.22"', 'dome slider default')
    html = replace_once(html, '>1.05</output>', '>1.22</output>', 'dome output default')
    html = replace_once(html, 'value="0.34"', 'value="0.18"', 'base slider default')
    html = replace_once(html, '>0.34</output>', '>0.18</output>', 'base output default')
    html = replace_once(html, 'value="0.52"', 'value="0.16"', 'lobes slider default')
    html = replace_once(html, '>0.52</output>', '>0.16</output>', 'lobes output default')
    html = replace_once(html, 'value="0.24"', 'value="0.12"', 'warp slider default')
    html = replace_once(html, '>0.24</output>', '>0.12</output>', 'warp output default')
    html = replace_once(html, 'value="0.44"', 'value="0.12"', 'undulation slider default')
    html = replace_once(html, '>0.44</output>', '>0.12</output>', 'undulation output default')
    html = replace_once(html, 'value="0.72"', 'value="0.44"', 'micro depth slider default')
    html = replace_once(html, '>0.72</output>', '>0.44</output>', 'micro depth output default')
    html = replace_once(html, 'value="0.58"', 'value="0.66"', 'ridge slider default')
    html = replace_once(html, '>0.58</output>', '>0.66</output>', 'ridge output default')
    html = replace_once(html, 'value="0.34"', 'value="0.22"', 'grain slider default')
    html = replace_once(html, '>0.34</output>', '>0.22</output>', 'grain output default')
    html = replace_once(html, 'value="1">', 'value="0.92">', 'saturation slider default')
    html = replace_once(html, '>1.00</output>', '>0.92</output>', 'saturation output default')

    html = replace_once(
        html,
        "const defaults={...cfg};",
        "const defaults={...cfg};",
        'defaults marker',
    )

    # P04 already has the correct topology. P05 raises sampling enough to make
    # the cellular field read as small cups rather than directional ridges.
    html = replace_once(
        html,
        'const start=performance.now(),LAT=128,LON=224,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();',
        'const start=performance.now(),LAT=160,LON=320,grid=[],positions=[],normals=[],colors=[],indices=[],col=baseColor();',
        'P05 mesh resolution',
    )
    html = replace_once(
        html,
        "macro=cfg.lobes*fade*(.030*Math.sin(sx*3.3+sy*2.1+sz*1.7)+.021*Math.sin(sx*5.2-sy*3.4+sz*4.1+1.2)),",
        "macro=cfg.lobes*fade*(.012*Math.sin(sx*3.3+sy*2.1+sz*1.7)+.008*Math.sin(sx*5.2-sy*3.4+sz*4.1+1.2)),",
        'smooth macro profile',
    )
    html = replace_once(
        html,
        "med=cfg.undulation*fade*(.012*Math.sin(sx*8.7+sy*5.9-sz*7.3)+.008*Math.sin(sx*13.1-sy*9.2+sz*11.7+2.4)),",
        "med=cfg.undulation*fade*(.0045*Math.sin(sx*8.7+sy*5.9-sz*7.3)+.0030*Math.sin(sx*13.1-sy*9.2+sz*11.7+2.4)),",
        'smooth medium profile',
    )
    html = replace_once(
        html,
        'k=6.5+6.5*cfg.microScale,cells=cellular3(sx*k+3.17,sy*k+7.31,sz*k+11.73),',
        'k=10.5+7.5*cfg.microScale,cells=cellular3(sx*k+3.17,sy*k+7.31,sz*k+11.73),',
        'dense species corallites',
    )
    html = replace_once(
        html,
        'pit=1-smooth((d-.045)/.235),',
        'pit=1-smooth((d-.040)/.205),',
        'shallow filled pit',
    )
    html = replace_once(
        html,
        'wall=1-smooth((edge-.006)/.125),',
        'wall=1-smooth((edge-.006)/.092),',
        'fine shared wall',
    )
    html = replace_once(
        html,
        'crown=Math.pow(clamp(1-Math.abs(d-.255)/.115,0,1),1.7),',
        'crown=Math.pow(clamp(1-Math.abs(d-.225)/.082,0,1),1.9),',
        'fine cup rim',
    )
    html = replace_once(
        html,
        'grain=cfg.grain*.006*Math.sin((sx*17.3+sy*23.1+sz*19.7)*k)*Math.sin((sx*29.1-sy*13.7+sz*31.3)*k),',
        'grain=cfg.grain*.0045*Math.sin((sx*17.3+sy*23.1+sz*19.7)*k)*Math.sin((sx*29.1-sy*13.7+sz*31.3)*k),\n    filled=pit*(.5+.5*Math.sin((sx*31.0+sy*37.0+sz*29.0)*k))*(.5+.5*Math.sin((sx*23.0-sy*41.0+sz*35.0)*k)),',
        'filled skeletal elements',
    )
    html = replace_once(
        html,
        'corallite=.060*cfg.ridges*wall+.034*crown-.072*pit+grain,',
        'corallite=.030*cfg.ridges*wall+.020*crown-.030*pit+.012*filled+grain,',
        'Porites shallow filled corallite profile',
    )
    html = replace_once(
        html,
        'micro=cfg.microDepth*fade*clamp(corallite,-.095,.105);',
        'micro=cfg.microDepth*fade*clamp(corallite,-.045,.050);',
        'subtle species relief',
    )
    html = replace_once(html, 'const c=[.39,.36,.25]', 'const c=[.62,.55,.35]', 'cream yellow species colour')

    # Runtime evidence fields and regional/local truth split.
    html = replace_once(
        html,
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',ecologicalPlacementReady:false,",
        "candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',ecologicalPlacementReady:false,",
        'runtime Palau evidence split',
    )
    html = replace_once(
        html,
        "surfaceCoverageProfile:'apex/base guard only',meshResolution:'128x224',coralliteFrequency:'cellular-worley',coralliteTopology:'pit-rim-wall',cellularCoverageTuned:true,microscopeGeometry:true,",
        "surfaceCoverageProfile:'apex/base guard only',meshResolution:'160x320',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'dense-cellular',coralliteTopology:'shallow-pit-fine-rim-filled-elements',cellularCoverageTuned:true,microscopeGeometry:true,",
        'runtime P05 morphology evidence',
    )
    html = replace_once(
        html,
        "candidateSpecies:'Porites lutea morphology prototype',palauOccurrenceEvidence:'UNRESOLVED',baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'128x224',coralliteFrequency:'cellular-worley',coralliteTopology:'pit-rim-wall',cellularCoverageTuned:true,runtimeGLB:0,",
        "candidateSpecies:'Porites lutea',assetStatus:'morphology prototype',palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED',palauEvidenceSite:'Ulong Channel',palauEvidenceCoordinates:[7.2859,134.2503],palauEvidenceDepthM:12,localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',baseCapOrientation:'downward',surfaceWinding:'outward-ccw',meshResolution:'160x320',colonyForm:'hemispherical-or-helmet-shaped',surfaceProfile:'usually-smooth',coralliteFrequency:'dense-cellular',coralliteTopology:'shallow-pit-fine-rim-filled-elements',cellularCoverageTuned:true,runtimeGLB:0,",
        'build marker P05 evidence',
    )

    # The generated QA class label stays the NOAA growth-form ID.
    if 'HARD_MASSIVE' not in html:
        raise RuntimeError('NOAA massive classification missing')
    for required in (
        "palauArchipelagoOccurrenceEvidence:'NOAA_NCEI_CONFIRMED'",
        "localSitePlacementEvidence:'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND'",
        "meshResolution:'160x320'",
        "surfaceProfile:'usually-smooth'",
        "coralliteTopology:'shallow-pit-fine-rim-filled-elements'",
        "data-view=\"micro\"",
    ):
        if required not in html:
            raise RuntimeError(f'P05 runtime marker missing: {required}')

    index.write_text(html, encoding='utf-8')

    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['schema'] = 'CORAL_MOTHER_R07_MASSIVE_P05_BUILD'
    build['releaseId'] = 'CORAL_R07_P05_NOAA_MASSIVE_PORITES_PALAU_SMOOTH_FILLED'
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['classification'].update({
        'candidateSpecies': 'Porites lutea',
        'assetStatus': 'morphology prototype',
        'palauArchipelagoOccurrenceEvidence': 'NOAA_NCEI_CONFIRMED',
        'palauEvidenceSite': 'Ulong Channel',
        'palauEvidenceCoordinates': {'latitude': 7.2859, 'longitude': 134.2503},
        'palauEvidenceDepthM': 12,
        'localSitePlacementEvidence': 'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',
        'ecologicalPlacementReady': False,
    })
    build['classification'].pop('palauOccurrenceEvidence', None)
    build['geometry'].update({
        'meshResolution': {'latitude': 160, 'longitude': 320},
        'colonyForm': 'hemispherical-or-helmet-shaped',
        'surfaceProfile': 'usually-smooth',
        'coralliteFrequency': 'dense-cellular',
        'coralliteTopology': 'shallow-pit-fine-rim-filled-elements',
        'filledSkeletalElements': True,
        'closeupCameraPreset': True,
        'defaultBroadReliefReduced': True,
    })
    build['defaults'] = {
        'width': 1.72,
        'height': 1.55,
        'dome': 1.22,
        'base': 0.18,
        'lobes': 0.16,
        'warp': 0.12,
        'undulation': 0.12,
        'microScale': 1.0,
        'microDepth': 0.44,
        'ridges': 0.66,
        'grain': 0.22,
        'saturation': 0.92,
    }
    build['supersedes'] = {
        'releaseId': 'CORAL_R07_P04_NOAA_MASSIVE_PORITES_CELLULAR_CORALLITES',
        'reason': 'P04 established cellular corallites but remained too low, brown, and broadly wrinkled relative to hemispherical, usually smooth Porites lutea references.',
    }
    build['visualAcceptance'] = False
    build['productionReady'] = False
    build['ecologicalPlacementReady'] = False
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    classification = json.loads(classification_path.read_text(encoding='utf-8'))
    classification.update({
        'candidateSpecies': 'Porites lutea',
        'assetStatus': 'morphology prototype',
        'palauArchipelagoOccurrenceEvidence': 'NOAA_NCEI_CONFIRMED',
        'palauEvidenceSite': 'Ulong Channel',
        'palauEvidenceCoordinates': {'latitude': 7.2859, 'longitude': 134.2503},
        'palauEvidenceDepthM': 12,
        'localSitePlacementEvidence': 'UNRESOLVED_AIRAI_STONE_MONEY_ISLAND',
        'ecologicalPlacementReady': False,
    })
    classification.pop('palauOccurrenceEvidence', None)
    classification_path.write_text(json.dumps(classification, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    evidence = {
        'schema': 'CORAL_PALAU_OCCURRENCE_EVIDENCE_V1',
        'species': 'Porites lutea',
        'regionalStatus': 'CONFIRMED',
        'region': 'Palau Archipelago',
        'site': 'Ulong Channel',
        'coordinates': {'latitude': 7.2859, 'longitude': 134.2503},
        'depthM': 12,
        'recordPeriod': '1945-2008 CE coral bands',
        'authority': 'NOAA National Centers for Environmental Information / World Data Service for Paleoclimatology',
        'dataset': 'NOAA/WDS Paleoclimatology - Western Tropical Pacific - Palau Archipelago, 1945-2008 CE, Porites lutea Coral D14C Data',
        'datasetId': 'noaa-coral-19702',
        'doi': '10.25921/775a-rz50',
        'sourceUrl': 'https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/noaa-coral-19702/html',
        'localGameSiteStatus': 'UNRESOLVED',
        'localGameSite': 'Airai / Stone Money Island',
        'ecologicalPlacementReady': False,
        'reason': 'Regional occurrence is confirmed, but the evidence point is Ulong Channel rather than the local game site.',
    }
    (root / 'PALAU_OCCURRENCE_EVIDENCE.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    (root / 'P05_PALAU_SMOOTH_FILLED_ZH.md').write_text(
        '# Coral Mother R07-P05 · Palau / Smooth / Filled\n\n'
        '- NOAA 生长形态仍为 Hard / stony coral → Massive coral。\n'
        '- NOAA NCEI 已确认 Porites lutea 样本来自帕劳群岛 Ulong Channel，坐标 7.2859°N, 134.2503°E，水深 12 m。\n'
        '- 这只关闭“帕劳群岛区域出现”证据；Airai / Stone Money Island 的局地生态投放仍未关闭。\n'
        '- 母体由低矮面包形收敛为半球／头盔形，高度提高，基底裙边与整体扭曲降低。\n'
        '- 参考事实要求表面通常平滑，因此默认宏观团块和中尺度起伏大幅降低。\n'
        '- 网格提高到 160×320；Microscope 改为更密集、更浅的杯坑、细杯缘与杯内骨骼元素。\n'
        '- 默认统一为奶油黄褐候选；不以颜色作为分类依据。\n'
        '- 新增“表面近景”镜头，用于检查珊瑚杯而不破坏整体尺度。\n'
        '- visualAcceptance=false；productionReady=false；ecologicalPlacementReady=false。\n',
        encoding='utf-8',
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
