import fs from 'node:fs';
import path from 'node:path';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {measureNativeFoot} from '../../src/NativeShoeFit.mjs';
const root=globalThis.__SHOE_QA_ROOT__,cache=JSON.parse(fs.readFileSync(path.join(root,'evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL_POSES.json'))),failure=JSON.parse(fs.readFileSync(path.join(root,'evidence/shoe-directional/PICKUP_FAILURE_DIRECTIONAL_VS_BASELINE.json'))),rows=[];
const sub=(a,b)=>a.map((v,k)=>v-b[k]),unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);},angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,k)=>s+v*b[k],0))))*180/Math.PI,pos=m=>[m[3],m[7],m[11]];
for(const id of cache.actorIds){const actor=actorFor(id),feet=Object.fromEntries(['L','R'].map(side=>[side,measureNativeFoot(actor,side)]));
 for(const p of cache.samples.filter(p=>p.actor===id))for(const side of ['L','R']){
  const limb=actor.rig.limbs['leg'+side],f=feet[side],m=p.skinMatrices[f.footId],forward=unit([0,1,2].map(k=>m[k*4]*f.forward[0]+m[k*4+1]*f.forward[1]+m[k*4+2]*f.forward[2])),shin=unit(sub(pos(p.posedMatrices[limb.b]),pos(p.posedMatrices[limb.c]))),restShin=unit(sub(actor.rig.restP[limb.b],actor.rig.restP[limb.c]));
  rows.push({actor:id,side,frame:p.frame,phase:p.phase,sourceFrame:p.sourceFrame,attached:p.attached,shinForwardAngleDegrees:angle(shin,forward),neutralShinForwardAngleDegrees:angle(restShin,f.forward),shinNative:shin,footForwardNative:forward});
 }
}
const selected=failure.rows.map(f=>rows.find(r=>r.actor===f.actor&&r.side===f.side&&r.frame===f.frame)),data={schema:'actual-cached-shin-forward-geometry/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
 definition:'Angle between ankle-to-knee vector and true original toe-derived forward vector transported by actual foot skin rotation. This is a geometry descriptor, not an assumed anatomical range or new gate.',
 selected,rangeByActor:Object.fromEntries(cache.actorIds.map(id=>{const a=rows.filter(r=>r.actor===id);return[id,{min:Math.min(...a.map(r=>r.shinForwardAngleDegrees)),max:Math.max(...a.map(r=>r.shinForwardAngleDegrees))}];})),rows};
fs.writeFileSync(path.join(root,'evidence/shoe-directional/ACTUAL_ANKLE_GEOMETRY.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(selected));
