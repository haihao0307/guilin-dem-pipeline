from pathlib import Path
p=Path(__file__).resolve().parent.parent/'src/integration.mjs'
s=p.read_text().replace('../../carriage-readonly/compare-workbench/build/node_modules/three/build/three.module.js','three').replace('../../carriage-readonly/compare-workbench/build/node_modules/three/examples/','three/examples/')
s="import {createLampTransmissionGuard} from '../qa/lamp-transmission-guard.mjs';\n"+s
needle='scene.add(placement);';assert s.count(needle)==1
s=s.replace(needle,needle+'const lampGuard=createLampTransmissionGuard({T,root:display});let lampGuardEnabled=true;')
needle='renderer.render(scene,camera);';assert s.count(needle)==1
s=s.replace(needle,'const lampStats=lampGuard.update(camera);try{renderer.render(scene,camera)}finally{lampGuard.reset()};')
s=s.replace('qa.train88={source:', 'qa.train88={lampGuard:lampStats,lampGuardEnabled,submittedCompleteCount:qa.completedFrames,source:')
s=s.replace('const api={ready:true,','const api={setLampGuard(v){lampGuardEnabled=!!v;lampGuard.setEnabled(v);viewRevision++;requestFrame()},setReviewYaw(v){followYaw=v;mode="follow";viewRevision++;requestFrame()},ready:true,')
p.with_name('lamp-entry.mjs').write_text(s)
