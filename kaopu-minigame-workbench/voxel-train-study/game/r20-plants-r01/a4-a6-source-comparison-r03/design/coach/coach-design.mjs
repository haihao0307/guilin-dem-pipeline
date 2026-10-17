import {createTrainMatter} from '../original-matter/materials/matter.mjs';
import {COACH_EXTERIOR_SUBSTITUTIONS,PROTECTED_COACH_MECHANICAL_PRIMITIVES,RETAINED_COACH_GLASS_PRIMITIVES,COACH_SOURCE_ENVELOPES as E,validateCoachSource} from './source-coach-map.mjs';
export {COACH_EXTERIOR_SUBSTITUTIONS,PROTECTED_COACH_MECHANICAL_PRIMITIVES,COACH_SOURCE_ENVELOPES} from './source-coach-map.mjs';
const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*t*(t*(t*6-15)+10);};
/** Source-native axes and source-native lengths; no metric scaling of original meshes. */
export function coachHemAt(z){const a=Math.abs(z);return E.centralHemY+(E.bogieHemY-E.centralHemY)*smooth((a-5.35)/.47);}
export function coachHalfAt(y,z=0){
 // Smooth new outward chine, quiet narrow waist and rounded shoulder. True glass is recessed.
 const points=[[1.47,1.415],[1.80,1.455],[2.30,1.425],[2.50,1.405],[3.22,1.360]];
 let i=0;while(i<points.length-2&&y>points[i+1][0])i++;
 const a=points[i],b=points[i+1],t=Math.min(1,Math.max(0,(y-a[0])/(b[0]-a[0])));
 return a[1]+(b[1]-a[1])*t;
}
/** Ordered real source-pane boundary polygons, not guessed window rectangles. */
export function readCoachWindowLoops(T,source){
 source.root.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(source.root.matrixWorld).invert(),out=[];
 for(const sourceNode of [16,20]){
  const primitive=source.primitives.find(p=>p.sourceNode===sourceNode&&p.primitive===0),mesh=primitive.object,g=mesh.geometry,p=g.attributes.position,world=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),unique=[],map=new Map(),ids=[];
  for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(world),key=v.toArray().map(x=>Math.round(x*1e6)).join(',');if(!map.has(key)){map.set(key,unique.length);unique.push(v);}ids.push(map.get(key));}
  const parent=unique.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const index=g.index?Array.from(g.index.array):ids.map((_,i)=>i);
  for(let i=0;i<index.length;i+=3){const a=find(ids[index[i]]);parent[find(ids[index[i+1]])]=a;parent[find(ids[index[i+2]])]=a;}
  const groups=new Map();for(let i=0;i<unique.length;i++){const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(unique[i]);}
  for(const vertices of groups.values()){
   const center=vertices.reduce((s,v)=>s.add(v),new T.Vector3()).multiplyScalar(1/vertices.length),ordered=vertices.slice().sort((a,b)=>Math.atan2(a.y-center.y,a.z-center.z)-Math.atan2(b.y-center.y,b.z-center.z));
   const box=new T.Box3().setFromPoints(ordered);if(ordered.length!==30)throw Error('COACH_SOURCE_PANE_TOPOLOGY_CHANGED_'+sourceNode+'_'+ordered.length);
   out.push({sourceNode,side:Math.sign(center.x),center:center.toArray(),points:ordered.map(v=>v.toArray()),yz:ordered.map(v=>[v.z,v.y]),bounds:[box.min.toArray(),box.max.toArray()]});
  }
 }
 if(out.length!==20)throw Error('COACH_EXPECTS_TWENTY_TRUE_SOURCE_PANES');return out.sort((a,b)=>a.side-b.side||a.center[2]-b.center[2]);
}
export function createCoachDesign(T,source,{materials:providedMaterials}={}){
 validateCoachSource(source);const root=new T.Group();root.name='R03 source-backed modern Mark3 exterior / no replacement running gear';root.visible=false;
 const base=providedMaterials||createTrainMatter(T),materials={...base};
 // Source glTF material objects are never reused or edited. Parent-supplied design materials may be shared.
 const sourceMaterialSet=new Set(source.primitives.flatMap(p=>Array.isArray(p.object.material)?p.object.material:[p.object.material]));
 if(Object.values(materials).some(m=>sourceMaterialSet.has(m)))throw Error('COACH_DESIGN_MUST_NOT_MUTATE_SOURCE_MATERIAL');
 if(!providedMaterials){materials.paint.color.set('#064631');materials.paint.metalness=.38;materials.paint.roughness=.22;materials.paint.clearcoat=.92;materials.paint.side=T.DoubleSide;}
 materials.gold=materials.brass;
 const windowBelt=materials.black.clone();windowBelt.name='R03 continuous deep-green window belt / original FH88 iron kernel';windowBelt.color.set('#071b18');windowBelt.metalness=.40;windowBelt.roughness=.23;windowBelt.clearcoat=.60;windowBelt.onBeforeCompile=materials.black.onBeforeCompile;const blackKey=materials.black.customProgramCacheKey;windowBelt.customProgramCacheKey=()=>blackKey()+'/coach-window-belt-r03';materials.windowBelt=windowBelt;
 const windowLoops=readCoachWindowLoops(T,source),shellMeshes=[],collarMeshes=[],sourceDoorDisplayCopies=[];
 const shell=new T.Group();shell.name='Independent finite rounded shell with 20 real window openings';root.add(shell);
 const details=new T.Group();details.name='Fine longitudinal finish and compact open interface';root.add(details);
 function addMesh(g,m,name,parent=shell){const mesh=new T.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData={newExteriorOnly:true,sourceUnits:'UNCHANGED_UNCALIBRATED',generatedRunningGear:false};parent.add(mesh);return mesh;}
 const toPath=points=>{const p=new T.Path();points.forEach(([z,y],i)=>i?p.lineTo(z,y):p.moveTo(z,y));p.closePath();return p;};
 function sidePanel(side,outline,holes,material,name){
  const shape=new T.Shape();outline.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();for(const hole of holes)shape.holes.push(toPath(hole));
  const g=new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:false,steps:1,curveSegments:1}),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const z=p.getX(i),y=p.getY(i),depth=p.getZ(i);p.setXYZ(i,side*(coachHalfAt(y,z)-depth),y,z);}
  if(side<0){const ix=Array.from({length:p.count},(_,i)=>i);for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.setIndex(ix);}
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={finiteThicknessSourceUnits:.022,trueHoles:holes.length,sourcePaneLoopsUnchanged:true};
  const mesh=addMesh(g,material,name);mesh.userData={...mesh.userData,finiteThicknessSourceUnits:.022,side,geometryRole:'sideShell',windowHoleCount:holes.length};shellMeshes.push(mesh);return mesh;
 }
 const bodyEnd=10.245;
 for(const side of [-1,1]){
  const lower=[];for(let i=0;i<=240;i++){const z=-bodyEnd+2*bodyEnd*i/240;lower.push([z,coachHemAt(z)]);}lower.push([bodyEnd,2.50],[-bodyEnd,2.50]);sidePanel(side,lower,[],materials.paint,'R03 green lower chine / complete bogie openings '+side);
  const apertures=windowLoops.filter(w=>w.side===side).map(w=>w.yz);
  // Silver source hardware19 is also a real aperture; do not bury it under the new belt.
  for(const s of [-1,1])apertures.push([[s*9.79,2.815],[s*9.87,2.815],[s*9.87,2.900],[s*9.79,2.900]]);
  sidePanel(side,[[-bodyEnd,2.50],[bodyEnd,2.50],[bodyEnd,3.22],[-bodyEnd,3.22]],apertures,windowBelt,'R03 true-aperture continuous window belt '+side);
 }
 // Single rounded transverse roof/shoulder field. Actual original rooftop fittings stay visible.
 const roofHalf=[[1.360,3.22],[1.340,3.48],[1.220,3.75],[.990,3.98],[.700,4.14],[.340,4.21],[0,E.newBodyCrownY]];
 const roofSection=[...roofHalf.map(([x,y])=>new T.Vector3(-x,y,0)),...roofHalf.slice(0,-1).reverse().map(([x,y])=>new T.Vector3(x,y,0))];
 const roofCurve=new T.CatmullRomCurve3(roofSection,false,'centripetal');
 function upperProfile(t){const v=roofCurve.getPoint(t);return new T.Vector2(v.x,v.y);}
 function outerProfile(t,minY=2.04){
  if(t>=.15&&t<=.85)return upperProfile((t-.15)/.70);
  const side=t<.5?-1:1,u=t<.5?t/.15:(1-t)/.15,y=minY+(3.22-minY)*u;return new T.Vector2(side*coachHalfAt(y),y);
 }
 function skinBand(z0,z1,profile,nu,nv,material,name,parent=shell,offset=0){
  const pos=[],uv=[],index=[],row=nv+1;
  for(let wall=0;wall<2;wall++)for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){
   const z=z0+(z1-z0)*i/nu,t=j/nv,p=profile(t),pa=profile(Math.max(0,t-.00001)),pb=profile(Math.min(1,t+.00001)),dx=pb.x-pa.x,dy=pb.y-pa.y,L=Math.hypot(dx,dy)||1;
   // For left-to-right roof traversal, the outward normal is (-dy,dx).
   const d=offset-wall*.022;pos.push(p.x-d*dy/L,p.y+d*dx/L,z);uv.push(t,(z-z0)/(z1-z0));
  }
  const layer=(nu+1)*row,quad=(a,b,c,d)=>index.push(a,b,c,b,d,c);
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*row+j,b=a+row;quad(a,a+1,b,b+1);quad(a+layer,b+layer,a+1+layer,b+1+layer);}
  for(let i=0;i<nu;i++)for(const j of[0,nv]){const a=i*row+j,b=a+row;if(j===0)quad(a,b,a+layer,b+layer);else quad(a,a+layer,b,b+layer);}
  for(const i of[0,nu])for(let j=0;j<nv;j++){const a=i*row+j;if(i===0)quad(a,a+layer,a+1,a+1+layer);else quad(a,a+1,a+layer,a+1+layer);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={finiteThicknessSourceUnits:.022,closed:true};
  const mesh=addMesh(g,material,name,parent);mesh.userData={...mesh.userData,geometryRole:parent===shell?'roofShell':'compactInterface',finiteThicknessSourceUnits:.022,openUnderbody:true};return mesh;
 }
 const roof=skinBand(-E.bodyEndZ,E.bodyEndZ,upperProfile,160,144,materials.paint,'R03 continuous rounded green shoulder and roof');shellMeshes.push(roof);
 // Simple, small overlapping seam only. All source couplers, buffers and hoses remain below.
 for(const side of[-1,1]){
  const a=side*E.bodyEndZ,b=side*11.79,z0=Math.min(a,b),z1=Math.max(a,b);
  const collar=skinBand(z0,z1,t=>outerProfile(t,E.interfaceMinimumY),12,176,materials.paint,'R03 short open-bottom coach interface '+side,details,.012);collarMeshes.push(collar);
  const z=side*11.60,seam=skinBand(z-.016,z+.016,t=>outerProfile(t,E.interfaceMinimumY),1,176,windowBelt,'R03 recessed compact interface seam '+side,details,.015);collarMeshes.push(seam);
 }
 function line(points,radius,material,name){const curve=new T.CatmullRomCurve3(points),g=new T.TubeGeometry(curve,Math.max(64,points.length*2),radius,8,false);return addMesh(g,material,name,details);}
 for(const side of[-1,1]){
  line(Array.from({length:90},(_,i)=>{const z=-bodyEnd+2*bodyEnd*i/89,y=2.465;return new T.Vector3(side*(coachHalfAt(y,z)+.008),y,z);}),.009,materials.brass,'R03 fine continuous gold waistline '+side);
  line(Array.from({length:90},(_,i)=>{const z=-bodyEnd+2*bodyEnd*i/89,y=coachHemAt(z)+.045;return new T.Vector3(side*(coachHalfAt(y,z)+.006),y,z);}),.005,materials.brass,'R03 fine gold raised hem accent '+side);
 }
 // Pure exterior doors use the EXACT unchanged source BufferGeometry. Only the independent display copy has design paint.
 source.root.updateMatrixWorld(true);const inverseSource=new T.Matrix4().copy(source.root.matrixWorld).invert();
 for(const sourceNode of[130,134]){const p=source.primitives.find(p=>p.sourceNode===sourceNode),copy=p.object.clone(false);copy.name='R03 exact source door skin / unified green '+sourceNode;copy.geometry=p.object.geometry;copy.material=materials.paint;copy.matrixAutoUpdate=false;copy.matrix.multiplyMatrices(inverseSource,p.object.matrixWorld);copy.userData={newExteriorOnly:true,exactSourceDoorDisplayCopy:true,sourceNode,sourceMesh:source.g.nodes[sourceNode].mesh,sourcePrimitive:0,sourceGeometrySharedUnmodified:true,generatedRunningGear:false,geometryRole:'exactSourceDoorSkin'};shell.add(copy);sourceDoorDisplayCopies.push(copy);}
 const substituted=new Set(COACH_EXTERIOR_SUBSTITUTIONS.map(x=>x.node)),sourcePrimitives=source.primitives.filter(p=>substituted.has(p.sourceNode)),baseline=new Map(sourcePrimitives.map(p=>[p.object,p.object.visible]));let visible=false;
 function setVisible(on){visible=Boolean(on);root.visible=visible;for(const p of sourcePrimitives)p.object.visible=visible?false:baseline.get(p.object);return visible;}
 const metadata={revision:'R03_COMPLETE_MARK3_SOURCE_CONTINUOUS_COACH',sourcePreserved:true,windowOpeningsPreserved:true,originalGlassPreserved:true,windowCount:20,windowSourceNodes:[16,20],doorGlassSourceNodes:[128,133],windowBoundary:'actual 30-vertex original pane outlines; no guessed rectangular holes',
 hiddenSourcePrimitiveNodes:[...substituted],protectedMechanicalPrimitiveNodes:[...PROTECTED_COACH_MECHANICAL_PRIMITIVES],allOtherSourcePrimitivesRetained:true,substitutionEvidence:COACH_EXTERIOR_SUBSTITUTIONS,
 sourceNodes:145,sourcePrimitives:89,sourceMaterialsUnchanged:true,sourceTransformsUnchanged:true,sourceGeometryUnchanged:true,sourceDoorSharedGeometryNodes:[130,134],generatedRunningGear:false,sourceUnits:E.units,
 samePaintAsA6:{color:materials.paint.color.getHexString(),metalness:materials.paint.metalness,roughness:materials.paint.roughness,clearcoat:materials.paint.clearcoat},sourceBodyCrownY:E.sourceBodyCrownY,newBodyCrownY:E.newBodyCrownY,
 finiteSkinThicknessSourceUnits:.022,bogieOpeningIntervals:[[-10.50,-5.82],[5.82,10.50]],bogieMinimumHemY:E.bogieHemY,compactInterface:{lengthSourceUnits:11.79-E.bodyEndZ,minimumY:E.interfaceMinimumY,openBottom:true,actualTenderConnectionVerified:false},
 certification:false,limitations:'Static source-unit exterior study. No metric calibration, running rail datum, suspension travel, coupling articulation, loading or aerodynamics certified.',externalDecorativeRivets:0};
 root.userData=metadata;root.updateMatrixWorld(true);
 return {root,setVisible,getVisible:()=>visible,materials,metadata,shell,details,shellMeshes,collarMeshes,sourceDoorDisplayCopies,windowLoops,sourcePrimitives,E};
}
