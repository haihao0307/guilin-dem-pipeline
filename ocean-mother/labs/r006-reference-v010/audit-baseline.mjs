/** Read-only reproduction of specific Coast v010 defects. No browser claim. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {buildClosedBed,inspectClosedMesh} from './boundary-geometry.mjs';
import {makeMacGrid,projectClosedMac} from './pressure-projection.mjs';
const root=resolve(process.argv[2]||'ocean-mother/coast-v010');
const expected={
 'coast-core.mjs':'093375bb401fd30929c680e7071cc6403df81792de60f96d79258218014e1af3',
 'coast-app.mjs':'41932e6141146fe43711ba152f20c5dda5b1a696a62a19d319d33cd333fa7d22',
 'shaders.mjs':'b515c615064d1a4cb1d09bbb9a16413d5121b3bdef4685ecffcfc1be212b9f4d',
 'policy.json':'fe69ea88c05d9b8c74e79e21c2c2c719dc096b677848eb40305575f08b5b8fdf'
};
const identities={};
for(const [name,hash] of Object.entries(expected)){const b=await readFile(join(root,name)),actual=createHash('sha256').update(b).digest('hex');if(actual!==hash)throw Error('Unexpected baseline: '+name);identities[name]={bytes:b.length,sha256:actual};}
const source=(await readFile(join(root,'coast-app.mjs'))).toString();
const {bed,sandBed,CoastState,DEFAULT}=await import(pathToFileURL(join(root,'coast-core.mjs')));
const snippet=source.slice(source.indexOf('function grid('),source.indexOf('function makeLogs('));
if(!snippet.includes('function makeSlab('))throw Error('Baseline function boundaries changed');
// Execute the exact two geometry functions; the adapter captures CPU buffers only.
const sandbox={Float32Array,Math,bed,sandBed,norm:v=>{const m=Math.hypot(...v);return v.map(x=>x/m);},mesh:(data,ids)=>({data,ids})};
vm.createContext(sandbox);vm.runInContext(snippet+'; capturedWater=grid(192,160,false);capturedSlab=makeSlab();',sandbox,{timeout:5000});
const asMesh=m=>({vertices:Array.from({length:m.data.length/10},(_,i)=>Array.from(m.data.slice(i*10,i*10+3))),indices:Array.from({length:m.ids.length/3},(_,i)=>Array.from(m.ids.slice(i*3,i*3+3)))});
const waterTopology=inspectClosedMesh(asMesh(sandbox.capturedWater));
const corners=[[-34,-28],[30,-28],[30,28],[-34,28]];const gaps=[];
for(let e=0;e<4;e++){
 const a=corners[e],b=corners[(e+1)%4],samples=e%2?224:256;let maxAbs=0,maxTerrainAboveWall=0,maxWallAboveTerrain=0,at=null;
 for(let i=0;i<=samples;i++){const t=i/samples,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  const displayedCornerA=sandbox.capturedSlab.data[e*40+21],displayedCornerB=sandbox.capturedSlab.data[e*40+31];
  const wallY=displayedCornerA*(1-t)+displayedCornerB*t,terrainY=Math.fround(bed(x,z)),difference=terrainY-wallY;
  maxTerrainAboveWall=Math.max(maxTerrainAboveWall,difference);maxWallAboveTerrain=Math.max(maxWallAboveTerrain,-difference);
  if(Math.abs(difference)>maxAbs){maxAbs=Math.abs(difference);at={x,z,terrainY,wallY};}
 }
 gaps.push({edgeIndex:e,from:a,to:b,samples:samples+1,maxAbsGapM:maxAbs,maxTerrainAboveWallM:maxTerrainAboveWall,maxWallAboveTerrainM:maxWallAboveTerrain,at});
}
const sim=new CoastState({...DEFAULT});for(let i=0;i<1440;i++)sim.step();
const defaultStats=sim.stats();
const periodicProbe=new CoastState({...DEFAULT,amplitude:0,smallWaves:0,wind:0,fire:0,smoke:0},{nx:8,nz:6,bedFn:()=>-2,forced:false});
const first=3,last=(periodicProbe.nz-1)*periodicProbe.nx+3;
periodicProbe.qz.fill(.4);periodicProbe.flux(last,first,1);
const periodic={lastCell: last,firstCell:first,lastCellWaterRate:periodicProbe.dh[last],firstCellWaterRate:periodicProbe.dh[first],sumPairRate:periodicProbe.dh[last]+periodicProbe.dh[first]};
const sprayProbe=new CoastState({...DEFAULT,amplitude:0,smallWaves:0,wind:0,fire:0,smoke:0},{nx:8,nz:6,bedFn:()=>-2,forced:false});
const outsideX=sprayProbe.bounds[0]-2;
sprayProbe.spray.push({x:outsideX,y:5,z:0,vx:0,vy:0,vz:0,age:0,life:1,size:.05});sprayProbe.step();
const closed=buildClosedBed({nx:256,nz:224,bounds:[-34,30,-28,28],bottom:-6,heightAt:bed});
const closedTopology=inspectClosedMesh(closed);
const larger=new CoastState({...DEFAULT,fire:0,smoke:0},{nx:216,nz:168,bounds:[-50,46,-42,42]});for(let i=0;i<240;i++)larger.step();
const g=makeMacGrid(16,12,10,[.25,.25,.25]);for(const [n,key]of ['u','v','w'].entries())for(let i=0;i<g[key].length;i++)g[key][i]=Math.sin(i*1.731+n*.371)*1.3+Math.cos(i*.379);
for(let k=0;k<g.nz;k++)for(let j=0;j<g.ny;j++)g.fluid[(k*g.ny+j)*g.nx+7]=0;
const projection=projectClosedMac({...g,dt:1/120,density:1000,tolerance:1e-8,maxIterations:2000});
const report={format:'ocean-r006-reference-audit',version:'0.1.0',auditedSourceCommit:'aeeafa124d79f9cb3df2345b0563929ef9f1b47f',identities,
 baselineFindings:{
  waterSurface:{...waterTopology,meaning:'The production geometry function outputs a top-only sheet, without wetted cut faces. Open edges do not alone prove numerical water loss.'},
  slab:{sideQuads:4,bottomCap:false,perimeterErrors:gaps,meaning:'Actual mesh vertices disagree with the corner-only sidewall top interpolation.'},
  lateralBoundary:{water:'periodic in Z',foamAdvection:'clamped interpolation',visibleBoundary:'finite cutaway slab',probe:periodic,verdict:'inconsistent boundary semantics for a closed-sides display'},
  spray:{injectedOutsideProbe:true,outsideX,remainingAfterOneStep:sprayProbe.spray.length,outsideQueryDepth:sprayProbe.sample(sprayProbe.h,outsideX,0),meaning:'A targeted external particle survives; this establishes missing domain rejection, not the frequency of visual leakage in the public page.'},
  waterBalance:{test:'1440 fixed steps at native 144x112 grid',...defaultStats,meaning:'Small global residual cannot rule out periodic wrap, missing rendered walls or escaping spray.'},
  rockRepresentation:{type:'elliptical single-valued height mounds',undercutRepresentable:false,overhangRepresentable:false,styleAcceptance:false},
  smokeRepresentation:{type:'finite advected expanding parcels plus procedural emissive field',gasPressureProjection:false,combustionChemistry:false}},
 referenceResults:{closedBedPrototype:{...closedTopology,topAndSideShareVertexIds:true,perimeterSegments:closed.perimeterSegmentCount,role:'geometry closure example only, not an automatic fluid repair'},
  enlargementProbe:{domainM:[96,84],cells:[216,168],spacingM:[larger.dx,larger.dz],areaMultiplier:2.25,physicalTimeS:2,...larger.stats(),status:'short numerical probe only; no browser or quality validation'},
  macProjection:{accepted:projection.accepted,iterations:projection.iterations,...projection.metrics,capabilities:projection.capabilities}},
 liveRuntimeChanged:false,newBrowserTest:false,newPublicDeployment:false,thirdPartyProgramExecuted:false,thirdPartySourceAvailable:false,
 visualApproved:false,productionApproved:false};
const text=JSON.stringify(report,null,2)+'\n';
if(process.argv[3])await writeFile(resolve(process.argv[3]),text);else console.log(text);
