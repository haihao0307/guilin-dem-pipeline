import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
 sourceTerminalHall,terminalHallMembers,terminalHallPlan,terminalHallWGSL,
 terminalHallBounds,terminalHallFloorBounds,terminalHallMemberBounds,terminalHallMaterialPadding,terminalHallMemberPoint,
 terminalHallMemberSample,createTerminalHallSampler,hallToStation,stationToHall,
 HALL_SOURCE_HASH,HALL_SOURCE_COMMIT,HALL_MATERIAL_ENVELOPE,HALL_CONSTRUCTION_DECISIONS,terminalHallContinuity,
} from '../../native-terminal-hall.mjs';
import { scanWGSLIdentifiers } from '../wgsl-identifiers.mjs';
import { STATION_SCORE } from '../../station-score.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./hall-source-r02.json',import.meta.url)));
const clean=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,e=1e-10)=>assert(Math.abs(a-b)<e,`${a} differs from ${b}`);
const vector=(a,b,e=1e-10)=>a.forEach((v,i)=>near(v,b[i],e));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const current=terminalHallMembers({...STATION_SCORE.hall,deck:.85}),source=terminalHallMembers({mode:'source'});
const sample=createTerminalHallSampler({...STATION_SCORE.hall,deck:.85});
const part=id=>{const m=current.parts.find(p=>p.id===id);assert(m,id);return m;};
const at=(v,y,u)=>hallToStation([v,y,u]);
const pd=(id,v,y,u)=>terminalHallMemberSample(part(id),at(v,y,u),current.plan).d;
const isAir=(p,message)=>assert(sample(p).d>1e-5,`${message}: ${JSON.stringify(sample(p))}`);
const isSolid=(p,message)=>assert(sample(p).d<-1e-6,`${message}: ${JSON.stringify(sample(p))}`);

test('frozen source mode reproduces all 569 descriptors and the exact title anchor, not just counts',()=>{
 assert.equal(fixture.sourceCommit,HALL_SOURCE_COMMIT);assert.equal(fixture.sha256,HALL_SOURCE_HASH);
 const actual=clean(sourceTerminalHall());assert.deepEqual(actual.parts,fixture.parts);assert.deepEqual(actual.anchors,fixture.anchors);
 assert.equal(actual.parts.length,569);assert.equal(new Set(actual.parts.map(p=>p.id)).size,569);assert.equal(fixture.families.length,25);
 for(const f of fixture.families){const members=source.parts.filter(m=>m.sourceFamily===f.name);assert.equal(members.length,f.count,f.name);assert.deepEqual(members.map(m=>m.sourceId),f.ids,f.name);}
 for(const old of fixture.parts){const m=source.parts.find(p=>p.id===old.id);assert.deepEqual(clean(m.shape),old.shape,old.id);assert.deepEqual(clean(m.surface),old.surface,old.id);assert.equal(m.sourceId,old.id);}
});

test('frozen source inventory remains independently verifiable where the accepted source checkout is available',async(t)=>{
 let url=new URL('../../../kowloon-station-r03/restored/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-station-r02/terminal-architecture.mjs',import.meta.url);
 // The portable fixture remains the gate in a standalone checkout; no network.
 if(!fs.existsSync(url))url=new URL('../../../kowloon-station-r02/terminal-architecture.mjs',import.meta.url);
 if(!fs.existsSync(url)){t.skip('Accepted source checkout absent; independent frozen fixture remains mandatory');return;}
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex'),HALL_SOURCE_HASH);
 const {terminalArchitecture}=await import(url.href),{stationPlan}=await import(new URL('./station-plan.mjs',url).href),fresh=terminalArchitecture(stationPlan(fixture.score));assert.equal(fresh.parts.length,1062);const ids=new Set(fixture.parts.map(p=>p.id));assert.deepEqual(clean(fresh.parts.filter(p=>ids.has(p.id))),fixture.parts);assert.deepEqual(fresh.anchors,fixture.anchors);
});

