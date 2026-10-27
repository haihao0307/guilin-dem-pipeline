/* Reversible R32 overlay: retained R31 sources/parts remain untouched. */
(function(root){'use strict';
function install(scene,D,api){
 if(D.upstreamCandidate)throw Error('R32 upstream already installed');
 const U=api.create(D.steamPathCandidate),old={snapshot:D.snapshot,visible:D.visible,scalar:D.scalar,argument:D.argument,bounds:D.bounds,interval:D.interval,classify:D.classify,transform:D.transform};
 D.steamRevision='r32';D.regulatorOpen=1;
 D.snapshot=function(options={}){const s=old.snapshot(options),steamRevision=s.mode==='baseline'?'r31':options.steamRevision??D.steamRevision,regulatorOpen=options.regulatorOpen??D.regulatorOpen;if(!['r31','r32'].includes(steamRevision)||!Number.isFinite(regulatorOpen)||regulatorOpen<0||regulatorOpen>1)throw Error('R31/R32 and regulator [0,1] required');return Object.freeze({...s,steamRevision,regulatorOpen});};
 D.selectSteam=function(revision,open){const s=D.snapshot({mode:'candidate',steamRevision:revision,regulatorOpen:open});D.steamRevision=s.steamRevision;D.regulatorOpen=s.regulatorOpen;return s;};
 const ids=new Set(scene.parts.map(p=>p.id));for(const p of U.parts)if(ids.has(p.id))throw Error('Duplicate upstream ID');
 scene.sources.upstreamSteam=U.source;scene.parts.push(...U.parts);D.glsl+='\n'+U.commonSource;
 D.visible=(p,s)=>p.source==='upstreamSteam'?U.enabled(s):old.visible(p,s);
 D.argument=(p,q='p')=>p.source==='upstreamSteam'?(p.upstreamMotion?`upRegulatorInverse(${q})`:q):old.argument(p,q);
 D.scalar=p=>{if(p.source==='upstreamSteam')return p.glsl_function+'('+D.argument(p)+')';const before=old.scalar(p),cut=U.hostCuts[p.id];return cut?`(installationCandidate==1&&upstreamCandidate==1?max(${before},-${cut.glsl_function}(p)):${before})`:before;};
 D.interval=p=>U.hostCuts[p.id]?'return vec2(-1e20,1e20);':old.interval(p);
 D.classify=p=>p.upstreamMotion?{type:'upstreamRegulator'}:old.classify(p);
 D.transform=(p,t,m,inverse=false,s=D.snapshot())=>m?.type==='upstreamRegulator'?p.map((v,i)=>v+(i===2?(inverse?-1:1)*s.regulatorOpen*U.parameters.regulator.lift:0)):old.transform(p,t,m,inverse,s);
 D.bounds=(p,t,s=D.snapshot())=>p.source==='upstreamSteam'?[p.aabb_min,p.aabb_max].map(v=>v.map((n,i)=>n+(p.upstreamMotion&&i===2?s.regulatorOpen*U.parameters.regulator.lift:0))):old.bounds(p,t,s);
 D.querySteamDomain=function(id,p,theta,s=D.snapshot()){
  if(U.domains[id])return U.domainScalar(id,p,theta,s);
  if(s.mode!=='candidate')return Infinity;
  return D.steamPathCandidate.domainScalar(id,p,theta,s);
 };
 D.clipExistingSteamDomain=function(id,value,p,theta,s=D.snapshot()){
  const oldValue=s.mode==='candidate'?D.steamPathCandidate.clipExistingDomain(id,value,p,theta,s):value;
  return U.clipExistingDomain(id,oldValue,p,theta,s);
 };
 D.upstreamCandidate=U;return U;
}
if(typeof module==='object'&&module.exports)module.exports=install;else{root.installUpstreamSteam=install;if(root.SCENE&&root.DYNAMIC&&root.UPSTREAM_STEAM)install(root.SCENE,root.DYNAMIC,root.UPSTREAM_STEAM);}
})(typeof globalThis!=='undefined'?globalThis:this);
