import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {openOuterSpectrum} from '../outer-terrain/data/height-spectrum.mjs';
import {buildOuterMesh,displayedHeight,insideOwned,sampleOldNode} from '../outer-terrain/mesh.mjs';
const root=new URL('../',import.meta.url),oldRoot=new URL('../../../hong-kong-map-sea-r03/',import.meta.url),read=p=>readFile(new URL(p,root));
const oldMeta=JSON.parse(await readFile(new URL('SOURCE_MANIFEST.json',oldRoot)));
function npy(b,Type){const v=new DataView(b.buffer,b.byteOffset,b.byteLength),offset=b[6]===1?10+v.getUint16(8,true):12+v.getUint32(8,true);return new Type(b.buffer.slice(b.byteOffset+offset,b.byteOffset+b.byteLength));}
const hkHeights=npy(await readFile(new URL('data/heights.npy',oldRoot)),Float32Array),hkMask=npy(await readFile(new URL('data/mask.npy',oldRoot)),Uint8Array),host={HK:{...oldMeta,step:30},hkHeights,hkMask};
const hash=b=>createHash('sha256').update(b).digest('hex'),oldHashes=[hash(hkHeights),hash(hkMask)];
const fetchImpl=async url=>{try{return new Response(await readFile(fileURLToPath(url)));}catch{return new Response('',{status:404});}};
const s=await openOuterSpectrum(new URL('outer-terrain/data/manifest.json',root),{fetchImpl}),loaded=new Map(),bounds=s.manifest.oldOwnedNodeBoundsEPSG2326;
async function chunk(E,N){const m=s.findChunk(E,N);if(m&&!loaded.has(m.id))loaded.set(m.id,await s.loadChunk(m.id));return m;}
function sourceAt(E,N){const m=s.findChunk(E,N);return m?loaded.get(m.id)?.evaluate(E,N)||null:null;}
const auditAll=process.argv.includes('--all');const locations=auditAll?s.manifest.chunks.filter(c=>c.oceanNodeCount!==c.shapeRC[0]*c.shapeRC[1]&&!(insideOwned(c.boundsEPSG2326Nodes[0],c.boundsEPSG2326Nodes[1],bounds)&&insideOwned(c.boundsEPSG2326Nodes[2],c.boundsEPSG2326Nodes[3],bounds))).map(c=>[(c.boundsEPSG2326Nodes[0]+c.boundsEPSG2326Nodes[2])/2,(c.boundsEPSG2326Nodes[1]+c.boundsEPSG2326Nodes[3])/2]):[[bounds[0]-60,bounds[1]+1800],[bounds[2]+60,bounds[3]-1800],[bounds[0]+1800,bounds[3]+60],[810000,815000]],results=[];
for(const [E,N]of locations){const meta=await chunk(E,N),b=meta.boundsEPSG2326Nodes;for(const e of[b[0]-30,(b[0]+b[2])/2,b[2]+30])for(const n of[b[1]-30,(b[1]+b[3])/2,b[3]+30])await chunk(e,n);const a=buildOuterMesh(loaded.get(meta.id),{sourceAt,oldAt:(e,n)=>sampleOldNode(e,n,host),ownedBounds:bounds});assert(a.vertices.every(Number.isFinite));assert(a.indices.length%3===0);for(let k=0;k<a.indices.length;k+=3){const ids=a.indices.subarray(k,k+3),E=ids.reduce((v,i)=>v+a.vertices[i*6]+834000,0)/3,N=ids.reduce((v,i)=>v+827000-a.vertices[i*6+2],0)/3;assert(!insideOwned(E,N,bounds),'No triangle may cover frozen owned interior');}results.push({id:meta.id,triangles:a.indices.length/3,bytes:a.bytes,...a.stats});}
assert.equal(hash(hkHeights),oldHashes[0]);assert.equal(hash(hkMask),oldHashes[1]);
// Exact transition limits and mask refusal on a simple, fully known support.
const common={ownedBounds:[0,0,100,100],oldAt:()=>({heightM:20,isLand:true}),sourceAt:()=>({heightM:10,waterClass:0})};assert.equal(displayedHeight(100,50,common).heightM,20);assert.equal(displayedHeight(160,50,common).heightM,15);assert.equal(displayedHeight(220,50,common).heightM,10);assert.equal(displayedHeight(130,50,{...common,sourceAt:()=>({heightM:10,waterClass:1})}).heightM,10);
// A single land node surrounded by water retains all supporting cells.
const water=new Uint8Array(9).fill(1);water[4]=0;const tiny=buildOuterMesh({meta:{id:'single-node-islet',shapeRC:[3,3],nodeOriginEastingNorthing:[800000,850000]},waterClass:water},{ownedBounds:[0,0,1,1],sourceAt:()=>({heightM:3,waterClass:0}),oldAt:()=>null});assert.equal(tiny.indices.length,24);
const out={passed:true,allExteriorChunksTested:auditAll,totalDisplayBytes:results.reduce((a,c)=>a+c.bytes,0),totalDisplayTriangles:results.reduce((a,c)=>a+c.triangles,0),browserRenderTested:false,oldHeightAndMaskHashesUnchanged:true,singleNodeIsletCellsRetained:4,ownedInteriorTriangles:0,joinWidthM:120,results};await writeFile(new URL(auditAll?'OUTER-ALL-MESH-CPU-QA.json':'OUTER-MESH-CPU-QA.json',root),JSON.stringify(out,null,2));console.log(JSON.stringify({...out,results:auditAll?results.length:results},null,2));
