// CPU execution of exact runtime mesh functions. GL upload calls are stubs.
// These tests prove generated arrays, never shader compilation or browser display.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as core from '../coast-v011/coast-core.mjs';import * as domain from '../coast-v011/rock-domain.mjs';
const file=new URL('../coast-v011/coast-app.mjs',import.meta.url);
const text=fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replace(/main\(\)\.catch\(fail\);\s*$/,'');
let boundVao;const noop=()=>{},gl=new Proxy({ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,createVertexArray:()=>({}),createBuffer:()=>({}),bindVertexArray:v=>{boundVao=v;},bufferData:(target,data)=>{if(target===2)boundVao.indices=Array.from(data);}},{get:(o,p)=>o[p]||(p===p.toUpperCase()?3:noop)});
const state=new core.CoastState();for(let k=0;k<30;k++)state.step();
const ctx=vm.createContext({...core,...domain,SH:{},window:{OceanWeather:{}},document:{getElementById:()=>({width:1100,height:720})},addEventListener:noop,__gl:gl,__state:state,console});
vm.runInContext(text,ctx);vm.runInContext('gl=__gl;sim=__state;terrain=grid(384,336,true);rocks=makeRocks();water=grid(288,240,false);waterSides=makeWaterSides();slab=makeSlab();updateMeshes();',ctx);
test('actual runtime mesh boundaries share matching vertices',()=>{const q=vm.runInContext('({...qa})',ctx);assert.equal(q.boundaryVertexMissingCount,0);assert.ok(q.boundaryVerticesChecked>900);assert.ok(q.sectionSeamMaxM<1e-5);assert.equal(q.surfaceClosedAtDomainEdge,true);console.log('MESH_BOUNDARY',JSON.stringify(q));});
test('slab upper edge matches sampled visible sand bed',()=>{const a=vm.runInContext('slab.data',ctx);let err=0;for(let i=0;i<a.length;i+=10)if(a[i+1]>-7.99)err=Math.max(err,Math.abs(a[i+1]-domain.sandBed(a[i],a[i+2])));assert.ok(err<1e-5,String(err));});
test('render mesh vertices remain finite in expanded domain',()=>{for(const m of ['terrain','rocks','water','waterSides','slab']){const a=vm.runInContext(m+'.data',ctx);assert.ok(a.every(Number.isFinite),m);}assert.equal(vm.runInContext('qa.rockSolids',ctx),10);});

test('actual terrain plus slab has closed manifold edges and positive signed volume',()=>{const all=new Map();let volume=0;for(const name of ['terrain','slab']){const a=vm.runInContext(name+'.data',ctx),ix=vm.runInContext(name+'.vao.indices',ctx),get=i=>Array.from(a.slice(i*10,i*10+3)),key=p=>p.map(v=>v.toFixed(4)).join(',');for(let i=0;i<ix.length;i+=3){const p=get(ix[i]),q=get(ix[i+1]),r=get(ix[i+2]);volume+=(p[0]*(q[1]*r[2]-q[2]*r[1])+p[1]*(q[2]*r[0]-q[0]*r[2])+p[2]*(q[0]*r[1]-q[1]*r[0]))/6;for(const [a,b]of [[p,q],[q,r],[r,p]]){const k=[key(a),key(b)].sort().join('|');all.set(k,(all.get(k)||0)+1);}}}assert.ok([...all.values()].every(v=>v===2));assert.ok(volume>0);console.log('CLOSED_BED',JSON.stringify({edges:all.size,volume,openEdges:[...all.values()].filter(v=>v!==2).length}));});
