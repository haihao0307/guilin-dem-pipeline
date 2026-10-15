import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as T from '../../geometry-orbit-r01/vendor/three.module.js';
import {buildBureau,DESIGN} from '../model.mjs';
import {PASSAGE_PATHS,checkPassages,resolveElement} from '../spatial.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url)),base=path.resolve(dir,'..');
const built=buildBureau(),{root,elements,proof}=built;
const report={schema:'bureau-architecture-r02-cpu/1',commit:process.env.GITHUB_SHA||null,createdUtc:new Date().toISOString(),
  artisticAcceptance:false,engineeringCertification:false,checks:[],proof,
  limitations:['Sampled rays establish only the tested route bands and stair points; they do not establish a swept-volume walkability proof.',
    'Geometry contracts are not structural, fire, accessibility, historical accuracy or artistic approval.',
    'Roof tests cover specified joining bounds and monitor apertures, not every possible surface intersection.']};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
report.sourceHashes=Object.fromEntries(['model.mjs','construction.mjs','spatial.mjs','viewer.mjs'].map(name=>[name,hash(fs.readFileSync(path.join(base,name)))]));
function check(name,fn){try{const details=fn();report.checks.push({name,pass:true,...(details===undefined?{}:{details})});}catch(e){report.checks.push({name,pass:false,error:e.message});}}
const close=(a,b,t=1e-4)=>Math.abs(a-b)<=t;
function ray(a,b,{groups=null,layers=null,materials=null}={}){
 const start=new T.Vector3(...a),delta=new T.Vector3(...b).sub(start),r=new T.Raycaster(start,delta.clone().normalize(),1e-5,delta.length()-1e-5);
 const allowedBuckets=groups?new Set(elements.filter(e=>groups.includes(e.group)).map(e=>e.layer+':'+e.material)):null;
 return r.intersectObjects(root.children.filter(o=>!['site','routes'].includes(o.userData.layer)&&(!layers||layers.includes(o.userData.layer))&&(!materials||materials.includes(o.userData.material))&&(!allowedBuckets||allowedBuckets.has(o.name))),false)
  .map(hit=>({point:hit.point.toArray(),distance:hit.distance,object:hit.object.name,faceIndex:hit.faceIndex,element:resolveElement(hit,elements)}))
  .filter(hit=>(!groups||groups.includes(hit.element?.group))&&(!layers||layers.includes(hit.element?.layer))&&(!materials||materials.includes(hit.element?.material)));
}
function groupBounds(group){const es=elements.filter(e=>e.group===group);assert(es.length,'Missing group '+group);return{min:[0,1,2].map(i=>Math.min(...es.map(e=>e.bounds[0][i]))),max:[0,1,2].map(i=>Math.max(...es.map(e=>e.bounds[1][i]))),elements:es.length};}

check('preserved R01 source SHA-256',()=>{const actual=hash(fs.readFileSync(path.resolve(base,'../geometry-orbit-r01/model.mjs'))),expected='c667bec8cf107409d63e7571a85b9915dc55fb9696e370f26f9f21caac21af99';assert.equal(actual,expected,'Old rejected candidate model must remain unchanged');return{actual,expected};});
check('all declared 14 routes and 42 lateral probes are clear',()=>{
 report.passages=checkPassages(root,{elements});assert.equal(Object.keys(PASSAGE_PATHS).length,14);
 const samples=Object.entries(report.passages).flatMap(([name,p])=>p.samples.map(s=>({name,...s})));assert.equal(samples.length,42);
 report.blockedPassages=samples.filter(s=>s.hits>0);assert.equal(report.blockedPassages.length,0,JSON.stringify(report.blockedPassages));
 return{routes:14,rays:42,lateralOffsetsMetres:[0,-.35,.35],heightMetres:1.7,blocked:0};
});

check('all rendered buffer attributes are finite and triangle faces are non-degenerate',()=>{
 const badValues=[],badFaces=[];let total=0,minDoubleArea=Infinity;
 for(const mesh of root.children){
  assert(mesh.geometry?.isBufferGeometry,mesh.name+' has no buffer geometry');
  const g=mesh.geometry,a=g.attributes.position.array;assert.equal(a.length%9,0,mesh.name+' triangle count');
  assert.equal(g.attributes.normal.count,g.attributes.position.count,mesh.name+' normal count');
  for(const[name,attribute]of Object.entries(g.attributes))for(let i=0;i<attribute.array.length;i++)if(!Number.isFinite(attribute.array[i]))badValues.push({mesh:mesh.name,attribute:name,index:i,value:String(attribute.array[i])});
  for(let i=0;i<a.length;i+=9){
   const u=[a[i+3]-a[i],a[i+4]-a[i+1],a[i+5]-a[i+2]],v=[a[i+6]-a[i],a[i+7]-a[i+1],a[i+8]-a[i+2]];
   const twiceArea=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
   minDoubleArea=Math.min(minDoubleArea,twiceArea);total++;
   if(!(twiceArea>1e-10))badFaces.push({mesh:mesh.name,faceIndex:i/9,element:resolveElement({object:mesh,faceIndex:i/9},elements),points:Array.from(a.slice(i,i+9)),twiceArea});
  }
 }
 report.geometry={triangles:total,minimumDoubleArea:minDoubleArea,nonfiniteValues:badValues.length,degenerateFaces:badFaces.length,badValues:badValues.slice(0,20),badFaces:badFaces.slice(0,24)};
 assert.equal(total,proof.triangles);assert.equal(badValues.length,0,JSON.stringify(badValues.slice(0,8)));assert.equal(badFaces.length,0,JSON.stringify(badFaces.slice(0,8)));
 return report.geometry;
});

