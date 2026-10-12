import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 PLATFORM_EDGE_CONTRACT,PLATFORM_EDGE_FRAME,platformEdgeSourceMembers,
 platformEdgeMembers,platformEdgeRowMembers,platformEdgeSample,
 platformEdgeRowSample,platformEdgeRowSampleFolded,platformEdgeBounds,
 platformEdgeSourceToStation,platformEdgeStationToSource,
 platformEdgeMaterialDirection,platformEdgeWGSL,
} from '../../native-platform-edge.mjs';
import {scanWGSLIdentifiers} from '../wgsl-identifiers.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./platform-edge-source-r02.json',import.meta.url),'utf8'));
const close=(a,b,tol=2e-10)=>{if(Array.isArray(a)){assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i],tol));}else assert(Math.abs(a-b)<=tol,JSON.stringify({a,b,tol}));};
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const host={centers:[-30,-10,8.86985,30],halfWidths:[3.4,3.4,2.2801500000000003,3.4],eaveCenters:[-30,-10,10,30]};
const row={row:2,center:host.centers[2],halfWidth:host.halfWidths[2],eaveCenter:10};
const parts=platformEdgeMembers(host);
const localPoint=(m,q)=>add(m.materialOrigin,platformEdgeSourceToStation(q));
const sdfBox=(p,center,extent)=>{const q=p.map((v,i)=>Math.abs(v-center[i])-extent[i]);return Math.hypot(...q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0);};

test('all 44 eave and 592 coping children match the exact 8504-part frozen source',()=>{
 assert.equal(fixture.actualExpandedRecipePartCount,8504);assert.equal(fixture.parts.length,636);
 const restored=platformEdgeSourceMembers(fixture.parameters);assert.equal(restored.length,636);
 assert.equal(restored.filter(m=>m.family==='eave').length,44);assert.equal(restored.filter(m=>m.family==='coping').length,592);
 const byId=new Map(restored.map(m=>[m.id,m]));assert.equal(byId.size,636);
 for(const original of fixture.parts){const m=byId.get(original.id);assert(m,original.id);assert.equal(m.materialRole,original.surface.role);assert.equal(m.feature,original.surface.feature);assert.equal(m.contact,original.surface.contact);assert.equal(m.sourceShape.type,original.shape.type);
  for(const[k,value]of Object.entries(original.shape)){if(k!=='type')typeof value==='number'?close(m.sourceShape[k],value):close(m.sourceShape[k],value);}
  close(m.metricFrame.origin,original.surface.metricFrame.origin);close(m.metricFrame.axis,original.surface.metricFrame.axis);
 }
 const last=restored.filter(m=>m.family==='coping'&&m.index===73);assert.equal(last.length,8);for(const m of last)close(m.sourceShape.size,[.394,.09,.28]);
});

test('material provenance explicitly distinguishes R02 concrete KST from current id-2 stone',()=>{
 assert.equal(fixture.sourceRoleBinding['platform-stone'],'concrete KST');assert.equal(fixture.currentRoleBinding['platform-stone'].materialId,2);
 assert.match(PLATFORM_EDGE_CONTRACT.materialBinding,/concrete KST/);assert.match(PLATFORM_EDGE_CONTRACT.materialBinding,/adaptation/);
 for(const m of parts){assert.equal(m.seed,m.family==='eave'?152:79);assert.equal(m.materialId,m.family==='eave'?3:2);assert.equal(m.sourceMembership.component,m.id);assert.equal(m.sourceMembership.row,m.row);assert.equal(m.sourceMembership.segment,m.index);}
});

test('R04 adapts all bays and both coping courses, retaining the clipped back-end block',()=>{
 assert.equal(parts.filter(m=>m.family==='eave').length,72);assert.equal(parts.filter(m=>m.family==='coping').length,920);assert.equal(parts.length,992);
 for(let r=0;r<4;r++)for(const side of[-1,1]){
  const course=parts.filter(m=>m.family==='coping'&&m.row===r&&m.side===side);assert.equal(course.length,115);
  const first=course[0],last=course.at(-1);close(first.center[2]+first.stationExtent[2],-8.7);close(last.center[2]-last.stationExtent[2],-146.3+.006);close(last.sourceShape.size[0],.794);
  for(const m of course){close(m.center[1]+m.stationExtent[1],.85);close(m.center[1]-m.stationExtent[1],.76);close(m.stationExtent[0]*2,.28);close(m.center[0],host.centers[r]+side*(host.halfWidths[r]-.14));}
  for(let i=0;i<course.length-1;i++)close(course[i].center[2]-course[i].stationExtent[2]-(course[i+1].center[2]+course[i+1].stationExtent[2]),.006);
 }
 const board=parts.filter(m=>m.family==='coping'&&m.row===2);close(Math.min(...board.map(m=>m.center[0]-.14)),6.5897);close(Math.max(...board.map(m=>m.center[0]+.14)),11.15);
 assert(parts.filter(m=>m.family==='eave'&&m.row===2).every(m=>m.center[0]===10));
});

