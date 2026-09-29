// Shared surface-covering algorithms. All output is generated from geometry
// and deterministic parameters; no photograph or prerecorded mesh is used.
import * as THREE from 'three';
const v=()=>new THREE.Vector3();
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function outwardGroom(g){
 const p=g.attributes.position,n=g.attributes.normal,axis=new THREE.Vector3(0,-.23,-.8);
 for(let i=0;i<p.count;i+=9){
  const a=v().fromBufferAttribute(p,i),b=v().fromBufferAttribute(p,i+1),base=a.clone().add(b).multiplyScalar(.5),normal=v().fromBufferAttribute(n,i).normalize();
  const length=a.distanceTo(b)/.09,side=b.clone().sub(a).multiplyScalar(.5);
  // Grooming must be tangent to the skin before the outward component is
  // added. Adding a fixed backwards vector directly sends face hair inward.
  let tangent=axis.clone().addScaledVector(normal,-axis.dot(normal));
  if(tangent.lengthSq()<1e-8)tangent=new THREE.Vector3(1,0,0).cross(normal);
  tangent.normalize();const direction=normal.clone().multiplyScalar(.55).addScaledVector(tangent,.83).normalize();
  const center=base.clone().addScaledVector(normal,length*.20).addScaledVector(direction,length*.42),tip=base.clone().addScaledVector(normal,length*.12).addScaledVector(direction,length);
  const l=center.clone().addScaledVector(side,-.5),r=center.clone().addScaledVector(side,.5);
  [a,b,l,b,r,l,l,r,tip].forEach((q,k)=>p.setXYZ(i+k,q.x,q.y,q.z));
 }
 p.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
}
export function coverAvianBody(root,skin,spec){
 const previous=root.getObjectByName('body-coverts');if(previous){previous.removeFromParent();previous.geometry.dispose();previous.material.dispose();}
 const positions=[],colors=[],indices=[],c=new THREE.Color();
 for(let i=0;i<=10;i++)for(let j=0;j<=4;j++){
  const u=i/10,w=j/4*2-1,width=.5*Math.pow(Math.sin(Math.PI*Math.pow(u,.7)),.62);
  positions.push(w*width,-u,.10*Math.sin(Math.PI*u)*(1-Math.abs(w))+.008*Math.sin(u*105-Math.abs(w)*9));
  const shade=.93+.06*Math.sin(u*92-Math.abs(w)*13)+.04*Math.exp(-w*w*60);colors.push(shade,shade,shade);
 }
 for(let i=0;i<10;i++)for(let j=0;j<4;j++){const a=i*5+j,b=a+5;indices.push(a,b,a+1,b,b+1,a+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,vertexColors:true,side:THREE.DoubleSide}),count=1250,inst=new THREE.InstancedMesh(geo,material,count);
 const p=skin.attributes.position,n=skin.attributes.normal,col=skin.attributes.color,rng=random(spec.p[4]+991),cdf=[];let sum=0;
 for(let i=0;i<p.count;i+=3){const a=v().fromBufferAttribute(p,i),b=v().fromBufferAttribute(p,i+1),cc=v().fromBufferAttribute(p,i+2);sum+=b.sub(a).cross(cc.sub(a)).length()/2;cdf.push(sum);}
 const matrix=new THREE.Matrix4(),basis=new THREE.Matrix4(),q=new THREE.Quaternion(),worldUp=new THREE.Vector3(0,1,0);
 for(let i=0;i<count;i++){
  const pick=rng()*sum;let a=0,b=cdf.length-1;while(a<b){const m=(a+b)>>1;if(cdf[m]<pick)a=m+1;else b=m;}
  const r=Math.sqrt(rng()),z=rng(),weights=[1-r,r*(1-z),r*z],point=v(),normal=v();c.setRGB(0,0,0);
  for(let j=0;j<3;j++){const at=a*3+j;point.addScaledVector(v().fromBufferAttribute(p,at),weights[j]);normal.addScaledVector(v().fromBufferAttribute(n,at),weights[j]);c.r+=col.getX(at)*weights[j];c.g+=col.getY(at)*weights[j];c.b+=col.getZ(at)*weights[j];}
  normal.normalize();let up=worldUp.clone().addScaledVector(normal,-worldUp.dot(normal));if(up.lengthSq()<1e-8)up.set(0,0,1);up.normalize();const right=up.clone().cross(normal).normalize();up=normal.clone().cross(right).normalize();
  const isHead=c.r>.4,length=(isHead?.022:.052)*(.8+rng()*.45),width=length*(isHead?.45:.5);
  point.addScaledVector(normal,.0015);basis.makeBasis(right,up,normal);q.setFromRotationMatrix(basis);matrix.compose(point,q,new THREE.Vector3(width,length,length));inst.setMatrixAt(i,matrix);inst.setColorAt(i,c.multiplyScalar(.90+rng()*.18));
 }
 inst.name='surface-fitted-avian-coverts';inst.castShadow=true;inst.receiveShadow=true;root.add(inst);
}
export function leatherRelief(g){
 const p=g.attributes.position,n=g.attributes.normal,col=g.attributes.color;
 const field=(x,y,z)=>.50*Math.sin(173*x+2*Math.sin(47*z))*Math.sin(131*y+3*Math.sin(41*x))+.25*Math.sin(257*z+3*Math.sin(111*y));
 const eps=.0004;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),mask=THREE.MathUtils.smoothstep(z,.55,.90);if(mask===0)continue;
  const a=.0016*mask,f=field(x,y,z),normal=v().fromBufferAttribute(n,i).normalize();
  const gradient=new THREE.Vector3((field(x+eps,y,z)-field(x-eps,y,z))/(2*eps),(field(x,y+eps,z)-field(x,y-eps,z))/(2*eps),(field(x,y,z+eps)-field(x,y,z-eps))/(2*eps));
  gradient.addScaledVector(normal,-gradient.dot(normal));const adjusted=normal.clone().addScaledVector(gradient,-a).normalize();
  p.setXYZ(i,x+normal.x*a*f,y+normal.y*a*f,z+normal.z*a*f);n.setXYZ(i,adjusted.x,adjusted.y,adjusted.z);
  if(col){const shade=.96+.045*f;col.setXYZ(i,col.getX(i)*shade,col.getY(i)*shade,col.getZ(i)*shade);}
 }
 p.needsUpdate=true;n.needsUpdate=true;if(col)col.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
}
