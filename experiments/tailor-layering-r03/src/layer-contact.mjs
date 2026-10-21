/**
 * Independent garment contact, in metres. Original implementation for this study.
 *
 * Mathematical references (no source implementation is copied):
 *   Macklin et al., XPBD (2016): https://mmacklin.com/xpbd.pdf
 *   Macklin et al., Small Steps (2019): https://mmacklin.com/smallsteps.pdf
 *   Brochu et al., exact CCD (2012), for the boundary of this discrete method:
 *   https://www.cs.ubc.ca/~rbridson/docs/brochu-siggraph2012-ccd.pdf
 *
 * This combines unsigned closest-feature proximity contacts with linearly swept
 * vertex/triangle and edge/edge endpoint-side guards. It does not stop at time
 * of impact: crossing and then
 * returning to the original side within one step is not prevented. It is not
 * complete CCD: grazing/coplanar motion, self collision and arbitrary
 * already-intersecting meshes are not covered.
 * A bounded neighbourhood and the actual last-step swept bounds are searched.
 * Only a proven finite swept crossing establishes persistent directed history.
 * Its material side is preserved at triangle interiors and transported across
 * internal mesh edges/vertices until resolved or legitimately released at an
 * actual open boundary. Ordinary proximity does not infer a material side from
 * a folded feature normal, so a triangle diagonal is not treated as an opening.
 *
 * Garments retain their own positions, topology, previous state and mass. Only
 * `positions` is mutated. thickness means TOTAL physical cloth thickness; the
 * minimum middle-surface distance is half the sum, plus contactMargin. The
 * host must derive/update velocities from the corrected positions as needed.
 * `friction` is bounded tangential displacement damping, NOT calibrated fabric
 * friction. It is applied with the same reciprocal-mass distribution as contact.
 */

import {LiveFeatureBounds, separatedLiveVertexFace, separatedLiveEdges} from './local-broadphase.mjs';

const EPS = 1e-12;
const INTERIOR_EPS = 1e-8;

function positive(value, fallback, name, allowZero = false) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || (allowZero ? result < 0 : result <= 0)) {
    throw new RangeError(`${name} must be ${allowZero ? 'nonnegative' : 'positive'} and finite`);
  }
  return result;
}

function emptyResult() {
  return {
    contactCount: 0,
    correctionCount: 0,
    candidateCount: 0,
    immovableContactCount: 0,
    maxDetectedPenetration: 0,
    maxCorrectedPenetration: 0,
    residualMaxPenetration: 0,
    residualCount: 0,
    residualCandidateCount: 0,
    residualScope: 'bounded cross-garment vertex-face and interior edge-edge proximity/swept queries plus retained unresolved contacts',
    continuousCollision: false,
    sweptVertexFace: true,
    sweptVertexFaceScope: 'linear vertex/triangle endpoint-side recovery; no global time-of-impact or cross-and-return guarantee',
    sweptCrossingCount: 0,
    edgeEdgeCollision: true,
    edgeEdgeScope: 'reciprocal interior segment proximity and linear endpoint-side crossing recovery; not complete CCD',
    edgeEdgeContactCount: 0,
    selfCollision: false,
    frictionModel: 'bounded tangential relative-displacement damping',
    sampleContactPoints: [],
  };
}

// Closest point on a triangle using its vertex, edge and face Voronoi regions.
// Output: [qx, qy, qz, b0, b1, b2, squared distance].
export function closestPoint(px, py, pz, positions, indices, offset, out) {
  const ia = indices[offset] * 3;
  const ib = indices[offset + 1] * 3;
  const ic = indices[offset + 2] * 3;
  const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
  const abx = positions[ib] - ax, aby = positions[ib + 1] - ay, abz = positions[ib + 2] - az;
  const acx = positions[ic] - ax, acy = positions[ic + 1] - ay, acz = positions[ic + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  let b0, b1, b2;
  if (d1 <= 0 && d2 <= 0) {
    b0 = 1; b1 = 0; b2 = 0;
  } else {
    const bpx = px - positions[ib], bpy = py - positions[ib + 1], bpz = pz - positions[ib + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) {
      b0 = 0; b1 = 1; b2 = 0;
    } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        b1 = d1 / (d1 - d3); b0 = 1 - b1; b2 = 0;
      } else {
        const cpx = px - positions[ic], cpy = py - positions[ic + 1], cpz = pz - positions[ic + 2];
        const d5 = abx * cpx + aby * cpy + abz * cpz;
        const d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) {
          b0 = 0; b1 = 0; b2 = 1;
        } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            b2 = d2 / (d2 - d6); b0 = 1 - b2; b1 = 0;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              b2 = (d4 - d3) / ((d4 - d3) + (d5 - d6)); b0 = 0; b1 = 1 - b2;
            } else {
              const denominator = va + vb + vc;
              if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-30) return false;
              b1 = vb / denominator; b2 = vc / denominator; b0 = 1 - b1 - b2;
            }
          }
        }
      }
    }
  }
  const qx = ax + b1 * abx + b2 * acx;
  const qy = ay + b1 * aby + b2 * acy;
  const qz = az + b1 * abz + b2 * acz;
  out[0] = qx; out[1] = qy; out[2] = qz;
  out[3] = b0; out[4] = b1; out[5] = b2;
  out[6] = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
  return Number.isFinite(out[6]);
}

function normal(positions, indices, offset, out) {
  const a = indices[offset] * 3, b = indices[offset + 1] * 3, c = indices[offset + 2] * 3;
  const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
  const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  if (!(length > 1e-16) || !Number.isFinite(length)) return false;
  out[0] = nx / length; out[1] = ny / length; out[2] = nz / length;
  return true;
}

// A moving point and moving triangle are coplanar at the roots of this cubic.
// Derivative roots partition it into monotone intervals; a bracket is refined
// before testing the actual triangle barycentrics. This is a crossing guard,
// not a general CCD or global time-of-impact solver (see header).
function sweptCrossing(a, vertex, b, face, scratch) {
  const k=vertex*3,t=b.triangles,ap=b.previous,p=b.positions,old=a.previous,cur=a.positions;
  const ia=t[face]*3,ib=t[face+1]*3,ic=t[face+2]*3;
  const ux=ap[ib]-ap[ia],uy=ap[ib+1]-ap[ia+1],uz=ap[ib+2]-ap[ia+2];
  const vx=ap[ic]-ap[ia],vy=ap[ic+1]-ap[ia+1],vz=ap[ic+2]-ap[ia+2];
  const dux=p[ib]-p[ia]-ux,duy=p[ib+1]-p[ia+1]-uy,duz=p[ib+2]-p[ia+2]-uz;
  const dvx=p[ic]-p[ia]-vx,dvy=p[ic+1]-p[ia+1]-vy,dvz=p[ic+2]-p[ia+2]-vz;
  const rx=old[k]-ap[ia],ry=old[k+1]-ap[ia+1],rz=old[k+2]-ap[ia+2];
  const drx=cur[k]-p[ia]-rx,dry=cur[k+1]-p[ia+1]-ry,drz=cur[k+2]-p[ia+2]-rz;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  const n1x=duy*vz-duz*vy+uy*dvz-uz*dvy,n1y=duz*vx-dux*vz+uz*dvx-ux*dvz,n1z=dux*vy-duy*vx+ux*dvy-uy*dvx;
  const n2x=duy*dvz-duz*dvy,n2y=duz*dvx-dux*dvz,n2z=dux*dvy-duy*dvx;
  const c0=rx*nx+ry*ny+rz*nz,c1=rx*n1x+ry*n1y+rz*n1z+drx*nx+dry*ny+drz*nz;
  const c2=rx*n2x+ry*n2y+rz*n2z+drx*n1x+dry*n1y+drz*n1z,c3=drx*n2x+dry*n2y+drz*n2z;
  const scale=Math.max(Math.abs(c0),Math.abs(c1),Math.abs(c2),Math.abs(c3));
  if(!(scale>1e-24))return null;
  if(Math.abs(c0)>Math.abs(c1)+Math.abs(c2)+Math.abs(c3))return null;
  if(Math.abs(c1)>2*Math.abs(c2)+3*Math.abs(c3)&&c0*(c0+c1+c2+c3)>=0)return null;
  const value=u=>((c3*u+c2)*u+c1)*u+c0;
  const stops=[0,1],A=3*c3,B=2*c2,C=c1;
  if(Math.abs(A)>scale*1e-14){const d=B*B-4*A*C;if(d>0){const r=Math.sqrt(d),u=(-B-r)/(2*A),v=(-B+r)/(2*A);if(u>0&&u<1)stops.push(u);if(v>0&&v<1)stops.push(v);}}
  else if(Math.abs(B)>scale*1e-14){const u=-C/B;if(u>0&&u<1)stops.push(u);}
  stops.sort((x,y)=>x-y);
  const triangle=scratch.sweptTriangle||(scratch.sweptTriangle=new Float64Array(9)),indices=scratch.sweptIndices||(scratch.sweptIndices=new Uint32Array([0,1,2])),q=scratch.sweptClosest||(scratch.sweptClosest=new Float64Array(7));
  for(let i=0;i+1<stops.length;i++) {
    let lo=stops[i],hi=stops[i+1],flo=value(lo),fhi=value(hi);
    // Touching/coplanar starts do not establish a reliable old side.
    if(flo===0||flo*fhi>=0)continue;
    const side=Math.sign(flo);
    for(let j=0;j<36;j++){const mid=(lo+hi)*.5,f=value(mid);if(f===0){lo=hi=mid;break;}if(Math.sign(f)===side){lo=mid;flo=f;}else hi=mid;}
    const u=(lo+hi)*.5;
    for(let j=0;j<3;j++)for(let d=0;d<3;d++){const idx=t[face+j]*3+d;triangle[j*3+d]=ap[idx]+u*(p[idx]-ap[idx]);}
    const x=old[k]+u*(cur[k]-old[k]),y=old[k+1]+u*(cur[k+1]-old[k+1]),z=old[k+2]+u*(cur[k+2]-old[k+2]);
    if(closestPoint(x,y,z,triangle,indices,0,q)&&q[6]<1e-16)return {side,bary:[q[3],q[4],q[5]],time:u};
  }
  return null;
}

