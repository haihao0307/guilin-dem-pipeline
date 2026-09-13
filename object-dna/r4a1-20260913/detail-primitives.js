import * as THREE from 'three';
// Geometry is generated from authored exterior profiles, never reference triangles.
const up=new THREE.Vector3(0,1,0),axes={x:new THREE.Vector3(1,0,0),y:up,z:new THREE.Vector3(0,0,1)};
function marked(g){const p=g.attributes.position;g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.count*3).fill(1),3));return g;}
function part(g,m){const mesh=new THREE.Mesh(marked(g),m);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
export function plate(p,mat){
  let shape;
  if(p.shape==='rounded_profile_plate'){
    shape=new THREE.Shape();const pts=p.outline.map(x=>new THREE.Vector2(...x));
    const corners=pts.map((b,i)=>{const a=pts[(i+pts.length-1)%pts.length],c=pts[(i+1)%pts.length],r=Math.min(p.cornerRadius,b.distanceTo(a)*.24,b.distanceTo(c)*.24);return{b,start:b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r)),end:b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r))};});
    shape.moveTo(corners[0].start.x,corners[0].start.y);
    for(const {b,start,end} of corners){shape.lineTo(start.x,start.y);shape.quadraticCurveTo(b.x,b.y,end.x,end.y);}shape.closePath();
  }else shape=new THREE.Shape(p.outline.map(x=>new THREE.Vector2(...x)));
  for(const loop of p.holes||[]){
    if(p.roundHoles){const hole=new THREE.Path(),pts=loop.map(x=>new THREE.Vector2(...x)),corners=pts.map((b,i)=>{const a=pts[(i+pts.length-1)%pts.length],c=pts[(i+1)%pts.length],r=Math.min(p.holeCornerRadius,a.distanceTo(b)*.24,b.distanceTo(c)*.24);return{b,start:b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r)),end:b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r))};});hole.moveTo(corners[0].start.x,corners[0].start.y);for(const {b,start,end}of corners){hole.lineTo(start.x,start.y);hole.quadraticCurveTo(b.x,b.y,end.x,end.y);}hole.closePath();shape.holes.push(hole);}
    else shape.holes.push(new THREE.Path(loop.map(x=>new THREE.Vector2(...x))));
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:p.depth,bevelEnabled:true,bevelSegments:2,bevelSize:p.bevel??.0005,bevelThickness:p.bevel??.0005,curveSegments:20});geometry.translate(0,0,-p.depth/2);
  const mesh=part(geometry,mat);if(p.plane==='xz')mesh.rotation.x=Math.PI/2;if(p.plane==='yz')mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)));return mesh;
}
export function coil(p,mat){
  const points=[];for(let i=0;i<=p.turns*16;i++){const t=i/(p.turns*16),angle=t*p.turns*Math.PI*2;points.push(new THREE.Vector3((t-.5)*p.length,Math.cos(angle)*p.radius,Math.sin(angle)*p.radius));}
  return part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),p.turns*16,p.wireRadius,5,false),mat);
}
export function fastener(p,mat,dark){
  const group=new THREE.Group(),r=p.radius,h=p.height||r*.35,profile=[[0,r],[h*.15,r],[h*.65,r*.8],[h*.95,r*.35],[h,.00001]];
  if(p.layeredHead&&(p.style==='hex'||p.style==='slot')){
    const washerShape=new THREE.Shape();washerShape.absarc(0,0,r*1.13,0,Math.PI*2,false);const inner=new THREE.Path();inner.absarc(0,0,r*.72,0,Math.PI*2,true);washerShape.holes.push(inner);const wg=new THREE.ExtrudeGeometry(washerShape,{depth:h*.16,bevelEnabled:true,bevelSize:r*.025,bevelThickness:r*.025,bevelSegments:2,curveSegments:32});wg.rotateX(-Math.PI/2);const washer=part(wg,mat);group.add(washer);
    const outline=new THREE.Shape();if(p.style==='hex'){for(let i=0;i<6;i++){const a=i*Math.PI/3;outline[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r);}outline.closePath();}else outline.absarc(0,0,r,0,Math.PI*2,false);
    if(p.recessedSlot){const slot=new THREE.Path();const a=r*.77,b=r*.10;slot.moveTo(-a,-b);slot.lineTo(-a,b);slot.lineTo(a,b);slot.lineTo(a,-b);slot.closePath();outline.holes.push(slot);}
    const hg=new THREE.ExtrudeGeometry(outline,{depth:h*.55,bevelEnabled:true,bevelSize:r*.065,bevelThickness:h*.12,bevelSegments:3,curveSegments:40});hg.rotateX(-Math.PI/2);hg.translate(0,h*.33,0);group.add(part(hg,mat));
    if(p.recessedSlot){const bed=part(new THREE.CylinderGeometry(r*.92,r*.92,h*.27,40),dark);bed.position.y=h*.23;group.add(bed);}
    group.quaternion.setFromUnitVectors(up,axes[p.axis||'y'].clone().multiplyScalar(p.sign||1));return group;
  }
  const dome=Array.from({length:13},(_,i)=>{const t=i/12*Math.PI/2;return new THREE.Vector2(i===12?0:r*Math.cos(t),h*Math.sin(t));});
  const head=p.style==='hex'?new THREE.CylinderGeometry(r,r,h,6):p.style==='slot'?new THREE.CylinderGeometry(r,r,h,40):new THREE.LatheGeometry(p.smoothDome?dome:profile.map(([y,x])=>new THREE.Vector2(x,y)),40);
  const body=part(head,mat);if(p.style==='hex'||p.style==='slot')body.position.y=h/2;group.add(body);
  const base=part(new THREE.CylinderGeometry(r*1.12,r*1.12,.0005,24),dark);group.add(base);
  if(p.style==='slot'){const slot=part(new THREE.BoxGeometry(r*1.5,.0003,r*.18),dark);slot.position.y=h+.0001;slot.rotation.y=p.slotAngle||.4;group.add(slot);}
  group.quaternion.setFromUnitVectors(up,axes[p.axis||'y'].clone().multiplyScalar(p.sign||1));return group;
}
const labelCache=new Map();
function canvasLabel(text,kind='stencil'){
  const key=kind+':'+text;if(labelCache.has(key))return labelCache.get(key);
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=kind==='headstamp'?256:1024;c.height=kind==='headstamp'?256:128;const ctx=c.getContext('2d');
  if(!ctx?.fillText)return null;
  ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=kind==='headstamp'?'#473820':'#c7bd88';ctx.textAlign='center';ctx.textBaseline='middle';
  if(kind==='headstamp'){ctx.font='26px monospace';const chars=text.split('');for(let i=0;i<chars.length;i++){ctx.save();ctx.translate(128,128);ctx.rotate(-Math.PI*.65+i/(Math.max(1,chars.length-1))*Math.PI*1.3);ctx.fillText(chars[i],0,-88);ctx.restore();}}
  else{ctx.font='600 74px monospace';ctx.fillText(text,512,68,980);ctx.globalCompositeOperation='destination-out';for(let x=24;x<1024;x+=29)ctx.clearRect(x,0,2,128);let seed=19;for(let i=0;i<700;i++){seed=(seed*16807)%2147483647;const x=seed%1024;seed=(seed*16807)%2147483647;ctx.clearRect(x,seed%128,1+seed%3,1);}}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;labelCache.set(key,texture);return texture;
}
export function label(p){
  const texture=canvasLabel(p.text,p.kind);if(!texture)return new THREE.Group();
  const material=new THREE.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:.75,metalness:p.kind==='headstamp'?.7:0,polygonOffset:true,polygonOffsetFactor:-2});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(...p.size),material);const right=new THREE.Vector3(...p.right),vertical=new THREE.Vector3(...p.up),normal=right.clone().cross(vertical).normalize();mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,vertical,normal));return mesh;
}
export function cartridge(length,radius,mats,{headstamp='',caseOnly=false}={}){
  const group=new THREE.Group();const caseEnd=length*.22;const profile=[[-.5*length,radius],[-.477*length,radius*1.04],[-.458*length,radius*1.04],[-.443*length,radius*.88],[-.408*length,radius*.89],[-.395*length,radius*.96],[.08*length,radius*.87],[.16*length,radius*.65],[caseEnd,radius*.64]];
  const shell=part(new THREE.LatheGeometry(profile.map(([h,r])=>new THREE.Vector2(r,h)),40),mats.brass);shell.rotation.z=-Math.PI/2;group.add(shell);
  if(!caseOnly){const tip=part(new THREE.LatheGeometry([[caseEnd,radius*.64],[.29*length,radius*.62],[.37*length,radius*.52],[.44*length,radius*.34],[.49*length,radius*.11],[.50*length,0]].map(([h,r])=>new THREE.Vector2(r,h)),40),mats.copper);tip.rotation.z=-Math.PI/2;group.add(tip);}
  const base=part(new THREE.CylinderGeometry(radius*.98,radius*.98,length*.006,40),mats.brass);base.rotation.z=Math.PI/2;base.position.x=-length*.501;group.add(base);
  const ring=part(new THREE.TorusGeometry(radius*.38,radius*.035,6,32),mats.dark);ring.rotation.y=Math.PI/2;ring.position.x=-length*.506;group.add(ring);
  const primer=part(new THREE.CylinderGeometry(radius*.29,radius*.29,length*.007,24),mats.primer||mats.brass);primer.rotation.z=Math.PI/2;primer.position.x=-length*.506;group.add(primer);
  if(headstamp){const stamp=label({text:headstamp,kind:'headstamp',size:[radius*1.9,radius*1.9],right:[0,-1,0],up:[0,0,1]});stamp.position.x=-length*.51;group.add(stamp);}return group;
}
export function belt(p,mats){
  const group=new THREE.Group(),path=new THREE.CatmullRomCurve3(p.points.map(x=>new THREE.Vector3(...x))),length=path.getLength();const count=p.count??Math.floor(length/p.spacing)+1;
  for(let i=0;i<count;i++){const t=i/(count-1),center=path.getPointAt(t),round=cartridge(p.displayRoundLength,p.displayRoundRadius,mats,{headstamp:p.headstamp||''});round.name='round-'+i;round.position.copy(center);group.add(round);if(i===count-1)continue;const next=path.getPointAt((i+1)/(count-1)),bridge=center.clone().add(next).multiplyScalar(.5),angle=Math.atan2(next.z-center.z,next.y-center.y);for(const offset of[-.018,.003]){const cuff=part(new THREE.CylinderGeometry(p.displayRoundRadius*1.1,p.displayRoundRadius*1.1,.010,24,1,true,0,Math.PI*1.65),mats.link);cuff.rotation.z=-Math.PI/2;cuff.position.copy(center);cuff.position.x+=offset;group.add(cuff);const rib=part(new THREE.BoxGeometry(.010,center.distanceTo(next),.0018),mats.link);rib.rotation.x=angle;rib.position.copy(bridge);rib.position.x+=offset;rib.position.z-=p.displayRoundRadius*.72;group.add(rib);}}
  return group;
}
