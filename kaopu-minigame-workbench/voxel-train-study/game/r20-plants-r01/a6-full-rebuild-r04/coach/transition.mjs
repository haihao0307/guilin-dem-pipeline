import {sectionAt,sectionPoint} from '../src/design/continuous-shell.mjs';

/**
 * R04 tender/coach interface: overlapping finite outer leaves, an independent
 * finite elastomer bellows, separate sliding buffer counterparts and a slack
 * service hose. Existing chassis, coupling, wheels and brake hardware are NEVER
 * deleted or substituted. Z=0 is the rail crown; all values are metres.
 *
 * This is a bounded, inspectable kinematic/design study. The articulation limits
 * are demonstration values, NOT a speed, loading, fatigue or safety approval.
 */
export function createTransition(T,M,options={}){
 const startX=options.startX??28.30,endX=options.endX??29.435;
 const pivot=new T.Vector3(options.pivotX??28.72,0,options.pivotZ??.88);
 const gap=endX-startX;
 if(!Number.isFinite(gap)||gap<.3||gap>3)throw Error('TRANSITION_GAP_OUT_OF_DESIGN_RANGE');
 const limits={yawDeg:3,pitchDeg:1,strokeM:.045,lateralM:.025,verticalM:.025,...options.limits};
 for(const [k,v]of Object.entries(limits))if(!Number.isFinite(v)||v<0)throw Error('INVALID_TRANSITION_LIMIT_'+k);
 const root=new T.Group();root.name='R04 articulated tender-coach aerodynamic transition';
 const exterior=new T.Group(),mechanical=new T.Group();root.add(exterior,mechanical);
 exterior.name='Independent overlapping shroud and flexible bellows';mechanical.name='Open inspection corridor / original coupling retained';
 const black=M.rubber||M.black,steel=M.steel,paint=M.paint;
 const bellowsMaterial=black.clone();bellowsMaterial.name='R04 flexible bellows / inherited original black material';
 bellowsMaterial.onBeforeCompile=black.onBeforeCompile;
 bellowsMaterial.customProgramCacheKey=()=>black.customProgramCacheKey()+'/R04-bellows';
 const section=sectionAt(startX);
 const startProfile=options.startProfile||((t)=>sectionPoint(section,t));
 const endProfile=options.endProfile||((t)=>{
  if(t<=.5){const a=t*Math.PI;return[1.415*Math.sin(a),3.25+.70*Math.cos(a)];}
  const z=3.25-(3.25-1.11)*(t-.5)*2;
  const tuck=Math.max(0,Math.min(1,(1.315-z)/.205));
  return[1.415-.175*(1-Math.sqrt(Math.max(0,1-tuck*tuck))),z];
 });
 // Arc-length matching prevents the rounded crown being dragged into a low
 // shoulder by the two different source cross-section parameterizations.
 function arcProfile(fn){
  const a=[],d=[0];for(let i=0;i<=256;i++){const p=fn(i/256);if(p.length!==2||!p.every(Number.isFinite))throw Error('FINITE_PROFILE_REQUIRED');a.push(p);if(i)d.push(d[i-1]+Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1]));}
  return(t)=>{const target=Math.max(0,Math.min(1,t))*d.at(-1);let i=1;while(i<256&&d[i]<target)i++;const u=(target-d[i-1])/(d[i]-d[i-1]||1);return a[i-1].map((v,k)=>v+(a[i][k]-v)*u);};
 }
 const from=arcProfile(startProfile),to=arcProfile(endProfile);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
 const profiles={from,to};
 const motions=[],outerPanels=[],clamps=[],bufferCounterparts=[];
 const state={yawDeg:0,pitchDeg:0,strokeM:0,lateralM:0,verticalM:0};
 const q=new T.Quaternion(),rotation=new T.Matrix4(),delta=new T.Vector3();
 const coachRoot=options.coachRoot||null;let coachRest=null;
 if(coachRoot){coachRoot.updateMatrix();coachRest=coachRoot.matrix.clone();}
 function add(g,material,name,parent=exterior){const m=new T.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 function endpointMoved(p){return p.clone().sub(pivot).applyQuaternion(q).add(pivot).add(delta);}
 function move(p,u){const w=smooth(u),moved=endpointMoved(p);return p.clone().lerp(moved,w);}
 function shapeAt(u,t,radial=0){
  const a=from(t),b=to(t),w=smooth(u),y=a[0]+(b[0]-a[0])*w,z=a[1]+(b[1]-a[1])*w;
  // Offset along local transverse normal, not a scale of the floor height.
  const e=.0005,ta=Math.max(0,t-e),tb=Math.min(1,t+e),aa=from(ta),ab=from(tb),ba=to(ta),bb=to(tb);
  const dy=ab[0]-aa[0]+((bb[0]-ba[0])-(ab[0]-aa[0]))*w,dz=ab[1]-aa[1]+((bb[1]-ba[1])-(ab[1]-aa[1]))*w,L=Math.hypot(dy,dz)||1;
  return[y-radial*dz/L,z+radial*dy/L];
 }
 function closedBand(u0,u1,nu,nv,thickness,offset,name,material){
  const coords=[],indices=[],stride=2*nv+1,row=stride*2;
  for(let i=0;i<=nu;i++){const v=i/nu,u=u0+(u1-u0)*v;
   for(let wall=0;wall<2;wall++)for(let j=-nv;j<=nv;j++){
    const t=Math.abs(j)/nv,[y,z]=shapeAt(u,t,offset(u,v)-wall*thickness);
    coords.push({point:new T.Vector3(startX+gap*u,Math.sign(j)*y,z),u});
   }
  }
  const quad=(a,b,c,d)=>indices.push(a,b,c,b,d,c);
  for(let i=0;i<nu;i++)for(let j=0;j<stride-1;j++){
   const a=i*row+j,b=a+row;quad(a,b,a+1,b+1);
   const c=a+stride,d=c+row;quad(c,c+1,d,d+1);
  }
  // Both hems and both longitudinal end faces close the finite panel volume.
  for(let i=0;i<nu;i++)for(const j of[0,stride-1]){
   const a=i*row+j,b=a+row,c=a+stride,d=b+stride;
   j===0?quad(a,c,b,d):quad(a,b,c,d);
  }
  for(const i of[0,nu])for(let j=0;j<stride-1;j++){
   const a=i*row+j,b=a+1,c=a+stride,d=b+stride;
   i===0?quad(a,b,c,d):quad(a,c,b,d);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(coords.length*3),3));g.setIndex(indices);
  g.userData={finiteThicknessM:thickness,closed:true,independentSegment:true};
  const mesh=add(g,material,name);mesh.userData={sourceGeometryRetained:true,noCertification:true,normalizedSpan:[u0,u1],kinematics:'bounded blend of fixed tender and moving coach attachment frames'};
  motions.push(()=>{const p=g.attributes.position;coords.forEach((c,i)=>{const a=move(c.point,c.u);p.setXYZ(i,a.x,a.y,a.z);});p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();});
  return mesh;
 }
 // Seven painted sliding leaves hide the original metre-wide visual gap. An
 // overlap remains between leaves, with a shallow recessed trailing lip.
 const panels=7,overlap=.034/gap;
 for(let i=0;i<panels;i++){
  const u0=i/panels-(i?overlap/2:.025/gap),u1=(i+1)/panels+(i<panels-1?overlap/2:.025/gap);
  outerPanels.push(closedBand(u0,u1,5,64,.012,(u,v)=>.008-.018*smooth((v-.70)/.30),'R04 sliding aerodynamic leaf '+(i+1)+' / seven independent overlaps',paint));
 }
 const bellows=closedBand(0,1,144,64,.014,(u)=>-.052+.014*(.5-.5*Math.cos(u*Math.PI*24)), 'R04 finite 12-fold elastomer inner bellows',bellowsMaterial);
 for(const [u,label]of[[0,'tender fixed'],[1,'coach articulated']]){
  const clamp=closedBand(u-.014/gap,u+.014/gap,2,64,.016,()=>.016,'R04 '+label+' bolted clamp band',steel);clamps.push(clamp);
 }
 // Fasteners bind each collar to its own body, never across the moving seam.
 const boltG=new T.CylinderGeometry(.011,.011,.012,6);boltG.rotateX(Math.PI/2);
 const bolts=new T.InstancedMesh(boltG,steel,40);bolts.name='R04 two independent attachment collars / 40 retaining bolts';exterior.add(bolts);
 motions.push(()=>{const matrix=new T.Matrix4();let n=0;for(const u of[0,1])for(const side of[-1,1])for(let i=1;i<=10;i++){const t=i/11,[y,z]=shapeAt(u,t,.027),p=move(new T.Vector3(startX+gap*u,side*y,z),u);matrix.makeTranslation(...p.toArray());bolts.setMatrixAt(n++,matrix);}bolts.instanceMatrix.needsUpdate=true;bolts.computeBoundingBox();bolts.computeBoundingSphere();});
 const cylinder=new T.CylinderGeometry(1,1,1,24),axis=new T.Vector3(0,1,0);
 function rod(name,mat,radius,a,b){const mesh=add(cylinder,mat,name,mechanical);function update(A=a,B=b){const d=B.clone().sub(A);mesh.position.copy(A).add(B).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(axis,d.clone().normalize());mesh.scale.set(radius,d.length(),radius);}update();return{mesh,update};}
 // Counterparts are additions on the tender side. The original coach buffer
 // rams/faces and centre drawbar/eye are untouched, with open access below.
 for(const side of[-1,1]){
  const y=side*.84,anchor=new T.Vector3(startX-.075,y,.92),baseTarget=new T.Vector3(endX-.495,y,.92);
  const sleeve=rod('R04 tender buffer guide sleeve '+side,M.iron,.118,anchor,anchor.clone().add(new T.Vector3(.32,0,0)));
  const ram=rod('R04 sliding buffer counterpart ram '+side,steel,.077,anchor.clone().add(new T.Vector3(.25,0,0)),baseTarget.clone().add(new T.Vector3(-.045,0,0)));
  const face=rod('R04 independent buffer follower face '+side,M.iron,.195,baseTarget.clone().add(new T.Vector3(-.055,0,0)),baseTarget.clone().add(new T.Vector3(-.012,0,0)));
  bufferCounterparts.push({sleeve:sleeve.mesh,ram:ram.mesh,face:face.mesh});
  motions.push(()=>{const target=endpointMoved(baseTarget),direction=target.clone().sub(anchor).normalize();sleeve.update(anchor,anchor.clone().addScaledVector(direction,.32));ram.update(anchor.clone().addScaledVector(direction,.25),target.clone().addScaledVector(direction,-.045));face.update(target.clone().addScaledVector(direction,-.055),target.clone().addScaledVector(direction,-.012));});
 }
 let brakeHose=add(new T.BufferGeometry(),black,'R04 slack rear brake hose continuation to preserved coach coupling head',mechanical);
 motions.push(()=>{
  const a=new T.Vector3(startX-.08,.24,.90),end=endpointMoved(new T.Vector3(endX-.205,.17,.55));
  const points=[a,new T.Vector3(startX+.12,.25,.65),new T.Vector3(startX+gap*.50,.23,.44),end.clone().add(new T.Vector3(-.12,.015,-.035)),end];
  const old=brakeHose.geometry;brakeHose.geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.025,10,false);old.dispose();
  brakeHose.userData={retainedCoachHoseUntouched:true,serviceContinuity:'visual endpoint match only; pressure/network logic unverified',slackLoop:true};
 });
 function setArticulation(next={}){
  if(typeof next==='number')next={yawDeg:next};
  const values={yawDeg:0,pitchDeg:0,strokeM:0,lateralM:0,verticalM:0,...next};
  if('yawRad'in next)values.yawDeg=next.yawRad*180/Math.PI;if('pitchRad'in next)values.pitchDeg=next.pitchRad*180/Math.PI;
  for(const k of Object.keys(state)){const v=values[k];if(!Number.isFinite(v))throw Error('FINITE_ARTICULATION_REQUIRED_'+k);if(Math.abs(v)>limits[k]+1e-10)throw Error('ARTICULATION_OUTSIDE_DEMONSTRATION_ENVELOPE_'+k);}
  Object.assign(state,Object.fromEntries(Object.keys(state).map(k=>[k,values[k]])));
  q.setFromEuler(new T.Euler(0,state.pitchDeg*Math.PI/180,state.yawDeg*Math.PI/180,'ZYX'));
  delta.set(state.strokeM,state.lateralM,state.verticalM);rotation.makeRotationFromQuaternion(q);
  if(coachRoot){const transform=new T.Matrix4().makeTranslation(...pivot.clone().add(delta).toArray()).multiply(rotation).multiply(new T.Matrix4().makeTranslation(...pivot.clone().negate().toArray())).multiply(coachRest);transform.decompose(coachRoot.position,coachRoot.quaternion,coachRoot.scale);coachRoot.updateMatrixWorld(true);}
  for(const update of motions)update();root.updateMatrixWorld(true);
  root.userData.articulation={...state};return{...state};
 }
 /** Conservative triangle-AABB checks, independent for wheels and buffers.
  * The supplied objects must already be in their posed world positions. Buffers
  * exclude their intended contact with the NEW counterparts; only external
  * shroud/bellows/collars are checked. A hit is a review flag, not proof of clash.
  */
 function checkClearances({wheels=[],buffers=[],wheelAllowanceM=.04,bufferAllowanceM=.025}={}){
  root.updateMatrixWorld(true);const shells=[...outerPanels,bellows,...clamps];
  const triangle=new T.Box3(),v=new T.Vector3(),protectedBoxes=[];
  for(const[kind,objects,allowance]of[['wheel',wheels,wheelAllowanceM],['buffer',buffers,bufferAllowanceM]])for(const object of objects){object.updateWorldMatrix(true,true);protectedBoxes.push({kind,name:object.name,box:new T.Box3().setFromObject(object).expandByScalar(allowance),hits:0});}
  for(const shell of shells){const g=shell.geometry,p=g.attributes.position,idx=g.index;for(let i=0;i<idx.count;i+=3){triangle.makeEmpty();for(let j=0;j<3;j++)triangle.expandByPoint(v.fromBufferAttribute(p,idx.getX(i+j)).applyMatrix4(shell.matrixWorld));for(const test of protectedBoxes)if(test.box.intersectsBox(triangle))test.hits++;}}
  return{method:'sampled current-pose finite-skin triangle AABB vs individually expanded protected-object AABB',wheelAllowanceM,bufferAllowanceM,checked:protectedBoxes.length,results:protectedBoxes.map(({kind,name,hits})=>({kind,name,intersections:hits,clear:hits===0})),allClear:protectedBoxes.every(x=>x.hits===0),certification:false,limitations:'A conservative current-pose geometric screen, not full suspension travel, continuous swept-volume proof or force/pressure validation.'};
 }
 function setExteriorVisible(value){exterior.visible=!!value;return exterior.visible;}
 root.userData={candidate:'A6-R04 tender-coach transition',startX,endX,gapM:gap,pivot:pivot.toArray(),sourceChassisRetained:true,sourceCouplerRetained:true,sourceBuffersRetained:true,sourceHoseRetained:true,wheelDiameterUnchanged:true,outerLeaves:panels,overlapM:.034,bellowsFolds:12,openUnderbody:true,certification:false,demonstrationLimits:{...limits},continuousMotionEnvelopeCertified:false,notes:'Finite, overlapping paint skin; independent flexible inner bellows; separate sliding buffers; no rigid welded closure.'};
 setArticulation();
 return{root,setArticulation,setExteriorVisible,checkClearances,details:{exterior,mechanical,outerPanels,bellows,clamps,bufferCounterparts,brakeHose,profiles,limits,get state(){return{...state};}}};
}
