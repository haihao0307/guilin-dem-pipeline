import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {matrixPoint} from './NativeHeadBinding.mjs';
const shapes=(b)=>[
 {c:b.center.slice(),r:b.radii.map(v=>v*.97),part:'head'},
 {c:[b.radii[0]*1.02,-.039,b.center[2]+.006],r:[.00001,.00001,.00001],part:'head'},
 {c:[-b.radii[0]*1.02,-.039,b.center[2]+.006],r:[.00001,.00001,.00001],part:'head'},
 {c:[0,-.151,-.074],r:[.049,.097,.052],part:'body'},
 {c:[.123,-.229,-.072],r:[.091,.055,.080],part:'body'},
 {c:[-.123,-.229,-.072],r:[.091,.055,.080],part:'body'},
 {c:[0,-.38,-.082],r:[.158,.19,.10],part:'body'}];
export class CollisionProxies{
 constructor(binding){this.binding=binding;this.bodyFrame=binding.frame.clone();this.bodyInverse=this.bodyFrame.clone().invert();this.shapes=shapes(binding);this.contacts=0;}
 projectWorld(p,head=true,arc=.05,bodySide=0){
  let x=p[0],y=p[1],z=p[2],changed=false;const b=this.binding;
  if(head){const e=b.inverse.elements,c=b.center;let qx=e[0]*x+e[4]*y+e[8]*z+e[12],qy=e[1]*x+e[5]*y+e[9]*z+e[13],qz=e[2]*x+e[6]*y+e[10]*z+e[14],dx=qx-c[0],dy=qy-c[1],dz=qz-c[2],len=Math.hypot(dx,dy,dz);if(len<b.radiusMax+.015&&len>1e-8){const radius=b.radiusXYZ(dx,dy,dz)+.0015+(this.volume||.006)*Math.max(0,dy/len)**2*(1-Math.exp(-arc/.015));if(len<radius){const ratio=radius/len;qx=c[0]+dx*ratio;qy=c[1]+dy*ratio;qz=c[2]+dz*ratio;const f=b.frame.elements;x=f[0]*qx+f[4]*qy+f[8]*qz+f[12];y=f[1]*qx+f[5]*qy+f[9]*qz+f[13];z=f[2]*qx+f[6]*qy+f[10]*qz+f[14];changed=true;}}}
  const e=this.bodyInverse.elements,qy=e[1]*x+e[5]*y+e[9]*z+e[13];if(qy<b.bodyRange[0]&&qy>b.bodyRange[1]){const qx=e[0]*x+e[4]*y+e[8]*z+e[12],qz=e[2]*x+e[6]*y+e[10]*z+e[14],t=(qy-b.bodyRange[0])/(b.bodyRange[1]-b.bodyRange[0])*63,i=Math.floor(t),j=Math.min(63,i+1),w=t-i,P=b.bodyProfile,rx=P[i*4]*(1-w)+P[j*4]*w,cz=P[i*4+1]*(1-w)+P[j*4+1]*w,rz=P[i*4+2]*(1-w)+P[j*4+2]*w,xx=qx/rx,zz=(qz-cz)/rz;if(xx*xx+zz*zz<1){const side=bodySide||(qz>=cz?1:-1),nz=cz+side*rz*Math.sqrt(Math.max(0,1-xx*xx)),f=this.bodyFrame.elements;x=f[0]*qx+f[4]*qy+f[8]*nz+f[12];y=f[1]*qx+f[5]*qy+f[9]*nz+f[13];z=f[2]*qx+f[6]*qy+f[10]*nz+f[14];changed=true;}}
  if(changed)this.contacts++;return{p:changed?[x,y,z]:p,changed};
 }

 report(){return{shapes:this.shapes,contactEvents:this.contacts,method:'native-head radial surface; native upper-body cross-section profile',bodyProfile:Array.from(this.binding.bodyProfile),exactBodySDF:false,selfCollision:false};}
}
