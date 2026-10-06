/* Verifies the actual worker message/transfer contract without browser images. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {GNMHeadModel,parseContainer} from '../src/GNMModel.js';
import {modelSnapshot,hydrateBinding} from '../src/groom/GroomFactory.js';
import {teacherVertexNormals} from '../src/groom/TeacherGroomBinding.js';
const raw=fs.readFileSync(process.env.GNM_ASSET||'../../face-workbench-20261005/qa-assets/gnm_head_web.bin'),{meta,sections}=parseContainer(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),model=new GNMHeadModel(meta,sections);
const moduleURL=new URL('../src/groom/BindingWorker.js',import.meta.url).href;
const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(`import {parentPort} from 'node:worker_threads';globalThis.self=globalThis;self.postMessage=(value,transfer)=>parentPort.postMessage(value,transfer);await import(${JSON.stringify(moduleURL)});parentPort.on('message',data=>self.onmessage({data}));`)),{type:'module'});
const message=new Promise((resolve,reject)=>{worker.on('message',data=>{if(data.type==='complete')resolve(data);if(data.type==='error')reject(Error(data.error));});worker.on('error',reject);});
worker.postMessage({model:modelSnapshot(model),regions:['hair','brows','lashes'],browHeight:0});
try{const {bindings}=await message,p=new Float32Array(model.numVertices*3);model.computeVertices(p);const n=teacherVertexNormals(model,p);for(const [name,data]of Object.entries(bindings)){const b=hydrateBinding(data,model,name);b.update(p,n);const d=b.diagnostics();assert.equal(d.finite,true);assert.equal(d.invalidTriangles,0);assert.ok(d.maxRootGap<.00012);assert.ok(model.template.byteLength>0,'main thread model not detached');}console.log(JSON.stringify({passed:true,regions:Object.keys(bindings),mainTemplateNotDetached:true,workerInputKeys:Object.keys(modelSnapshot(model))}));}finally{await worker.terminate();}
