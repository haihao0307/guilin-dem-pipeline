/** Exact candidate-search acceleration for the pinned LongHairLayer envelope.
 * The donor's 27-cell candidate domain, face normals, closest-point arithmetic,
 * tie order, clearance, 16 passes and 4 mm step are retained. No source face or
 * hair vertex is removed. The byte-exact donor remains in hair-long/.
 * The deterministic prepare step explicitly routes the original donor through
 * this adapter. Numerical point-for-point evidence is recorded in the lock.
 */
import * as THREE from 'three';
import {MeshContact} from './cloth-adapted/mesh-contact.mjs';

export function createStaticSurfaceEnvelope(geometry,{clearance=.0015,cell=.025}={}) {
  const p=geometry.attributes.position.array,f=geometry.index.array,
    surface=new MeshContact(p,f),count=f.length/3,
    bounds=new Int32Array(count*6),normals=new Float64Array(count*3),
    triangle=new THREE.Triangle(new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()),
    n=new THREE.Vector3(),q=new THREE.Vector3(),best=new THREE.Vector3(),delta=new THREE.Vector3();
  const readTriangle=id=>{
    triangle.a.fromArray(p,f[id*3]*3);triangle.b.fromArray(p,f[id*3+1]*3);triangle.c.fromArray(p,f[id*3+2]*3);
    return triangle;
  };
  for(let id=0;id<count;id++) {
    readTriangle(id).getNormal(n);n.toArray(normals,id*3);
    for(let d=0;d<3;d++) {
      const a=triangle.a.getComponent(d),b=triangle.b.getComponent(d),c=triangle.c.getComponent(d);
      bounds[id*6+d]=Math.floor(Math.min(a,b,c)/cell);bounds[id*6+d+3]=Math.floor(Math.max(a,b,c)/cell);
    }
  }
  let corrections=0,maxDisplacement=0,queries=0,testedTriangles=0;
  const stack=new Int32Array(Math.max(128,surface.nodes.length)),lo=new Int32Array(3),hi=new Int32Array(3),bestOrder=new Int32Array(4);
  function nearest(point) {
    for(let d=0;d<3;d++){const c=Math.floor(point.getComponent(d)/cell);lo[d]=c-1;hi[d]=c+1;}
    let head=1,d2=Infinity,chosen=-1;stack[0]=0;queries++;
    while(head) {
      const node=surface.nodes[stack[--head]],b=node.box,
        dx=Math.max(b[0]-point.x,0,point.x-b[3]),dy=Math.max(b[1]-point.y,0,point.y-b[4]),dz=Math.max(b[2]-point.z,0,point.z-b[5]);
      if(dx*dx+dy*dy+dz*dz>d2)continue;
      if(Math.floor(b[0]/cell)>hi[0]||Math.floor(b[3]/cell)<lo[0]||Math.floor(b[1]/cell)>hi[1]||Math.floor(b[4]/cell)<lo[1]||Math.floor(b[2]/cell)>hi[2]||Math.floor(b[5]/cell)<lo[2])continue;
      if(node.left>=0) {
        const a=surface.nodes[node.left].box,c=surface.nodes[node.right].box,
          da=(a[0]+a[3]-2*point.x)**2+(a[1]+a[4]-2*point.y)**2+(a[2]+a[5]-2*point.z)**2,
          dc=(c[0]+c[3]-2*point.x)**2+(c[1]+c[4]-2*point.y)**2+(c[2]+c[5]-2*point.z)**2;
        if(da<dc){stack[head++]=node.right;stack[head++]=node.left;}else{stack[head++]=node.left;stack[head++]=node.right;}
        continue;
      }
      for(let k=node.lo;k<node.hi;k++) {
        const id=surface.tri[k]/3,o=id*6;
        if(bounds[o]>hi[0]||bounds[o+3]<lo[0]||bounds[o+1]>hi[1]||bounds[o+4]<lo[1]||bounds[o+2]>hi[2]||bounds[o+5]<lo[2])continue;
        readTriangle(id).closestPointToPoint(point,q);testedTriangles++;const d=q.distanceToSquared(point);
        let before=false;
        // The source enumerates cells in x/y/z order, then source face order.
        // A duplicate face first appears in its lexicographically first cell.
        if(d===d2&&chosen>=0){
          for(let axis=0;axis<4;axis++){
            const value=axis<3?Math.max(bounds[o+axis],lo[axis]):id;
            if(value!==bestOrder[axis]){before=value<bestOrder[axis];break;}
          }
        }
        if(d<d2||before){d2=d;chosen=id;best.copy(q);for(let axis=0;axis<3;axis++)bestOrder[axis]=Math.max(bounds[o+axis],lo[axis]);bestOrder[3]=id;}
      }
    }
    return {d2,chosen};
  }
  function project(point) {
    const original=point.clone();
    for(let pass=0;pass<16;pass++) {
      const {d2,chosen}=nearest(point);if(chosen<0||d2>.035*.035)break;
      n.fromArray(normals,chosen*3);const signed=delta.copy(point).sub(best).dot(n);if(signed>=clearance)break;
      point.addScaledVector(n,Math.min(.004,clearance-signed));corrections++;
    }
    maxDisplacement=Math.max(maxDisplacement,point.distanceTo(original));return point;
  }
  return {project,report:()=>({kind:'nearest-triangle local normal clearance',clearance,maxStep:.004,maxIterations:16,corrections,maxDisplacement,physics:false,
    acceleration:'exact BVH search within the source 27-cell domain; original closest-point arithmetic and face tie order',sourceTriangles:count,queries,testedTriangles})};
}
