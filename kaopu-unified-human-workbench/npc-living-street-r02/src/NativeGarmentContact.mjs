/** Actual complete native-body contact for a bounded garment corrective.
 * This is a local adapter, not the source signed-nearest-plane contact. Every
 * accepted endpoint is checked against the complete posed triangle mesh.
 * The oriented ray is a discrete query; open neck / continuous collision and
 * arbitrary garment self-collision are not certified by it.
 */
import {MeshContact,closestTriangle} from '../vendor/appearance/cloth-r10/mesh-contact.mjs';

export function nativeBodyWinding(contact,x,y,z){
  const p=contact.p,F=contact.faces,stack=[0];let crossings=0;y+=1.738271e-10;z+=2.493731e-10;
  while(stack.length){const node=contact.nodes[stack.pop()],box=node.box;
    if(x>box[3]||y<box[1]||y>box[4]||z<box[2]||z>box[5])continue;
    if(node.left>=0){stack.push(node.left,node.right);continue;}
    for(let k=node.lo;k<node.hi;k++){
      const f=contact.tri[k],a=F[f]*3,b=F[f+1]*3,c=F[f+2]*3,
        uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],den=uy*vz-uz*vy;
      if(Math.abs(den)<1e-16)continue;const dy=y-p[a+1],dz=z-p[a+2],v=(dy*vz-dz*vy)/den,w=(uy*dz-uz*dy)/den;
      if(v<0||w<0||v+w>1)continue;
      const at=p[a]+v*(p[b]-p[a])+w*(p[c]-p[a]);if(at>x)crossings+=den>0?1:-1;
    }
  }return crossings;
}
export function nativeFaceNormal(p,F,f,out=new Float64Array(3)){
  const a=F[f]*3,b=F[f+1]*3,c=F[f+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
  out[0]=uy*vz-uz*vy;out[1]=uz*vx-ux*vz;out[2]=ux*vy-uy*vx;const l=Math.hypot(...out);if(l>0)for(let k=0;k<3;k++)out[k]/=l;return out;
}

export class NativeGarmentContact{
  constructor(positions,faces){
    this.mesh=new MeshContact(positions,faces);this.revision=0;this.resetMetrics();
    this.q=new Float64Array(7);this.n=new Float64Array(3);
  }
  resetMetrics(){this.metrics={queries:0,windingQueries:0,nearestQueries:0,exteriorFaceCandidates:0,endpointChecks:0,outsideRadialCandidates:0,outsideRadialAccepted:0,foreignSkipped:0,unresolved:0};}
  refit(positions){this.mesh.refit(positions);this.revision++;this.resetMetrics();}
  inspect(x,y,z){
    const m=this.mesh;this.metrics.nearestQueries++;const face=m.nearest(x,y,z),distance=face<0?Infinity:Math.sqrt(m.best[0]);
    this.metrics.windingQueries++;const winding=nativeBodyWinding(m,x,y,z);
    return {face,distance,winding,inside:winding!==0};
  }
  /** Same fixed material side throughout one pose. Candidate surface normals
   * choose actual mesh endpoints; they do not replace that side identity.
   * Neither a positive nearest-normal sign nor a foreign foreground limb is
   * treated as proof of underlying-body contact.
   */
  project(point,{eligibleFaces=null,preferredNormal=null,referenceOrigin=point,margin=.004,limit=.08,paired=true}={}){
    this.metrics.queries++;const [x,y,z]=point,initial=this.inspect(x,y,z);
    if(!initial.inside&&initial.distance>=margin-1e-10)return {...initial,delta:null,reason:'already outside',resolved:true};
    if(paired&&eligibleFaces&&initial.face>=0&&!eligibleFaces[initial.face/3]){
      this.metrics.foreignSkipped++;return {...initial,delta:null,reason:'foreign limb is not the underlying body patch',foreignSkipped:true,resolved:false};
    }
    const m=this.mesh,P=m.p,F=m.faces,q=this.q,n=this.n,stack=[0],origin=referenceOrigin;
    // An already-exterior point can be closest to a TRIANGLE EDGE, where the
    // distance gradient is not either adjacent face normal. For that case,
    // q + margin * normalize(p-q) is the exact minimum-displacement clearance
    // candidate (the distance field is 1-Lipschitz). Accept only after the
    // same complete-body outside/distance/side/bound checks. This cannot turn
    // a 3.4 micrometre positive-clearance deficit into a 69 mm face jump.
    if(!initial.inside&&initial.distance>1e-14&&initial.distance<margin){
      this.metrics.outsideRadialCandidates++;
      const nearest=Array.from(m.best.subarray(1,4)),direction=[x-nearest[0],y-nearest[1],z-nearest[2]].map(v=>v/initial.distance),
        delta=direction.map(v=>v*(margin-initial.distance)),endpoint=point.map((v,k)=>v+delta[k]);
      if((!preferredNormal||delta.reduce((s,v,k)=>s+v*preferredNormal[k],0)>0)&&Math.hypot(...endpoint.map((v,k)=>v-origin[k]))<=limit){
        this.metrics.endpointChecks++;const proof=this.inspect(...endpoint);
        if(!proof.inside&&proof.distance>=margin-1e-10){this.metrics.outsideRadialAccepted++;return {...initial,delta,endpoint,direction,sourceFace:initial.face,endpointFace:proof.face,endpointDistance:proof.distance,endpointWinding:proof.winding,reason:'verified minimum exterior clearance',resolved:true};}
      }
    }
    let best=null,bestSquared=Infinity;
    while(stack.length){
      const node=m.nodes[stack.pop()],b=node.box,dx=Math.max(b[0]-x,0,x-b[3]),dy=Math.max(b[1]-y,0,y-b[4]),dz=Math.max(b[2]-z,0,z-b[5]),lower=Math.max(0,Math.hypot(dx,dy,dz)-margin);
      if(lower*lower>bestSquared||lower>limit+Math.hypot(x-origin[0],y-origin[1],z-origin[2]))continue;
      if(node.left>=0){stack.push(node.left,node.right);continue;}
      for(let k=node.lo;k<node.hi;k++){
        const f=m.tri[k];if(eligibleFaces&&!eligibleFaces[f/3])continue;
        closestTriangle(P,F,f,x,y,z,q);if(Math.max(0,Math.sqrt(q[0])-margin)**2>bestSquared)continue;
        this.metrics.exteriorFaceCandidates++;nativeFaceNormal(P,F,f,n);
        if(Math.hypot(...n)<.5)continue;
        const endpoint=[q[1]+n[0]*margin,q[2]+n[1]*margin,q[3]+n[2]*margin],delta=[endpoint[0]-x,endpoint[1]-y,endpoint[2]-z],d2=delta[0]**2+delta[1]**2+delta[2]**2;
        if(d2>=bestSquared||Math.hypot(endpoint[0]-origin[0],endpoint[1]-origin[1],endpoint[2]-origin[2])>limit)continue;
        if(preferredNormal&&delta[0]*preferredNormal[0]+delta[1]*preferredNormal[1]+delta[2]*preferredNormal[2]<=0)continue;
        this.metrics.endpointChecks++;const result=this.inspect(...endpoint);
        if(result.inside||result.distance<margin-1e-10)continue;
        const length=Math.sqrt(d2);if(length<1e-14)continue;
        bestSquared=d2;best={...initial,delta,endpoint,direction:delta.map(v=>v/length),sourceFace:f,endpointFace:result.face,endpointDistance:result.distance,endpointWinding:result.winding,reason:'qualified actual exterior',resolved:true};
      }
    }
    if(best)return best;this.metrics.unresolved++;return {...initial,delta:null,reason:'no qualified same-side exterior within total bound',resolved:false};
  }
}