test('all source IDs have exactly one current target and explicit material ownership, with no implicit omissions',()=>{
 assert.equal(current.sourceCount,569);assert.equal(current.parts.length,593);assert.equal(new Set(current.parts.map(p=>p.id)).size,593);
 for(const old of fixture.parts){const all=current.parts.filter(p=>p.sourceId===old.id);assert.equal(all.length,1,old.id);const m=all[0];assert.deepEqual(m.sourceShape,old.shape);assert.deepEqual(m.sourceSurface,old.surface);assert(m.adaptation);assert(m.status);assert.equal(m.surface.role,old.surface.role);assert.equal(m.surface.feature,old.surface.feature);assert(Number.isInteger(m.member));assert(m.binding.physicalRole);assert(m.extent.every(x=>x>0));assert.deepEqual(clean(m.surface.metricFrame),clean(m.materialFrame));}
 const additions=current.parts.filter(m=>m.sourceId===null);assert.equal(additions.length,24);assert(additions.every(m=>m.id.startsWith('current-')&&m.adaptation&&m.status==='explicit-addition'));
 const repeat=additions.filter(m=>m.adaptation==='repeat-extensions');assert.equal(repeat.length,7);
 assert.equal(current.parts.filter(m=>m.sourceFamily==='hall-floor-joint'||m.id.startsWith('current-hall-floor-joint-')).length,29);
 assert.equal(current.parts.filter(m=>m.sourceFamily==='pierced-parapet'||m.id.startsWith('current-parapet-')).length,288);
 const missing=current.parts.filter(m=>m.binding.deferred);assert.deepEqual(missing.map(m=>m.id),['pediment-oculus']);assert.equal(missing[0].status,'optics-unresolved');
 assert(!current.parts.some(m=>/keystone|colonnade|end-wall/.test(m.id)));
});

test('current score drives the 60×16 hall, eight bays and separate lower/upper anchors',()=>{
 assert.equal(current.plan.width,STATION_SCORE.hall.width);assert.equal(current.plan.depth,STATION_SCORE.hall.depth);assert.equal(current.plan.eave,STATION_SCORE.hall.eave);near(current.plan.bay,7.5);near(current.plan.ridge,14.3);
 for(const side of['sea','rail']){
  for(let i=0;i<=8;i++){const m=part(side+'-wall-pier-'+i);near(m.shape.center[2],-30+i*7.5);near(m.shape.center[1]-m.shape.size[1]/2,.85);near(m.shape.center[1]+m.shape.size[1]/2,10.4);near(m.shape.size[1],9.55);}
  for(let i=0;i<8;i++){const m=part(side+'-arch-'+i);near(m.shape.center[2],-30+(i+.5)*7.5);near(m.shape.center[1],6.55);near(m.shape.radius,3.2);near(m.shape.width,.30);near(m.shape.depth,.77);}
 }
 near(part('portico-0-shaft').shape.height,8.35);near(part('portico-0-shaft').shape.radius,.44);assert.equal(part('portico-0-shaft').shape.flutes,20);near(part('portico-0-shaft').shape.depth,.022);
 const transformed=terminalHallMembers({width:62.5,depth:16,deck:1.05,eave:12.4});near(transformed.plan.ridge,14.7);near(transformed.parts.find(m=>m.id==='sea-arch-0').shape.radius,(62.5/8-1.1)/2);
 assert.throws(()=>terminalHallMembers({bays:7}));assert.throws(()=>terminalHallMembers({depth:18}));assert.throws(()=>terminalHallMembers({width:57}));assert.throws(()=>terminalHallMembers({eave:NaN}));
});

test('all eight rail bays are doors; exactly public bays 3/4 are lower doors, including wall thickness',()=>{
 for(let i=0;i<8;i++){const u=-30+(i+.5)*7.5;
  for(const dy of[.12,.7,1.5])for(const offset of[-.30,0,.30]){
   isAir(at(-8+offset,.85+dy,u),'rail door '+i);
   if(i===3||i===4)isAir(at(8+offset,.85+dy,u),'public door '+i);else isSolid(at(8+offset,.85+dy,u),'public lower wall '+i);
  }
  for(const v of[-8.25,-8,7.75,8,8.25])isAir(at(v,4,u),'window/arcade clear above sill '+i);
  for(const v of[-8,8])for(const du of[-.52,0,.52])isSolid(at(v,5,-30+i*7.5+du),'rectangular pier '+i);
 }
 for(const v of[-8,8])isSolid(at(v,5,30),'ninth pier');
 assert.equal(current.parts.filter(m=>m.sourceFamily==='hall-lower-wall').length,6);
});

