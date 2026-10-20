/** Complete MP05 R10 garment and material reuse for the six R07 wearers.
 * Source papers, every material vertex/index, seams and original yarn programs
 * are retained. Barycentric native-body binding transports each paper to the
 * selected wearer and keeps every contributing CSR influence. Source
 * MeshContact performs posed native-triangle clearance; no body clipping or
 * replacement torso/legs is used. This adapter is not free cloth simulation.
 */
import {THREE as T} from './NativeBinding.mjs';
import {appearanceData} from '../vendor/appearance/appearance-data.mjs';
import {nativeGarmentMesh} from '../vendor/appearance/cloth-adapted/outfits-r043.mjs';
import {MeshContact} from '../vendor/appearance/cloth-adapted/mesh-contact.mjs';
import {smoothSewnNormals} from '../vendor/appearance/cloth-adapted/sewn-normals-r0433.mjs';
import {buildContinuousSolid} from '../vendor/appearance/cloth-adapted/continuous-solid.mjs';
import {withSettings} from '../vendor/appearance/cloth-adapted/material-settings.mjs';
import {LOOKS} from '../vendor/appearance/cloth-adapted/looks.mjs';
import materialRecords from '../vendor/appearance/cloth-r10/materials.json';

const SOURCE='guilin-dem-pipeline/c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49/mp05-r10';
const GROUND_SHIFT=.9858653545379639;
const LOOK_BY_ACTOR={A:'D01',B:'L02',C:'D04',D:'D03',E:'L04',F:'D02'};
const pause=()=>new Promise(r=>setTimeout(r,0));
const xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const mul=(a,b)=>a.map(v=>v*b),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
function frame(P,ids) {const a=xyz(P,ids[0]),b=xyz(P,ids[1]),c=xyz(P,ids[2]),e=sub(b,a),n=unit(cross(e,sub(c,a))),u=unit(e),v=unit(cross(n,u));return {u,v,n,len:Math.hypot(...e)};}
const baryPoint=(P,ids,b)=>ids.reduce((p,id,k)=>add(p,mul(xyz(P,id),b[k])),[0,0,0]);
const bodyFaces=(person)=>Int32Array.from(Array.from({length:person.faces.length/3},(_,i)=>i*3)
  .filter(k=>person.faces[k]<person.bodyCount&&person.faces[k+1]<person.bodyCount&&person.faces[k+2]<person.bodyCount)
  .flatMap(k=>[person.faces[k],person.faces[k+1],person.faces[k+2]]));

/** An oriented horizontal ray tests the actual posed triangle solid. Counting
 * signed crossings (not parity) also identifies a point inside overlapping
 * folded limb surfaces. The native body has its open neck above these outfits. */
export function nativeBodyWinding(contact,x,y,z) {
  const p=contact.p,F=contact.faces,stack=[0];let crossings=0;
  y+=1.738271e-10;z+=2.493731e-10;
  while(stack.length){const node=contact.nodes[stack.pop()],b=node.box;
    if(x>b[3]||y<b[1]||y>b[4]||z<b[2]||z>b[5])continue;
    if(node.left>=0){stack.push(node.left,node.right);continue;}
    for(let k=node.lo;k<node.hi;k++){
      const f=contact.tri[k],a=F[f]*3,b=F[f+1]*3,c=F[f+2]*3,
        uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2],den=uy*vz-uz*vy;
      if(Math.abs(den)<1e-16)continue;const dy=y-p[a+1],dz=z-p[a+2],v=(dy*vz-dz*vy)/den,w=(uy*dz-uz*dy)/den;
      if(v<0||w<0||v+w>1)continue;
      const at=p[a]+v*(p[b]-p[a])+w*(p[c]-p[a]);if(at>x)crossings+=den>0?1:-1;
    }
  }
  return crossings;
}

