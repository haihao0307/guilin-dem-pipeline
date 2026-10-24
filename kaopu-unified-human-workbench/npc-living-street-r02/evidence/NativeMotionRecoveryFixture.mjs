/** Non-rendering recovery fixture. The original canonical 9,253-point body,
 * all 28,658 CSR influences and all 104 native bones are loaded unchanged.
 * The hand prefix has no head subdivision; original production NativeBinding,
 * palm selector, cylinder fit and fitted finger execution are called directly.
 * GNM head/lips and actual browser rendering are deliberately outside scope.
 */
import {loadNativeBodyFixture} from './native-body-fixtures.mjs';
import {THREE,NativeBinding} from '../src/NativeBinding.mjs';
import {NativeRig,math} from '../src/NativeRig.mjs';
import {findPalmSupport,fitCylinderGrasp,applyNativeFittedGrip} from '../src/ActorAdapter.mjs';
import {fitNativeShoeSide} from '../src/NativeShoes.mjs';
import {prepareActorMotion} from '../src/NativeMotionLibrary.mjs';
import {NativeMotion} from '../src/NativeMotion.mjs';
const {add,sub,scale,cross,norm,unit,clamp}=math;
const SIDES=['L','R'];
export const FULL_NATIVE_HEIGHTS={A:1.9273384809494019,B:1.6332803964614868,C:1.8001427054405212,D:1.5038026571273804,E:1.806150197982788,F:1.6567941308021545};
const restVertex=(g,id)=>{const p=g.attributes.position;return[p.getX(id),-p.getZ(id),p.getY(id)];};
const display=p=>new THREE.Vector3(p[0],p[2],-p[1]);
const vector=p=>p?.isVector3?p.clone():new THREE.Vector3(...(Array.isArray(p)||ArrayBuffer.isView(p)?p:[p.x,p.y,p.z]));

