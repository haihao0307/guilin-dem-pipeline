import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {GNMHeadModel,parseContainer} from '../src/GNMModel.js';import {makeRootSet,SkinField,compileGroom} from '../src/LengthKernel.js';
const p=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),raw=zlib.gunzipSync(fs.readFileSync(p+'/../r12/assets/gnm_head_web.bin.gz'));assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961');
const c=parseContainer(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),model=new GNMHeadModel(c.meta,c.sections),roots=makeRootSet(model,8000),skin=new SkinField(model),report={success:false,scope:'8k-root computational fixture on actual GNM, not browser pixels or full swept-radius collision',checks:[],cases:[]};
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name)};
const a=[-.08331507444381714,.29511758685112,.026777341961860657],b=[-.08226785063743591,.2915591895580292,.02363542467355728];
check('frozen first-iteration chord really intersects ear',!!skin.bvh.segmentHit(a,b));const ear=skin.earGuard.ears[0],d=skin.earGuard.need(a,b,ear),aa=[a[0]-d,a[1],a[2]],bb=[b[0]-d,b[1],b[2]];
check('measured ear envelope clears the same frozen chord',d>0&&!skin.bvh.segmentHit(aa,bb));report.counterexample={sourceRevision:'3f90ca92837dadb544e756adf1a5c62cdbe14c26',fixtureRoots:8000,rootId:6630,segment:12,a,b,lateralCorrection:d};
report.nonEarCounterexamples=[];
for(const [a,b]of [[[-.057458050549030304,.32340845465660095,.09518004953861237],[-.0405089408159256,.30313578248023987,.10530152171850204]],[[.022876376286149025,.39983075857162476,.05482549965381622],[.04424764961004257,.3868468701839447,.059711407870054245]]]){
 const hit=skin.bvh.segmentHit(a,b),points=[a.slice(),a.slice(),b.slice()];check('frozen non-ear chord has a real triangle crossing',!!hit);skin.headGuard.apply(points);check('original-head chord guard clears contact and keeps root fixed',points[0].every((v,k)=>v===a[k])&&points.slice(1).every((p,i)=>!skin.bvh.segmentHit(points[i],p)));report.nonEarCounterexamples.push({sourceRevision:'20667efeba5e947953b1e4d2e4378d48afdf609a',a,b,triangle:hit.triangle,corrected:points});
}
for(const style of ['textured-fringe','side-flow','curtain-layer'])for(const lengthMM of [55,160]){
 const r=await compileGroom(roots,skin,{style,lengthMM});let inside=0,crossings=0,minGap=Infinity,total=0;
 for(let i=0;i<r.count;i+=10)for(let j=1;j<r.per;j++){const q=(i*r.per+j)*3,p=Array.from(r.curves.subarray(q,q+3)),prev=Array.from(r.curves.subarray(q-3,q)),h=skin.bvh.nearest(p),gap=p.reduce((s,v,k)=>s+(v-h.p[k])*h.n[k],0);minGap=Math.min(minGap,gap);if(gap<0)inside++;if(skin.bvh.segmentHit(prev,p))crossings++;total++;}
 report.cases.push({style,lengthMM,rootHash:r.rootHash,maxRootOffset:r.maxRootOffset,stats:r.stats,earGuard:r.earGuard,headGuard:r.headGuard,sampledStrands:800,sampledSegments:total,inside,crossings,minGap});
 check(style+' '+lengthMM+'mm finite actual curves',r.curves.every(Number.isFinite));check(style+' '+lengthMM+'mm stable surface roots',r.maxRootOffset<.000021);check(style+' '+lengthMM+'mm sampled vertices and segments clear',inside===0&&crossings===0);
}
report.success=true;fs.mkdirSync(p+'/evidence',{recursive:true});fs.writeFileSync(p+'/evidence/length-boundaries.json',JSON.stringify(report,null,2));
