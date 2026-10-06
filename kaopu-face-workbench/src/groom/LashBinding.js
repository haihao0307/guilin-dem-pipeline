/** New procedural lashes, not part of Daniel Bystedt's teacher asset.
 * Deterministic curved 3D fibres. Roots are projected onto component-0 eyelid
 * skin once, then follow those exact triangles with barycentric coordinates.
 * This is a bounded eyelid attachment, not a collision or anatomy certificate.
 */
import {TeacherSkinBVH,teacherVertexNormals} from './TeacherGroomBinding.js';
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const point=(p,i)=>Array.from(p.subarray(i*3,i*3+3));
function bary(p,tr,t,b){return [0,1,2].map(d=>b.reduce((sum,w,k)=>sum+p[tr[t*3+k]*3+d]*w,0));}
function frame(model,p,n,t,b){const root=bary(p,model.triangles,t,b),a=point(p,model.triangles[t*3]),e=sub(point(p,model.triangles[t*3+1]),a),normal=unit(cross(e,sub(point(p,model.triangles[t*3+2]),a)));const u=unit(sub(e,mul(normal,dot(e,normal))));return {root,u,v:unit(cross(normal,u)),n:normal,edge:Math.hypot(...e)};}
function spline(points,t){const f=Math.min(points.length-1-1e-9,t*(points.length-1)),i=Math.floor(f),u=f-i;const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];return b.map((x,k)=>.5*((2*x)+(-a[k]+c[k])*u+(2*a[k]-5*x+4*c[k]-d[k])*u*u+(-a[k]+3*x-3*c[k]+d[k])*u*u*u));}
export class LashBinding {
  constructor(model,{segments=7,upperCount=70,lowerCount=42,seed=724}={}){
    this.model=model;this.segments=segments;this.per=segments+1;this.count=(upperCount+lowerCount)*2;this.options={seed};this.clearance=.00009;
    const n=this.count*this.per;this.positions=new Float32Array(n*3);this.tangents=new Float32Array(n*3);this.rootNormals=new Float32Array(n*3);this.radii=new Float32Array(n);this.strandRandom=new Float32Array(n);this.roots=new Float32Array(this.count*3);this.rootTriangles=new Int32Array(this.count);this.rootBarycentrics=new Float32Array(this.count*3);this.templateRoots=new Float32Array(this.count*3);this.localOffsets=new Float32Array(n*3);this.neutralEdges=new Float32Array(this.count);this.lids=new Uint8Array(this.count);this.eyes=new Uint8Array(this.count);
    this.maxRootProjectionDistance=0;this.length=1;this.curl=1;this.lowerVisible=true;this.revision=0;
    const landmarks=new Float32Array(68*3);model.computeLandmarks(model.template,landmarks);const normals=teacherVertexNormals(model),skin=new TeacherSkinBVH(model),externalFaces=new Set(skin.faces.filter(f=>f.n[2]>.45).map(f=>f.t)),bvh=new TeacherSkinBVH(model,model.template,externalFaces);
    let strand=0;
    for(let eye=0;eye<2;eye++){
      const o=36+eye*6,center=mul(add(point(landmarks,o),point(landmarks,o+3)),.5);
      for(const [lid,ids,count]of [[0,[o,o+1,o+2,o+3],upperCount],[1,[o,o+5,o+4,o+3],lowerCount]]){
        const controls=ids.map(i=>point(landmarks,i));
        for(let j=0;j<count;j++,strand++){
          const t=.065+.87*(j+.5)/count,desired=spline(controls,t),hit=bvh.nearest(desired),f=frame(model,model.template,normals,hit.t,hit.b);
          this.maxRootProjectionDistance=Math.max(this.maxRootProjectionDistance,hit.distance);this.rootTriangles[strand]=hit.t;this.rootBarycentrics.set(hit.b,strand*3);this.templateRoots.set(f.root,strand*3);this.neutralEdges[strand]=f.edge;this.lids[strand]=lid;this.eyes[strand]=eye;
          const random=(Math.sin((strand+seed)*127.1)*43758.5453123)%1;const r=random-Math.floor(random);
          // Outward fan follows the eyelid's own frontal contour; lower lashes
          // use the inverse vertical direction and a shorter, gentler curve.
          let outward=sub(desired,center);outward[2]=0;outward=unit(outward);
          const tangent=outward,forward=[0,0,1];
          const length=(lid?.0034:.0065)*(.72+.28*Math.sin(Math.PI*t))*(.91+.18*r);
          for(let k=0;k<this.per;k++){
            const s=k/segments,q=strand*this.per+k;
            const delta=add(mul(f.n,this.clearance),add(mul(forward,length*(.90*s-.20*s*s)),mul(tangent,length*((lid?.16:.18)*s+(lid?.36:.55)*s*s))));
            this.localOffsets.set([dot(delta,f.u),dot(delta,f.v),dot(delta,f.n)],q*3);
            this.radii[q]=(lid?.000027:.000039)*(.84+.28*r)*Math.max(.025,(1-s)**.8);this.strandRandom[q]=r;
          }
        }
      }
    }
    this.update(model.template,normals);
  }
  setOptions({length=this.length,curl=this.curl,lowerVisible=this.lowerVisible}={}){this.length=length;this.curl=curl;this.lowerVisible=lowerVisible;return this;}
  update(positions,normals){
    for(let i=0;i<this.count;i++){
      const f=frame(this.model,positions,normals,this.rootTriangles[i],this.rootBarycentrics.subarray(i*3,i*3+3)),scale=Math.max(.72,Math.min(1.3,f.edge/this.neutralEdges[i]));this.roots.set(f.root,i*3);
      for(let j=0;j<this.per;j++){
        const q=i*this.per+j,o=q*3,lo=this.localOffsets;const u=lo[o]*this.length*this.curl*scale,v=lo[o+1]*this.length*this.curl*scale,n=this.clearance+(lo[o+2]-this.clearance)*this.length*scale;
        const p=add(f.root,add(mul(f.u,u),add(mul(f.v,v),mul(f.n,n))));this.positions.set(p,o);this.rootNormals.set(f.n,o);
      }
      for(let j=0;j<this.per;j++){const q=i*this.per+j;const a=point(this.positions,i*this.per+Math.max(0,j-1)),b=point(this.positions,i*this.per+Math.min(this.segments,j+1));this.tangents.set(unit(sub(b,a)),q*3);}
    }
    this.revision++;return this;
  }
  diagnostics(){let maxRootGap=0,invalidTriangles=0,maxBaryError=0;for(let i=0;i<this.count;i++){maxRootGap=Math.max(maxRootGap,Math.hypot(...sub(point(this.positions,i*this.per),point(this.roots,i))));const t=this.rootTriangles[i];if([0,1,2].some(k=>this.model.componentId[this.model.triangles[t*3+k]]!==0))invalidTriangles++;maxBaryError=Math.max(maxBaryError,Math.abs(this.rootBarycentrics[i*3]+this.rootBarycentrics[i*3+1]+this.rootBarycentrics[i*3+2]-1));}return {method:'eyelid-skin-barycentric-curved-fibres',count:this.count,segments:this.segments,revision:this.revision,maxRootProjectionDistance:this.maxRootProjectionDistance,invalidTriangles,maxRootGap,maxBaryError,finite:[this.positions,this.tangents,this.radii].every(a=>a.every(Number.isFinite)),length:this.length,curl:this.curl,limitation:'Procedural lashes, not teacher-source geometry; no full collision guarantee for extreme eyelid poses'};}
}
