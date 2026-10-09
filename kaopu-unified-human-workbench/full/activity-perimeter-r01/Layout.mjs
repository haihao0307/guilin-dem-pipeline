import{RING_SPEC}from'../boxing-r02/Arena.mjs';
import{translatedBounds,horizontalClearance}from'./Envelope.mjs';
/** Planning footprints conservatively include original R02 apron/labels and
 * the real three stair treads (frontmost z=4.805m), not only rope squares.
 * Host should prefer Box3 bounds measured from the actual instantiated rings. */
export function r02PlanningArenaBounds(){return Array.from({length:18},(_,i)=>{const x=(i%6-2.5)*RING_SPEC.pitch,z=(Math.floor(i/6)-1)*RING_SPEC.pitch;return{id:'arena-'+i,min:[x-RING_SPEC.platform/2-.08,0,z-RING_SPEC.platform/2-.08],max:[x+RING_SPEC.platform/2+.08,2.7,z+4.85],source:'R02 component-complete conservative planning footprint'};});}
export function planPerimeterZones(sweeps,arenaBounds,{boundaryMargin=.8,betweenZones=1.5,arenaClearance=2}={}){
 if(!sweeps.length||!arenaBounds.length||![boundaryMargin,betweenZones,arenaClearance].every(x=>Number.isFinite(x)&&x>0))throw Error('Explicit occupied rings, actor sweeps and positive safety margins required');
 for(const b of[...sweeps,...arenaBounds])if(b.min?.length!==3||b.max?.length!==3||!b.min.every(Number.isFinite)||!b.max.every(Number.isFinite)||b.min.some((v,k)=>v>b.max[k]))throw Error('Invalid measured bounds');
 const ringMin=Math.min(...arenaBounds.map(b=>b.min[0])),ringMax=Math.max(...arenaBounds.map(b=>b.max[0])),front=Math.max(...arenaBounds.map(b=>b.max[2])),widths=sweeps.map(b=>b.max[0]-b.min[0]+2*boundaryMargin),total=widths.reduce((a,b)=>a+b,0)+betweenZones*(sweeps.length-1);let cursor=(ringMin+ringMax-total)/2;
 const zones=sweeps.map((b,i)=>{const position=[cursor+boundaryMargin-b.min[0],0,front+arenaClearance-b.min[2]],sweep=translatedBounds(b,position),zone={min:[cursor,0,front+arenaClearance-boundaryMargin],max:[cursor+widths[i],Math.max(3,b.max[1]+.5),sweep.max[2]+boundaryMargin]},result={position,zone,sweep};cursor+=widths[i]+betweenZones;return result;});
 let minArenaClearance=Infinity,minActorClearance=Infinity;for(let i=0;i<zones.length;i++){for(const a of arenaBounds)minArenaClearance=Math.min(minArenaClearance,horizontalClearance(zones[i].sweep,a));for(let j=0;j<i;j++)minActorClearance=Math.min(minActorClearance,horizontalClearance(zones[i].sweep,zones[j].sweep));}
 if(minArenaClearance<arenaClearance-1e-7||minActorClearance<betweenZones-1e-7)throw Error('Perimeter plan overlaps occupied scene');return{zones,arenaBounds,minimumArenaClearance:minArenaClearance,minimumActorClearance:minActorClearance,frame:'host root local Y-up metres',method:'disjoint complete-motion full-CSR envelopes, not a runtime collision solver'};
}
