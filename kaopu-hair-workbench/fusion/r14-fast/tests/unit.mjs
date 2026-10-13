import fs from'node:fs';import assert from'node:assert/strict';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
import{parseContainer,GNMHeadModel}from'../src/GNMModel.js';import{exactNearestGuides}from'../src/ExactGuideSearch.js';
const p=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),r={success:false,checks:[]},sha=b=>createHash('sha256').update(b).digest('hex'),read=n=>{const b=fs.readFileSync(p+'/build-data/'+n);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
function test(name,pass,detail){r.checks.push({name,pass,detail});assert(pass,name);console.log('PASS',name);}
try{
const original=read('original.bin'),core=read('core.bin'),deferred=read('deferred.bin'),o=parseContainer(original),c=parseContainer(core),d=parseContainer(deferred),view=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
test('all original metadata retained',JSON.stringify(o.meta)===JSON.stringify(c.meta));
for(const[n,a]of Object.entries(c.sections))test('exact primary section '+n,view(a).equals(view(o.sections[n])));
for(const[n,a]of Object.entries(d.sections))test('exact deferred section '+n,view(a).equals(view(o.sections[n])));
const m0=new GNMHeadModel(o.meta,o.sections),m1=new GNMHeadModel(c.meta,c.sections),a=new Float32Array(m0.numVertices*3),b=new Float32Array(a.length);m0.computeVertices(a);m1.computeVertices(b);test('entire neutral head bit-for-bit identical',view(a).equals(view(b)));
const desc=JSON.parse(fs.readFileSync(p+'/build-data/original.json')),joined=new Uint8Array(desc.bytes),prefix=Buffer.from(desc.prefix,'base64');joined.set(prefix);const all={...c.sections,...d.sections};for(const s of desc.sections)joined.set(view(all[s.name]),prefix.length+s.offset);
test('whole original GNM container reconstructs exactly',sha(joined)===desc.sha256&&Buffer.from(original).equals(Buffer.from(joined)));
const restored=parseContainer(joined.buffer);m1.identityBasis=restored.sections.identity_basis;m1.expressionBasis=restored.sections.expression_basis;
for(const i of[0,17,252]){m0.setIdentityParam(i,.31);m1.setIdentityParam(i,.31);}for(const i of[0,27,382]){m0.setExpressionParam(i,.23);m1.setExpressionParam(i,.23);}m0.computeVertices(a);m1.computeVertices(b);test('nonzero identity and expression retain original full-basis output',view(a).equals(view(b)));
let seed=714;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};const gs=Array.from({length:840},(_,i)=>({root:[rand()*.2-.1,rand()*.2+.2,rand()*.2-.1],dir:rand()*2-1,i}));
const brute=(root,score,compat)=>{const id=[-1,-1,-1],ds=[Infinity,Infinity,Infinity];for(let i=0;i<gs.length;i++){const dist=score(gs[i]);if(dist>=ds[2])continue;if(!compat(gs[i]))continue;let k=2;while(k>0&&dist<ds[k-1]){ds[k]=ds[k-1];id[k]=id[k-1];k--;}ds[k]=dist;id[k]=i;}for(let j=1;j<3;j++)if(id[j]<0){id[j]=id[0];ds[j]=ds[0];}const w=ds.map(x=>1/Math.max(x,1e-8)),sum=w.reduce((a,b)=>a+b,0);return{id,w:w.map(x=>x/sum)};};
for(let j=0;j<4000;j++){const root=[rand()*.2-.1,rand()*.2+.2,rand()*.2-.1],penalty=rand()*5,dir=rand()*2-1,score=g=>{const q=g.root.map((x,k)=>x-root[k]);return(q[0]*q[0]+q[1]*q[1]+q[2]*q[2])*(1+penalty*(1-dir*g.dir)**2);},compat=g=>g.i%7!==j%7;assert.deepEqual(exactNearestGuides(gs,root,score,compat),brute(root,score,compat));}
test('4000 weighted compatible nearest-guide searches exactly match brute force',true);
const ties=Array.from({length:48},(_,i)=>({root:[i%2?1:-1,0,0]}));test('stable original index tie ordering',JSON.stringify(exactNearestGuides(ties,[0,0,0],()=>1,()=>true).id)==='[0,1,2]');r.success=true;
}finally{fs.mkdirSync(p+'/evidence',{recursive:true});fs.writeFileSync(p+'/evidence/unit.json',JSON.stringify(r,null,2));}