let sourcePromise;
async function sourceData(){if(!sourcePromise)sourcePromise=(async()=>{const person=await appearanceData('person');
  const positions=Float32Array.from(person.positions),faces=bodyFaces(person),contact=new MeshContact(positions,faces);
  const W=person.rig.weights,names=person.rig.names,torsoWeight=new Float32Array(person.bodyCount),lowerWeight=new Float32Array(person.bodyCount);
  for(let i=0;i<person.bodyCount;i++)for(let k=W.ptr[i];k<W.ptr[i+1];k++){
    const name=names[W.joints[k]],w=W.values[k];
    if(/^(root|spine|pelvis|clavicle|shoulder|neck)/.test(name))torsoWeight[i]+=w;
    if(/^(root|spine05|pelvis|upperleg|lowerleg|foot|toe)/.test(name))lowerWeight[i]+=w;
  }
  const region=(kind)=>{const ff=[];for(let f=0;f<faces.length;f+=3){const ids=[faces[f],faces[f+1],faces[f+2]];
    const weight=ids.reduce((s,i)=>s+(kind==='torso'?torsoWeight[i]:lowerWeight[i]),0)/3;
    const x=ids.reduce((s,i)=>s+positions[i*3],0)/3;
    if(weight>.65&&(kind==='torso'||kind==='lower'||(kind==='left'?x>=-.001:x<=.001)))ff.push(...ids);
  }return new MeshContact(positions,Int32Array.from(ff));};
  return {person,positions,faces,contact,regions:{torso:region('torso'),lower:region('lower'),left:region('left'),right:region('right')},references:new Map()};})();return sourcePromise;}