test('forty fanlight bars and eight transoms are rectangular iron stock with unobstructed intervening air',()=>{
 const bars=current.parts.filter(m=>m.sourceFamily==='hall-fanlight-bar'),transoms=current.parts.filter(m=>m.sourceFamily==='hall-transom');assert.equal(bars.length,40);assert.equal(transoms.length,8);
 for(const m of [...bars,...transoms]){assert.equal(m.binding.id,3);assert.equal(m.kind,'box');near(m.extent[0]*2,m.shape.width);near(m.extent[2]*2,m.shape.depth);const h=terminalHallMemberSample(m,m.center,current.plan);assert(h.d<0);}
 for(let i=0;i<8;i++){const u=-30+(i+.5)*7.5;isSolid(at(8.08,7,u),'center fanlight '+i);isAir(at(8.08,7,u+.36),'between fanlights '+i);}
});

test('dedicated short-end portico opens through the old end-wall plane and preserves four six-profile columns',()=>{
 near(current.plan.porticoFront,30.9);
 for(const u of[29.5,30,30.5,30.9,31.5,32])for(const z of[-4.3,0,4.3])for(const y of[1.5,4,8])isAir(at(z,y,u),'entry route');
 for(let i=0;i<4;i++){const cols=current.parts.filter(m=>m.sourceFamily==='portico-column'&&m.id.startsWith('portico-'+i+'-'));assert.equal(cols.length,6);for(const m of cols)near(m.center[0],-30.9);isSolid(at(-6.45+i*4.3,4,30.9),'portico shaft');}
 isAir(at(0,9.95,30.9),'lintel headroom');isSolid(at(0,10.3,30.9),'entablature lintel');
 for(const z of[-7.3,7.3])isSolid(at(z,5,30),'brick return');
 assert.equal(current.parts.filter(m=>m.id.startsWith('return-band-')).length,28);
 const bands=current.parts.filter(m=>m.id.startsWith('return-band-1-'));near(bands[1].shape.center[1]-bands[0].shape.center[1],.62*(1+.45/8.9));assert(bands.every(m=>m.shape.size[1]===.10&&m.shape.size[2]===.14));
 vector(current.anchors[0].at,[-31.67,10.42,0]);assert.equal(current.anchors[0].text,'九龍  KOWLOON');assert.equal(current.anchors[0].axis,'x');
});

test('landing, four source treads, grounded bedding and road approach form a continuous route',()=>{
 for(let u=29.8;u<=32.5;u+=.025)isSolid(at(0,.849,u),'level threshold/landing/first tread');
 for(let i=0;i<4;i++){const top=.85-i*.22,u=32.35+i*.37;near(part('hall-entry-step-'+i).shape.center[1]+.11,top);isSolid(at(0,top-.001,u),'stair top');isSolid(at(0,-.05,u),'stair bedding');}
 for(let u=33.64;u<43.0;u+=.1)isSolid(at(0,-.001,u),'road approach');
 for(const x of[-30,-10,10,30])for(const dx of[-3.39,0,3.39])isSolid([x+dx,.849,-9],'all island mouth apron widths');
 isSolid([0,.849,-8.4],'apron to hall overlap');
});

test('source floor strips are floating, while current joints are 18×12 mm inset solids in actual cut slots',()=>{
 const old=source.parts.find(m=>m.sourceFamily==='hall-floor-joint');near(old.shape.center[1]-old.shape.size[1]/2,1.103);
 const host=part('concourse-foundation');for(let j=0;j<29;j++){const u=-30+.8+j*2.1,q=at(0,.844,u),h=sample(q);assert.equal(h.id,3);assert(/hall-floor-joint/.test(h.componentId));assert(h.d<0);assert(terminalHallMemberSample(host,q,current.plan).d>0);isAir(at(0,.853,u),'no floating overlay');isSolid(at(0,.83,u),'floor below slot');}
 near(host.shape.center[1]+host.shape.size[1]/2,.85);vector(host.shape.size,[17.6,1.4,62.4]);
});