// Closest points of two finite segments. Output is [s,t,ax-bx,ay-by,az-bz,d²].
// Endpoint regions remain vertex/face constraints; EE handles the two interiors.
export function closestSegments(p, a, b, q, c, d, out) {
  a*=3;b*=3;c*=3;d*=3;
  const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2];
  const vx=q[d]-q[c],vy=q[d+1]-q[c+1],vz=q[d+2]-q[c+2];
  const wx=p[a]-q[c],wy=p[a+1]-q[c+1],wz=p[a+2]-q[c+2];
  const A=ux*ux+uy*uy+uz*uz,B=ux*vx+uy*vy+uz*vz,C=vx*vx+vy*vy+vz*vz,D=ux*wx+uy*wy+uz*wz,E=vx*wx+vy*wy+vz*wz;
  if(!(A>1e-24&&C>1e-24))return false;
  const denominator=A*C-B*B,clamp=x=>Math.max(0,Math.min(1,x));
  let s=denominator>A*C*1e-14?clamp((B*E-C*D)/denominator):0,t=(B*s+E)/C;
  if(t<0){t=0;s=clamp(-D/A);}else if(t>1){t=1;s=clamp((B-D)/A);}
  out[0]=s;out[1]=t;out[2]=wx+s*ux-t*vx;out[3]=wy+s*uy-t*vy;out[4]=wz+s*uz-t*vz;
  out[5]=out[2]**2+out[3]**2+out[4]**2;
  return true;
}

