import fs from 'node:fs';import assert from 'node:assert/strict';
const dir=new URL('../',import.meta.url),html=fs.readFileSync(new URL('index.html',dir),'utf8'),view=fs.readFileSync(new URL('view.mjs',dir),'utf8');
for(const id of ['motion-play','motion-pause','motion-step','motion-reset','motion-speed','check-motion','check-connection','connection-angle','coating-wear']){assert(html.includes(`id="${id}"`));assert(view.includes(`#${id}`));}
assert(view.includes('enterSideInspection(state)'));assert(view.includes('currentMotionPose.partTransforms'));assert(view.includes('couplingPose.transforms.coach'));assert(view.includes('couplingPose});'));
const old=fs.readFileSync(new URL('../../a6-native-r01/index.html',import.meta.url),'utf8');const css=s=>s.match(/<style>([\s\S]*?)<\/style>/)[1];assert.equal(css(html),css(old),'No mobile CSS redesign');
console.log('R02 explicit controls, native motion adapters, bounded camera and unchanged CSS contract passed');
