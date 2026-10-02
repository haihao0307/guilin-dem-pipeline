import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url), B=require('../src/behavior.js');
const rows=[], failures=[];
const check=(label,fn)=>{try{rows.push({label,pass:true,...fn()});console.log('PASS '+label);}catch(error){failures.push({label,error:error.message});rows.push({label,pass:false,error:error.message});console.log('FAIL '+label+': '+error.message);}};
const finite=(value)=>{if(typeof value==='number') assert.ok(Number.isFinite(value),'finite numeric state');else if(Array.isArray(value)) value.forEach(finite);else if(value&&typeof value==='object') Object.values(value).forEach(finite);};
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const groupRadius=s=>{const centroid=[0,0,0];s.actors.forEach(a=>a.position.forEach((v,k)=>centroid[k]+=v/s.count));return s.actors.reduce((sum,a)=>sum+distance(a.position,centroid),0)/s.count;};
for(const id of Object.keys(B.profiles)) {
  check(id+' actual source-fin and transported vertex containment',()=>{
    const file=new URL('../data/'+id+'.score.json.gz',import.meta.url);assert.ok(fs.existsSync(file),'actual source score required for containment');
    const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(file))),s=B.create(id,1,444);let worst=-Infinity;
    const kind=f=>/caud|tail/.test(f.kind)?'caudal':/anal/.test(f.kind)?'anal':/dors/.test(f.kind)?'dorsal':/pelv/.test(f.kind)?'pelvic':/right/.test(f.kind)?'pectoralRight':'pectoralLeft';
    for(let phase=0;phase<24;phase++){
      B.update(s,.25,{mode:phase<8?'burst':phase<16?'turn':'hover'});const a=s.actors[0],curve=B.sampleSpine(a,id),half=B.collisionBox(a,s).half;
      for(const primitive of data.primitives)for(let i=0;i<primitive.positions.length/3;i++){
        let point=primitive.positions.slice(i*3,i*3+3),fid=primitive.finId?.[i]||0,weight=primitive.finWeight?.[i]||0;
        if(fid&&weight){const f=data.rig.fins.find(f=>f.id===fid),k=kind(f),wave=a.finWaves[k],spatial=id==='picasso'&&['dorsal','anal'].includes(k)?12:k==='caudal'?1.3:2;
          const theta=(wave.amplitude*Math.sin(wave.phase+spatial*(point[0]-f.root[0]))+wave.bias)*weight,axis=f.axis,l=Math.hypot(...axis),n=axis.map(v=>v/l),p=point.map((v,j)=>v-f.root[j]),c=Math.cos(theta),si=Math.sin(theta),d=p.reduce((v,x,j)=>v+x*n[j],0),cross=[n[1]*p[2]-n[2]*p[1],n[2]*p[0]-n[0]*p[2],n[0]*p[1]-n[1]*p[0]];point=p.map((v,j)=>f.root[j]+v*c+cross[j]*si+n[j]*d*(1-c));
        }
        const final=B.deform(point,a,id,curve);worst=Math.max(worst,...final.map((v,k)=>Math.abs(v)-half[k]));
      }
    }
    assert.ok(worst<=1e-7,'source collision envelope contains all deformed original vertices');return {phases:24,maxEnvelopeViolation:worst,vertices:data.primitives.reduce((n,p)=>n+p.positions.length/3,0)};
  });
  check(id+' deterministic 120-second multi-mode 30-member simulation',()=>{
    const a=B.create(id,30,73), b=B.create(id,30,73), p=B.profiles[id];let maxTurn=0,maxStep=0,maxRadius=0,minClearance=Infinity,maxContactCorrection=0;
    for(let frame=0;frame<7200;frame++) {
      const mode=['cruise','burst','turn','rest','hover'][Math.floor(frame/1440)], input={mode,pointer:frame>1900&&frame<2150?[0,0,0]:null};
      const before=a.actors.map(x=>x.yaw);B.update(a,1/60,input);B.update(b,1/60,input);
      a.actors.forEach((actor,i)=>{maxTurn=Math.max(maxTurn,Math.abs(actor.turnRate));maxStep=Math.max(maxStep,Math.abs(Math.atan2(Math.sin(actor.yaw-before[i]),Math.cos(actor.yaw-before[i]))));maxRadius=Math.max(maxRadius,Math.hypot(...actor.position));});
      minClearance=Math.min(minClearance,a.contact.minimumClearance);maxContactCorrection=Math.max(maxContactCorrection,a.contact.maxCorrection);
      if(frame%120===0) finite(B.snapshot(a));
    }
    assert.deepEqual(B.snapshot(a),B.snapshot(b)); assert.ok(maxTurn<=p.maxTurn+1e-9);assert.ok(maxStep<=p.maxTurn/60+1e-9);assert.ok(maxRadius<11,'swarm remains in bounded exhibit volume');
    assert.ok(new Set(a.actors.map(x=>x.beatPhase.toFixed(4))).size>20,'independent beat phases');
    assert.ok(new Set(a.actors.map(x=>x.eyes.yaw.toFixed(5))).size>20,'independent eye clocks');
    const physicalClearance=minClearance+a.shape.gap;
    assert.ok(physicalClearance>=a.shape.gap*.5,'source-enclosing boxes retain positive clearance');assert.ok(maxContactCorrection<=3.5/60+1e-8,'contact correction is bounded, no large teleport');
    return {seconds:120,count:30,maxTurn,maxYawStep:maxStep,maxWorldRadius:maxRadius,minSourceBoxClearance:physicalClearance,desiredClearance:a.shape.gap,solverGapResidual:minClearance,maxContactCorrection};
  });
  check(id+' arc length, head stability and continuous transported surface',()=>{
    const s=B.create(id,1,81),a=s.actors[0];B.update(s,2,{mode:'burst'});const curve=B.sampleSpine(a,id,129);
    let arclength=0, maxOrtho=0;for(let i=0;i<129;i++){finite(curve.centers[i]);maxOrtho=Math.max(maxOrtho,Math.abs(curve.tangents[i].reduce((v,x,k)=>v+x*curve.binormals[i][k],0)));if(i)arclength+=distance(curve.centers[i],curve.centers[i-1]);}
    assert.ok(Math.abs(arclength-1)<1e-10);assert.ok(maxOrtho<1e-12);assert.deepEqual(curve.centers[0],[-.5,0,0]);
    for(let u=0;u<=1;u+=.013){const first=B.deform([u-.5,.05,.07],a,id,curve),second=B.deform([u-.5+1e-7,.05,.07],a,id,curve);assert.ok(distance(first,second)<3e-7,'no segment cracks');}
    const zero={...a,amplitude:0,turnRate:0};const neutral=B.sampleSpine(zero,id);
    for(const v of [[-.5,0,.1],[0,.1,.2],[.5,0,-.1]]) assert.ok(distance(v,B.deform(v,zero,id,neutral))<1e-12,'neutral reproduces original rest surface');
    return {arclength,maxOrtho};
  });
  check(id+' cursor threat increases distance and regroup is autonomous',()=>{
    const a=B.create(id,30,199),control=B.create(id,30,199);for(let f=0;f<180;f++){B.update(a,1/60);B.update(control,1/60);}
    const target=a.actors[0].position.slice();const initial=distance(a.actors[0].position,target);
    for(let f=0;f<90;f++){B.update(a,1/60,{pointer:target});B.update(control,1/60);}
    const avoided=distance(a.actors[0].position,target),noPointer=distance(control.actors[0].position,target);assert.ok(avoided>initial+.08);assert.ok(a.actors.some(x=>x.threat>.1),'threat activates without teleporting');
    const disturbed=groupRadius(a);for(let f=0;f<1800;f++)B.update(a,1/60);const settled=groupRadius(a);
    assert.ok(a.actors.every(x=>x.threat<1e-5),'sensor release decays');assert.ok(settled<3.8,'school regroups into finite coherent volume');
    return {cursorDistance:avoided,controlDistance:noPointer,disturbedRadius:disturbed,regroupRadius:settled};
  });
}
check('Picasso low-speed dorsal/anal locomotion and burst body recruitment',()=>{
  const rest=B.create('picasso',1,44),burst=B.create('picasso',1,44);let dorsal=0,anal=0;
  for(let i=0;i<600;i++){B.update(rest,1/60,{mode:'hover'});B.update(burst,1/60,{mode:'burst'});dorsal=Math.max(dorsal,Math.abs(rest.actors[0].finAngles.dorsal));anal=Math.max(anal,Math.abs(rest.actors[0].finAngles.anal));}
  assert.ok(dorsal>.25&&anal>.25);assert.ok(burst.actors[0].amplitude>rest.actors[0].amplitude*3);
  return {dorsal,anal,hoverBodyAmplitude:rest.actors[0].amplitude,burstBodyAmplitude:burst.actors[0].amplitude};
});
check('Large frame gap bounded and reset is exact',()=>{const a=B.create('herring',1,16),initial=B.snapshot(a);B.update(a,3,{mode:'burst'});assert.ok(a.time<=.500001);B.reset(a);assert.deepEqual(B.snapshot(a),initial);B.update(a,NaN);finite(B.snapshot(a));return {};});
const sourceHashes=Object.fromEntries(['../src/behavior.js',...Object.keys(B.profiles).map(id=>'../data/'+id+'.score.json.gz')].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex')]));
const report={schema:'fish.behavior-verification/2',taskId:'FISH_UNIFIED_SURFACE_MOTION_R02_20261002',createdAt:new Date().toISOString(),pass:failures.length===0,sourceHashes,tests:rows,failures,scope:'Numerical locomotion/behavior and source-enclosing collision constraints only; not independent visual/species/production acceptance',visualAcceptance:false,productionReady:false};
const dest=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1')),'../evidence/R02_BEHAVIOR_REPORT.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,tests:rows.length,failures},null,2));if(failures.length)process.exitCode=1;