function referenceFor(source,packet) {
  const id=packet.binding.presetId;if(source.references.has(id))return source.references.get(id);
  const panelIds=packet.spec.panels.flatMap(p=>Array(p.uvMm.length).fill(p.id));
  const refs=packet.record.positionsMm.map((p,index)=>{
    const native=[p[0]*.001,-p[2]*.001,p[1]*.001-GROUND_SHIFT];
    const panel=panelIds[index],region=/torso/.test(panel)?'torso':/^pant_.*_l$/.test(panel)?'left':/^pant_.*_r$/.test(panel)?'right':'lower',contact=source.regions[region];
    const f=contact.nearest(...native),q=contact.best,ids=Array.from(contact.faces.subarray(f,f+3));
    const bary=Array.from(q.subarray(4,7)),base=[q[1],q[2],q[3]],F=frame(source.positions,ids),delta=sub(native,base);
    return {ids,bary,frame:F,region,offset:[dot(delta,F.u),dot(delta,F.v),dot(delta,F.n)],sourceDistance:Math.sqrt(q[0])};
  });source.references.set(id,refs);return refs;
}
function bindGarment(actor,packet,mesh,source,role) {
  const refs=referenceFor(source,packet),P=actor.nativeSource.positions,ranges=new Uint32Array(refs.length*2),entries=[],normals=new Float32Array(refs.length*3);
  let maxInfluences=0,maxOriginalInsideM=0,maxRetargetOffsetM=0;
  for(let i=0;i<refs.length;i++) {
    const ref=refs[i],F=frame(P,ref.ids),ratio=Math.max(.65,Math.min(1.6,F.len/(ref.frame.len||1))),base=baryPoint(P,ref.ids,ref.bary);
    // Positive rest clearance is a collision correction, never a hidden body
    // mask. Original outer folds remain offsets from their true body triangles.
    const minClearance=role==='top'?.006:.003;
    maxOriginalInsideM=Math.max(maxOriginalInsideM,-ref.offset[2]);
    const delta=add(add(mul(F.u,ref.offset[0]*ratio),mul(F.v,ref.offset[1]*ratio)),mul(F.n,Math.max(minClearance,ref.offset[2])));
    const rest=add(base,delta);maxRetargetOffsetM=Math.max(maxRetargetOffsetM,Math.hypot(...delta));
    normals.set(F.n,i*3);
    const g=mesh.geometry.attributes.position.array;g.set([rest[0],rest[2],-rest[1]],i*3);
    const all=new Map();
    for(let k=0;k<3;k++) {
      const id=ref.ids[k],start=actor.binding.range[id*2],count=actor.binding.range[id*2+1];
      for(let j=0;j<count;j++) {
        const o=(start+j)*8,A=actor.binding.packed,joint=A[o+3],w=ref.bary[k]*A[o+4];if(w<=0)continue;
        let a=all.get(joint);if(!a){a={j:joint,w:0,p:[0,0,0]};all.set(joint,a);}a.w+=w;
        for(let c=0;c<3;c++)a.p[c]+=(A[o+c]+delta[c])*w;
      }
    }
    const sum=[...all.values()].reduce((s,a)=>s+a.w,0);if(Math.abs(sum-1)>1e-4)throw Error('Garment native weights do not sum to one');
    ranges.set([entries.length/8,all.size],i*2);maxInfluences=Math.max(maxInfluences,all.size);
    for(const a of all.values())entries.push(...a.p.map(v=>v/a.w),a.j,a.w,0,0,0);
  }
  mesh.geometry.computeVertexNormals();smoothSewnNormals(mesh.geometry,packet.spec,packet.record.activeSeams);
  mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  return {ranges,entries:Float32Array.from(entries),normals,count:refs.length,maxInfluences,
    report:{method:'source actual-body triangle barycentrics + every native CSR influence',weightsTruncated:false,
      sourceVertices:refs.length,sourceTriangles:mesh.geometry.index.count/3,maxInfluences,maxOriginalInsideM,maxRetargetOffsetM,
      indexSequenceRetained:true,sourcePaperUVRetained:true,bodyGeometryChanged:false,referenceSelection:'original torso/pant panel identity and source native body weights; no arm binding for sleeveless torso, no opposite-leg binding'}};
}
function skinBound(bound,matrices,out) {
  const A=bound.entries,R=bound.ranges;
  for(let i=0;i<bound.count;i++) {
    let x=0,y=0,z=0;for(let k=0;k<R[i*2+1];k++) {
      const q=(R[i*2]+k)*8,m=matrices[A[q+3]],w=A[q+4],a=A[q],b=A[q+1],c=A[q+2];
      x+=w*(m[0]*a+m[1]*b+m[2]*c+m[3]);y+=w*(m[4]*a+m[5]*b+m[6]*c+m[7]);z+=w*(m[8]*a+m[9]*b+m[10]*c+m[11]);
    }out[i*3]=x;out[i*3+1]=y;out[i*3+2]=z;
  }
}

