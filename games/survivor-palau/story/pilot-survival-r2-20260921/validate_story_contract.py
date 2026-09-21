\
#!/usr/bin/env python3
import json
from pathlib import Path

repo = Path.cwd()
story = repo / 'games/survivor-palau/story/pilot-survival-r2-20260921'
manifest = json.loads((story / 'manifest.json').read_text(encoding='utf-8'))
contract = json.loads((repo / 'contracts/survivor-palau/pilot_survival_story_r12.json').read_text(encoding='utf-8'))

missing = [name for name in manifest['files'] if not (story / name).is_file()]
assert not missing, f'missing package files: {missing}'
assert manifest['version'] == 'R2.2'
assert manifest['original_zip_sha256'] == contract['sourcePackage']['originalZipSha256']
assert contract['historicalPrototype']['lossDate'] == '1944-11-21'
assert contract['historicalPrototype']['bureauNumber'] == '14053'
assert contract['historicalPrototype']['gameDivergence'].startswith('rescue fails')
assert contract['equipmentCertainty']['exactIssuedSurvivalKit'] == 'unverified'
assert contract['equipmentCertainty']['specificAviationGoggleModel'] == 'unverified'
assert contract['equipmentCertainty']['fg1RaftStowageAndRelease'] == 'unverified'
assert contract['canonicalWorld']['worldConductor'] == 'PalauWorld.sample()'
assert contract['canonicalWorld']['traditionalLOD'] is False
assert contract['acceptance'] == {
    'visualAcceptance': False,
    'productionReady': False,
    'publicShareAllowed': False,
}

master = (story / '01_MASTER_SPEC_ZH.md').read_text(encoding='utf-8')
rejected = (story / '03_LOCKED_DECISIONS_AND_REJECTED_ROUTES_ZH.md').read_text(encoding='utf-8')
assert '1944 年 11 月 21 日' in master
for required in ('手线', '短呼吸管', '木鱼叉', '自由潜'):
    assert required in master, f'master missing {required}'
for banned in ('弹力', 'Hawaiian sling', '机械鱼枪', '自动'):
    assert banned.lower() in rejected.lower(), f'rejected-routes ledger missing {banned}'
for banned in ('elastic spear', 'Hawaiian sling', 'mechanical speargun', 'automatic catch'):
    assert banned in contract['bannedRoutes'], f'contract missing banned route {banned}'

print(json.dumps({
    'passed': True,
    'manifestVersion': manifest['version'],
    'fileCount': len(manifest['files']),
    'canonicalWorld': contract['canonicalWorld']['handoffBranch'],
    'storyDate': contract['historicalPrototype']['lossDate'],
    'acceptance': contract['acceptance'],
}, ensure_ascii=False, indent=2))
