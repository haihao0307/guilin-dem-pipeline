#!/usr/bin/env python3
"""Apply the 小华 ownership update and register the three 100 km2 showcases."""
from __future__ import annotations
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
text_roots=[root/'skills/dem-procedural-landscape',root/'tools/procedural_landscape',root/'web/procedural-landscape-skill',root/'ops/tasks']
patched=[]
for base in text_roots:
    if not base.exists():continue
    for path in base.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in {'.md','.json','.py','.html','.yml','.yaml'}:continue
        if base.name=='tasks' and 'DEM_PROCEDURAL_LANDSCAPE' not in path.name:continue
        try:text=path.read_text(encoding='utf-8')
        except UnicodeDecodeError:continue
        if '小王' in text:
            path.write_text(text.replace('小王','小华'),encoding='utf-8');patched.append(str(path.relative_to(root)))
for path in root.glob('HANDOFF_DEM_PROCEDURAL_LANDSCAPE*.md'):
    text=path.read_text(encoding='utf-8')
    if '小王' in text:path.write_text(text.replace('小王','小华'),encoding='utf-8');patched.append(str(path.relative_to(root)))

registry_path=root/'skills/dem-procedural-landscape/BRANCH_REGISTRY.json'
registry=json.loads(registry_path.read_text(encoding='utf-8'))
registry['skill']['controllerAlias']='小华'
registry['showcaseProgram']={
    'version':'0.1.0','controllerAlias':'小华','entry':'web/procedural-landscape-showcases-v010/index.html',
    'uniformAoi':{'widthKm':10.0,'heightKm':10.0,'areaKm2':100.0,'shape':'square'},
    'regions':['guilin','wenzhou','kunming'],'visualAcceptance':False,'productionReady':False,'publicReleaseApproved':False,
    'truthPolicy':'Each page exposes project-specific source status. Exact 10 km by 10 km truth cutouts remain unclaimed until mounted and verified.'
}
registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

status_path=root/'web/procedural-landscape-skill/status.json'
status=json.loads(status_path.read_text(encoding='utf-8'))
status['skill']['controllerAlias']='小华'
status['showcaseProgram']=registry['showcaseProgram']
status_path.write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

hub_path=root/'web/procedural-landscape-skill/index.html'
hub=hub_path.read_text(encoding='utf-8').replace('小王','小华')
link='<p style="margin-top:18px"><a href="../procedural-landscape-showcases-v010/index.html" style="display:inline-flex;padding:10px 15px;border-radius:12px;background:#b7d48f;color:#132017;text-decoration:none;font-weight:700">打开桂林、温州、昆明 10 × 10 km 典型生态样板</a></p>'
if 'procedural-landscape-showcases-v010' not in hub:hub=hub.replace('</header>',link+'</header>',1)
hub_path.write_text(hub,encoding='utf-8')

receipt={
    'schema':'dem_procedural_landscape_showcases_apply@1.0.0','controllerAlias':'小华',
    'uniformAoi':{'widthKm':10.0,'heightKm':10.0,'areaKm2':100.0},'regions':['guilin','wenzhou','kunming'],
    'patchedFiles':sorted(set(patched)),'entry':'web/procedural-landscape-showcases-v010/index.html',
    'truthDataModified':False,'visualAcceptance':False,'productionReady':False,'publicReleaseApproved':False
}
(root/'ops/tasks/DEM_PROCEDURAL_LANDSCAPE_SHOWCASES_V010_APPLY_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