// Contact constraints act on the source's sewn material vertices together.
// Indices/UVs remain unchanged: this is a solver map, not a topology weld.
function contactCache(n){return {face:new Int32Array(n).fill(-1),point:new Float64Array(n*3),distance:new Float64Array(n),clock:new Float64Array(n)};}
function queryContact(contact,cache,i,x,y,z,margin,out,metrics) {
  const q=i*3,clock=contact.npcMotionClock||0;
  if(cache.face[i]>=0&&cache.distance[i]>margin){
    const travelled=Math.hypot(x-cache.point[q],y-cache.point[q+1],z-cache.point[q+2])+clock-cache.clock[i];
    const lower=cache.distance[i]-travelled;
    if(lower>=margin){out[0]=lower;metrics.safelySkippedQueries++;return out;}
  }
  const f=contact.nearest(x,y,z,Infinity,cache.face[i]);cache.face[i]=f;
  contact.evaluate(f,x,y,z,out);cache.point.set([x,y,z],q);cache.distance[i]=out[0];cache.clock[i]=clock;metrics.queries++;return out;
}
function controlTopology(packet,mesh) {
  const count=mesh.geometry.attributes.position.count,parent=Int32Array.from({length:count},(_,i)=>i),offsets=new Map();let n=0;
  for(const p of packet.spec.panels){offsets.set(p.id,n);n+=p.uvMm.length;}
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const active=new Set(packet.record.activeSeams);
  for(const seam of packet.spec.seams)if(active.has(seam.id))for(const [a,b]of seam.stitchVertexPairs||[]){
    const i=offsets.get(seam.a.panelId)+a,j=offsets.get(seam.b.panelId)+b;parent[root(j)]=root(i);}
  const map=new Map(),vertexGroup=new Int32Array(count),groups=[];
  for(let i=0;i<count;i++){const r=root(i);if(!map.has(r)){map.set(r,groups.length);groups.push([]);}const g=map.get(r);groups[g].push(i);vertexGroup[i]=g;}
  const vertexSide=new Int8Array(groups.length),faceSide=[];let off=0;
  for(const p of packet.spec.panels){const sign=/^pant_f_|front/.test(p.id)?1:/^pant_b_|back/.test(p.id)?-1:0;
    for(let i=0;i<p.uvMm.length;i++)vertexSide[vertexGroup[off+i]]+=sign;
    for(const t of p.triangles)faceSide.push(sign);off+=p.uvMm.length;}
  const rest=new Float64Array(groups.length*3),display=mesh.geometry.attributes.position.array;
  for(let g=0;g<groups.length;g++)for(let d=0;d<3;d++){for(const i of groups[g])rest[g*3+d]+=display[i*3+d]/groups[g].length;}
  return {groups,vertexGroup,position:new Float64Array(groups.length*3),normal:new Float64Array(groups.length*3),rest,vertexSide,faceSide,
    vertexCache:contactCache(groups.length),triangleCache:contactCache(mesh.geometry.index.count/3*4)};
}

function projectGarment(item,contact,actor) {
  const topology=item.controlTopology||(item.controlTopology=controlTopology(item.packet,item.mesh)),
    {groups,vertexGroup:G,position:P,vertexCache}=topology,source=item.native,probe=new Float64Array(4),
    clearance=item.role==='top'?.006:.004,metrics={queries:0,safelySkippedQueries:0};
  for(let g=0;g<groups.length;g++)for(let d=0;d<3;d++){let v=0;for(const i of groups[g])v+=source[i*3+d];P[g*3+d]=v/groups[g].length;}
  let corrections=0,minimum=Infinity,maximumProjectionM=0;
  for(let g=0;g<groups.length;g++){
    const q=g*3;
    for(let pass=0;pass<3;pass++){
      queryContact(contact,vertexCache,g,P[q],P[q+1],P[q+2],clearance-.00001,probe,metrics);
      const depth=clearance-probe[0];if(depth<=.00001){minimum=Math.min(minimum,probe[0]);break;}
      for(let d=0;d<3;d++)P[q+d]+=probe[d+1]*depth;corrections++;
    }
  }
  for(let i=0;i<item.binding.count;i++){const g=G[i]*3,q=i*3;maximumProjectionM=Math.max(maximumProjectionM,Math.hypot(source[q]-P[g],source[q+1]-P[g+1],source[q+2]-P[g+2]));source.set(P.subarray(g,g+3),q);}
  return {corrections,triangleCorrections:0,minimum,maximumProjectionM,passes:3,remaining:null,...metrics};
}

