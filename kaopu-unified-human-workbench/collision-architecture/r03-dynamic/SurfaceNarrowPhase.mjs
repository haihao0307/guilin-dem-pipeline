/** Faster conservative bounds around the unchanged full-CSR surface oracle. */
import {SurfaceNarrowPhase as OracleSurface} from '../r02/SurfaceNarrowPhase.mjs';
export {SURFACE_TOLERANCE,closestTriangle,sweepSphereTriangle,bodyRegionForBone} from '../r02/SurfaceNarrowPhase.mjs';
const EPS=32*Number.EPSILON;
const empty=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});

/** Analytic affine extrema, with outward error allowance for products/sums.
 * No eight-corner allocation. Padding scales with absolute operand magnitudes,
 * including cancellation, and is many ulps beyond the short arithmetic chain.
 * Inputs must be finite affine matrices and finite geometric coordinates. */
export function affineBounds(b,m,view=false){
 const out=empty();
 for(let k=0;k<3;k++){
  const x=view?m[k]:m[k*4],y=view?-m[8+k]:m[k*4+1],z=view?m[4+k]:m[k*4+2],d=view?m[12+k]:m[k*4+3];
  const x0=x*(x<0?b.max[0]:b.min[0]),x1=x*(x<0?b.min[0]:b.max[0]);
  const y0=y*(y<0?b.max[1]:b.min[1]),y1=y*(y<0?b.min[1]:b.max[1]);
  const z0=z*(z<0?b.max[2]:b.min[2]),z1=z*(z<0?b.min[2]:b.max[2]);
  const pad=EPS*(Math.max(Math.abs(x0),Math.abs(x1))+Math.max(Math.abs(y0),Math.abs(y1))+Math.max(Math.abs(z0),Math.abs(z1))+Math.abs(d)+1);
  out.min[k]=x0+y0+z0+d-pad;out.max[k]=x1+y1+z1+d+pad;
 }
 return out;
}
export class SurfaceNarrowPhase extends OracleSurface {
 bounds(node,snapshot){
  const cached=snapshot.bounds.get(node.id);if(cached)return cached;
  const native=empty();
  for(const [joint,b] of node.influence){
   const q=affineBounds(b,snapshot.matrices[joint]);
   for(let k=0;k<3;k++){if(q.min[k]<native.min[k])native.min[k]=q.min[k];if(q.max[k]>native.max[k])native.max[k]=q.max[k];}
  }
  // Preserve every actual CSR influence and the original non-unit weight sum
  // envelope. Positive weights make this convex envelope conservative.
  for(let k=0;k<3;k++){
   const a=native.min[k]*node.minSum,b=native.min[k]*node.maxSum,c=native.max[k]*node.minSum,d=native.max[k]*node.maxSum;
   const pad=EPS*(Math.max(Math.abs(a),Math.abs(b),Math.abs(c),Math.abs(d))+1);
   native.min[k]=Math.min(a,b,c,d)-pad;native.max[k]=Math.max(a,b,c,d)+pad;
  }
  const result=affineBounds(native,snapshot.world,true);snapshot.bounds.set(node.id,result);return result;
 }
}
