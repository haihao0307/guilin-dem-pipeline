'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),F=require('./frame_support'),E=require('./support_export');
const {modelPath,topologyPath}=require('./model_path'),base=modelPath(),topology=topologyPath(base);
const c={};c.window=c;vm.createContext(c);for(const n of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(base,n),'utf8'),c);
const S=require(path.join(base,'stack-reconstruction/stack_candidate')),old=require(path.join(base,'gresley_solver')),outside=require(path.join(base,'outside_valve_solver')).createOutsideValveSolver(c.DYNAMIC),G=require(path.join(topology,'side_offset_solver')).createSideOffsetGresleySolver(c.SCENE,c.DYNAMIC,outside,{middleX:.38,middleLinkLength:.25,middleSpindleLength:1.18});
if(process.argv.includes('--resolve-only')){console.log(JSON.stringify({model:base,topology,modulesLoaded:true}));process.exit(0);}
const hosts=F.inspectFrameHosts(c.SCENE),profiles=S.inspect(c.SCENE,old.extractReference(c.SCENE)),design=S.derive(profiles,G.reference,{},{terminalEyes:true}),parts=S.parts(design,profiles,G.pose(.4));
const apertures=JSON.parse(fs.readFileSync(path.join(__dirname,'CONDITIONAL_APERTURE_CERTIFICATE.json'))).results.find(r=>r.middleX===.38).openings;
const pack=E.pack({hosts,pose:G.pose(.4),parts,apertures});assert.equal(pack.parts.length,14);assert.equal(pack.parts.filter(p=>p.replacesId).length,1);assert.equal(pack.parts.filter(p=>p.replacesId)[0].replacesId,'stack_candidate/pin/O');assert.equal(pack.frameHostCuts.length,2);
let seed=9428,sampleChecks=0;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const pairAudit=[];for(let i=0;i<pack.parts.length;i++)for(let j=i+1;j<pack.parts.length;j++){
 const a=pack.parts[i],b=pack.parts[j],lo=a.aabb_min.map((v,k)=>Math.max(v,b.aabb_min[k])),hi=a.aabb_max.map((v,k)=>Math.min(v,b.aabb_max[k]));if(lo.some((v,k)=>v>hi[k]+1e-14)){pairAudit.push({a:a.id,b:b.id,result:'separated_support_AABBs'});continue;}
 let minCommon=Infinity;for(let k=0;k<10000;k++){const p=lo.map((v,axis)=>v+rand()*(hi[axis]-v)),d=Math.max(E.scalar(a.shape,p),E.scalar(b.shape,p));minCommon=Math.min(minCommon,d);assert(d>=-1e-12,JSON.stringify({a:a.id,b:b.id,p,d}));sampleChecks++;}
 pairAudit.push({a:a.id,b:b.id,result:'no_sampled_positive_volume_overlap; contacts explicitly enumerated',minimumMaxField:minCommon});
}
// The central pivot is occupied by the replacement fixed pin and explicitly
// absent from the bridge socket, with a nominal radial seat at exactly 12 mm.
const bridge=pack.parts.find(p=>p.id==='frame_support/front_stretcher'),pin=pack.parts.find(p=>p.replacesId),O=G.reference.pins.O,ym=(pack.derived.bridgeY[0]+pack.derived.bridgeY[1])/2;
assert(E.scalar(bridge.shape,[O[0],ym,O[2]])>0);assert(E.scalar(pin.shape,[O[0],ym,O[2]])<0);assert(Math.abs(E.scalar(bridge.shape,[O[0]+.012,ym,O[2]]))<1e-12);
// Fixed bolt holes are real voids through bridge tabs, not concealed overlaps.
for(const cut of pack.frameHostCuts)for(const bore of cut.bores){const r=bore.shape.range,p=bore.shape.center.slice();p[0]=(r[0]+r[1])/2;assert(E.scalar(bore.shape,p)<0);const hx=hosts.find(h=>h.id===cut.sourcePartId);p[0]=hx.innerFace-Math.sign(hx.x)*.007;assert(E.scalar(bridge.shape,p)>0);}
// Apertures contain exact finite profiles for a dense independent input grid.
let sectionChecks=0,minMargin=Infinity;for(let i=0;i<=80;i++)for(let j=0;j<=80;j++){
 const pose=G.solveInputs(4.02+.16*i/80,4.02+.16*j/80),partsNow=S.parts(design,profiles,pose);
 for(const ap of apertures){const part=partsNow.find(p=>p.id===ap.partId),q=F.sectionBounds(part,ap.frameSlab);assert(q);const margin=Math.min(q.y[0]-ap.opening.y[0],ap.opening.y[1]-q.y[1],q.z[0]-ap.opening.z[0],ap.opening.z[1]-q.z[1]);assert(margin>0);minMargin=Math.min(minMargin,margin);sectionChecks++;}
}
const report={pass:true,partCount:14,netAddedPieces:13,oneExistingStackPinReplaced:true,frameCutCount:2,matchingSideBoltBoreCount:4,sideNutAndWasherCount:8,finiteSupportPairSampleChecks:sampleChecks,independentInputSectionChecks:sectionChecks,minimumSampledOpeningMarginM:minMargin,checks:pack.checks,pairAudit,continuousApertureCertificate:'CONDITIONAL_APERTURE_CERTIFICATE.json',supportGeometryProofScope:'Simple analytic cuts/contact interfaces plus sampled redundant pair test. Whole scene and unresolved threads/locking/strength are not accepted.',wholeAcceptance:false};
fs.writeFileSync(path.join(__dirname,'SUPPORT_EXPORT.json'),JSON.stringify(pack,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'SUPPORT_FIELDS.glsl'),pack.source+'\n');fs.writeFileSync(path.join(__dirname,'FRAME_HOST_CUTS.glsl'),pack.frameHostCuts.map(c=>c.glsl).join('\n')+'\n');fs.writeFileSync(path.join(__dirname,'SUPPORT_EXPORT_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,pairAudit:undefined},null,2));