function deformControl(actor,items,posedBody,contact) {
  let movement=0;for(let i=0;i<actor.nativeSource.bodyCount;i++){const p=actor.binding.sampleVertex(i),q=i*3;movement=Math.max(movement,Math.hypot(p[0]-posedBody[q],p[1]-posedBody[q+1],p[2]-posedBody[q+2]));posedBody.set(p,q);}
  contact.npcMotionClock=(contact.npcMotionClock||0)+movement;if(movement>0)contact.refit(posedBody);let corrections=0,triangleCorrections=0,minimum=Infinity,maxProjection=0,passes=0,remaining=0;
  for(const item of items) {
    skinBound(item.binding,actor.rig.skinMatrices,item.native);const P=item.native,Q=item.mesh.geometry.attributes.position.array;
    const result=projectGarment(item,contact,actor);corrections+=result.corrections;triangleCorrections+=result.triangleCorrections;
    minimum=Math.min(minimum,result.minimum);maxProjection=Math.max(maxProjection,result.maximumProjectionM);passes=Math.max(passes,result.passes);remaining+=result.remaining;
    for(let q=0;q<P.length;q+=3)Q.set([P[q],P[q+2],-P[q+1]],q);
    const geometry=item.mesh.geometry;geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
    smoothSewnNormals(geometry,item.packet.spec,item.packet.record.activeSeams);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    item.solid?.deform();item.solid?.motion(true);
  }
  return {corrections,triangleCorrections,minimumSignedDistanceM:Number.isFinite(minimum)?minimum:null,maximumProjectionM:maxProjection,passes,lastPassPenetratingConstraints:remaining,
    method:'source panel anatomical binding; original MeshContact with complete sewn-vertex groups',triangleInteriorCertified:false,selfCollisionSolved:false};
}

/** Pure whole-garment binding/deformation for numerical review of the exact
 * six generated body fixtures. No material/renderer initialization is needed. */
export async function prepareNativeWardrobeControl(actor,{lookId=LOOK_BY_ACTOR[actor.id]||'D01'}={}) {
  const source=await sourceData(),look=LOOKS.find(l=>l.id===lookId);if(!look)throw Error('Unknown original outfit');
  const items=[];
  for(const [role,id] of [['top',look.top],['bottom',look.bottom]]) {
    const packet=await appearanceData(id),mesh=nativeGarmentMesh(T,packet,GROUND_SHIFT),binding=bindGarment(actor,packet,mesh,source,role);
    items.push({role,id,packet,mesh,binding,native:new Float32Array(binding.count*3),contactFaces:new Int32Array(binding.count).fill(-1)});
  }
  const posedBody=Float32Array.from(actor.nativeSource.positions),contact=new MeshContact(posedBody,bodyFaces(actor.nativeSource));
  return {items,contact,update(){return deformControl(actor,items,posedBody,contact);},
    dispose(){for(const i of items){i.mesh.geometry.dispose();for(const m of i.mesh.material)m.dispose();}}};
}

