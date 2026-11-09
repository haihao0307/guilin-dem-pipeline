import fs from 'node:fs';
import path from 'node:path';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
const root=globalThis.__SHOE_QA_ROOT__,actor=actorFor('A'),input='evidence/shoe-directional/upper-temporal/ACTUAL_UPPER_TEMPORAL.json',receipt=JSON.parse(fs.readFileSync(path.join(root,input))),row=receipt.rows.find(r=>r.actor==='A'&&r.frame===474),r=actor.binding.displayRange,e=actor.binding.displayPacked;
const rows=row.driver.failures.map(f=>({...f,bodyVertices:Array.from(actor.nativeSource.faces.subarray(f.bodyFace*3,f.bodyFace*3+3)).map(vertex=>{const weights=[];for(let n=0;n<r[vertex*4+1];n++){const k=(r[vertex*4]+n)*8;if(e[k+4]>0)weights.push({bone:actor.rig.names[e[k+3]],weight:e[k+4]});}return{vertex,weights};})}));
const output={schema:'actual-entry-foreign-upper-obstruction-identity/1',input,actor:'A',frame:474,side:'L',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,rows,conclusion:'Preserve actual 1 mm failure; do not use same-side upper deformation to hide opposite-side native body proximity. This source frame predates the motion lane entry-route correction.'};
fs.writeFileSync(path.join(root,'evidence/shoe-directional/upper-temporal/A474_FOREIGN_IDENTITY.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output.rows));