test('all longitudinal eaves retain .20 vertical / .26 transverse and exact touching bay joints',()=>{
 for(let row=0;row<4;row++){
  const a=parts.filter(m=>m.family==='eave'&&m.row===row);assert.equal(a.length,18);
  for(const m of a){close(m.stationExtent,[.13,.10,3.75]);close(m.center[1],9.25);}
  close(a[0].center[2]+3.75,-10);close(a.at(-1).center[2]-3.75,-145);
  for(let i=0;i<a.length-1;i++){const z=a[i].center[2]-3.75;close(z,a[i+1].center[2]+3.75);const p=[a[i].center[0],9.25,z];close(platformEdgeSample(a[i],p).d,0);close(platformEdgeSample(a[i+1],p).d,0);}
 }
});

test('proper material rotation has no reflection and preserves source origin, metric and normal',()=>{
 close(dot(cross(PLATFORM_EDGE_FRAME[0],PLATFORM_EDGE_FRAME[1]),PLATFORM_EDGE_FRAME[2]),1);
 for(const p of[[3,4,-7],[-.1,.6,.9],[1,0,0]])close(platformEdgeStationToSource(platformEdgeSourceToStation(p)),p);
 for(const m of parts){const q=[.023,-.017,.019];close(platformEdgeSample(m,localPoint(m,q)).q,q);}
 close(platformEdgeMaterialDirection([1,0,0]),[0,0,1]);close(platformEdgeMaterialDirection([0,0,-1]),[1,0,0]);
 const eave=parts.find(m=>m.family==='eave');close(platformEdgeSample(eave,eave.center).q,[3.75,0,0]);
 const coping=parts.find(m=>m.family==='coping');close(platformEdgeSample(coping,coping.center).q,[0,0,0]);
});

test('coping voids and clipped tail are real signed distance fields, not broad edge proxies',()=>{
 const a=platformEdgeRowMembers(row).filter(m=>m.family==='coping'&&m.side===-1),first=a[0],second=a[1];
 const gapZ=(first.center[2]-first.stationExtent[2]+second.center[2]+second.stationExtent[2])/2;
 const gap=[first.center[0],first.center[1],gapZ];close(Math.min(...a.map(m=>platformEdgeSample(m,gap).d)),.003);
 close(platformEdgeSample(first,first.center).d,-.045);const tail=a.at(-1);assert(platformEdgeSample(tail,tail.center).d<0);
 assert(platformEdgeSample(tail,[tail.center[0],tail.center[1],-146.301]).d>0);
 assert(platformEdgeSample(first,[first.center[0]-.141,first.center[1],first.center[2]]).d>0);
});

test('physical competition occurs before inner union, preserving the displaced winner raw field and identity',()=>{
 const a=platformEdgeRowMembers(row).filter(m=>m.family==='coping'&&m.side===-1),left=a[0],right=a[1];
 const joint=(left.center[2]-left.stationExtent[2]+right.center[2]+right.stationExtent[2])/2;
 const p=[left.center[0],left.center[1],joint+.001];
 const raw=platformEdgeRowSample(p,row),physical=platformEdgeRowSample(p,row,(h)=>h.baseD-(h.family==='coping'&&h.index===1?.004:0));
 assert.equal(raw.index,0);assert.equal(physical.index,1);assert(physical.d<raw.d);assert(physical.baseD>raw.baseD);
 assert.equal(physical.sourceId,right.id);assert.equal(physical.sourceSeed,right.member);close(physical.q,platformEdgeSample(right,p).q);
});