check('six tower stair flights have 90 supported treads and 2 m sampled headroom',()=>{
 const samples=[];
 for(let level=0;level<3;level++)for(let flight=0;flight<2;flight++)for(let tread=0;tread<15;tread++){
  const x=flight===0?-36.35:-34.65,start=flight===0?-23:-18.8,sign=flight===0?1:-1;
  const z=start+sign*(tread+.5)*.28,y=level*5.4+flight*2.7+(tread+1)*.18;
  const support=ray([x,y+.06,z],[x,y-.12,z],{groups:['tower-stair']});
  const headroom=ray([x,y+.04,z],[x,y+2.0,z]);
  samples.push({level,flight,tread,expected:[x,y,z],support:!!support.length&&close(support[0].point[1],y),supportFirst:support[0]??null,headroomHits:headroom.length,headroomFirst:headroom[0]??null});
 }
 report.stairTreads={samples:samples.length,failures:samples.filter(s=>!s.support||s.headroomHits>0)};
 assert.equal(samples.length,90);assert.equal(report.stairTreads.failures.length,0,JSON.stringify(report.stairTreads.failures.slice(0,16)));
 return{flights:6,treads:90,supportVerticalToleranceMetres:.0001,sampledHeadroomMetres:2.0};
});

check('tower half-landings and floor returns have continuous support',()=>{
 const samples=[];
 for(let level=0;level<3;level++){
  const halfY=level*5.4+2.7,topY=(level+1)*5.4;
  // First-flight tip / landing / second-flight start, sampled on both sides
  // of their common z=-18.8 boundary. No overlap/gap is inferred from metadata.
  for(const [label,x,z,y,groups]of[
   ['first-flight-end',-36.35,-18.82,halfY,['tower-stair']],
   ['half-landing-left',-36.35,-18.78,halfY,['tower-stair']],
   ['half-landing-center',-35.5,-18.05,halfY,['tower-stair']],
   ['half-landing-right',-34.65,-18.78,halfY,['tower-stair']],
   ['second-flight-start',-34.65,-18.82,halfY+.18,['tower-stair']],
   ['return-flight-end',-34.65,-22.98,topY,['tower-stair']],
   ['return-floor-right',-34.65,-23.02,topY,['tower-slabs']],
   ['return-floor-center',-35.5,-23.35,topY,['tower-slabs']],
   ['return-floor-left',-36.35,-23.02,topY,['tower-slabs']],
  ]){
   const hits=ray([x,y+.06,z],[x,y-.12,z],{groups});
   samples.push({level,label,expected:[x,y,z],pass:!!hits.length&&close(hits[0].point[1],y),first:hits[0]??null});
  }
 }
 report.stairLandings={samples:samples.length,failures:samples.filter(s=>!s.pass)};
 assert.equal(report.stairLandings.failures.length,0,JSON.stringify(report.stairLandings.failures));return{supportSamples:samples.length};
});

check('all three tower slabs leave the shared stair shaft open',()=>{
 const failures=[];let count=0;
 for(const y of DESIGN.tower.floors.slice(1))for(const x of[-36.35,-35.5,-34.65])for(const z of[-22.8,-20,-17.4]){
  const hits=ray([x,y+.4,z],[x,y-.4,z],{groups:['tower-slabs']});count++;if(hits.length)failures.push({point:[x,y,z],first:hits[0]});
 }
 report.shaftClearance={samples:count,failures};assert.equal(count,27);assert.equal(failures.length,0,JSON.stringify(failures));return{sampledOpenings:count};
});

check('public hall remains full-height without an upper floor slab',()=>{
 const failures=[];let count=0;
 for(const x of[-36.8,-34.5,-28.3])for(const z of[-7,5,20]){
  const hits=ray([x,1.5,z],[x,8.4,z],{layers:['upper-floors']});count++;if(hits.length)failures.push({x,z,first:hits[0]});
 }
 report.hallClearance={samples:count,failures};assert.equal(failures.length,0,JSON.stringify(failures));return{openVerticalSamples:count,topMetres:8.4};
});

