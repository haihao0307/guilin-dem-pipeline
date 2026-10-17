import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import zlib from 'node:zlib';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {packExperiment,unpackExperiment} from '../src/ExperimentTransport.mjs';
import {EXPERIMENTS} from '../src/FlowExperiments.mjs';
const base=fileURLToPath(new URL('../',import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const e of EXPERIMENTS.filter(e=>e.id!=='baseline'))cp.execFileSync(process.execPath,[path.join(base,'tools/compile-structure.mjs'),e.id,'assets/experiments/'+e.id,'assets/structure.json.gz'],{stdio:'inherit'});
const baselineBytes=fs.readFileSync(path.join(base,'assets/structure.json.gz')),baseline=JSON.parse(zlib.gunzipSync(baselineBytes)),baseSHA256=sha(baselineBytes);
for(const e of EXPERIMENTS.filter(e=>e.id!=='baseline')){const dir=path.join(base,'assets/experiments',e.id),lab=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'structure.json.gz')))),patch=packExperiment(baseline,lab,baseSHA256);if(JSON.stringify(unpackExperiment(baseline,patch,baseSHA256))!==JSON.stringify(lab))throw Error('Experiment transport round-trip mismatch');fs.writeFileSync(path.join(dir,'patch.json.gz'),zlib.gzipSync(Buffer.from(JSON.stringify(patch)),{level:9}));}
const old=JSON.parse(fs.readFileSync(path.join(base,'assets/ASSET_MANIFEST.json'))),manifest={roots:old.roots,structure:old.structure};
for(const e of EXPERIMENTS.filter(e=>e.id!=='baseline'))for(const [key,file]of [['patch','patch.json.gz'],['roots','roots.bin.gz']]){const p='assets/experiments/'+e.id+'/'+file,b=fs.readFileSync(path.join(base,p));manifest[e.id+'/'+key]={path:p,bytes:b.length,sha256:sha(b)};if(key==='patch')manifest[e.id+'/'+key].structureSHA256=sha(fs.readFileSync(path.join(base,'assets/experiments',e.id,'structure.json.gz')));}
fs.writeFileSync(path.join(base,'assets/ASSET_MANIFEST.json'),JSON.stringify(manifest,null,2));
console.log('Precompiled '+EXPERIMENTS.length+' independent control states; not included in startup requests.');