test('current oculus is cut through masonry and the true torus/rebate retain air; glass is an explicit open gate',()=>{
 const ped=part('road-pediment'),ring=part('pediment-oculus-ring'),glass=part('pediment-oculus'),old=source.parts.find(p=>p.id==='road-pediment');
 assert.equal(old.shape.oculus,undefined);near(ped.shape.oculus.radius,.64);near(ring.shape.radius,.72);near(ring.shape.tube,.12);near(glass.shape.radius,.58);near(glass.shape.thickness,.012);assert.equal(glass.binding.deferred,true);assert.equal(glass.binding.id,0);
 for(let u=30.5;u<31.55;u+=.03)isAir(at(0,12.75,u),'through-oculus axis');
 assert(pd('road-pediment',.63,12.75,30.9)>0);assert(pd('road-pediment',.70,12.75,30.9)<0);
 isSolid(at(.72,12.75,31.36),'torus rounded section');assert(terminalHallMemberSample(ring,at(.72,12.75,31.50),current.plan).d>0);
 isSolid(at(.62,12.75,31.18),'finite plain rebate');isAir(at(.3,12.75,31.37),'reserved pane remains transparent air until optics exist');
 const withPane=createTerminalHallSampler({}, {includeDeferredGlass:true});assert.equal(withPane(at(0,12.75,31.37)).componentId,'pediment-oculus');
});

test('all source and extension parapet cells preserve both rails, posts, physical 1.25 m pitch and open centers',()=>{
 for(const v of[-8.15,8.15])for(let j=0;j<48;j++){const u=-30+j*1.25;isSolid(at(v,12.55,u),'parapet post');isSolid(at(v,12.08,u+.6),'lower rail');isSolid(at(v,13.09,u+.6),'upper rail');isAir(at(v,12.55,u+.6),'pierced parapet opening');}
 assert.equal(source.parts.filter(m=>m.sourceFamily==='pierced-parapet').length,282);
});

test('pitched roof panels retain exact 130 mm vertical sections and original metal role, with independent ridge stock',()=>{
 for(const side of[-1,1]){const name=side<0?'hall-roof-west':'hall-roof-east',m=part(name),v=side*4.325,top=13.15;near(m.shape.thickness,.13);assert.equal(m.surface.role,'roof-metal');assert.equal(m.surface.feature,'slate-roof');assert.equal(m.binding.id,3);assert.equal(m.binding.seed,8);near(pd(name,v,top,0),0);near(pd(name,v,top-.13,0),0);assert(pd(name,v,top-.065,0)<0);assert(pd(name,v,top+.002,0)>0);assert(pd(name,v,top-.132,0)>0);assert(pd(name,v,top-.065,30.54)<0);assert(pd(name,v,top-.065,30.56)>0);}
 const ridge=part('hall-roof-ridge');near(ridge.shape.width,.16);near(ridge.shape.depth,.21);near(ridge.shape.a[1],14.34);near(ridge.shape.b[2]-ridge.shape.a[2],61.2);
 for(const u of[30.545,30.55,30.56,30.575])isSolid(at(1,13.98,u),'concealed roof/pediment lap');
});

test('explicit bearing/backing corrections close source gaps without replacing column profiles',()=>{
 for(let i=0;i<4;i++){const v=-6.45+i*4.3;for(let y=.86;y<10.6;y+=.012)isSolid(at(v,y,30.9),'continuous column load path '+i);}
 const oldBase=source.parts.find(m=>m.id==='portico-0-base'),oldShaft=source.parts.find(m=>m.id==='portico-0-shaft');near(oldShaft.shape.center[1]-oldShaft.shape.height/2-oldBase.shape.center[1]-oldBase.shape.height/2,.04);
 for(const v of[-8,8])for(let y=11.04;y<12.04;y+=.012)isSolid(at(v,y,0),'cornice and parapet concealed backing');
 for(let y=10.14;y<11.23;y+=.012)isSolid(at(0,y,30.9),'entablature backing to pediment');
 for(const v of[-7.3,7.3])for(let u=30.0;u<30.91;u+=.025)isSolid(at(v,10.15,u),'returns to entablature');
});