check('tower, hall and south-wing high roofs have separate exact plan bounds',()=>{
 const west=groupBounds('west-wing-hip-roof'),tower=groupBounds('tower-hip-roof'),south=groupBounds('south-wing-hip-roof'),neck=groupBounds('tower-hall-low-connection');
 report.roofJunctions={west,tower,south,neck,declared:proof.junctions};
 assert(west.min[2]>=-10-1e-4,'Hall high roof extends into tower/neck interval');
 assert(tower.max[2]<=-14.45+1e-4,'Tower roof crosses its intended north edge');
 assert(south.max[2]<=-28+1e-4,'South-wing high roof enters tower interval');
 assert(neck.min[2]>=-12-1e-4&&neck.max[2]<=-10+1e-4,'Low neck footprint moved beyond tower-hall interval');
 assert(close(neck.max[1],5.0)&&neck.max[1]<DESIGN.tower.floors[1]&&neck.min[1]>=4.2,'Low neck roof blocks a 4.2 m door or reaches the upper floor');
 assert(west.min[1]>neck.max[1]&&tower.min[1]>west.max[1],'High roofs do not retain the intended height hierarchy');
 return report.roofJunctions;
});

check('hall roof structure stays below the actual roof underside',()=>{
 const roofByXZ=new Map(),failures=[];let vertices=0,minimumClearance=Infinity;
 for(const element of elements.filter(e=>e.group==='hall-roof-structure')){
  const mesh=root.children.find(o=>o.name===element.layer+':'+element.material),a=mesh.geometry.attributes.position.array;
  for(let v=element.start;v<element.start+element.count;v++){
   const [x,y,z]=[a[v*3],a[v*3+1],a[v*3+2]],key=x.toFixed(6)+','+z.toFixed(6);vertices++;
   if(!roofByXZ.has(key)){
    const hits=ray([x,40,z],[x,8,z],{groups:['west-wing-hip-roof']});
    roofByXZ.set(key,hits.length?Math.min(...hits.map(h=>h.point[1])):null);
   }
   const underside=roofByXZ.get(key),clearance=underside===null?null:underside-y;
   if(clearance!==null)minimumClearance=Math.min(minimumClearance,clearance);
   if(underside===null||clearance<-.0001)failures.push({element:element.id,point:[x,y,z],roofUnderside:underside,clearance});
  }
 }
 report.hallTrussRoof={vertices,distinctRoofSamples:roofByXZ.size,minimumClearance,failures:failures.slice(0,30),failureCount:failures.length};
 assert(vertices>0);assert.equal(failures.length,0,JSON.stringify(report.hallTrussRoof));
 return{vertices,distinctRoofSamples:roofByXZ.size,minimumClearance};
});

check('warehouse monitor slots are open below their canopy and have actual glazing',()=>{
 const samples=[],failures=[];
 for(let span=0;span<3;span++)for(const bay of[0,5,9]){
  const x=-14+span*24,z=-28+(bay+.5)*6.3;
  const opaqueSlot=ray([x,11.8,z],[x,13.1,z],{groups:['warehouse-roofs'],materials:['roof']});
  const canopy=ray([x,13.1,z],[x,14,z],{groups:['warehouse-roofs'],materials:['roof']});
  const westGlass=ray([x,12.8,z],[x-1.5,12.8,z],{groups:['warehouse-roofs'],materials:['glass']});
  const eastGlass=ray([x,12.8,z],[x+1.5,12.8,z],{groups:['warehouse-roofs'],materials:['glass']});
  const sample={span,bay,x,z,opaqueSlotHits:opaqueSlot.length,canopyHits:canopy.length,westGlassHits:westGlass.length,eastGlassHits:eastGlass.length,
   firstObstruction:opaqueSlot[0]??null};samples.push(sample);
  if(opaqueSlot.length||!canopy.length||!westGlass.length||!eastGlass.length)failures.push(sample);
 }
 report.monitorSlots={samples,failures};assert.equal(failures.length,0,JSON.stringify(failures));return{slots:3,longitudinalSamplesPerSlot:3,totalRays:36};
});

check('warehouse usable-area claim is explicitly measured and uncertified',()=>{
 assert.equal(proof.warehouse.allocation,4536);assert(proof.warehouse.measuredColumnFootprint>0);assert(close(proof.warehouse.remainingArea,proof.warehouse.allocation-proof.warehouse.measuredColumnFootprint));
 assert(proof.warehouse.remainingArea>=4500);assert.equal(proof.warehouse.rackCapacityCertified,false);assert.equal(proof.artisticAcceptance,false);assert.equal(proof.engineeringCertification,false);return proof.warehouse;
});

report.passed=report.checks.every(c=>c.pass);report.status=report.passed?'cpu-contracts-passed-browser-and-visual-review-pending':'failed';
const out=process.env.GITHUB_ACTIONS?path.resolve('bureau-r03f-public-preview-results'):dir;fs.mkdirSync(out,{recursive:true});
const filename=path.join(out,'architecture-r02-cpu-receipt.json');fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');
for(const c of report.checks)console.log((c.pass?'PASS':'FAIL')+' '+c.name+(c.pass?'':'\n'+c.error));
console.log('CPU_RECEIPT',filename,'RESULT',report.status);
if(!report.passed)process.exitCode=1;
