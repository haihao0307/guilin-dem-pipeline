import fs from 'node:fs';import zlib from'node:zlib';import path from'node:path';import{fileURLToPath}from'node:url';import{SETTINGS,validate,prepare,growth,oldGrowth,enabled,V,point,signature,domain,earClearance,frozenGrowth}from'../src/BoundaryKernel.mjs';import{makeRoots as makeOldRoots}from'../src/LegacyFoundation.mjs';
import{prepare as prepareF02}from'../src/F02Boundary.mjs';
const p=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),f01=process.env.HAIR_F01||path.resolve(p,'../f01'),head=JSON.parse(zlib.gunzipSync(fs.readFileSync(f01+'/site/head.json.gz'))),checks=[],test=(name,pass,detail=null)=>{checks.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail??'');};
const t=performance.now(),s=prepare(head),old=makeOldRoots(head),before=JSON.stringify(s.roots),verts=Array.from({length:head.positions.length/3},(_,i)=>V(head.positions,i)),front=verts.filter(p=>Math.abs(Math.atan2(p[0],p[2]-.015))<=.6);test('native head unchanged',head.positions.length===17821*3&&head.triangles.length===35324*3);test('exact F01 root bank prefix',JSON.stringify(s.roots.slice(0,2400))===JSON.stringify(old));test('exact frontal field retained',front.every(p=>growth(p)===oldGrowth(p)),front.length);test('frontal unchanged at edit limits',front.every(p=>growth(p,{...SETTINGS,earTopMM:-1,sideburnMM:-4,napeMM:-4})===oldGrowth(p)));
test('barycentric bindings valid',s.roots.every(r=>r.b.every(x=>x>=-1e-8)&&Math.abs(r.b.reduce((a,b)=>a+b)-1)<1e-7&&point(head,r.f,r.b).every((x,i)=>Math.abs(x-r.p[i])<1e-9)));
test('no active roots outside actual field',s.roots.filter(r=>enabled(r)).every(r=>growth(r.p)>=-1e-8));test('boundary reads exact same field',s.domain.boundary.every(r=>Math.abs(growth(r.p))<1e-6));
const areas={temple:p=>p[1]<.312&&p[1]>.282&&p[2]>.032&&p[2]<.046,aboveEar:p=>p[1]>.307&&p[1]<.324&&p[2]>0&&p[2]<.024,behindEar:p=>p[1]>.24&&p[1]<.285&&p[2]<-.010&&p[2]>-.031,nape:p=>p[1]>.222&&p[1]<.246&&p[2]<-.029};
for(const[name,fn]of Object.entries(areas)){const fresh=s.roots.filter(r=>enabled(r)&&fn(r.p)),prior=old.filter(r=>oldGrowth(r.p)>=0&&fn(r.p));test(name+' gains actual growth roots',fresh.length>prior.length&&fresh.length>5,{new:fresh.length,old:prior.length});}
let ears=verts.filter(p=>Math.abs(p[0])>.084&&p[1]>.241&&p[1]<.300&&p[2]>.002&&p[2]<.033);test('protruding auricle excluded',ears.length>25&&ears.every(p=>growth(p)<0),{tested:ears.length,inside:ears.filter(p=>growth(p)>=0).length});test('face cheek and lower neck excluded',[[.07,.273,.067],[0,.30,.12],[0,.19,-.03]].every(p=>growth(p)<0));test('lowered density is stable subset',s.roots.filter(r=>enabled(r,{...SETTINGS,density:.3})).every(r=>enabled(r))&&JSON.stringify(s.roots)===before);
for(const r of[{...SETTINGS,frontLocked:false},{...SETTINGS,napeMM:NaN},{...SETTINGS,topology:'bad'},{...SETTINGS,earTopMM:12}]){let bad=false;try{validate(r);}catch{bad=true;}test('invalid import rejected',bad);}
const d=domain(head,{...SETTINGS,napeMM:3});test('nape edit changes domain without resampling',Math.abs(d.area-s.domain.area)>1e-6&&JSON.stringify(s.roots)===before);test('new root bank repeatable',signature(prepare(head).roots.flatMap(r=>[r.f,...r.b]))===s.summary.bankSignature);
// F02.1 targeted regression: the old 211 protruding-vertex test missed the ear base.
const f02=prepareF02(head),baselineJSON=JSON.stringify(f02.roots);
test('all 3300 F02 root records unchanged',JSON.stringify(s.roots)===baselineJSON);
test('existing root-bank signature unchanged',s.summary.bankSignature==='a624b76f');
const earBridge=[2631,2710,2711,3006,3007,3010,4866,4974,8759,8838,8839,9134,9135,9138,10994,11102];
test('ear-base positive control catches F02 mistake',earBridge.every(i=>frozenGrowth(V(head.positions,i))>=0),earBridge);
test('all reported ear-base samples excluded now',earBridge.every(i=>growth(V(head.positions,i))<-.00001),earBridge.length);
for(const r of [{...SETTINGS},{...SETTINGS,earTopMM:-1,sideburnMM:-4,napeMM:-4},{...SETTINGS,earTopMM:2,sideburnMM:4,napeMM:4}]){
 test('ear guard survives supported edit extremes',earBridge.every(i=>growth(V(head.positions,i),r)<0),r);
}
const cutRoots=s.roots.filter(r=>frozenGrowth(r.p)>=0&&growth(r.p)<0);
test('only small ear patch removed',cutRoots.length>0&&cutRoots.length<66&&cutRoots.every(r=>earClearance(r.p)<0),cutRoots.length);
test('no new growth added anywhere',verts.every(p=>growth(p)<0||frozenGrowth(p)>=0));
test('sideburn body sample positions remain allowed', [2713,5037,8841,11165].every(i=>frozenGrowth(V(head.positions,i))>0&&growth(V(head.positions,i))>0));
let tested=0,mismatch=0,unexpected=0,changed=0;
for(let f=0;f<head.triangles.length/3;f++){
 if(head.triangles.slice(f*3,f*3+3).some(i=>head.components[i]!==0))continue;
 for(const b of [[1,0,0],[0,1,0],[0,0,1],[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]]){
  const p=point(head,f,b),a=frozenGrowth(p)>=0,c=growth(p)>=0;tested++;
  if(c&&!a)unexpected++;
  if(a!==c){changed++;if(earClearance(p)>=0)mismatch++;}
 }
}
test('dense native samples change only inside ear guard',tested>100000&&changed>0&&mismatch===0&&unexpected===0,{tested,changed,mismatch,unexpected});
test('less than one percent of accepted scalp removed',(f02.domain.area-s.domain.area)>0&&(f02.domain.area-s.domain.area)/f02.domain.area<.01,{oldCM2:f02.domain.area*1e4,newCM2:s.domain.area*1e4});
test('diagnostic sampling not complete follicle population',s.summary.diagnosticOnly===true&&s.summary.finalHairCount===null);
const report={success:checks.every(x=>x.pass),checks,summary:s.summary,totalMS:performance.now()-t,limits:['Local ear-base subtraction on the same native head','Other accepted F02 coverage retained; no physics advance','Sparse root samples, not full follicle population or final hair count']};fs.mkdirSync(p+'/evidence',{recursive:true});fs.writeFileSync(p+'/evidence/core.json',JSON.stringify(report,null,2));if(!report.success)process.exitCode=1;
