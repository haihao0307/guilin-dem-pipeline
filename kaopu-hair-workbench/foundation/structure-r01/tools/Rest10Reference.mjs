import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {unpackExperiment} from '../src/ExperimentTransport.mjs';
export function loadRest10Reference(){
 const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),lock=JSON.parse(read('locks/upper-rest-r11.json')),b=read('assets/structure.json.gz'),patch=read(lock.sourcePatch),r=read(lock.sourceRoots);
 if(sha(b)!==lock.sourceBaselineSHA256||sha(patch)!==lock.sourcePatchSHA256||sha(r)!==lock.sourceRootsSHA256)throw Error('Immutable R10 reference changed');
 return{lab:unpackExperiment(JSON.parse(zlib.gunzipSync(b)),JSON.parse(zlib.gunzipSync(patch)),sha(b)),roots:new Float32Array(Uint8Array.from(zlib.gunzipSync(r)).buffer),lock};
}
