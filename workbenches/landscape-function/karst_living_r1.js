/* Landscape Mother — living karst causal tracer R1
 * Read-only companion for the accepted R5 limestone SDF.
 * Contract: sdf(x,y,z) < 0 means rock, > 0 means void/air.
 * This module does NOT alter the macro SDF, mesh, cave opening, foot, soil or fallen stones.
 * It only derives deterministic diagnostic/process state from fixed world coordinates.
 */
(function(root){
'use strict';

const VERSION='LANDSCAPE_KARST_LIVING_R1';
const EPS=1e-9;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>a*(1-t)+b*t;

function hash32(x){
  x|=0; x=Math.imul(x^(x>>>16),0x7feb352d); x=Math.imul(x^(x>>>15),0x846ca68b); return (x^(x>>>16))>>>0;
}
function hash3i(a,b,c,seed=1){
  return hash32((a|0)^Math.imul(b|0,0x9e3779b1)^Math.imul(c|0,0x85ebca6b)^Math.imul(seed|0,0xc2b2ae35));
}
function u01(h){return (h>>>0)/4294967295;}
function stableNoise(x,z,seed=1){
  const xi=Math.floor(x*64), zi=Math.floor(z*64);
  return u01(hash3i(xi,zi,seed,seed+17))*2-1;
}

function bisectZero(sdf,x,z,a,b,iters=18){
  let fa=sdf(x,a,z), fb=sdf(x,b,z);
  if(!Number.isFinite(fa)||!Number.isFinite(fb)) return null;
  if(Math.sign(fa)===Math.sign(fb)) return null;
  for(let i=0;i<iters;i++){
    const m=(a+b)*0.5, fm=sdf(x,m,z);
    if(!Number.isFinite(fm)) return null;
    if(Math.sign(fa)===Math.sign(fm)){a=m;fa=fm}else{b=m;fb=fm}
  }
  return (a+b)*0.5;
}

function traceColumn(sdf,x,z,yTop,yBottom,step=0.35){
  if(!(yTop>yBottom) || !(step>0)) throw new Error('invalid vertical scan');
  let prevY=yTop, prev=sdf(x,prevY,z);
  if(!Number.isFinite(prev)) return null;
  let surface=null, roof=null, enteredRock=prev<0;
  for(let y=yTop-step;y>=yBottom-EPS;y-=step){
    const yy=Math.max(y,yBottom), v=sdf(x,yy,z);
    if(!Number.isFinite(v)) return null;
    if(!enteredRock && prev>=0 && v<0){
      surface=bisectZero(sdf,x,z,prevY,yy) ?? (prevY+yy)*0.5;
      enteredRock=true;
    }else if(enteredRock && surface!==null && prev<0 && v>=0){
      roof=bisectZero(sdf,x,z,prevY,yy) ?? (prevY+yy)*0.5;
      break;
    }
    prevY=yy; prev=v;
    if(yy===yBottom) break;
  }
  if(surface===null||roof===null||surface<=roof) return null;
  return {surfaceY:surface,roofY:roof,rockThickness:surface-roof};
}

function estimateCatchment(sdf,x,z,opt){
  const r=opt.catchmentRadius;
  const n=opt.catchmentSamples;
  let valid=0, relief=0, center=null;
  const samples=[];
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2;
    const rr=r*(0.35+0.65*((i*0.61803398875)%1));
    const sx=x+Math.cos(a)*rr, sz=z+Math.sin(a)*rr;
    const c=traceColumn(sdf,sx,sz,opt.yTop,opt.yBottom,opt.scanStep);
    if(c){
      valid++;
      samples.push({x:sx,z:sz,y:c.surfaceY});
      if(!center) center=c;
    }
  }
  if(!samples.length) return {score:0,valid:0,samples:[]};
  const mean=samples.reduce((s,p)=>s+p.y,0)/samples.length;
  relief=samples.reduce((s,p)=>s+Math.abs(p.y-mean),0)/samples.length;
  const coverage=valid/n;
  const score=coverage*(1+clamp(relief/(r+EPS),0,1)*0.35);
  return {score,valid,samples};
}

function makePath(site,seed,nodes=7){
  const out=[];
  const amp=Math.min(0.28,site.rockThickness*0.012);
  for(let i=0;i<nodes;i++){
    const t=i/(nodes-1);
    const y=lerp(site.surfaceY,site.roofY,t);
    const taper=Math.sin(Math.PI*t);
    const nx=stableNoise(site.x*0.37+i*0.19,site.z*0.41,seed+site.ordinal*31);
    const nz=stableNoise(site.x*0.29,site.z*0.33+i*0.17,seed+site.ordinal*47);
    out.push({x:site.x+nx*amp*taper,y,z:site.z+nz*amp*taper});
  }
  return out;
}

function buildDripSites(args){
  if(!args||typeof args.sdf!=='function') throw new Error('sdf function required');
  const sdf=args.sdf;
  const opt={
    seed:Number.isInteger(args.seed)?args.seed:83,
    stage:clamp(Number(args.stage??1),0,1),
    yTop:Number(args.yTop??72),
    yBottom:Number(args.yBottom??-16),
    scanStep:clamp(Number(args.scanStep??0.35),0.08,2),
    catchmentRadius:clamp(Number(args.catchmentRadius??2.4),0.25,10),
    catchmentSamples:clamp(Math.round(Number(args.catchmentSamples??10)),4,32),
    inputWater:Math.max(0,Number(args.inputWater??1)),
    maxSites:clamp(Math.round(Number(args.maxSites??6)),1,16)
  };
  const anchors=Array.isArray(args.anchors)?args.anchors:[];
  if(!anchors.length) throw new Error('explicit fixed-world anchors required');

  const candidates=[];
  for(let i=0;i<anchors.length;i++){
    const a=anchors[i]; if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.z)) continue;
    const col=traceColumn(sdf,a.x,a.z,opt.yTop,opt.yBottom,opt.scanStep);
    if(!col) continue;
    const catchment=estimateCatchment(sdf,a.x,a.z,opt);
    const fracture=typeof args.fractureField==='function'?clamp(Number(args.fractureField(a.x,col.roofY,a.z)),0,1):0.55;
    const vulnerability=typeof args.vulnerabilityField==='function'?clamp(Number(args.vulnerabilityField(a.x,col.roofY,a.z)),0,1):0.65;
    const residence=clamp(col.rockThickness/32,0.08,1);
    const connectivity=clamp((0.45+0.55*fracture)*catchment.score,0,1.8);
    const raw=Math.max(EPS,connectivity*(0.35+0.65*residence));
    candidates.push({ordinal:i,x:a.x,z:a.z,...col,catchment,fracture,vulnerability,residence,connectivity,raw});
  }
  candidates.sort((a,b)=>b.raw-a.raw||a.ordinal-b.ordinal);
  const selected=candidates.slice(0,opt.maxSites);
  const sumRaw=selected.reduce((s,p)=>s+p.raw,0)||1;
  const sites=selected.map((s,rank)=>{
    const q=opt.inputWater*s.raw/sumRaw;
    const acid=clamp(0.38+0.34*s.residence+0.18*s.fracture,0,1);
    const dissolution=q*acid*s.vulnerability*0.62*opt.stage;
    const dissolvedLoad=dissolution*0.82;
    const degassing=clamp(0.28+0.44*(1-s.residence)+0.16*stableNoise(s.x,s.z,opt.seed+91),0.08,0.82);
    const deposit=dissolvedLoad*degassing*opt.stage;
    const outLoad=Math.max(0,dissolvedLoad-deposit);
    const dripRate=q*mix(0.45,1,clamp(s.connectivity,0,1));
    const growthSignal=deposit/(opt.inputWater+EPS);
    const stalactiteScale=clamp(growthSignal*7.5,0,1);
    const stalagmiteScale=clamp(growthSignal*5.4,0,1);
    const site={
      id:`KL1-${opt.seed}-${String(s.ordinal).padStart(2,'0')}`,
      rank,ordinal:s.ordinal,x:s.x,z:s.z,surfaceY:s.surfaceY,roofY:s.roofY,rockThickness:s.rockThickness,
      catchmentScore:s.catchment.score,catchmentSamples:s.catchment.samples,
      fracture:s.fracture,vulnerability:s.vulnerability,residence:s.residence,connectivity:s.connectivity,
      waterIn:q,acidProxy:acid,dissolutionProxy:dissolution,dissolvedCarbonateProxy:dissolvedLoad,
      degassingProxy:degassing,calciteDepositProxy:deposit,dissolvedLoadOutProxy:outLoad,dripRateProxy:dripRate,
      display:{stalactiteScale,stalagmiteScale},
      geometryReadOnly:true
    };
    site.path=makePath(site,opt.seed);
    return site;
  });
  const totals=sites.reduce((o,s)=>{
    o.waterIn+=s.waterIn;o.dissolution+=s.dissolutionProxy;o.loadIn+=s.dissolvedCarbonateProxy;o.deposit+=s.calciteDepositProxy;o.loadOut+=s.dissolvedLoadOutProxy;return o;
  },{waterIn:0,dissolution:0,loadIn:0,deposit:0,loadOut:0});
  totals.massBalanceError=Math.abs(totals.loadIn-(totals.deposit+totals.loadOut));
  return {version:VERSION,seed:opt.seed,stage:opt.stage,calibratedYears:false,geometryReadOnly:true,sites,totals,
    assumptions:['relative process stage only','proxy chemistry, not calibrated geochemistry','explicit fixed-world anchors','shared dissolved-load budget']};
}

function checkInvariants(result,tol=1e-8){
  const issues=[];
  if(!result||result.version!==VERSION) issues.push('version');
  if(!result?.geometryReadOnly) issues.push('geometry must remain read-only');
  if(result?.calibratedYears!==false) issues.push('stage must not claim calibrated years');
  if((result?.totals?.massBalanceError??Infinity)>tol) issues.push('dissolved-load budget');
  for(const s of result?.sites||[]){
    if(s.calciteDepositProxy< -tol||s.dissolvedLoadOutProxy< -tol) issues.push(`${s.id}:negative budget`);
    if(s.calciteDepositProxy-s.dissolvedCarbonateProxy>tol) issues.push(`${s.id}:deposit exceeds load`);
    if(!(s.surfaceY>s.roofY)) issues.push(`${s.id}:invalid vertical order`);
  }
  return {passed:issues.length===0,issues};
}

const api={VERSION,traceColumn,estimateCatchment,buildDripSites,checkInvariants};
if(typeof module!=='undefined'&&module.exports) module.exports=api;
root.KarstLivingR1=api;
})(typeof self!=='undefined'?self:globalThis);
