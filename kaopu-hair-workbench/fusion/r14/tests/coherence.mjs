import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';import path from 'node:path';import{fileURLToPath}from'node:url';
import{GNMHeadModel,parseContainer}from'../src/GNMModel.js';
import{PRESETS,validateRecipe,makeRootSet,SkinField,compileGroom,fieldDirection,hashArray}from'../src/LengthKernel.js';
import{canInterpolate,finitePart,zoneWeights}from'../src/GroomTopology.js';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),report={success:false,checks:[],styles:[]};
function check(name,value,detail){report.checks.push({name,pass:!!value,detail});console.log(value?'PASS':'FAIL',name,detail??'');assert(value,name);}
try{
 for(const style of Object.keys(PRESETS)){const d=validateRecipe({style});check(style+' finite front part; no global rear barrier',finitePart([0,.38,-.02],d)===0&&canInterpolate([-.04,.39,-.02],[.04,.39,-.02],d));let worst=1;for(const x of[-.068,.068])for(const y of[.31,.34,.37])for(let z=-.045;z<.040;z+=.0005){const a=[x,y,z],b=[x,y,z+.0005],u=fieldDirection(a,a,d),v=fieldDirection(b,b,d);worst=Math.min(worst,u.reduce((n,a,k)=>n+a*v[k],0));}check(style+' ear-side field continuity across old ring band',worst>.98,worst);}
 const parted=validateRecipe({style:'curtain-layer'});check('finite frontal barrier blocks unlike-side guides',!canInterpolate([-.012,.385,.080],[.012,.385,.080],parted));
 for(const patch of[{style:'bad'},{style:'textured-fringe',lengthMM:999},{style:'side-flow',sideburnMM:-1},{style:'side-flow',napeMM:NaN}])assert.throws(()=>validateRecipe(patch));check('invalid shape and trim controls rejected',true);
 const raw=zlib.gunzipSync(fs.readFileSync(path.resolve(base,'../r12/assets/gnm_head_web.bin.gz')));check('fixed native model hash preserved',crypto.createHash('sha256').update(raw).digest('hex')==='fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961');
 const c=parseContainer(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),model=new GNMHeadModel(c.meta,c.sections),roots=makeRootSet(model,1800),rootHash=hashArray(roots.templateRoots),skin=new SkinField(model);let first;
 for(const style of Object.keys(PRESETS)){
  const r=await compileGroom(roots,skin,{style});if(!first)first=r;check(style+' finite geometry and stable 20um root attachment',r.curves.every(Number.isFinite)&&r.tangents.every(Number.isFinite)&&r.rootHash===rootHash&&r.maxRootOffset<.000021);
  let bad=0,weightError=0,sideburnCount=0,minBurn=1,inside=0,crossings=0;
  for(let i=0;i<r.count;i++){const root=roots.templateRoots.subarray(i*3,i*3+3);let sum=0;for(let k=0;k<3;k++){sum+=r.weights[i*3+k];if(!canInterpolate(root,r.guides[r.guideMap[i*3+k]].root,r.recipe))bad++;}weightError=Math.max(weightError,Math.abs(sum-1));
   if(r.active[i]&&zoneWeights(root).sideburn>.8&&root[1]>.278){sideburnCount++;for(let j=1;j<r.per;j++)minBurn=Math.min(minBurn,r.curves[(i*r.per+j)*3+1]);}
   if(r.active[i]&&i%9===0)for(let j=1;j<r.per;j++){const q=(i*r.per+j)*3,p=Array.from(r.curves.subarray(q,q+3)),prev=Array.from(r.curves.subarray(q-3,q)),h=skin.bvh.nearest(p),gap=p.reduce((n,x,k)=>n+(x-h.p[k])*h.n[k],0);if(gap<-.0001)inside++;if(skin.bvh.segmentHit(prev,p))crossings++;}
  }
  check(style+' no follower crosses finite part',bad===0&&weightError<1e-6,{bad,weightError});check(style+' classified sideburn finish above lower-ear region',sideburnCount>0&&minBurn>.277,{sideburnCount,minBurn});check(style+' sampled static triangle guards',inside===0&&crossings===0,{inside,crossings});
  report.styles.push({style,rootHash:r.rootHash,curveHash:r.curveHash,active:r.activeCount,guideCount:r.guides.length,buildMs:r.buildMs,arcLengthMM:r.stats.actualArcLengthMM});
 }
 const reset=await compileGroom(roots,skin,{style:'textured-fringe'});check('regeneration is deterministic',reset.curveHash===first.curveHash);await assert.rejects(()=>compileGroom(roots,skin,{style:'textured-fringe'},{cancel:()=>true}),/取消/);check('cancel preserves old result',true);check('three presets are distinct geometry',new Set(report.styles.map(s=>s.curveHash)).size===3);report.success=true;
}finally{fs.mkdirSync(base+'/evidence',{recursive:true});fs.writeFileSync(base+'/evidence/coherence.json',JSON.stringify(report,null,2));}