export async function createMotionRecoveryFixture(id,{shoes=true,prepare=true,notify=()=>{}}={}){
 const model=loadNativeBodyFixture(id),geometry=new THREE.BufferGeometry(),positions=new Float32Array(model.positions.length);
 for(let i=0;i<model.bodyCount;i++){positions[i*3]=model.positions[i*3];positions[i*3+1]=model.positions[i*3+2];positions[i*3+2]=-model.positions[i*3+1];}
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(model.faces.slice(),1));geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 // An explicit zero-refinement numerical body view. NativeBinding still
 // applies both original neutral-residual corrections and Float32 CSR packs.
 const ocular={source:geometry,geometry,pairs:[]},viewer={mesh,geometry,currentOcular:ocular,surfaces:new Map([['body-prefix',{geometry,levels:[]}]])};
 const binding=new NativeBinding(model,viewer);binding.height=FULL_NATIVE_HEIGHTS[id];
 const rig=new NativeRig({...binding.rig,stature:binding.height}),root=new THREE.Group();root.add(mesh);root.position.y=binding.floorOffset;root.updateMatrixWorld(true);
 const fingers={},patches={},handSurfaceVertices={};
 for(const side of SIDES){
  const frame=rig.hand[side],handJoints=new Set(rig.descendants[rig.index.get('wrist.'+side)]),ids=[];
  for(let i=0;i<geometry.attributes.position.count;i++){
   const start=binding.displayRange[i*4],count=binding.displayRange[i*4+1];
   for(let k=0;k<count;k++)if(handJoints.has(binding.displayPacked[(start+k)*8+3])&&binding.displayPacked[(start+k)*8+4]>1e-6){ids.push(i);break;}
  }
  handSurfaceVertices[side]=ids;patches[side]=findPalmSupport(geometry,binding,rig,side,ids);
  for(let f=1;f<=5;f++){
   const joints=[1,2,3].map(k=>rig.index.get(`finger${f}-${k}.${side}`)),points=joints.map(j=>rig.restP[j]);
   fingers[side+f]={ids:joints,axes:joints.map((j,k)=>unit(cross(unit(k<2?sub(points[k+1],points[k]):sub(points[2],points[1])),frame.palm)))};
  }
 }
 const shape={kind:'upright-cylinder',radius:.032,height:.14,gripHeight:0},sides={};
 for(const side of SIDES)sides[side]=fitCylinderGrasp({rig,binding,fingers,patch:patches[side],handVertices:handSurfaceVertices[side],side,shape});
 const graspReport={profile:'bottle',shape,sides,admissible:SIDES.every(s=>sides[s].admissible)};
 if(!graspReport.admissible)throw Error('Production native cylinder fit failed for '+id+': '+JSON.stringify(sides));
 const feet=SIDES.map(side=>{
  const foot=rig.restP[rig.index.get('foot.'+side)];let vertex=-1,lowest=Infinity,best=Infinity;
  for(let i=0;i<binding.N;i++){
   const p=restVertex(geometry,i);if(p[0]*foot[0]<=0||p[2]>-binding.floorOffset+.025)continue;
   const d=norm(sub(p,foot));if(p[2]<lowest-1e-7||Math.abs(p[2]-lowest)<1e-7&&d<best){lowest=p[2];best=d;vertex=i;}
  }
  if(vertex<0)throw Error('Actual canonical foot support absent');return{id:vertex,side,rest:restVertex(geometry,vertex)};
 });
 const soleSurfaceIds={L:[],R:[]};
 for(let i=0;i<binding.N;i++){
  if(binding.positions[i*3+2]>-binding.floorOffset+binding.height*.13)continue;
  for(const side of SIDES){let weight=0;for(let k=0;k<binding.range[i*2+1];k++){
   const slot=(binding.range[i*2]+k)*8,name=rig.names[binding.packed[slot+3]];if(/^(foot|toe)/.test(name)&&name.endsWith('.'+side))weight+=binding.packed[slot+4];
  }if(weight>.5)soleSurfaceIds[side].push(i);}
 }
 const sampleLiveVertex=id=>{
  const ranges=binding.displayRange,entries=binding.displayPacked,out=[0,0,0];
  for(let n=0;n<ranges[id*4+1];n++){
   const k=(ranges[id*4]+n)*8,m=rig.skinMatrices[entries[k+3]],w=entries[k+4];
   for(let q=0;q<3;q++)out[q]+=w*(m[q*4]*entries[k]+m[q*4+1]*entries[k+1]+m[q*4+2]*entries[k+2]+m[q*4+3]);
  }return out;
 };
 const samplePalm=(side='R')=>{const patch=patches[side],out=[0,0,0];for(let i=0;i<patch.indices.length;i++){const p=sampleLiveVertex(patch.indices[i]);for(let k=0;k<3;k++)out[k]+=p[k]*patch.barycentric[i];}return out;};
 const toLocal=p=>{root.updateWorldMatrix(true,false);const v=root.worldToLocal(vector(p));return[v.x,-v.z,v.y];};
 const toWorld=p=>{root.updateWorldMatrix(true,false);return root.localToWorld(display(p));};
 const actor={id,profile:model.profile,root,mesh,rig,binding,side:'R',graspReport,graspProfiles:{bottle:graspReport},
  nativeSource:{positions:binding.positions,faces:model.faces,bodyCount:model.bodyCount},
  setSide(side){if(!SIDES.includes(side))throw Error('Invalid anatomical side');this.side=side;return this;},
  selectGrasp(profile='bottle'){if(!this.graspProfiles[profile]?.admissible)throw Error('Fixture deliberately has only a real bottle fit; no food/head proof');this.graspReport=this.graspProfiles[profile];return this.graspReport;},
  poseTools:{feet,soleSurfaceIds,toLocal,toWorld,restVertex:id=>restVertex(geometry,id),sampleVertex:sampleLiveVertex,samplePalm,palmRest:side=>patches[side].rest.slice(),
   selectGrasp:profile=>actor.selectGrasp(profile),
   clear({side='R',grip=0,handActive=false}={}){for(const v of rig.rotationDeltas)v.fill(0);rig.rootTranslation.fill(0);if(handActive)applyNativeFittedGrip(rig,fingers,actor.graspReport.sides[side],side,clamp(grip,0,1));},
   applyGrip(side,amount){applyNativeFittedGrip(rig,fingers,actor.graspReport.sides[side],side,clamp(amount,0,1));},
   commit(){binding.animate(rig.skinMatrices);}
  },
  fixture:{schema:'original-native-body-motion-fixture/1',bodyVertices:binding.N,bodyTriangles:model.faces.length/3,bones:rig.count,csrInfluences:binding.packed.length/8,
   maxInfluences:binding.report.maxInfluences,source:model.source,fullHeightSource:'prior exact R07 runtime identity measurement; current canonical body excludes GNM head',
   sourceDisplayHandEquivalent:true,handVertices:Object.fromEntries(SIDES.map(s=>[s,handSurfaceVertices[s].length])),headOrMouthIncluded:false,rendered:false,originalGeometryUnmodified:true},
  diagnostics({prop}={}){
   const hand={};for(const side of SIDES){let minimum=Infinity,deepest=-1;for(const id of handSurfaceVertices[side]){
    const p=toWorld(sampleLiveVertex(id));if(!prop)continue;const q=new THREE.Quaternion(...prop.quaternion).invert();p.sub(new THREE.Vector3(...prop.position)).applyQuaternion(q);
    const radial=Math.hypot(p.x,p.z)-(prop.radius??.032),axial=Math.abs(p.y)-(prop.height??.14)/2,sdf=Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0);
    if(sdf<minimum){minimum=sdf;deepest=id;}
   }hand[side]={minimumSignedDistanceM:minimum,deepestVertex:deepest,vertices:handSurfaceVertices[side].length};}return{hand,headOrMouthIncluded:false};
  }
 };
 actor.fixture.geometry=geometry;actor.fixture.patches=patches;actor.fixture.fingers=fingers;actor.fixture.handSurfaceVertices=handSurfaceVertices;
 for(const v of rig.rotationDeltas)v.fill(0);rig.rootTranslation.fill(0);rig.fk();binding.animate(rig.skinMatrices);
 if(shoes){const perSide={},fits={};for(const side of SIDES){fits[side]=fitNativeShoeSide(actor,side);perSide[side]=fits[side].record;}
  actor.footwear={source:'original R14 complete retained shoe geometry; current recovered wearer adapter',styleId:fits.R.record.styleId,perSide,soleLiftM:Math.max(...SIDES.map(s=>perSide[s].soleLiftM))};actor.fixture.shoeFits=fits;
 }
 if(prepare){notify('preparing all original clips for '+id);await prepareActorMotion(actor,()=>{});actor.motion=new NativeMotion(actor);}
 return actor;
}
