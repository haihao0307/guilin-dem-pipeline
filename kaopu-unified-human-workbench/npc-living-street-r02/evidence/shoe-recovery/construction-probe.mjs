import fs from 'node:fs';
import path from 'node:path';
import {actorFor} from './native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
const rows=[];
for(const id of (process.env.ACTOR_IDS||'B,C,D,E').split(',')){
 try{const actor=actorFor(id),fit=fitNativeShoeSide(actor,'L');rows.push({actor:id,constructs:true,report:fit.model.report.wearerFit});}
 catch(error){rows.push({actor:id,constructs:false,error:error.message});}
 console.log(JSON.stringify(rows.at(-1)));
}
fs.writeFileSync(path.join(globalThis.__SHOE_QA_ROOT__,'evidence/shoe-recovery/APERTURE_CONSTRUCTION_RCA.json'),JSON.stringify({sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,rows},null,2)+'\n');
