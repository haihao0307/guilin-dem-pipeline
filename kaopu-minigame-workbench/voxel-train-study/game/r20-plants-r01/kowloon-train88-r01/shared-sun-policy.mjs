// One host sun. This enclosure changes its camera, never its direction, colour,
// intensity, map resolution, or the construction/material functions.
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normal=a=>{const d=Math.hypot(...a);if(!(d>1e-8))throw Error('Nonzero sun direction required');return a.map(v=>v/d);};
export function fitSharedSun({direction,bounds,mapSize=[2048,2048],padding=2}){
 if(!Array.isArray(direction)||direction.length!==3||!direction.every(Number.isFinite)||!bounds?.length||!mapSize.every(v=>Number.isInteger(v)&&v>=4)||!(padding>0))throw Error('Invalid shared sun domain');
 const d=normal(direction),right=normal(cross(Math.abs(d[1])>.99?[0,0,1]:[0,1,0],d)),up=cross(d,right),axes=[right,up,d],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const b of bounds){if(!['min','max'].every(k=>Array.isArray(b[k])&&b[k].length===3&&b[k].every(Number.isFinite))||b.min.some((v,i)=>v>b.max[i]))throw Error('Invalid sun bounds');for(const x of[b.min[0],b.max[0]])for(const y of[b.min[1],b.max[1]])for(const z of[b.min[2],b.max[2]])for(let k=0;k<3;k++){const p=dot([x,y,z],axes[k]);lo[k]=Math.min(lo[k],p);hi[k]=Math.max(hi[k],p);}}
 const span=hi.map((v,i)=>Math.max(.01,v-lo[i])+2*padding),center=hi.map((v,i)=>(v+lo[i])/2);
 // The extra texel margin contains the at-most-half-texel center snap.
 const extents=span.slice(0,2).map((v,i)=>v/(1-2/mapSize[i]));
 for(let i=0;i<2;i++){const texel=extents[i]/mapSize[i];center[i]=Math.round(center[i]/texel)*texel;}
 const target=[0,1,2].map(i=>axes.reduce((n,a,k)=>n+a[i]*center[k],0));
 const eyeDistance=span[2]/2+1,position=target.map((v,i)=>v+d[i]*eyeDistance);
 return {position,target,up,direction:d,left:-extents[0]/2,right:extents[0]/2,bottom:-extents[1]/2,top:extents[1]/2,near:.5,far:span[2]+2,mapSize:mapSize.slice(),worldTexelM:extents.map((v,i)=>v/mapSize[i]),basis:axes,enclosedBounds:bounds.length};
}
export function pointInSunFrame(point,frame,epsilon=1e-7){
 const local=frame.basis.map(axis=>dot(point.map((v,i)=>v-frame.position[i]),axis));
 return local[0]>=frame.left-epsilon&&local[0]<=frame.right+epsilon&&local[1]>=frame.bottom-epsilon&&local[1]<=frame.top+epsilon&&-local[2]>=frame.near-epsilon&&-local[2]<=frame.far+epsilon;
}
