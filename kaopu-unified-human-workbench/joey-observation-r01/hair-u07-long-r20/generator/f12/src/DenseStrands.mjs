import {clumpBudget} from './BundleVolumes.mjs';
import {point} from './NativeSurface.mjs';
import {add,sub,mul,mix,dot,len,unit,smooth} from './approved/LegacyFoundation.mjs';
export const STRAND_SAMPLES=49;
function randomStream(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
export function strandSeed(id){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
// One deterministic area sample is one actual root binding and one whole hair.
// Samples keep their identities when density changes; no screen-facing cards.
export function sampleDenseRoot(region,random){
 const wanted=random()*region.area;let a=0,b=region.cells.length-1;while(a<b){const m=(a+b)>>1;if(region.cells[m].cdf<wanted)a=m+1;else b=m;}
 const cell=region.cells[a],u=Math.sqrt(random()),v=random(),w=[1-u,u*(1-v),u*v],blend=key=>[0,1,2].map(k=>cell.v.reduce((n,p,j)=>n+w[j]*p[key][k],0));
 return {f:cell.f,b:blend('b'),p:blend('p'),chartP:blend('chartP')};
}
export function buildDenseStrands(builder,population,onProgress=()=>{}){
 const began=performance.now(),parts=[],clearance=new Map();let count=0,checked=0,corrected=0,maxStepMM=0,segmentChecks=0,segmentRepairs=0,unresolvedSegments=0,shortenedSegments=0;
 // Cache only the local nearest-body plane. Exact point coordinates are never
 // quantized; nearby hairs share a conservative clearance plane, not a path.
 function clear(p,u){if(!u)return p;const cell=.002,grid=p.map(x=>Math.round(x/cell)),key=grid.join(',');let plane=clearance.get(key);if(!plane){const h=builder.bvh.nearest(grid.map(x=>x*cell)),n=unit(point(builder.head,h.t,h.b,builder.normals));plane={p:h.p,n};clearance.set(key,plane);}const signed=dot(sub(p,plane.p),plane.n),gap=Math.min(.0011,u*.020);if(signed>=gap)return p;corrected++;return add(p,mul(plane.n,gap-signed));}
 for(const patch of population.patches){
  const children=builder.denseModels.filter(c=>c.region.id===patch.id),budget=clumpBudget(children.map(c=>c.model.metadata),patch.targetCount);
  for(const {region,model} of children){
   const target=budget.find(b=>b.id===region.clumpId).targetCount,positions=new Float32Array(target*STRAND_SAMPLES*3),bindings=new Float64Array(target*4),appearance=new Float32Array(target*4),sourceCharts=new Float32Array(target*3),random=randomStream(strandSeed(region.clumpId)),fringe=builder.u07Long!==true&&patch.id.startsWith('bang');
   for(let i=0;i<target;i++){
    const node=sampleDenseRoot(region,random),phase=random()*Math.PI*2,lengthVariation=random(),amplitude=(.00018+random()*.0005)*(fringe?.45:1),tone=random(),disk=model.coords(node);
    bindings.set([node.f,...node.b],i*4);sourceCharts.set(node.chartP,i*3);appearance.set([phase,lengthVariation,amplitude,tone],i*4);
    let previous=node.p;for(let j=0;j<STRAND_SAMPLES;j++){
     const u=j/(STRAND_SAMPLES-1),s=model.section(u);let p=model.at(node,u,false);
     // Small, smooth correlated departures retain each lock's transported
     // width/thickness frame. Variation vanishes exactly at the follicle.
     const envelope=smooth(u/.16),wave=Math.sin(phase+u*Math.PI*2.2)*amplitude*envelope;
     p=add(p,add(mul(s.widthAxis,wave),mul(s.thicknessAxis,Math.sin(phase*.7+u*5)*amplitude*.6*envelope)));
     // Distributed terminal lengths break a blunt clump cap without exploding
     // the silhouette. The last third smoothly changes, not the root or part.
     const tip=(lengthVariation-.52)*(fringe?.009:.018)*smooth((u-.65)/.35),tangent=model.metadata.sections[Math.min(64,Math.round(u*64))].tangent;
     p=add(p,mul(tangent,tip));if(fringe){const e=smooth((u-.46)/.54),sweep=patch.id==='bang-sweep';p[0]+=disk[0]*(sweep?.0048:.0030)*e;p[1]+=disk[0]*(sweep?.0055:.001)*e;p[1]+=(tone-.5)*(sweep?.006:.009)*e;}p=clear(p,u);
     if(j){segmentChecks++;let repaired=false;for(let attempt=0;attempt<12;attempt++){const hit=builder.bvh.segmentHit(mix(previous,p,.0001),p);if(!hit)break;repaired=true;const near=builder.bvh.nearest(hit.point),n=unit(point(builder.head,near.t,near.b,builder.normals)),distance=dot(sub(p,hit.point),n);p=add(p,mul(n,Math.max(.0015,.0015-distance)));const q=builder.bvh.nearest(p),N=unit(point(builder.head,q.t,q.b,builder.normals)),gap=dot(sub(p,q.p),N);if(gap<.0011)p=add(p,mul(N,.0011-gap));}if(repaired)segmentRepairs++;if(builder.bvh.segmentHit(mix(previous,p,.0001),p)){shortenedSegments++;for(let shrink=0;shrink<16&&builder.bvh.segmentHit(mix(previous,p,.0001),p);shrink++)p=mix(previous,p,.5);if(builder.bvh.segmentHit(mix(previous,p,.0001),p))unresolvedSegments++;}}
     positions.set(p,(i*STRAND_SAMPLES+j)*3);
     if(j)maxStepMM=Math.max(maxStepMM,len(sub(p,previous))*1000);previous=p;
     if(i%127===0&&j>0)checked++;
    }
   }
   count+=target;onProgress(count,population.totalTarget);parts.push({id:region.clumpId,patch:patch.id,parent:patch.parent,count:target,samples:STRAND_SAMPLES,positions,bindings,appearance,sourceCharts,seed:strandSeed(region.clumpId),sourceAreaCM2:region.area*1e4});
  }
 }
 if(count!==population.totalTarget)throw Error('实际发丝总数不等于面积密度预算');
 return {schema:'kaopu/dense-root-strands@1',coordinates:'head-aligned-Yup-Zfront',algorithm:'native-cell area CDF -> exact follicle -> same 2D volume field and transported twist -> smooth strand variation -> cached native-body clearance',count,samples:STRAND_SAMPLES,parts,seed:190915,buildMS:performance.now()-began,clearanceCells:clearance.size,clearanceCorrections:corrected,sampledBodyChecks:checked,segmentChecks,segmentRepairs,shortenedSegments,unresolvedSegments,maxStepMM,finiteWidthCollisionCertified:false,physicsImplemented:false};
}
