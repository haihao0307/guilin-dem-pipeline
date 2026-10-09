/** Conservative full-CSR envelope, including joint-conditioned rest points.
 * Nonnegative normalized skinning is a convex combination. The union of all
 * transformed influence boxes therefore contains every skinned vertex. */
export function buildInfluenceEnvelope(human){
 const boxes=human.names.map(()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],count:0}));let maxWeightError=0;
 for(let v=0;v<human.N;v++){let sum=0;for(let n=0;n<human.range[v*2+1];n++){const k=(human.range[v*2]+n)*8,j=human.packed[k+3],w=human.packed[k+4];if(!Number.isInteger(j)||j<0||j>=boxes.length||!Number.isFinite(w)||w<0)throw Error('Invalid full CSR influence');sum+=w;if(w===0)continue;const b=boxes[j];for(let a=0;a<3;a++){const x=human.packed[k+a];if(!Number.isFinite(x))throw Error('Invalid rest influence point');b.min[a]=Math.min(b.min[a],x);b.max[a]=Math.max(b.max[a],x);}b.count++;}maxWeightError=Math.max(maxWeightError,Math.abs(sum-1));}
 if(maxWeightError>1e-5)throw Error('Full CSR weights are not normalized');return{boxes,maxWeightError,vertices:human.N};
}
export function posedEnvelope(envelope,matrices,{floorOffset=0,position=[0,0,0],padding=.005}={}){
 const out={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(let j=0;j<envelope.boxes.length;j++){const b=envelope.boxes[j];if(!b.count)continue;const m=new Float32Array(matrices[j]);for(let bits=0;bits<8;bits++){const p=[0,1,2].map(k=>(bits>>k)&1?b.max[k]:b.min[k]),native=[0,1,2].map(k=>m[k*4]*p[0]+m[k*4+1]*p[1]+m[k*4+2]*p[2]+m[k*4+3]),view=[native[0]+position[0],native[2]+floorOffset+position[1],-native[1]+position[2]];for(let k=0;k<3;k++){out.min[k]=Math.min(out.min[k],view[k]);out.max[k]=Math.max(out.max[k],view[k]);}}}
 const epsilon=padding+Math.max(...out.min.map(Math.abs),...out.max.map(Math.abs))*envelope.maxWeightError;for(let k=0;k<3;k++){out.min[k]-=epsilon;out.max[k]+=epsilon;}return out;
}
export const unionBounds=(a,b)=>({min:a.min.map((v,k)=>Math.min(v,b.min[k])),max:a.max.map((v,k)=>Math.max(v,b.max[k]))});
export const translatedBounds=(b,p)=>({min:b.min.map((v,k)=>v+p[k]),max:b.max.map((v,k)=>v+p[k])});
export function horizontalClearance(a,b){const x=Math.max(0,a.min[0]-b.max[0],b.min[0]-a.max[0]),z=Math.max(0,a.min[2]-b.max[2],b.min[2]-a.max[2]);return Math.hypot(x,z);}
export function containsHorizontal(outer,inner,epsilon=1e-8){return[0,2].every(k=>inner.min[k]>=outer.min[k]-epsilon&&inner.max[k]<=outer.max[k]+epsilon);}
