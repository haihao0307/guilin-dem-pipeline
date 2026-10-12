import fs from 'node:fs';import crypto from 'node:crypto';
import {shaderSource} from '../../../bureau-train88-r01/source/renderer.mjs';
import {extractSource} from '../../../bureau-train88-r01/extract-source.mjs';
import {GEOMETRY_PROBE} from '../../../bureau-train88-r01/qa/probe-source.mjs';
import {RUNTIME_HEADER,STEP_ENTRY,splitOriginalStep,COMPACT_FIELD,QUERY_ENTRY} from './source.mjs';
const original=shaderSource(),extract=extractSource(original),split=splitOriginalStep(),out=new URL('./generated/',import.meta.url),sha=s=>crypto.createHash('sha256').update(s).digest('hex');fs.mkdirSync(out,{recursive:true});
const pointEntry=COMPACT_FIELD+GEOMETRY_PROBE.replace('let f=sceneField(bureauProbePoint(u32(pixel.x)));return vec4<f32>(f.d,f32(f.mat),f.seed,f.wet);','return compactBureauField(bureauProbePoint(u32(pixel.x)));');
if(pointEntry===COMPACT_FIELD+GEOMETRY_PROBE)throw Error('Point-probe entry contract changed');
const specs={reference:['geometryProbe',['sceneField'],'',GEOMETRY_PROBE],points:['geometryProbe',['sceneField'],'',pointEntry],loop:['stepRays',['sceneField'],RUNTIME_HEADER,STEP_ENTRY],query:['queryBureauRays',['sceneField'],RUNTIME_HEADER,QUERY_ENTRY],init:['initializeBureauRays',[],RUNTIME_HEADER,split.init],advance:['advanceBureauRays',[],RUNTIME_HEADER,split.advance]};
const manifest={sourceSHA256:sha(original),originalStepSHA256:sha(STEP_ENTRY),equations:'Unchanged sceneField closure; original step body partitioned at its one geometry call',outputs:{}};
for(const[name,[entry,roots,header,body]]of Object.entries(specs)){const closure=extract.closure(roots,header+body),code=closure.source+'\n'+header+'\n'+body;fs.writeFileSync(new URL(name+'.wgsl',out),code);manifest.outputs[name]={entry,bytes:Buffer.byteLength(code),sha256:sha(code),functions:closure.functionNames};}
fs.writeFileSync(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest.outputs).map(([k,v])=>[k,v.bytes]))));
