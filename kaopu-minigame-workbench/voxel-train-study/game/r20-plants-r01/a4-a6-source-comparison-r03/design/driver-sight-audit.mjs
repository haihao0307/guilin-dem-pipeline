/** Full-scene actual-triangle visibility audit. No persistent source mutations.
 * All camera/landmark values are source-local, uncalibrated units.
 * Root world transform is applied for live/browser use, then hit points converted back.
 */
export function auditCabVisibility(T,{root,original,driver,driverCab,landmarks,glassMaterial}){
 root.updateWorldMatrix(true,true);original.root.updateWorldMatrix(true,true);
 const effectiveVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const descendant=(o,parent)=>{for(let p=o;p;p=p.parent)if(p===parent)return true;return false;};
 const meshes=[];for(const group of[original.root,root])group.traverse(o=>{if(o.isMesh&&effectiveVisible(o))meshes.push(o);});
 const inverse=root.matrixWorld.clone().invert(),toWorld=p=>new T.Vector3(...p).applyMatrix4(root.matrixWorld),toSource=p=>p.clone().applyMatrix4(inverse).toArray();
 const material=h=>Array.isArray(h.object.material)?h.object.material[h.face.materialIndex]:h.object.material;
 const describe=h=>({name:h.object.name,sourceNode:h.object.userData.originalPrimitive?.node??null,sourcePoint:toSource(h.point),distanceWorld:h.distance,glass:material(h)===glassMaterial,materialIndex:h.face.materialIndex});
 const sides=new Map();meshes.forEach(o=>(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!sides.has(m)){sides.set(m,m.side);m.side=T.DoubleSide;}}));
 try{
  function cast(start,end,{excludeDriver=false,excludeTargetName=null,stopBefore=0}={}){
   const a=toWorld(start),b=toWorld(end),distance=a.distanceTo(b),direction=b.clone().sub(a).normalize(),ray=new T.Raycaster(a,direction,.0005,Math.max(.001,distance-stopBefore));
   const hits=ray.intersectObjects(meshes.filter(o=>(!excludeDriver||!descendant(o,driver))&&o.name!==excludeTargetName),false);
   const opaque=hits.filter(h=>material(h)!==glassMaterial),glass=hits.filter(h=>material(h)===glassMaterial);
   return{glassCount:glass.length,opaqueCount:opaque.length,firstOpaque:opaque.length?describe(opaque[0]):null,firstGlass:glass.length?describe(glass[0]):null};
  }
  const eye=landmarks.eye.position.toArray(),forward=[];
  for(const down of[0,2,4,6]){const r=down*Math.PI/180,end=[eye[0],eye[1]-40*Math.sin(r),eye[2]+40*Math.cos(r)],row=cast(eye,end,{excludeDriver:true});forward.push({downDegrees:down,...row,pass:row.glassCount>=2&&row.opaqueCount===0});}
  const fan=[];for(const yaw of[-20,-10,-5,0,5,10,20])for(const down of[0,2,4,6,8]){const a=down*Math.PI/180,b=yaw*Math.PI/180,end=[eye[0]+40*Math.sin(b)*Math.cos(a),eye[1]-40*Math.sin(a),eye[2]+40*Math.cos(b)*Math.cos(a)],row=cast(eye,end,{excludeDriver:true});fan.push({yawDegrees:yaw,downDegrees:down,...row,pass:row.glassCount>=2&&row.opaqueCount===0});}
  const outside=[];for(const [view,observer]of[['positive-side',[8,2,eye[2]]],['negative-side',[-8,2,eye[2]]],['positive-quarter',[8,2,10]],['negative-quarter',[-8,2,10]],['front',[0,2,20]]])for(const key of['head','torso','leftHand','rightHand','leftFoot','rightFoot']){
   const marker=landmarks[key],target=marker.position.toArray(),foot=key.includes('Foot'),row=cast(observer,target,{excludeDriver:foot,excludeTargetName:marker.userData.targetMeshName,stopBefore:key.includes('Hand')?.065:key==='head'?.12:.03});
   outside.push({view,observerSource:observer,target:key,targetSource:target,...row,expectation:foot?'FOOT_CONCEALED':'UPPER_BODY_VISIBLE',pass:foot?row.opaqueCount>0&&/continuous one-mesh|cab floor|footwell|sill/.test(row.firstOpaque.name):row.glassCount>=2&&row.opaqueCount===0});
  }
  const requiredSide=outside.filter(r=>r.view==='positive-side');
  return{status:forward.every(r=>r.pass)&&requiredSide.every(r=>r.pass)?'PASS_REQUIRED_ACTUAL_MESH_RAYS':'FAIL_REQUIRED_ACTUAL_MESH_RAYS',units:'SOURCE_UNITS_UNCALIBRATED',scope:'actual visible source + design triangle meshes, finite inner/outer windshield, frames, wipers, instruments and source hardware; optical quality requires rendered review',coordinates:'source-local endpoints converted by actual design root.matrixWorld; hits converted back',worldFromSource:root.matrixWorld.elements.slice(),eyeSource:eye,forward,fan,outside,requiredOutsideView:'positive-side',sourceMechanicalRelocations:[],sourceMaterialsRestoredAfterAudit:true};
 }finally{for(const [m,side]of sides)m.side=side;}
}
