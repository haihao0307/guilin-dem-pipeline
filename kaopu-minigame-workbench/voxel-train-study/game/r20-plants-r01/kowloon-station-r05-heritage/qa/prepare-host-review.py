from pathlib import Path
import shutil, re
root=Path('kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01')
source=root/'kowloon-train88-r01';target=root/'kowloon-heritage-host-qa'
shutil.copytree(source,target,dirs_exist_ok=True)
for p in target.rglob('*.mjs'):
 s=p.read_text().replace('../kowloon-station-r04/','../kowloon-station-r05-heritage/')
 p.write_text(s)
p=target/'host-app.mjs';s=p.read_text()
s,count=re.subn(r"import\s*\{STATION_SCORE\}\s*from\s*'../kowloon-station-r05-heritage/station-score.mjs';", "import {STATION_SCORE,VIEWS as HERITAGE_VIEWS} from '../kowloon-station-r05-heritage/station-score.mjs';",s)
assert count==1, f'Expected one station score import, got {count}'
s=s.replace("// Independent integration entry,", "window.__heritageReviewStartup={moduleLoaded:true,viewsBound:typeof HERITAGE_VIEWS==='object',viewNames:Object.keys(HERITAGE_VIEWS)};console.log('HERITAGE_STARTUP '+JSON.stringify(window.__heritageReviewStartup));\n// Independent integration entry,")
needle='camera.lookAt(cameraTarget);if(bridgeTestCamera)'
assert needle in s
s=s.replace(needle,"camera.lookAt(cameraTarget);if(params.has('heritageView')){const hv=HERITAGE_VIEWS[params.get('heritageView')];if(!hv)throw Error('Unknown heritage observation');const hf=stationReceiver.binding.frame(view,game.route);bridgeTestCamera={eye:hf.toWorld(hv.eye),target:hf.toWorld(hv.target)};}if(bridgeTestCamera)")
p.write_text(s)
print('Created ephemeral original shared host, with R05 field and score imports. Original checkout files are unchanged.')