function edgeNormal(a,edgeA,b,edgeB,previous,out) {
  const p=previous?a.previous:a.positions,q=previous?b.previous:b.positions,ea=a.topology.edgeVertices,eb=b.topology.edgeVertices;
  const i=ea[edgeA*2]*3,j=ea[edgeA*2+1]*3,k=eb[edgeB*2]*3,l=eb[edgeB*2+1]*3;
  const ux=p[j]-p[i],uy=p[j+1]-p[i+1],uz=p[j+2]-p[i+2],vx=q[l]-q[k],vy=q[l+1]-q[k+1],vz=q[l+2]-q[k+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
  if(!(length>Math.hypot(ux,uy,uz)*Math.hypot(vx,vy,vz)*1e-10))return false;
  out[0]=nx/length;out[1]=ny/length;out[2]=nz/length;return true;
}

function sweptEdgeCrossing(a,edgeA,b,edgeB,scratch,reference=null,events=false) {
  const ea=a.topology.edgeVertices,eb=b.topology.edgeVertices,indices=[ea[edgeA*2],ea[edgeA*2+1],eb[edgeB*2],eb[edgeB*2+1]],old=scratch.edgeOld||(scratch.edgeOld=new Float64Array(12)),delta=scratch.edgeDelta||(scratch.edgeDelta=new Float64Array(12));
  for(let v=0;v<4;v++){const g=v<2?a:b,k=indices[v]*3;for(let d=0;d<3;d++){old[v*3+d]=reference?reference[v*3+d]:g.previous[k+d];delta[v*3+d]=g.positions[k+d]-old[v*3+d];}}
  const u=[old[3]-old[0],old[4]-old[1],old[5]-old[2]],v=[old[9]-old[6],old[10]-old[7],old[11]-old[8]],r=[old[0]-old[6],old[1]-old[7],old[2]-old[8]];
  const du=[delta[3]-delta[0],delta[4]-delta[1],delta[5]-delta[2]],dv=[delta[9]-delta[6],delta[10]-delta[7],delta[11]-delta[8]],dr=[delta[0]-delta[6],delta[1]-delta[7],delta[2]-delta[8]];
  const cross=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
  const n0=cross(u,v),n1a=cross(du,v),n1b=cross(u,dv),n1=n1a.map((x,i)=>x+n1b[i]),n2=cross(du,dv);
  const c0=dot(r,n0),c1=dot(r,n1)+dot(dr,n0),c2=dot(r,n2)+dot(dr,n1),c3=dot(dr,n2),scale=Math.max(Math.abs(c0),Math.abs(c1),Math.abs(c2),Math.abs(c3));
  if(!(scale>1e-24)||Math.abs(c0)>Math.abs(c1)+Math.abs(c2)+Math.abs(c3))return null;
  if(Math.abs(c1)>2*Math.abs(c2)+3*Math.abs(c3)&&c0*(c0+c1+c2+c3)>=0)return null;
  const value=t=>((c3*t+c2)*t+c1)*t+c0,stops=[0,1],A=3*c3,B=2*c2,C=c1;
  if(Math.abs(A)>scale*1e-14){const disc=B*B-4*A*C;if(disc>0){const root=Math.sqrt(disc);for(const t of [(-B-root)/(2*A),(-B+root)/(2*A)])if(t>0&&t<1)stops.push(t);}}
  else if(Math.abs(B)>scale*1e-14){const t=-C/B;if(t>0&&t<1)stops.push(t);}
  stops.sort((x,y)=>x-y);
  const p=scratch.edgeAtTime||(scratch.edgeAtTime=new Float64Array(12)),q=scratch.edgeRootClosest||(scratch.edgeRootClosest=new Float64Array(6));
  let first=null,orientationFlips=0;
  for(let i=0;i+1<stops.length;i++){
    let lo=stops[i],hi=stops[i+1],left=value(lo),right=value(hi);if(left===0||left*right>=0)continue;
    const side=Math.sign(left);for(let j=0;j<36;j++){const mid=(lo+hi)*.5,f=value(mid);if(f===0){lo=hi=mid;break;}if(Math.sign(f)===side)lo=mid;else hi=mid;}
    const time=(lo+hi)*.5;for(let j=0;j<12;j++)p[j]=old[j]+time*delta[j];
    if(closestSegments(p,0,1,p,2,3,q)&&q[5]<1e-16&&q[0]>INTERIOR_EPS&&q[0]<1-INTERIOR_EPS&&q[1]>INTERIOR_EPS&&q[1]<1-INTERIOR_EPS){first||={side,time,s:q[0],t:q[1]};if(!events)return first;}
    else orientationFlips++;
  }
  return events?{crossing:first,orientationFlips}:first;
}

class TriangleHash {
  constructor(garment, expansion, cellSize, maxCells, swept=false) {
    this.garment = garment;
    this.cellSize = cellSize;
    this.cells = new Map();
    this.large = [];
    this.stamps=new Uint32Array(garment.triangles.length/3);this.epoch=0;this.query=[];
    this.bounds = new Float64Array(garment.triangles.length * 2);
    const p = garment.positions, old=garment.previous, t = garment.triangles;
    for (let f = 0; f < t.length; f += 3) {
      const a = t[f] * 3, b = t[f + 1] * 3, c = t[f + 2] * 3, row = f * 2;
      const x0=(swept?Math.min(p[a],p[b],p[c],old[a],old[b],old[c]):Math.min(p[a],p[b],p[c]))-expansion,y0=(swept?Math.min(p[a+1],p[b+1],p[c+1],old[a+1],old[b+1],old[c+1]):Math.min(p[a+1],p[b+1],p[c+1]))-expansion,z0=(swept?Math.min(p[a+2],p[b+2],p[c+2],old[a+2],old[b+2],old[c+2]):Math.min(p[a+2],p[b+2],p[c+2]))-expansion;
      const x1=(swept?Math.max(p[a],p[b],p[c],old[a],old[b],old[c]):Math.max(p[a],p[b],p[c]))+expansion,y1=(swept?Math.max(p[a+1],p[b+1],p[c+1],old[a+1],old[b+1],old[c+1]):Math.max(p[a+1],p[b+1],p[c+1]))+expansion,z1=(swept?Math.max(p[a+2],p[b+2],p[c+2],old[a+2],old[b+2],old[c+2]):Math.max(p[a+2],p[b+2],p[c+2]))+expansion;
      const bounds=this.bounds;bounds[row]=x0;bounds[row+1]=y0;bounds[row+2]=z0;bounds[row+3]=x1;bounds[row+4]=y1;bounds[row+5]=z1;
      const lx=Math.floor(x0/cellSize),ly=Math.floor(y0/cellSize),lz=Math.floor(z0/cellSize),hx=Math.floor(x1/cellSize),hy=Math.floor(y1/cellSize),hz=Math.floor(z1/cellSize);
      const count=(hx-lx+1)*(hy-ly+1)*(hz-lz+1);
      if (count > maxCells) {
        this.large.push(f);
        continue;
      }
      for (let x = lx; x <= hx; x++) for (let y = ly; y <= hy; y++) for (let z = lz; z <= hz; z++) {
        const key = this.key(x,y,z);
        let bucket = this.cells.get(key);
        if (!bucket) this.cells.set(key, bucket = []);
        bucket.push(f);
      }
    }
  }

  key(x,y,z) {
    // Three signed 17-bit grid coordinates occupy 51 exact integer bits.
    // Fall back outside that range; never alias distant cells by truncation.
    if(x>=-65536&&x<65536&&y>=-65536&&y<65536&&z>=-65536&&z<65536)return (x+65536)*17179869184+(y+65536)*131072+z+65536;
    return `${x},${y},${z}`;
  }

  candidates(x, y, z) {
    const h = this.cellSize;
    const local = this.cells.get(this.key(Math.floor(x/h),Math.floor(y/h),Math.floor(z/h))) || [];
    return this.large.length ? local.concat(this.large) : local;
  }

  sweptCandidates(x,y,z,px,py,pz) {
    const h=this.cellSize,lx=Math.floor(Math.min(x,px)/h),ly=Math.floor(Math.min(y,py)/h),lz=Math.floor(Math.min(z,pz)/h),hx=Math.floor(Math.max(x,px)/h),hy=Math.floor(Math.max(y,py)/h),hz=Math.floor(Math.max(z,pz)/h);
    if(lx===hx&&ly===hy&&lz===hz)return this.candidates(x,y,z);
    const out=this.query;out.length=0;this.epoch++;if(this.epoch===4294967295){this.stamps.fill(0);this.epoch=1;}
    const epoch=this.epoch,stamps=this.stamps;
    if((hx-lx+1)*(hy-ly+1)*(hz-lz+1)>512){for(let f=0;f<this.garment.triangles.length;f+=3)out.push(f);return out;}
    for(let a=lx;a<=hx;a++)for(let b=ly;b<=hy;b++)for(let c=lz;c<=hz;c++)for(const f of this.cells.get(this.key(a,b,c))||[]){if(stamps[f/3]!==epoch){stamps[f/3]=epoch;out.push(f);}}
    for(const f of this.large)if(stamps[f/3]!==epoch){stamps[f/3]=epoch;out.push(f);}
    return out;
  }

  contains(offset, x, y, z) {
    const b = this.bounds, j = offset * 2;
    return x >= b[j] && y >= b[j + 1] && z >= b[j + 2] && x <= b[j + 3] && y <= b[j + 4] && z <= b[j + 5];
  }

  overlapsSweep(offset,x,y,z,px,py,pz) {
    const b=this.bounds,j=offset*2;
    return Math.max(x,px)>=b[j]&&Math.max(y,py)>=b[j+1]&&Math.max(z,pz)>=b[j+2]&&Math.min(x,px)<=b[j+3]&&Math.min(y,py)<=b[j+4]&&Math.min(z,pz)<=b[j+5];
  }
}

/**
 * solve([{ id, positions, previous?, triangles, inverseMass?, thickness,
 *          enabled?: true }], { friction?: 0..1, passes?: 2 })
 *
 * Counts refer to vertex/triangle and interior edge/edge constraints, not unique
 * physical contact patches. Vertex/face directions are tested reciprocally.
 * maxCorrectedPenetration is the largest
 * applied relative normal correction, NOT a claim that all penetration ended.
 * Residual is independently recomputed after the final correction over the
 * bounded search domain; it is not a full triangle-intersection audit.
 */
export class LayerContact {
  constructor(options = {}) {
    this.cellSize = positive(options.cellSize, 0.04, 'cellSize');
    this.searchMargin = positive(options.searchMargin, 0.006, 'searchMargin', true);
    this.contactMargin = positive(options.contactMargin, 0.0005, 'contactMargin', true);
    this.maxCorrection = positive(options.maxCorrection, 0.01, 'maxCorrection');
    this.tolerance = positive(options.tolerance, 1e-7, 'tolerance', true);
    this.maxCellsPerTriangle = Math.floor(positive(options.maxCellsPerTriangle, 512, 'maxCellsPerTriangle'));
    this.sampleLimit = Math.floor(positive(options.sampleLimit, 12, 'sampleLimit', true));
    this.cacheSkin=positive(options.cacheSkin,.012,'cacheSkin');
    this.broadphaseCache=options.broadphaseCache!==false;
    this.optimizationEnabled=options.optimizationEnabled!==false;
    this._history = new Map();
    this._sides = new Map();
    this._frameSides = new Map();
    this._edgeReferences = new Map();
    this._pending = new Map();
    this._topologies = new WeakMap();
    this._broadphases = new Map();
    this._edgeBroadphases = new Map();
  }

  setOptimizationEnabled(enabled) {
    if(typeof enabled!=='boolean')throw new TypeError('optimizationEnabled must be boolean');
    this.optimizationEnabled=enabled;
    // Switching execution paths must not reset physical/contact history.
    return this;
  }

  _statistics(garments) {
    const stats={broadphaseBuildMS:0,broadphaseBuildCount:0,broadphaseReuseCount:0,
      optimizationEnabled:this.optimizationEnabled,localBoundsBuildMS:0,
      localBoundsRefitVertices:0,localBoundsRefitFaces:0,localBoundsRefitEdges:0,
      vertexFaceTests:0,edgeEdgeTests:0,sweptVertexFaceTests:0,sweptEdgeEdgeTests:0,
      localBoundsRejectedVF:0,localBoundsRejectedEE:0,
      ordinaryDistanceRejectedVF:0,ordinaryDistanceRejectedEE:0,
      adjacentFaceTests:0};
    for(const g of garments)if(g.bounds){stats.localBoundsBuildMS+=g.boundsBuildMS;g.bounds.stats=stats;}
    return stats;
  }

  reset() {
    this._history.clear();
    this._sides.clear();
    this._frameSides.clear();
    this._edgeReferences.clear();
    this._pending.clear();
    this._broadphases.clear();
    this._edgeBroadphases.clear();
    return this;
  }

  // Transactional host rollback must retain proven crossing provenance as
  // well as positions. These maps contain immutable per-call history values;
  // solve replaces them and rebinds pending contacts to newly prepared inputs.
  // Geometry belongs to the host and must be restored separately.
  checkpoint() {
    return {owner:this,history:new Map(this._history),sides:new Map(this._sides),
      frameSides:new Map(this._frameSides),edgeReferences:new Map(this._edgeReferences),pending:new Map(this._pending)};
  }

  restore(checkpoint) {
    if(checkpoint?.owner!==this)throw new TypeError('Contact checkpoint belongs to a different solver');
    this._history=new Map(checkpoint.history);this._sides=new Map(checkpoint.sides);
    this._frameSides=new Map(checkpoint.frameSides);this._edgeReferences=new Map(checkpoint.edgeReferences);
    this._pending=new Map(checkpoint.pending);
    this._broadphases.clear();this._edgeBroadphases.clear();
    this._releasedSides=new Set();this._edgeWorkingReferences=new Map(this._edgeReferences);this._stats=null;
    return this;
  }

  _prepare(inputs) {
    const ids = new Set();
    const mutablePositions = [];
    return inputs.filter(g => g && g.enabled !== false).map(input => {
      if (input.id === undefined || input.id === null) throw new TypeError('Every garment needs a stable id');
      const id = String(input.id);
      if (ids.has(id)) throw new TypeError(`Duplicate garment id: ${id}`);
      ids.add(id);
      const p = input.positions, triangles = input.triangles;
      if (!p || p.length % 3 || !triangles || triangles.length % 3) throw new TypeError(`${id}: flat xyz positions and flat triangle indices required`);
      for (const other of mutablePositions) {
        const overlappingViews = p.buffer && p.buffer === other.buffer && p.byteOffset < other.byteOffset + other.byteLength && other.byteOffset < p.byteOffset + p.byteLength;
        if (p === other || overlappingViews) throw new TypeError(`${id}: independent garments cannot share mutable positions`);
      }
      mutablePositions.push(p);
      const count = p.length / 3;
      for (const value of p) if (!Number.isFinite(value)) throw new RangeError(`${id}: nonfinite position`);
      for (const index of triangles) if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError(`${id}: triangle index outside positions`);
      const inverseMass = input.inverseMass;
      if (inverseMass) {
        if (inverseMass.length !== count) throw new RangeError(`${id}: inverseMass length mismatch`);
        for (const value of inverseMass) if (!Number.isFinite(value) || value < 0) throw new RangeError(`${id}: invalid inverse mass`);
      }
      const prior = this._history.get(id);
      const previous = input.previous || (prior?.triangles === triangles && prior.positions.length === p.length ? prior.positions : p);
      if (previous.length !== p.length) throw new RangeError(`${id}: previous length mismatch`);
      for (const value of previous) if (!Number.isFinite(value)) throw new RangeError(`${id}: nonfinite previous position`);
      let topology=this._topologies.get(triangles);
      if(!topology||topology.count!==count) {
        const edges=new Map(),vertexFaces=Array.from({length:count},()=>[]),boundaryVertices=new Uint8Array(count);
        for(let face=0;face<triangles.length;face+=3)for(let j=0;j<3;j++) {
          const a=triangles[face+j],b=triangles[face+(j+1)%3],key=Math.min(a,b)*count+Math.max(a,b);
          vertexFaces[a].push(face);let adjacent=edges.get(key);if(!adjacent)edges.set(key,adjacent=[]);adjacent.push(face);
        }
        for(const [key,faces]of edges)if(faces.length===1){boundaryVertices[Math.floor(key/count)]=1;boundaryVertices[key%count]=1;}
        const faceLinks=Array.from({length:triangles.length/3},()=>[]),orientations=new Int8Array(triangles.length/3);
        for(const [key,faces]of edges)if(faces.length>1){const a=Math.floor(key/count),b=key%count,direction=f=>{for(let j=0;j<3;j++)if(triangles[f+j]===a&&triangles[f+(j+1)%3]===b)return 1;return -1;};for(let j=1;j<faces.length;j++){const u=faces[0]/3,v=faces[j]/3,relative=-direction(faces[0])*direction(faces[j]);faceLinks[u].push([v,relative]);faceLinks[v].push([u,relative]);}}
        for(let f=0;f<orientations.length;f++)if(!orientations[f]){orientations[f]=1;const stack=[f];while(stack.length){const current=stack.pop();for(const [other,relative]of faceLinks[current])if(!orientations[other]){orientations[other]=orientations[current]*relative;stack.push(other);}}}
        const edgeVertices=new Uint32Array(edges.size*2),edgeTriangles=new Uint32Array(edges.size*3);let edgeIndex=0;
        for(const key of edges.keys()){const a=Math.floor(key/count),b=key%count;edgeVertices[edgeIndex*2]=a;edgeVertices[edgeIndex*2+1]=b;edgeTriangles[edgeIndex*3]=a;edgeTriangles[edgeIndex*3+1]=edgeTriangles[edgeIndex*3+2]=b;edgeIndex++;}
        topology={count,edges,vertexFaces,boundaryVertices,orientations,edgeVertices,edgeTriangles};this._topologies.set(triangles,topology);
      }
      const motion=new Float64Array(count);let maxMotion=0;
      for(let i=0;i<count;i++){const k=i*3;motion[i]=Math.hypot(p[k]-previous[k],p[k+1]-previous[k+1],p[k+2]-previous[k+2]);maxMotion=Math.max(maxMotion,motion[i]);}
      const garment={ id, positions: p, triangles, inverseMass, thickness: positive(input.thickness, 0.001, `${id}.thickness`, true), previous: Float64Array.from(previous), count, topology, motion,maxMotion,historyMatches:prior?.triangles===triangles&&prior.positions.length===p.length };
      if(this.optimizationEnabled){const started=performance.now();garment.bounds=new LiveFeatureBounds(garment);garment.boundsBuildMS=performance.now()-started;}
      return garment;
    });
  }

  _feature(b,face,q) {
    const zeros=[];for(let j=0;j<3;j++)if(q[3+j]<=INTERIOR_EPS)zeros.push(j);
    if(!zeros.length)return null;
    if(zeros.length===1){const a=b.triangles[face+(zeros[0]+1)%3],c=b.triangles[face+(zeros[0]+2)%3],faces=b.topology.edges.get(Math.min(a,c)*b.count+Math.max(a,c));return {boundary:faces.length===1,faces};}
    let j=0;if(q[4]>q[3])j=1;if(q[5]>q[3+j])j=2;const vertex=b.triangles[face+j];
    return {boundary:!!b.topology.boundaryVertices[vertex],faces:b.topology.vertexFaces[vertex]};
  }

  _featureNormal(positions,indices,face,feature,out,scratch) {
    if(!feature||feature.boundary)return normal(positions,indices,face,out);
    let x=0,y=0,z=0;for(const f of feature.faces)if(normal(positions,indices,f,scratch)){x+=scratch[0];y+=scratch[1];z+=scratch[2];}
    const length=Math.hypot(x,y,z);if(!(length>EPS))return normal(positions,indices,face,out);
    out[0]=x/length;out[1]=y/length;out[2]=z/length;return true;
  }

  _featureOwner(a,vertex,b,face,feature,q,scratch) {
    if(!feature)return face;
    const other=scratch.adjacentClosest||(scratch.adjacentClosest=new Float64Array(7)),k=vertex*3,p=a.positions;
    let owner=face,distance=q[6];
    for(const f of feature.faces)if(f!==face&&(this._stats&&(this._stats.adjacentFaceTests++),closestPoint(p[k],p[k+1],p[k+2],b.positions,b.triangles,f,other))) {
      // The Voronoi regions of adjacent triangles must be considered together.
      // An internal diagonal is not another independent rounded obstacle when
      // its adjacent triangle already contains the nearer surface point.
      if(other[6]<distance-1e-18){owner=f;distance=other[6];}
      else if(f<owner&&Math.abs(other[6]-distance)<1e-18&&(other[0]-q[0])**2+(other[1]-q[1])**2+(other[2]-q[2])**2<1e-18)owner=f;
    }
    return owner;
  }

  _contact(a, vertex, b, face, gap, radius, oldSides, newSides, scratch) {
    // Without any directed history, an expanded swept box separated by the
    // physical gap proves both no proximity contact and no finite crossing.
    // Once a crossing establishes history, retain the original search radius.
    const queryRadius=this.optimizationEnabled&&!oldSides.size&&!newSides.size&&radius<Infinity?gap:radius;
    if(radius<Infinity&&(this.optimizationEnabled?separatedLiveVertexFace(a.bounds,vertex,b.bounds,face,queryRadius):separatedVFSweep(a,vertex,b,face,radius))){if(this._stats)this._stats.localBoundsRejectedVF++;return null;}
    const index=vertex*3,p=a.positions,q=scratch.closest;
    if(this._stats)this._stats.vertexFaceTests++;
    if(!closestPoint(p[index],p[index+1],p[index+2],b.positions,b.triangles,face,q))return null;
    // Actual feature motion bounds a possible finite-triangle crossing. A
    // proximity pseudonormal can reverse at a fold without any physical hit,
    // so its sign is never the evidence used to create directed history.
    const motion=a.motion[vertex]+Math.max(b.motion[b.triangles[face]],b.motion[b.triangles[face+1]],b.motion[b.triangles[face+2]]);
    let crossing=null;
    if(q[6]<=motion*motion+1e-20){if(this._stats)this._stats.sweptVertexFaceTests++;crossing=sweptCrossing(a,vertex,b,face,scratch);}
    if(q[6]>radius*radius&&!crossing)return null;
    if(crossing){
      for(let d=0;d<3;d++){q[d]=0;for(let j=0;j<3;j++)q[d]+=crossing.bary[j]*b.positions[b.triangles[face+j]*3+d];q[3+d]=crossing.bary[d];}
      q[6]=(p[index]-q[0])**2+(p[index+1]-q[1])**2+(p[index+2]-q[2])**2;
    }
    if(this.optimizationEnabled&&!crossing&&Math.sqrt(q[6])>=gap){
      const historyKey=oldSides.size||newSides.size?JSON.stringify([a.id,vertex,b.id,face/3]):null;
      if(!historyKey||(!oldSides.has(historyKey)&&!newSides.has(historyKey))){if(this._stats)this._stats.ordinaryDistanceRejectedVF++;return null;}
    }
    const n=scratch.normal,feature=this._feature(b,face,q);
    if(!crossing&&this._featureOwner(a,vertex,b,face,feature,q,scratch)!==face)return null;
    const featureScratch=scratch.featureNormal||(scratch.featureNormal=new Float64Array(3));
    if(!this._featureNormal(b.positions,b.triangles,face,feature,n,featureScratch))return null;
    const key=JSON.stringify([a.id,vertex,b.id,face/3]);
    const delta=[p[index]-q[0],p[index+1]-q[1],p[index+2]-q[2]],planeDistance=delta[0]*n[0]+delta[1]*n[1]+delta[2]*n[2];
    if(feature?.boundary)this._releaseSide(key,oldSides,newSides);
    const retainedSide=newSides.get(key)||oldSides.get(key),directed=!feature?.boundary&&!!(retainedSide||crossing);
    const side=retainedSide||crossing?.side||Math.sign(planeDistance)||1;
    let distance=Math.sqrt(q[6]);
    if(directed&&!feature){distance=side*planeDistance;for(let d=0;d<3;d++)n[d]*=side;}
    else{
      const sign=directed?side*(Math.sign(planeDistance)||side):1;
      if(distance>EPS)for(let d=0;d<3;d++)n[d]=sign*delta[d]/distance;else for(let d=0;d<3;d++)n[d]*=side;
      distance*=sign;
    }
    const penetration=gap-distance;if(!(penetration>this.tolerance))return null;
    if(directed){newSides.set(key,side);this._releasedSides?.delete(key);}
    return{key,vertex,face,bary:[q[3],q[4],q[5]],normal:[n[0],n[1],n[2]],penetration,side,directed,boundaryFeature:!!feature?.boundary,crossing:!!crossing,a,b};
  }

  _buildCandidates(a,b,radius) {
    const started=performance.now(),hash=new TriangleHash(b,radius+this.cacheSkin,this.cellSize,this.maxCellsPerTriangle,true);
    const lists=Array.from({length:a.count},()=>[]),p=a.positions,old=a.previous;
    for(let i=0;i<a.count;i++){const j=i*3,list=lists[i];for(const f of hash.sweptCandidates(p[j],p[j+1],p[j+2],old[j],old[j+1],old[j+2]))if(hash.overlapsSweep(f,p[j],p[j+1],p[j+2],old[j],old[j+1],old[j+2]))list.push(f);}
    if(this._stats){this._stats.broadphaseBuildMS+=performance.now()-started;this._stats.broadphaseBuildCount++;}
    return {aId:a.id,bId:b.id,aTriangles:a.triangles,bTriangles:b.triangles,radius,lists,aCurrent:Float64Array.from(p),aPrevious:Float64Array.from(old),bCurrent:Float64Array.from(b.positions),bPrevious:Float64Array.from(b.previous)};
  }

  _cacheValid(cache,a,b,radius) {
    if(!cache||!this.broadphaseCache||cache.aTriangles!==a.triangles||cache.bTriangles!==b.triangles||cache.radius!==radius||cache.aCurrent.length!==a.positions.length||cache.bCurrent.length!==b.positions.length)return false;
    const limit=this.cacheSkin*.5;
    for(let i=0;i<a.positions.length;i++)if(Math.abs(a.positions[i]-cache.aCurrent[i])>limit||Math.abs(a.previous[i]-cache.aPrevious[i])>limit)return false;
    for(let i=0;i<b.positions.length;i++)if(Math.abs(b.positions[i]-cache.bCurrent[i])>limit||Math.abs(b.previous[i]-cache.bPrevious[i])>limit)return false;
    return true;
  }

  _movedPastSkin(cache,contact) {
    const {a,b,vertex,face}=contact,k=vertex*3,limit=this.cacheSkin*.5;
    for(let d=0;d<3;d++)if(Math.abs(a.positions[k+d]-cache.aCurrent[k+d])>limit)return true;
    for(let j=0;j<3;j++){const i=b.triangles[face+j]*3;for(let d=0;d<3;d++)if(Math.abs(b.positions[i+d]-cache.bCurrent[i+d])>limit)return true;}
    return false;
  }

  _visit(a, b, callback, oldSides, newSides) {
    const gap = (a.thickness + b.thickness) * 0.5 + this.contactMargin;
    const radius = gap + this.searchMargin;
    const cacheKey=JSON.stringify([a.id,b.id]);let cache=this._broadphases.get(cacheKey);
    // Candidate lists use a conservative skin. Each endpoint may move at most
    // half that skin in each axis. Crossing that bound rebuilds immediately,
    // including during a correction sweep; a per-constraint correction cap is
    // never mistaken for a bound on a triangle's accumulated motion.
    if(!this._cacheValid(cache,a,b,radius)){cache=this._buildCandidates(a,b,radius);this._broadphases.set(cacheKey,cache);}
    else if(this._stats)this._stats.broadphaseReuseCount++;
    const scratch = { closest: new Float64Array(7), normal: new Float64Array(3), previousNormal: new Float64Array(3) };
    let candidates = 0;
    for (let i = 0; i < a.count; i++) {
      for(let index=0;index<cache.lists[i].length;index++) {
        const f=cache.lists[i][index];
        candidates++;
        const contact = this._contact(a, i, b, f, gap, radius, oldSides, newSides, scratch);
        if (contact){callback(contact);if(this._movedPastSkin(cache,contact)){cache=this._buildCandidates(a,b,radius);this._broadphases.set(cacheKey,cache);index=-1;}}
      }
    }
    return candidates;
  }

  _activePending(garments) {
    const byId=new Map(garments.map(g=>[g.id,g])),out=[];
    for(const prior of this._pending.values()) {
      const a=byId.get(prior.a.id),b=byId.get(prior.b.id);
      if(a&&b&&a.triangles===prior.a.triangles&&b.triangles===prior.b.triangles&&a.count===prior.a.count&&b.count===prior.b.count)out.push({...prior,a,b});
    }
    return out;
  }

  _releaseSide(key,oldSides,newSides) {
    if(oldSides.has(key)||newSides.has(key)||this._edgeWorkingReferences?.has(key)){
      oldSides.delete(key);newSides.delete(key);this._releasedSides?.add(key);this._edgeWorkingReferences?.delete(key);
    }
  }

  _edgeReference(contact) {
    const result=new Float64Array(12),{a,b,idsA,idsB}=contact;
    for(let v=0;v<4;v++){const g=v<2?a:b,id=v<2?idsA[v]:idsB[v-2];for(let d=0;d<3;d++)result[v*3+d]=g.positions[id*3+d];}
    return result;
  }

  _edgeContact(a,edgeA,b,edgeB,gap,radius,oldSides,newSides,scratch) {
    const ea=a.topology.edgeVertices,eb=b.topology.edgeVertices,q=scratch.edgeClosest||(scratch.edgeClosest=new Float64Array(6));
    const ai=ea[edgeA*2],aj=ea[edgeA*2+1],bi=eb[edgeB*2],bj=eb[edgeB*2+1];
    const noHistory=!oldSides.size&&!newSides.size&&!this._edgeWorkingReferences?.size;
    const queryRadius=this.optimizationEnabled&&noHistory&&radius<Infinity?gap:radius;
    if(radius<Infinity&&(this.optimizationEnabled?separatedLiveEdges(a.bounds,edgeA,b.bounds,edgeB,queryRadius):separatedEESweep(a,ai,aj,b,bi,bj,radius))){if(this._stats)this._stats.localBoundsRejectedEE++;return null;}
    if(this._stats)this._stats.edgeEdgeTests++;
    if(!closestSegments(a.positions,ai,aj,b.positions,bi,bj,q))return null;
    const motion=Math.max(a.motion[ai],a.motion[aj])+Math.max(b.motion[bi],b.motion[bj]);
    let crossing=null;
    if(q[5]<=motion*motion+1e-20){if(this._stats)this._stats.sweptEdgeEdgeTests++;crossing=sweptEdgeCrossing(a,edgeA,b,edgeB,scratch);}
    if(q[5]>radius*radius&&!crossing)return null;
    if(crossing){
      q[0]=crossing.s;q[1]=crossing.t;
      for(let d=0;d<3;d++)q[2+d]=(1-q[0])*a.positions[ai*3+d]+q[0]*a.positions[aj*3+d]-(1-q[1])*b.positions[bi*3+d]-q[1]*b.positions[bj*3+d];
      q[5]=q[2]**2+q[3]**2+q[4]**2;
    }
    const key=JSON.stringify([a.id,'edge:'+edgeA,b.id,edgeB]);
    if(this.optimizationEnabled&&!crossing&&Math.sqrt(q[5])>=gap&&!oldSides.has(key)&&!newSides.has(key)&&!this._edgeWorkingReferences?.has(key)){if(this._stats)this._stats.ordinaryDistanceRejectedEE++;return null;}
    if(q[0]<=INTERIOR_EPS||q[0]>=1-INTERIOR_EPS||q[1]<=INTERIOR_EPS||q[1]>=1-INTERIOR_EPS){this._releaseSide(key,oldSides,newSides);return null;}
    const n=scratch.edgeNormal||(scratch.edgeNormal=new Float64Array(3));if(!edgeNormal(a,edgeA,b,edgeB,false,n))return null;
    const currentDistance=q[2]*n[0]+q[3]*n[1]+q[4]*n[2];let retained=newSides.get(key)||oldSides.get(key);
    const reference=this._edgeWorkingReferences?.get(key);
    if(retained&&reference){
      // A true unresolved crossing survives legal changes of the u×v frame.
      // Proximity alone does not create a persistent side in the first place.
      if(this._stats)this._stats.sweptEdgeEdgeTests++;
      const events=sweptEdgeCrossing(a,edgeA,b,edgeB,scratch,reference,true);
      if(events?.orientationFlips%2){retained=-retained;oldSides.set(key,retained);newSides.set(key,retained);}
    }
    const directed=!!(retained||crossing),side=retained||crossing?.side||Math.sign(currentDistance)||1,distance=directed?side*currentDistance:Math.sqrt(q[5]);
    const direction=directed||distance<=EPS?[n[0]*side,n[1]*side,n[2]*side]:[q[2]/distance,q[3]/distance,q[4]/distance];
    const contact={kind:'edge-edge',key,a,b,edgeA,edgeB,idsA:[ai,aj],idsB:[bi,bj],baryA:[1-q[0],q[0]],baryB:[1-q[1],q[1]],normal:direction,side,directed,penetration:gap-distance,crossing:!!crossing};
    if(retained)this._edgeWorkingReferences?.set(key,this._edgeReference(contact));
    if(!(contact.penetration>this.tolerance))return null;
    if(directed){newSides.set(key,side);this._releasedSides?.delete(key);this._edgeWorkingReferences?.set(key,this._edgeReference(contact));}
    return contact;
  }

  _buildEdgeCandidates(a,b,radius) {
    const started=performance.now(),proxy={...b,triangles:b.topology.edgeTriangles},hash=new TriangleHash(proxy,radius+this.cacheSkin,this.cellSize,this.maxCellsPerTriangle,true);
    const edge=a.topology.edgeVertices,p=a.positions,old=a.previous,lists=Array.from({length:edge.length/2},()=>[]);
    for(let e=0;e<lists.length;e++){
      const i=edge[e*2]*3,j=edge[e*2+1]*3,lx=Math.min(p[i],p[j],old[i],old[j]),ly=Math.min(p[i+1],p[j+1],old[i+1],old[j+1]),lz=Math.min(p[i+2],p[j+2],old[i+2],old[j+2]),hx=Math.max(p[i],p[j],old[i],old[j]),hy=Math.max(p[i+1],p[j+1],old[i+1],old[j+1]),hz=Math.max(p[i+2],p[j+2],old[i+2],old[j+2]);
      for(const f of hash.sweptCandidates(lx,ly,lz,hx,hy,hz))if(hash.overlapsSweep(f,lx,ly,lz,hx,hy,hz))lists[e].push(f/3);
    }
    if(this._stats){this._stats.broadphaseBuildMS+=performance.now()-started;this._stats.broadphaseBuildCount++;}
    return{aId:a.id,bId:b.id,aTriangles:a.triangles,bTriangles:b.triangles,radius,lists,aCurrent:Float64Array.from(p),aPrevious:Float64Array.from(old),bCurrent:Float64Array.from(b.positions),bPrevious:Float64Array.from(b.previous)};
  }

  _visitEdges(a,b,callback,oldSides,newSides) {
    if(a.id>b.id)[a,b]=[b,a];
    if(!a.topology.edgeVertices.length||!b.topology.edgeVertices.length)return 0;
    const gap=(a.thickness+b.thickness)*.5+this.contactMargin,radius=gap+this.searchMargin,key=JSON.stringify([a.id,b.id]);
    let cache=this._edgeBroadphases.get(key);
    if(!this._cacheValid(cache,a,b,radius)){cache=this._buildEdgeCandidates(a,b,radius);this._edgeBroadphases.set(key,cache);}else if(this._stats)this._stats.broadphaseReuseCount++;
    const scratch={},limit=this.cacheSkin*.5;let candidates=0;
    for(let edgeA=0;edgeA<cache.lists.length;edgeA++)for(let index=0;index<cache.lists[edgeA].length;index++){
      const edgeB=cache.lists[edgeA][index];candidates++;
      const contact=this._edgeContact(a,edgeA,b,edgeB,gap,radius,oldSides,newSides,scratch);
      if(contact){callback(contact);let invalid=false;for(const [g,ids,reference]of [[a,contact.idsA,cache.aCurrent],[b,contact.idsB,cache.bCurrent]])for(const id of ids)for(let d=0;d<3;d++)if(Math.abs(g.positions[id*3+d]-reference[id*3+d])>limit)invalid=true;
        if(invalid){cache=this._buildEdgeCandidates(a,b,radius);this._edgeBroadphases.set(key,cache);index=-1;}}
    }
    return candidates;
  }

  _retargetContact(prior,gap,oldSides,newSides,scratch) {
    if(prior.kind==='edge-edge')return this._edgeContact(prior.a,prior.edgeA,prior.b,prior.edgeB,gap,Infinity,oldSides,newSides,scratch);
    const {a,b,vertex}=prior,p=a.positions,k=vertex*3,q=scratch.closest;
    let face=prior.face,side=newSides.get(prior.key)||oldSides.get(prior.key)||prior.side||1;
    // A persistent contact follows a connected mesh feature. Face IDs are not
    // material identities: dropping history at an internal diagonal would
    // turn an unresolved crossing into a false zero-residual state.
    for(let visit=0;visit<=b.triangles.length/3;visit++) {
      if(!closestPoint(p[k],p[k+1],p[k+2],b.positions,b.triangles,face,q))return null;
      const owner=this._featureOwner(a,vertex,b,face,this._feature(b,face,q),q,scratch);
      if(owner===face)break;
      side*=b.topology.orientations[face/3]*b.topology.orientations[owner/3];face=owner;
    }
    const key=JSON.stringify([a.id,vertex,b.id,face/3]),hadSide=newSides.has(key),priorSide=newSides.get(key);
    // Two independently valid facet constraints can have opposite signs at a
    // sharp fold. Migration must not overwrite the destination's established
    // side with the departed facet's sign and invent a crossing of the fold.
    const establishedSide=newSides.get(key)||oldSides.get(key);
    // An unsigned true-boundary distance has no material-side constraint to
    // transport. Its incidental face sign must never become an internal side
    // when a later reciprocal correction changes the nearest feature.
    const seed=establishedSide||(prior.directed&&!prior.boundaryFeature?side:0);
    if(seed)newSides.set(key,seed);
    if(key!==prior.key)this._releaseSide(prior.key,oldSides,newSides);
    const contact=this._contact(a,vertex,b,face,gap,Infinity,oldSides,newSides,scratch);
    // A path around a true free boundary releases the side constraint. A
    // temporary seed must not turn that legal release into a later ghost.
    if(!contact){if(hadSide&&!this._releasedSides?.has(key))newSides.set(key,priorSide);else newSides.delete(key);}
    return contact;
  }

  _retainedSides(garments) {
    const ids=new Set(garments.filter(g=>g.historyMatches).map(g=>g.id)),sides=new Map(),sameFrame=new Set();
    for(const [key,side]of this._sides){const [a,,b]=JSON.parse(key);if(ids.has(a)&&ids.has(b))sides.set(key,side);}
    for(const g of garments){const previous=this._history.get(g.id)?.previous;if(g.historyMatches&&previous?.length===g.previous.length&&g.previous.every((x,i)=>x===previous[i]))sameFrame.add(g.id);}
    // Several projection calls can share one integration substep. A resolved
    // crossing must not be reinterpreted backwards while explicit `previous`
    // still describes its formerly wrong-side state. This memory expires when
    // that previous state advances; only unresolved contacts survive a frame.
    for(const [key,side]of this._frameSides){const [a,,b]=JSON.parse(key);if(sameFrame.has(a)&&sameFrame.has(b))sides.set(key,side);}
    return sides;
  }

  _correct(contact, friction) {
    if(contact.kind==='edge-edge')return this._correctEdges(contact,friction);
    const { a, b, vertex, face, bary, normal: n } = contact;
    const pointWeight = a.inverseMass ? a.inverseMass[vertex] : 1;
    const weights = bary.map((_, k) => b.inverseMass ? b.inverseMass[b.triangles[face + k]] : 1);
    const effectiveMass = pointWeight + bary.reduce((sum, value, k) => sum + value * value * weights[k], 0);
    if (!(effectiveMass > 0)) return 0;
    const correction = Math.min(contact.penetration, this.maxCorrection);
    const multiplier = correction / effectiveMass;
    const vi = vertex * 3;
    for (let k = 0; k < 3; k++) {
      a.positions[vi + k] += pointWeight * multiplier * n[k];
      for (let j = 0; j < 3; j++) b.positions[b.triangles[face + j] * 3 + k] -= weights[j] * bary[j] * multiplier * n[k];
    }
    if (friction > 0) {
      const relative = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        relative[k] = a.positions[vi + k] - a.previous[vi + k];
        for (let j = 0; j < 3; j++) {
          const bi = b.triangles[face + j] * 3 + k;
          relative[k] -= bary[j] * (b.positions[bi] - b.previous[bi]);
        }
      }
      const normalAmount = relative[0] * n[0] + relative[1] * n[1] + relative[2] * n[2];
      const tangent = relative.map((value, k) => value - normalAmount * n[k]);
      const length = Math.hypot(...tangent);
      if (length > EPS) {
        const scale = Math.min(friction, friction * correction / length) / effectiveMass;
        for (let k = 0; k < 3; k++) {
          a.positions[vi + k] -= pointWeight * scale * tangent[k];
          for (let j = 0; j < 3; j++) b.positions[b.triangles[face + j] * 3 + k] += weights[j] * bary[j] * scale * tangent[k];
        }
      }
    }
    const updateMotion=(g,i)=>{const k=i*3,m=Math.hypot(g.positions[k]-g.previous[k],g.positions[k+1]-g.previous[k+1],g.positions[k+2]-g.previous[k+2]);g.motion[i]=m;g.maxMotion=Math.max(g.maxMotion,m);};
    updateMotion(a,vertex);for(let j=0;j<3;j++)updateMotion(b,b.triangles[face+j]);
    if(this.optimizationEnabled){a.bounds.refitVertex(vertex);b.bounds.refitIndices(b.triangles,face,3);}
    return correction;
  }

  _correctEdges(contact,friction) {
    const {a,b,idsA,idsB,baryA,baryB,normal:n}=contact,groups=[[a,idsA,baryA,1],[b,idsB,baryB,-1]];
    let effective=0;for(const [g,ids,bary]of groups)for(let j=0;j<2;j++)effective+=bary[j]**2*(g.inverseMass?g.inverseMass[ids[j]]:1);
    if(!(effective>0))return 0;
    const correction=Math.min(contact.penetration,this.maxCorrection),lambda=correction/effective;
    for(const [g,ids,bary,sign]of groups)for(let j=0;j<2;j++){const k=ids[j]*3,scale=sign*(g.inverseMass?g.inverseMass[ids[j]]:1)*bary[j]*lambda;for(let d=0;d<3;d++)g.positions[k+d]+=scale*n[d];}
    if(friction>0){const relative=[0,0,0];for(const [g,ids,bary,sign]of groups)for(let j=0;j<2;j++)for(let d=0;d<3;d++){const k=ids[j]*3+d;relative[d]+=sign*bary[j]*(g.positions[k]-g.previous[k]);}
      const projection=relative[0]*n[0]+relative[1]*n[1]+relative[2]*n[2],tangent=relative.map((v,d)=>v-projection*n[d]),length=Math.hypot(...tangent);
      if(length>EPS){const scale=Math.min(friction,friction*correction/length)/effective;for(const [g,ids,bary,sign]of groups)for(let j=0;j<2;j++){const k=ids[j]*3,weight=sign*(g.inverseMass?g.inverseMass[ids[j]]:1)*bary[j]*scale;for(let d=0;d<3;d++)g.positions[k+d]-=weight*tangent[d];}}
    }
    for(const [g,ids]of groups)for(const id of ids){const k=id*3,m=Math.hypot(g.positions[k]-g.previous[k],g.positions[k+1]-g.previous[k+1],g.positions[k+2]-g.previous[k+2]);g.motion[id]=m;g.maxMotion=Math.max(g.maxMotion,m);}
    if(this.optimizationEnabled){a.bounds.refitIndices(idsA,0,2);b.bounds.refitIndices(idsB,0,2);}
    if(contact.directed)this._edgeWorkingReferences?.set(contact.key,this._edgeReference(contact));
    return correction;
  }

  _sample(contact,residual) {
    const {a,b}=contact;let pa,pb;
    if(contact.kind==='edge-edge'){
      const point=(g,ids,bary)=>[0,1,2].map(d=>bary[0]*g.positions[ids[0]*3+d]+bary[1]*g.positions[ids[1]*3+d]);
      pa=point(a,contact.idsA,contact.baryA);pb=point(b,contact.idsB,contact.baryB);
    }else{
      pa=Array.from(a.positions.slice(contact.vertex*3,contact.vertex*3+3));const q=new Float64Array(7);
      if(!closestPoint(...pa,b.positions,b.triangles,contact.face,q))return null;pb=[q[0],q[1],q[2]];
    }
    return{kind:contact.kind||'vertex-face',garmentA:a.id,garmentB:b.id,
      ...(contact.kind==='edge-edge'?{edgeA:contact.idsA.slice(),edgeB:contact.idsB.slice()}:{vertexIndex:contact.vertex,triangleIndex:contact.face/3}),
      point:pa.map((v,d)=>(v+pb[d])*.5),pointA:pa,pointB:pb,normal:contact.normal.slice(),penetrationBefore:contact.penetration,residualPenetration:residual};
  }

  solve(inputs, { friction = 0, passes = 2, measureResidual = true } = {}) {
    if (!Array.isArray(inputs)) throw new TypeError('garments must be an array');
    if (!Number.isFinite(friction) || friction < 0 || friction > 1) throw new RangeError('friction must be between 0 and 1');
    if (!Number.isInteger(passes) || passes < 1 || passes > 32) throw new RangeError('passes must be an integer between 1 and 32');
    if (typeof measureResidual !== 'boolean') throw new TypeError('measureResidual must be boolean');
    const garments = this._prepare(inputs), result = emptyResult();
    this._releasedSides=new Set();this._edgeWorkingReferences=new Map(this._edgeReferences);
    this._stats=result.timings=this._statistics(garments);
    const previousSides = this._retainedSides(garments), nextSides = new Map(), contacts = new Map(), fixed = new Set(),crossings=new Set();
    const pending=this._activePending(garments),residualScratch={closest:new Float64Array(7),normal:new Float64Array(3),previousNormal:new Float64Array(3)};
    for (let pass = 0; pass < passes; pass++) {
      const processed=new Set();
      const correct=contact=>{
        if(processed.has(contact.key))return;processed.add(contact.key);
        const prior=contacts.get(contact.key);if(!prior||contact.penetration>prior.penetration)contacts.set(contact.key,contact);
        if(contact.crossing)crossings.add(contact.key);
        result.maxDetectedPenetration=Math.max(result.maxDetectedPenetration,contact.penetration);
        const corrected=this._correct(contact,friction);
        if(corrected>0){result.correctionCount++;result.maxCorrectedPenetration=Math.max(result.maxCorrectedPenetration,corrected);}else fixed.add(contact.key);
      };
      // Unresolved real contacts remain constraints when a later solver/body
      // projection moves their endpoints beyond the proximity search radius.
      for(const prior of pending){const {a,b}=prior,gap=(a.thickness+b.thickness)*.5+this.contactMargin;const c=this._retargetContact(prior,gap,previousSides,nextSides,residualScratch);if(c)correct(c);}
      for (let i = 0; i < garments.length; i++) for (let j = i + 1; j < garments.length; j++) {
        // Alternate visit order to reduce a persistent first-garment bias.
        const directions = pass % 2 ? [[garments[j], garments[i]], [garments[i], garments[j]]] : [[garments[i], garments[j]], [garments[j], garments[i]]];
        for (const [a, b] of directions) result.candidateCount += this._visit(a,b,correct,previousSides,nextSides);
        result.candidateCount+=this._visitEdges(garments[i],garments[j],correct,previousSides,nextSides);
      }
    }
    result.contactCount = contacts.size;
    result.immovableContactCount = fixed.size;
    result.sweptCrossingCount=crossings.size;
    result.edgeEdgeContactCount=Array.from(contacts.values()).filter(c=>c.kind==='edge-edge').length;
    const residuals = new Map();
    if (measureResidual) for (let i = 0; i < garments.length; i++) for (let j = 0; j < garments.length; j++) if (i !== j) {
      result.residualCandidateCount += this._visit(garments[i], garments[j], contact => {
        residuals.set(contact.key, contact.penetration);
        result.residualMaxPenetration = Math.max(result.residualMaxPenetration, contact.penetration);
      }, previousSides, nextSides);
    }
    if(measureResidual)for(let i=0;i<garments.length;i++)for(let j=i+1;j<garments.length;j++)result.residualCandidateCount+=this._visitEdges(garments[i],garments[j],contact=>{residuals.set(contact.key,contact.penetration);result.residualMaxPenetration=Math.max(result.residualMaxPenetration,contact.penetration);},previousSides,nextSides);
    // Recheck every constraint we actually touched, even if another correction
    // moved it outside the final broadphase radius. Unseen distant intersections
    // remain outside this method's stated scope.
    const nextPending=new Map();
    // This small touched-constraint pass also owns history lifecycle when a
    // host defers the expensive broadphase residual audit to its final state.
    for (const prior of contacts.values()) {
      const { a, b, vertex, face } = prior;
      const gap = (a.thickness + b.thickness) * 0.5 + this.contactMargin;
      const contact = this._retargetContact(prior,gap,previousSides,nextSides,residualScratch);
      if (contact) {
        nextPending.set(contact.key,contact);
        if(measureResidual){residuals.set(contact.key, contact.penetration);result.residualMaxPenetration = Math.max(result.residualMaxPenetration, contact.penetration);}
      }
    }
    result.residualCount = measureResidual ? residuals.size : null;
    if (!measureResidual) {
      result.residualMaxPenetration = null;
      result.residualScope = 'not measured in this solve call; use measure() on the final state';
    }
    for (const contact of contacts.values()) {
      if (result.sampleContactPoints.length >= this.sampleLimit) break;
      const sample=this._sample(contact,measureResidual?(residuals.get(contact.key)||0):null);if(sample)result.sampleContactPoints.push(sample);
    }
    // Replace, rather than append, state: disabled/removed garments leave no
    // collision objects or retained history behind. Position history is copied;
    // only the immutable topology identity is retained to detect replacement.
    this._history = new Map(garments.map(g => [g.id, { positions: Float64Array.from(g.positions), previous:Float64Array.from(g.previous),triangles: g.triangles }]));
    this._sides = garments.length > 1 ? new Map([...nextPending].filter(([,c])=>c.directed&&!c.boundaryFeature).map(([key,c])=>[key,c.side])) : new Map();
    this._frameSides=garments.length>1?new Map([...previousSides,...nextSides]):new Map();
    for(const key of this._releasedSides)this._frameSides.delete(key);
    this._edgeReferences=new Map([...this._edgeWorkingReferences].filter(([key])=>this._frameSides.has(key)||this._sides.has(key)));
    this._pending = garments.length > 1 ? nextPending : new Map();
    const ids=new Set(garments.map(g=>g.id));for(const [key,cache]of this._broadphases)if(!ids.has(cache.aId)||!ids.has(cache.bId))this._broadphases.delete(key);
    for(const [key,cache]of this._edgeBroadphases)if(!ids.has(cache.aId)||!ids.has(cache.bId))this._edgeBroadphases.delete(key);
    this._stats=null;
    return result;
  }

  /** A read-only final-state query, including after a different constraint
   * solver (for example body contact) has moved the garments. It does not
   * advance previous-position history, change side history, or correct cloth.
   */
  measure(inputs) {
    if (!Array.isArray(inputs)) throw new TypeError('garments must be an array');
    const garments = this._prepare(inputs), result = emptyResult(), sides = new Map(),previousSides=this._retainedSides(garments);
    this._releasedSides=new Set();this._edgeWorkingReferences=new Map(this._edgeReferences);
    this._stats=result.timings=this._statistics(garments);
    result.measurementOnly = true;
    result.residualScope = 'bounded cross-garment vertex-face and interior edge-edge proximity/swept queries plus retained unresolved contacts at measured positions';
    const seen=new Set();
    const record=contact=>{
        if(seen.has(contact.key))return;seen.add(contact.key);
        result.residualCount++;
        if(contact.kind==='edge-edge')result.edgeEdgeContactCount++;
        result.residualMaxPenetration = Math.max(result.residualMaxPenetration, contact.penetration);
        if (result.sampleContactPoints.length >= this.sampleLimit) return;
        const sample=this._sample(contact,contact.penetration);if(sample)result.sampleContactPoints.push(sample);
      };
    for (let i = 0; i < garments.length; i++) for (let j = 0; j < garments.length; j++) if (i !== j)result.residualCandidateCount+=this._visit(garments[i],garments[j],record,previousSides,sides);
    for(let i=0;i<garments.length;i++)for(let j=i+1;j<garments.length;j++)result.residualCandidateCount+=this._visitEdges(garments[i],garments[j],record,previousSides,sides);
    const scratch={closest:new Float64Array(7),normal:new Float64Array(3),previousNormal:new Float64Array(3)};
    for(const prior of this._activePending(garments)){const {a,b}=prior,gap=(a.thickness+b.thickness)*.5+this.contactMargin;const c=this._retargetContact(prior,gap,previousSides,sides,scratch);if(c)record(c);}
    result.contactCount = result.residualCount;
    result.maxDetectedPenetration = result.residualMaxPenetration;
    this._stats=null;
    return result;
  }
}

