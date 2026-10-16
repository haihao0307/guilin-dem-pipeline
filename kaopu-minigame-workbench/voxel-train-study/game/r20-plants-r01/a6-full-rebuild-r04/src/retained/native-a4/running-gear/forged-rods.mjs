// Original parametric forged-metal components. Shape observations: SNGLT
// engineering photographs e2148/e2149/e2128 (2025); reference photos are not assets.
// Pin diameters may be supplied from drawings; unmarked section dimensions are
// explicit visual reconstruction parameters, not surveyed A4 manufacturing data.
const recessedMaterials=new WeakMap();
export function createForgedRod(T,{lengthM,bigRadiusM=.17,smallRadiusM=.12,bigBoreM=.0702,smallBoreM=.0553,shankBigM=.17,shankSmallM=.12,thicknessM=.095,webM=.027,name='forged connecting rod',steel,bush}){
 if(![lengthM,bigRadiusM,smallRadiusM,bigBoreM,smallBoreM,shankBigM,shankSmallM,thicknessM,webM].every(x=>Number.isFinite(x)&&x>0)||lengthM<4*(bigRadiusM+smallRadiusM)||webM>=thicknessM||bigBoreM>=bigRadiusM||smallBoreM>=smallRadiusM)throw Error('INVALID_FORGED_ROD_SECTION');
 const root=new T.Group();root.name=name;const L=lengthM,R=bigRadiusM,r=smallRadiusM,h=shankBigM/2,k=shankSmallM/2;
 function eye(path,x,y,radius){const hole=new T.Path();hole.absarc(x,y,radius,0,Math.PI*2,false);path.holes.push(hole);}
 function outline(fluted=false){const s=new T.Shape();s.moveTo(0,R);s.bezierCurveTo(R*1.3,R,R*1.5,h,R*2,h);s.lineTo(L-r*2,k);s.bezierCurveTo(L-r*1.4,k,L-r*1.2,r,L,r);s.absarc(L,0,r,Math.PI/2,-Math.PI/2,true);s.bezierCurveTo(L-r*1.2,-r,L-r*1.4,-k,L-r*2,-k);s.lineTo(R*2,-h);s.bezierCurveTo(R*1.5,-h,R*1.3,-R,0,-R);s.absarc(0,0,R,-Math.PI/2,-Math.PI*1.5,true);s.closePath();eye(s,0,0,bigBoreM+.012);eye(s,L,0,smallBoreM+.010);
  if(fluted){const a=R*2.1,b=L-r*2.1,ha=h*.56,hb=k*.56,q=new T.Path();q.moveTo(a,ha);q.lineTo(b,hb);q.quadraticCurveTo(b+hb,0,b,-hb);q.lineTo(a,-ha);q.quadraticCurveTo(a-ha,0,a,ha);q.closePath();s.holes.push(q);}return s;}
 function layer(shape,depth,offset,material,label){const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24,steps:1});g.translate(0,0,-depth/2);g.rotateX(Math.PI/2);const a=g.attributes.position,indices=[],A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();let removed=0;for(let i=0;i<a.count;i+=3){A.fromBufferAttribute(a,i);B.fromBufferAttribute(a,i+1).sub(A);C.fromBufferAttribute(a,i+2).sub(A);if(B.cross(C).lengthSq()>1e-20)indices.push(i,i+1,i+2);else removed++;}g.setIndex(indices);g.userData.removedDegenerateFaces=removed;const m=new T.Mesh(g,material);m.position.y=offset;m.name=label;m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 if(!recessedMaterials.has(steel)){const m=steel.clone();if(m.color)m.color.multiplyScalar(.72);m.roughness=Math.min(1,(m.roughness||.35)+.12);recessedMaterials.set(steel,m);}
 layer(outline(),webM,0,recessedMaterials.get(steel),'continuous forged web and bearing bosses');const skin=(thicknessM-webM)/2;for(const side of[-1,1])layer(outline(true),skin,side*(webM+skin)/2,steel,'recessed flute edge, side '+side);
 for(const [x,bore,outer]of[[0,bigBoreM,bigBoreM+.012],[L,smallBoreM,smallBoreM+.010]]){const s=new T.Shape();s.absarc(x,0,outer,0,Math.PI*2,true);eye(s,x,0,bore);layer(s,thicknessM+.003,0,bush,'replaceable bronze bearing bush');}
 for(const[x,radius]of[[0,R],[L,r]]){const pot=new T.Mesh(new T.BoxGeometry(.060,.057,.049),steel);pot.name='bearing oil box';pot.position.set(x,0,radius+.020);root.add(pot);const cap=new T.Mesh(new T.CylinderGeometry(.012,.012,.018,12),bush);cap.rotation.x=Math.PI/2;cap.position.set(x,0,radius+.052);cap.name='oil box closure';root.add(cap);}
 root.userData={nativeForgedRod:true,pinCentresM:L,section:{bigRadiusM,smallRadiusM,bigBoreM,smallBoreM,shankBigM,shankSmallM,thicknessM,webM},shape:'wide flat fluted shank, enlarged bearing eyes, through bores, replaceable bushes',dimensionStatus:'pin centres from declared assembly; unmarked section sizes are visual reconstruction'};
 return root;
}
export function placeForgedRod(T,rod,A,B){const dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2],L=Math.hypot(dx,dy,dz);if(Math.abs(dy)>1e-8||Math.abs(L-rod.userData.pinCentresM)>1e-7)throw Error('FORGED_ROD_PIN_CLOSURE');rod.position.set(...A);rod.rotation.set(0,-Math.atan2(dz,dx),0);rod.userData.endpoints=[A.slice(),B.slice()];}
export function createCrosshead(T,{steel,bush,axisYM,slideZM,guideCentreXM,strokeM,name}){
 const root=new T.Group();root.name=name;const moving=new T.Group();moving.name='guided crosshead shoe with gudgeon pin';root.add(moving);const fixed=new T.Group();fixed.name='fixed paired machined slidebars';root.add(fixed);
 const mesh=(p,g,m,at,label)=>{const o=new T.Mesh(g,m);o.position.set(...at);o.name=label;o.castShadow=o.receiveShadow=true;p.add(o);return o;};
 const shoe=mesh(moving,new T.BoxGeometry(.28,.17,.22),steel,[0,0,0],'crosshead slide block');
 for(const side of[-1,1])mesh(moving,new T.BoxGeometry(.31,.045,.07),bush,[0,side*.096,0],'wearing slipper');
 const pin=mesh(moving,new T.CylinderGeometry(.055,.055,.225,32),steel,[0,0,0],'gudgeon pin');
 const span=strokeM+.38;for(const z of[-.145,.145])mesh(fixed,new T.BoxGeometry(span,.11,.055),steel,[guideCentreXM,axisYM,slideZM+z],'paired crosshead guide');
 for(const x of[guideCentreXM-span/2,guideCentreXM+span/2]){mesh(fixed,new T.BoxGeometry(.065,.22,.40),steel,[x,axisYM,slideZM],'slidebar support yoke');for(const z of[-.20,.20])mesh(fixed,new T.CylinderGeometry(.025,.025,.26,6),bush,[x,axisYM,slideZM+z],'guide fastening');}
 return {root,moving,fixed,shoe,pin,spanM:span};
}
