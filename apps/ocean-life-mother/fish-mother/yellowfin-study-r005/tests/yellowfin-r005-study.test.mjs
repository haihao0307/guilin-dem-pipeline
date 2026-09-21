import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('./../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const spec=JSON.parse(fs.readFileSync(new URL('WORKBENCH_SPEC.json',root),'utf8'));
let checks=0; const ok=(v,m)=>{assert(v,m);checks++};

ok(spec.source==='FISH-REF-002','source locked');
ok(spec.generationLocked===true,'generation locked');
ok(html.includes('642c6515d893474a8fc8f129491efcac'),'exact Sketchfab source uid');
ok(html.includes('d8bd9870-35fc-4d95-8a97-0898da56921e.jpg'),'author side render');
ok(html.includes("data-mode=\"snout\""),'snout calibration mode');
ok(html.includes("data-mode=\"fork\""),'fork calibration mode');
ok(html.includes("data-mode=\"dorsal\""),'dorsal finlet inventory');
ok(html.includes("data-mode=\"ventral\""),'ventral finlet inventory');
ok(html.includes('distancePct')===false,'no invented cross-frame % metric');
ok(html.includes('Source Copy') && html.includes('不启动'),'source copy remains locked in UI');
ok(!html.includes('YELLOWFIN-NATIVE-R003'),'old generated fish not reused');
ok(!html.includes('new THREE.'),'no native fish geometry generator in R005');
ok(html.includes('localStorage'),'measurement persistence');
ok(html.includes("download='YELLOWFIN_R005_SOURCE_STUDY.json'"),'measurement export');

console.log(`Yellowfin R005 study gate: ${checks} assertions passed`);