test('eave and coping enclosure helpers include all raw and physical children and are bound-only id 0',()=>{
 for(let r=0;r<4;r++){
  const opt={row:r,center:host.centers[r],halfWidth:host.halfWidths[r],eaveCenter:host.eaveCenters[r]},bounds=platformEdgeBounds(opt),rowParts=parts.filter(m=>m.row===r);
  assert.equal(bounds.union.materialId,0);assert.equal(bounds.union.boundOnly,true);
  for(const m of rowParts){const b=m.family==='eave'?bounds.eaves:bounds.copings[m.side<0?0:1];assert.equal(b.materialId,0);assert(b.boundOnly);
   for(let k=0;k<3;k++){assert(m.center[k]-m.stationExtent[k]-.03001>=b.min[k]-1e-10);assert(m.center[k]+m.stationExtent[k]+.03001<=b.max[k]+1e-10);}
  }
 }
});

test('three-cell station-contract fold equals exhaustive physical union across joints, tails, near and far queries',()=>{
 let random=19160328;const rand=()=>{random=(1664525*random+1013904223)>>>0;return random/2**32;};
 const physical=(h,p)=>Math.abs(h.baseD)<.045?h.baseD+(h.id===2?-.004*Math.sin(h.q[0]*4.9+h.q[2]*6.1+h.sourceSeed*.7):.0008*(.5+.5*Math.cos(h.q[0]*3.3+h.sourceSeed))):Math.sign(h.baseD)*Math.max(Math.abs(h.baseD)-.03,0);
 const samples=[[row.center,.85,-8.7],[row.center,.85,-146.3],[10,9.25,-17.5],[row.center,1000,-78],[1000,1,-78]];
 for(let i=0;i<300;i++){const eave=i%3===0,side=i%2?-1:1,index=Math.floor(rand()*(eave?18:115)),z=(eave?-10-index*7.5:-8.7-index*1.2)+(rand()-.5)*.2;
  samples.push([eave?10+(rand()-.5)*.5:row.center+side*(row.halfWidth-.14)+(rand()-.5)*.4,eave?9.25+(rand()-.5)*.35:.805+(rand()-.5)*.2,z]);
 }
 for(let i=0;i<80;i++)samples.push([(rand()-.5)*100,(rand()-.5)*50,-250+rand()*400]);
 for(const p of samples){const exhaustive=platformEdgeRowSample(p,row,physical),folded=platformEdgeRowSampleFolded(p,row,physical);close(exhaustive.d,folded.d,1e-10);assert.equal(exhaustive.sourceId,folded.sourceId,JSON.stringify(p));}
});

test('WGSL exports row candidates, raw/physical data, frame and bound helpers without adding floor or textures',()=>{
 const code=platformEdgeWGSL({materialDistance:'stationPlatformEdgePhysicalDistance'}),folded=platformEdgeWGSL({materialDistance:'stationPlatformEdgePhysicalDistance',stationDistanceContract:true});
 assert.deepEqual(scanWGSLIdentifiers(code),[]);assert.deepEqual(scanWGSLIdentifiers(folded),[]);
 for(const token of['completeStationPlatformEdgeRow','stationPlatformEdgeRawWinner','stationEaveMemberAt','stationCopingMemberAt','stationPlatformEdgeRowBound','frame:mat3x3<f32>','baseD:f32','sourceSeed:f32','h.d=stationPlatformEdgePhysicalDistance(h,p)','let width=min(1.2,front-','-.006','2u,79.','3u,152.'])assert(code.includes(token),token);
 assert(folded.includes('cell-1'));assert(folded.includes('cell+1'));assert(code.includes('let last=114u'));
 assert(!/\b17u\s*,/.test(code));
 assert(code.includes('return HitField(h.baseD,h.id,h.q,h.seed,h.baseD,h.extent,h.sourceSeed)'));
 for(const token of['textureSample','sampler','vertexBuffer','BufferGeometry','THREE.','skipFloor'])assert(!code.includes(token)||token==='skipFloor'&&code.includes('skipFloor is irrelevant'));
});

test('invalid datums are rejected instead of clipping or producing a zero/negative final child',()=>{
 assert.throws(()=>platformEdgeRowMembers({halfWidth:.2}));assert.throws(()=>platformEdgeRowMembers({back:-10,front:-145}));assert.throws(()=>platformEdgeRowMembers({bay:8}));
 assert.throws(()=>platformEdgeWGSL({materialDistance:'not valid'}));assert.throws(()=>platformEdgeMembers({centers:[0],halfWidths:[3.4,3.4]}));
});
