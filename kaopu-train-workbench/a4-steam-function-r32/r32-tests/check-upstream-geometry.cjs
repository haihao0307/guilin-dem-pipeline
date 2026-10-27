'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),{scene:S,dynamic:D}=require(root+'/load-whole-scene')(),U=D.upstreamCandidate,SP=require(root+'/steam-path');
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const s=D.snapshot({mode:'candidate',steamRevision:'r32',regulatorOpen:1});
const records=[];let crossChecks=0,emptyTubeFailures=0,minWall=Infinity,minBend=Infinity;
for(const r of U.routes){const pts=r.points,cs=pts.slice(1,-1).map((p,i)=>SP.fillet(pts[i],p,pts[i+2],r.bend)),stations=[];
 for(let i=0;i<pts.length-1;i++){const a=i?cs[i-1].end:pts[0],b=i===pts.length-2?pts.at(-1):cs[i].start,t=unit(sub(b,a)),n=Math.max(3,Math.ceil(norm(sub(b,a))/.03));for(let k=1;k<n;k++)stations.push({p:add(a,mul(sub(b,a),k/n)),t,segment:'straight'+i});}
 cs.forEach((f,i)=>{minBend=Math.min(minBend,f.r);assert(f.r>r.outerRadius,'bend must exceed outer tube radius');for(let k=0;k<=24;k++){const a=f.angle*k/24;stations.push({p:add(f.center,add(mul(f.e,f.r*Math.cos(a)),mul(f.f,f.r*Math.sin(a)))),t:add(mul(f.e,-Math.sin(a)),mul(f.f,Math.cos(a))),segment:'arc'+i});}});
 const counts={};for(const st of stations){counts[st.segment]=(counts[st.segment]||0)+1;const b=unit(cross(st.t,Math.abs(st.t[0])<.8?[1,0,0]:[0,1,0])),c=cross(st.t,b);assert(U.worldScalar(r.partId,st.p,.4,s)>0,'axis must be empty');assert(U.domainScalar(r.lumenDomain,st.p,.4,s)<0,'axis must be in fluid domain');
  for(let j=0;j<12;j++){const a=j*Math.PI/6,n=add(mul(b,Math.cos(a)),mul(c,Math.sin(a))),mid=add(st.p,mul(n,(r.innerRadius+r.outerRadius)/2)),outside=add(st.p,mul(n,r.outerRadius+.003)),wall=U.worldScalar(r.partId,mid,.4,s);assert(wall< -1e-5,`missing wall ${r.id} ${st.segment} ${j}: ${wall}`);assert(U.worldScalar(r.partId,outside,.4,s)>1e-5,`outside incorrectly solid ${r.id} ${st.segment} ${j}`);minWall=Math.min(minWall,-wall);crossChecks++;
   if(r.id==='superheater_element'){const broken={op:'tube',points:r.points,ri:r.innerRadius,ro:r.outerRadius,bend:r.bend};if(SP.scalar(broken,mid)>=0)emptyTubeFailures++;}
  }
 }
 if(r.id==='superheater_element'){
  // Bore extension leaves all original internal corner fillets unchanged.
  const inner=r.ast.b.points;for(let i=1;i<pts.length-1;i++){const before=cs[i-1],after=SP.fillet(inner[i-1],inner[i],inner[i+1],r.bend);for(const key of ['start','end','center'])assert(norm(sub(before[key],after[key]))<1e-12);}
  // Explicit open mouths, plus wall just inside each lip; no solid cap.
  for(const [i,j] of [[0,1],[pts.length-1,pts.length-2]]){const outward=unit(sub(pts[i],pts[j]));for(const t of [-.01,0,.01,.019]){const p=add(pts[i],mul(outward,t));assert(U.worldScalar(r.partId,p,.4,s)>0,'sealed mouth');}}
 }
 records.push({id:r.id,stations:stations.length,segments:counts,inner:r.innerRadius,outer:r.outerRadius,openEndConstruction:r.openEndConstruction});
}
assert(emptyTubeFailures>100,'negative control must detect old empty-loop defect');
// Same actual disc coordinate system is invertible across mechanical Time states.
const disc=U.byId['upstream_steam/regulator_valve_disc'];for(const theta of [0,.4,2,6.2])for(const open of [0,.25,1]){const st=D.snapshot({...s,regulatorOpen:open}),p=[.02,3.3,-1.712],q=D.transform(p,theta,D.classify(disc),false,st),back=D.transform(q,theta,D.classify(disc),true,st);assert(norm(sub(p,back))<1e-12);assert(U.worldScalar(disc.id,q,theta,st)<0);}
assert(U.commonSource.includes('float upPath9('));assert(!/spPath9\(/.test(U.source));
for(const [id,point] of [['pr_boiler_water_or_steam_space',[0,3.3,0]],['pr_boiler_tube_hot',[0,3.045,0]]])assert(D.clipExistingSteamDomain(id,-.01,point,.4,s)>0);
const result={status:'PASS',checked:new Date().toISOString(),records,crossSectionChecks:crossChecks,minimumMidWallNegativity:minWall,minimumActualBendRadius:minBend,oldGlobalEndPlaneEmptyLoopRejected:emptyTubeFailures,scope:'Actual generated AST/adapter CPU values on every straight and arc; no GPU/pixels or continuous all-neighbor clearance certificate.'};fs.writeFileSync(__dirname+'/UPSTREAM_GEOMETRY_RESULT.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