export default LayerContact;

// Conservative rejection inside a reused broadphase skin. Always read live
// endpoints, including earlier reciprocal corrections in this very pass.
// The 1e-8 m expansion retains the swept feature test's spatial tolerance.
// Unbounded retained constraints deliberately bypass this proximity rejection.
function separatedVFSweep(a,vertex,b,face,radius) {
  const p=a.positions,old=a.previous,q=b.positions,prior=b.previous,t=b.triangles,k=vertex*3;
  const i=t[face]*3,j=t[face+1]*3,l=t[face+2]*3,r=radius+1e-8;
  for(let d=0;d<3;d++) {
    const lo=Math.min(p[k+d],old[k+d])-r,hi=Math.max(p[k+d],old[k+d])+r;
    if(q[i+d]>hi&&q[j+d]>hi&&q[l+d]>hi&&prior[i+d]>hi&&prior[j+d]>hi&&prior[l+d]>hi)return true;
    if(q[i+d]<lo&&q[j+d]<lo&&q[l+d]<lo&&prior[i+d]<lo&&prior[j+d]<lo&&prior[l+d]<lo)return true;
  }
  return false;
}
function separatedEESweep(a,ai,aj,b,bi,bj,radius) {
  const p=a.positions,old=a.previous,q=b.positions,prior=b.previous,r=radius+1e-8;
  ai*=3;aj*=3;bi*=3;bj*=3;
  for(let d=0;d<3;d++) {
    const lo=Math.min(p[ai+d],p[aj+d],old[ai+d],old[aj+d])-r,hi=Math.max(p[ai+d],p[aj+d],old[ai+d],old[aj+d])+r;
    if(q[bi+d]>hi&&q[bj+d]>hi&&prior[bi+d]>hi&&prior[bj+d]>hi)return true;
    if(q[bi+d]<lo&&q[bj+d]<lo&&prior[bi+d]<lo&&prior[bj+d]<lo)return true;
  }
  return false;
}
