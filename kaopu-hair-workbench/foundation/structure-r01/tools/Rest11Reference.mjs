import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {unpackExperiment} from '../src/ExperimentTransport.mjs';
export function loadRest11Reference(){
 const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),lock=JSON.parse(read('locks/ear-rest-r13.json')),bytes=read('assets/structure.json.gz');
 if(sha(bytes)!==lock.sourceBaselineSHA256)throw Error('R11 baseline changed');
 for(const f of Object.values(lock.referenceFiles))if(sha(read(f.path))!==f.sha256)throw Error('Immutable R11 reference changed');
 const patch=lock.referenceFiles['assets/experiments/current-rest/patch.json.gz'],roots=lock.referenceFiles['assets/experiments/current-rest/roots.bin.gz'];
 return{lab:unpackExperiment(JSON.parse(zlib.gunzipSync(bytes)),JSON.parse(zlib.gunzipSync(read(patch.path))),sha(bytes)),roots:new Float32Array(Uint8Array.from(zlib.gunzipSync(read(roots.path))).buffer),lock};
}