test('every physical frame is proper, invertible, metric, and encloses its complete child plus material range',()=>{
 const bound=terminalHallBounds();for(const m of current.parts){const b=terminalHallMemberBounds(m,HALL_MATERIAL_ENVELOPE);assert(m.extent.every(x=>Number.isFinite(x)&&x>0),m.id);near(dot(cross(m.frame[0],m.frame[1]),m.frame[2]),1,1e-8);
  for(let i=0;i<3;i++){near(dot(m.frame[i],m.frame[i]),1);for(let j=i+1;j<3;j++)near(dot(m.frame[i],m.frame[j]),0);assert(b.min[i]>=bound.min[i]-1e-9&&b.max[i]<=bound.max[i]+1e-9,m.id);}
  for(const q of[[0,0,0],m.extent,m.extent.map(x=>-x),m.extent.map((x,i)=>i===1?-x:x)]){const p=terminalHallMemberPoint(m,q),h=terminalHallMemberSample(m,p,current.plan);vector(h.q,q);assert(Number.isFinite(h.d),m.id);vector(h.extent,m.extent);assert.equal(h.sourceSeed,m.member);}
 }
 for(const p of[[5,3,-9],[-33,2,7],[0,0,0]])vector(hallToStation(stationToHall(p)),p);
 assert.equal(part('road-pediment').binding.id,12);assert.equal(part('entrance-return-1').binding.id,12);assert.equal(part('sea-wall-pier-3').binding.id,1);assert.equal(part('rail-wall-pier-3').binding.id,1);
 assert(bound.min[0]<-43.25&&bound.max[0]>33.4);assert(bound.min[2]<-10&&bound.max[2]>9);assert(bound.max[1]>15.3);
});

test('material distance runs per real child before union, including a nominally farther coated winner',()=>{
 const p=at(8.58,11.355,0),raw=sample(p);assert.equal(raw.componentId,'sea-cornice-11.32');
 const callback=(h,p,m)=>h.baseD-(m.id==='sea-cornice-10.96'?.03:0),physical=createTerminalHallSampler({}, {materialDistance:callback}),compact=createTerminalHallSampler({}, {materialDistance:callback,compact:true});
 const result=physical(p);assert.equal(result.componentId,'sea-cornice-10.96');assert(result.baseD>raw.baseD);assert(result.d<raw.d);assert.equal(compact(p).componentId,result.componentId);near(compact(p).d,result.d);assert.deepEqual(result.extent,part(result.componentId).extent);vector(result.q,terminalHallMemberSample(part(result.componentId),p,current.plan).q);
 assert.throws(()=>createTerminalHallSampler({}, {materialDistance:()=>NaN})(p));assert.throws(()=>createTerminalHallSampler({}, {materialDistance:h=>h.baseD-.04})(p));
});

test('compact repeated domains agree with exhaustive material-bearing child selection at deterministic probes',()=>{
 const material=(h,p,m)=>h.baseD+(m.binding.id===3?.0008*Math.abs(Math.sin(h.q[0]+h.q[2]+m.member)):m.binding.id===13?-.017*(.5+.5*Math.sin(h.q[1]+m.member)):-.0004*Math.cos(h.q[0]+h.q[2]));
 const exhaustive=createTerminalHallSampler({}, {materialDistance:material}),compact=createTerminalHallSampler({}, {materialDistance:material,compact:true}),proxy=createTerminalHallSampler({}, {materialDistance:material,compact:true,proxyBounds:true});
 let state=19471001;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const points=[];for(let i=0;i<800;i++)points.push([-46+82*random(),-.6+17*random(),-11+22*random()]);
 for(const m of current.parts){if(m.binding.deferred)continue;const q=m.extent.map((x,i)=>i===0?x+.012:(random()-.5)*x);points.push(terminalHallMemberPoint(m,q));}
 for(const p of points){const a=exhaustive(p),b=compact(p);near(a.d,b.d,1e-8);if(a.d<.045){const c=proxy(p);near(c.d,a.d,1e-8);assert.equal(c.member,a.member);}else assert(Number.isFinite(proxy(p).d)&&proxy(p).d>0,'far enclosing-AABB proxy remains outside every physical child');}
 const ids=compact.groups.flatMap(g=>g.members);assert.equal(ids.length,592);assert.equal(new Set(ids).size,592);assert(ids.every(i=>!current.parts[i].binding.deferred));assert(compact.groups.length<100);
});