export async function createNativeWardrobe({renderer,onProgress=()=>{},requestRender}={}) {
  if(!renderer)throw Error('Native materials need the existing renderer');
  const source=await sourceData(),wearers=new Set();
  async function attach(actor,{lookId=LOOK_BY_ACTOR[actor.id]||'D01'}={}) {
    const look=LOOKS.find(l=>l.id===lookId);if(!look)throw Error('Unknown original MP05 look '+lookId);
    const items=[],group=new T.Group();group.name=`${actor.id}/MP05-original-whole-outfit`;actor.root.add(group);
    const posedBody=Float32Array.from(actor.nativeSource.positions),faces=bodyFaces(actor.nativeSource),contact=new MeshContact(posedBody,faces);
    for(const [role,id,materialId]of [['top',look.top,look.topMaterial],['bottom',look.bottom,look.bottomMaterial]]) {
      onProgress({actor:actor.id,role,phase:'original garment binding',fraction:0});
      const packet=await appearanceData(id),mesh=nativeGarmentMesh(T,packet,GROUND_SHIFT),binding=bindGarment(actor,packet,mesh,source,role);
      const material=materialRecords.find(m=>m.id===materialId);if(!material)throw Error('Missing native textile '+materialId);
      if(material.family==='knit')throw Error('Knit is not enabled in R02: accepted P02 C2 source remains isolated from these six denim/leather looks');
      const info=withSettings(material),solid=await buildContinuousSolid(mesh,packet,info,{renderer,requestRender,
        onProgress:(fraction,panel)=>onProgress({actor:actor.id,role,phase:'original material',fraction,panel})});
      // The source garment is a hidden control surface, as in its own MP05
      // workbench. Only its complete native yarns/seams render; no opaque cover.
      group.add(solid.group);items.push({role,id,materialId,packet,mesh,binding,solid,info,
        native:new Float32Array(binding.count*3),contactFaces:new Int32Array(binding.count).fill(-1)});
      await pause();
    }
    let updates=0,deformations=0,unchangedPoseUpdates=0,lastPose=null,lastWorld=null,lastUpdateMS=0,lastContact={corrections:0,minimumSignedDistanceM:Infinity,maximumProjectionM:0};
    const localCamera={fov:45,position:new T.Vector3(),matrixWorld:new T.Matrix4(),matrixWorldInverse:new T.Matrix4(),projectionMatrix:new T.Matrix4(),updateMatrixWorld(){}};
    const wardrobe={actor,group,items,lookId,
      update(camera) {
        const start=performance.now(),matrices=actor.rig.skinMatrices;
        // These static bound garments depend on the complete native pose. A
        // camera redraw must not invalidate their source yarn/seam atlases.
        // Compare every coefficient exactly: even a tiny real change updates
        // the original control surface. No time interval or error tolerance.
        const poseChanged=!lastPose||matrices.some((m,i)=>m.length!==lastPose[i]?.length||m.some((v,j)=>v!==lastPose[i][j]));
        if(poseChanged){lastContact=deformControl(actor,items,posedBody,contact);lastPose=matrices.map(m=>Float64Array.from(m));deformations++;}
        else unchangedPoseUpdates++;
        actor.root.updateWorldMatrix(true,false);
        const world=actor.root.matrixWorld.elements,rootMoved=!lastWorld||world.some((v,i)=>v!==lastWorld[i]);
        lastWorld=Float64Array.from(world);
        for(const item of items)item.solid.motion(poseChanged||rootMoved);
        if(camera){camera.updateMatrixWorld();
          localCamera.fov=camera.fov;localCamera.matrixWorld.copy(actor.root.matrixWorld).invert().multiply(camera.matrixWorld);
          localCamera.position.setFromMatrixPosition(localCamera.matrixWorld);
          localCamera.matrixWorldInverse.copy(localCamera.matrixWorld).invert();localCamera.projectionMatrix.copy(camera.projectionMatrix);
          for(const item of items)item.solid.update(localCamera);}
        updates++;lastUpdateMS=performance.now()-start;
      },
      report(){return {actor:actor.id,lookId,source:SOURCE,originalLook:{...look},updates,deformations,unchangedPoseUpdates,
        invalidation:'all native skin-matrix coefficients compared exactly; immutable binding, topology and paper; camera/material sampling still updates on every submitted batch',lastUpdateMS,contact:lastContact,
        bodyClipping:false,bodyGeometryChanged:false,freeClothPhysics:false,visualVerified:false,
        members:items.map(i=>({role:i.role,id:i.id,materialId:i.materialId,binding:i.binding.report,material:i.solid.stats,resources:i.solid.resources()}))};},
      dispose(){for(const i of items){i.solid.dispose();i.mesh.geometry.dispose();for(const m of i.mesh.material)m.dispose();}group.removeFromParent();wearers.delete(wardrobe);}};
    actor.wardrobe=wardrobe;wearers.add(wardrobe);wardrobe.update();return wardrobe;
  }
  return {attach,update(camera){for(const w of wearers)w.update(camera);},report(){return [...wearers].map(w=>w.report());},dispose(){for(const w of [...wearers])w.dispose();}};
}

export async function attachNativeWardrobe(actor,options={}){const system=await createNativeWardrobe(options),wardrobe=await system.attach(actor,options);wardrobe.system=system;return wardrobe;}
