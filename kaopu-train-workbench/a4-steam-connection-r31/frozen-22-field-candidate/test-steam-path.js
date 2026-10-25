'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const base=path.resolve(process.argv[2]||'../r31'),load=require(path.join(base,'load-r29.js')),api=require('./steam-path'),install=require('./steam-path-adapter');
const c=load(base);for(const f of ['outer-crosshead.js','outer-crosshead-adapter.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),c,{filename:f});
const D=c.DYNAMIC,S=c.SCENE,baseline={mode:'baseline',beta:.11},candidate={mode:'candidate',beta:.126},originalSources={...S.sources},originalParts=JSON.stringify(S.parts),oldHostCuts=JSON.stringify(S.hostCuts),before=S.parts.filter(p=>D.visible(p,baseline)).map(p=>p.id);
const C=install(S,D,api,c.TOPOLOGY_PARAMETERS),A=c.createSurfaceAppearance(S,D,c.ANALYTIC_MATERIAL_WAVES,c.createMaterialCoordinates);
assert.equal(before.length,519);assert.deepStrictEqual(S.parts.filter(p=>D.visible(p,baseline)).map(p=>p.id),before);for(const[k,v]of Object.entries(originalSources))assert.equal(S.sources[k],v);assert.equal(JSON.stringify(S.parts.slice(0,-C.parts.length)),originalParts);assert.equal(JSON.stringify(S.hostCuts),oldHostCuts);
assert.equal(C.parts.length,22);assert(C.parts.every(p=>D.visible(p,candidate)&&!D.visible(p,baseline)));assert(C.parts.every(p=>A.frame(p,.4,candidate).assignment.materialIndex>=0));assert(!C.status.completeSteamFlow&&!C.status.pressureCertified&&!C.status.historicalValveEventsVerified);
assert(!Object.keys(C.hostCuts).some(id=>/frame|axle/.test(id)));for(const[id,cut]of Object.entries(C.hostCuts)){const p=S.parts.find(p=>p.id===id);assert(p,'Existing host required');assert(D.scalar(p).includes('installationCandidate==1?max('));assert.equal(D.interval(p),'return vec2(-1e20,1e20);');}
// The separator occupies the original lumen and reaches all its boundary faces.
assert(C.worldScalar('steam_path/header_separator',[0,3.3,3.35],.4,candidate)<0);assert(C.domainScalar('header/pre_superheat',[0,3.3,3.35],.4,candidate)>0);assert(C.domainScalar('header/post_superheat',[0,3.3,3.35],.4,candidate)>0);
assert.equal(C.graph.missingEdges.length,9);assert.equal(C.graph.connections.length,9);
const norm=a=>Math.hypot(...a),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
// Independent very dense arc reference catches the atan +/-pi endpoint bug.
const f=api.fillet([-1,0,0],[0,0,0],[0,1,0],.2),pts=[[-1,0,0],[0,0,0],[0,1,0]];let maxArcError=0,maxLipschitzExcess=0;
function ref(p){let d=Infinity;const line=(a,b)=>{const v=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),v)/dot(v,v)));return norm(sub(p,a.map((x,i)=>x+v[i]*t)));};d=Math.min(line(pts[0],f.start),line(f.end,pts[2]));for(let k=0;k<=20000;k++){const t=f.angle*k/20000,q=f.center.map((v,i)=>v+f.r*(f.e[i]*Math.cos(t)+f.f[i]*Math.sin(t)));d=Math.min(d,norm(sub(p,q)));}return d;}
for(const angle of [-Math.PI-1e-7,-Math.PI,-Math.PI+1e-7,-2.5,-1,.1,1,2.5,Math.PI-1e-7,Math.PI,Math.PI+1e-7])for(const r of [.05,.2,.5]){const p=f.center.map((v,i)=>v+r*(f.e[i]*Math.cos(angle)+f.f[i]*Math.sin(angle))),a=api.pathDistance(p,pts,.2),b=ref(p);maxArcError=Math.max(maxArcError,Math.abs(a-b));assert(Math.abs(a-b)<2e-5);const q=p.map((v,i)=>v+(i===0?1e-7:0));maxLipschitzExcess=Math.max(maxLipschitzExcess,Math.abs(api.pathDistance(q,pts,.2)-a)-1e-7);}
assert(maxLipschitzExcess<1e-10);
let minPistonPortMargin=Infinity,finite=0,maxSnapshotError=0,boundsMisses=0;
for(const beta of [.11,.126,.16])for(let k=0;k<=144;k++){
 const theta=k*2*Math.PI/144,inst={mode:'candidate',beta},I=C.inspection(theta,inst);assert.equal(I.theta,theta);assert.equal(I.workingChambers.length,3);
 for(const q of I.workingChambers){const ri=q.side==='middle'?api.parameters.work.middleInner:api.parameters.work.outerInner;minPistonPortMargin=Math.min(minPistonPortMargin,q.pistonRear-q.rearPortStation-ri,q.frontPortStation-ri-q.pistonFront);const side=['left','middle','right'].indexOf(q.side),pose=D.pose(theta,side,side===1?beta:0),st=(pose.s[0]-1.016)*Math.sin(side===1?beta:0)+pose.s[1]*Math.cos(side===1?beta:0)+1.25;maxSnapshotError=Math.max(maxSnapshotError,Math.abs(st-q.pistonStation));}
 for(const p of C.parts){const m=p.aabb_min.map((v,i)=>(v+p.aabb_max[i])/2);assert(Number.isFinite(C.worldScalar(p.id,m,theta,inst)));finite++;}
 if(k===0){for(const p of C.ports(theta,inst).filter(p=>p.kind==='power_chamber_port_beta_bound')){assert(C.hostCutScalar(p.host,p.position,theta,inst)<0);const domain='chamber/'+['left','middle','right'][p.side]+'/'+(p.id.includes('/rear_')?'rear':'front');assert(C.domainScalar(domain,p.position,theta,inst)<0,'Cylinder endpoint must reach real queried chamber');}}
}
assert(minPistonPortMargin>.0047);assert.equal(maxSnapshotError,0);
// New field bounds must contain all their declarative centreline control points;
// circular fillets remain in their control-point convex hull. Beta point bounds
// include exact sin/cos extrema, not just sampled installation values.
for(const beta of [.11,.126,.16])for(const r of C.routes){const p=C.byId[r.partId];for(const q0 of r.points){const q=api.point(q0,beta);if(q.some((v,i)=>v<p.aabb_min[i]||v>p.aabb_max[i]))boundsMisses++;}}
assert.equal(boundsMisses,0);
const out={status:'PASS scoped CPU gates; independent whole-neighbor and browser verification still required',parts:C.parts.length,baselineVisible:519,candidateVisible:S.parts.filter(p=>D.visible(p,candidate)).length,modifiedHostIDs:Object.keys(C.hostCuts),originalSourcesAndPartsUnchanged:true,originalHostCutTableUnchanged:true,arcBacksideDenseReferenceMaxError:maxArcError,arcBranchLipschitzExcess:maxLipschitzExcess,finiteSamples:finite,boundsMisses,samePoseMaxError:maxSnapshotError,minimumEndPortPistonAxialMargin:minPistonPortMargin,graphBreaks:C.graph.missingEdges.length,physicalAcceptance:false,CFD:false,pressureCertified:false};
fs.writeFileSync(path.join(__dirname,'STEAM_PATH_CPU_QA.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