test('native WGSL is compact construction, preserves callback ordering, and consumes one global candidate',()=>{
 const code=terminalHallWGSL({...STATION_SCORE.hall,deck:.85});assert(code.length<100000);assert.deepEqual(scanWGSLIdentifiers(code),[]);assert(!code.includes('q.y--'));assert(code.includes('child.d=stationCandidatePhysicalDistance(child,p,st);if(child.d<h.d){h=child;}'));
 assert(code.includes('fn terminalHallRawWinner'));assert(code.includes('c.d=h.baseD'));assert(code.includes('let s=vec3<f32>(p.z,p.y,-p.x)'));assert(code.includes('fn terminalHallQuery(p:vec3<f32>,skipRoof:bool,skipFloor:bool)'));
 assert(!/recordCandidate\(|array<HitField|textureSample|textureLoad|BufferGeometry|Float32Array|Uint32Array/.test(code));assert(!code.includes('oculus-glazing'));assert(code.includes('current-oculus-rebate'));
 const plain=terminalHallWGSL({proxyBounds:false});assert(!plain.includes('if(bound>.06)'));assert(plain.includes('for(var offset='));
 const module=fs.readFileSync(new URL('../../native-terminal-hall.mjs',import.meta.url),'utf8');assert(!/kpStoneSurface\s*\(|kpBrickOriginalSurface\s*\(|kpPlasterOriginalField\s*\(/.test(module));assert(!/fetch\(|\.png|\.jpg|vertexBuffer|indexBuffer/.test(module));
 assert(HALL_CONSTRUCTION_DECISIONS.some(x=>x.id==='material-trim-composite'&&x.kind==='material-adaptation'));
 assert(HALL_CONSTRUCTION_DECISIONS.some(x=>x.id==='oculus-glass-optics'&&x.kind==='unresolved'));
});


test('skipFloor excludes the entire coupled floor/joint and stair/landing/approach assembly; six physical envelopes cover every excluded child',()=>{
 const bounds=terminalHallFloorBounds(),members=current.parts.filter(m=>m.isFloor);assert.equal(bounds.length,6);assert.equal(members.length,42);assert.deepEqual(new Set(bounds.flatMap(b=>b.memberIds)),new Set(members.map(m=>m.id)));
 for(const m of members){const b=bounds.find(b=>b.memberIds.includes(m.id)),a=terminalHallMemberBounds(m,HALL_MATERIAL_ENVELOPE);for(let k=0;k<3;k++){assert(a.min[k]>=b.min[k]-1e-9,m.id);assert(a.max[k]<=b.max[k]+1e-9,m.id);}}
 for(const p of[at(0,.844,-29.2),at(0,.84,31.8),at(0,.4,33.09),at(0,-.01,40),[0,.84,-9]]){assert(sample(p).d<0);assert(sample(p,{skipFloor:true}).d>0,JSON.stringify(sample(p,{skipFloor:true})));}
 const code=terminalHallWGSL();assert(code.includes('fn completeTerminalHall(p:vec3<f32>,skipFloor:bool)'));
});


test('analytic curved/oblique sections have correct signs and conservative boundary distances',()=>{
 const shaft=part('portico-0-shaft');for(let i=0;i<160;i++){const a=i*Math.PI/80,r=.44-.022*(.5+.5*Math.cos(a*20));for(const delta of[-.007,0,.007]){const q=[Math.cos(a)*(r+delta),0,Math.sin(a)*(r+delta)],d=terminalHallMemberSample(shaft,terminalHallMemberPoint(shaft,q),current.plan).d;assert(Math.sign(d)===Math.sign(delta)||Math.abs(d)<1e-12);assert(Math.abs(d)<=Math.abs(delta)+1e-12);}}
 const cap=part('portico-0-capital');for(const y of[-.10,0,.10]){const radius=.484+(.616-.484)*(y+.12)/.24;near(terminalHallMemberSample(cap,terminalHallMemberPoint(cap,[radius,y,0]),current.plan).d,0);assert(terminalHallMemberSample(cap,terminalHallMemberPoint(cap,[radius+.004,y,0]),current.plan).d>0);}
 for(const id of['pediment-rake--1','pediment-rake-1']){const m=part(id);for(let k=0;k<3;k++){const q=[0,0,0];q[k]=m.extent[k]+.005;near(terminalHallMemberSample(m,terminalHallMemberPoint(m,q),current.plan).d,.005);}}
 const arch=part('sea-arch-0');for(const a of[.15,.5,1,Math.PI/2,2.5]){const r=3.35,p=terminalHallMemberPoint(arch,[r*Math.cos(a),r*Math.sin(a),0]);near(terminalHallMemberSample(arch,p,current.plan).d,-.15);}
});

test('material envelopes bound level-set offsets at triangular corners, sloped roof edges and flutes',()=>{
 const delta=HALL_MATERIAL_ENVELOPE;for(const id of['road-pediment','hall-roof-east','hall-roof-west','portico-0-shaft']){const m=part(id),pad=terminalHallMaterialPadding(m,delta),bounds=terminalHallMemberBounds(m,delta);assert(pad.every(x=>x>=delta));const a=m.params;let q;
  if(m.kind==='triangle'){const k=2*a.rise/a.width,n=Math.hypot(1,k);q=[m.extent[0]+delta*(n+1)/k,-m.extent[1]-delta,0];}
  else if(m.kind==='roof'){const x=m.extent[0]+delta;q=[x,a.slope*x+a.thickness/2+delta*Math.hypot(1,a.slope),0];}
  else{const theta=Math.PI/20,r=.44+delta*Math.hypot(1,.022*20*.5/(.44-.022));q=[r*Math.cos(theta),0,r*Math.sin(theta)];}
  const point=terminalHallMemberPoint(m,q);near(terminalHallMemberSample(m,point,current.plan).d,delta,1e-9);for(let k=0;k<3;k++)assert(point[k]>=bounds.min[k]-1e-9&&point[k]<=bounds.max[k]+1e-9,id);
 }
});


test('continuity ledger is explicit and hall seed 191 cannot collide with waterfront state ownership',()=>{
 const ledger=terminalHallContinuity(),sourceEntries=ledger.filter(m=>m.sourceId);assert.equal(sourceEntries.length,569);assert(sourceEntries.every(m=>m.sourceId===m.targetId&&m.status&&m.adaptations.length));assert.equal(ledger.filter(m=>m.opticalDependency).length,1);
 for(const m of current.parts)assert.equal(m.binding.seed,m.surface.role==='roof-metal'?8:191,m.id);
});


test('approach is grounded and its 4 cm threshold plus two 18.5 cm curb risers are explicit finite solids',()=>{
 const approach=part('current-portico-approach'),curb=part('current-portico-road-curb-step'),last=part('hall-entry-step-3');
 const top=m=>m.shape.center[1]+m.shape.size[1]/2,bottom=m=>m.shape.center[1]-m.shape.size[1]/2;near(top(approach),.15);near(bottom(approach),-.30);near(top(last)-top(approach),.04);near(top(curb),-.035);near(bottom(curb),-.34);near(top(approach)-top(curb),.185);near(top(curb)-(-.22),.185);
 near(approach.shape.center[2]+approach.shape.size[2]/2,43);near(curb.shape.center[2]-curb.shape.size[2]/2,42.98);near(curb.shape.center[2]+curb.shape.size[2]/2,43.6);near(43.6-43,.6);
 for(const u of[33.66,34,38,42.99]){isSolid(at(0,.149,u),'raised approach top');isSolid(at(0,-.279,u),'approach enters ground');}
 for(const u of[43.01,43.3,43.59]){isSolid(at(0,-.036,u),'curb tread');isSolid(at(0,-.279,u),'grounded curb');isAir(at(0,-.02,u),'real exposed tread');}
 const b=terminalHallFloorBounds().find(b=>b.id==='road-curb-step');assert(b&&b.memberIds.includes(curb.id));assert(sample(at(0,-.036,43.3),{skipFloor:true}).d>0);assert(HALL_CONSTRUCTION_DECISIONS.find(d=>d.id==='road-approach-bearing-and-levels').reason.includes('not claimed accessible'));
});
