import * as THREE from '../vendor/three.module.js';
import {NativeHeadBinding,matrixPoint} from '../vendor/fiber/NativeHeadBinding.mjs';
import {CollisionProxies} from '../vendor/fiber/CollisionProxies.mjs';
import {StrandDynamics} from '../vendor/fiber/GuideDynamics.mjs';
import {prepareStyling,motionWeights} from '../../f12/src/Styling.mjs';

function resample(points,frame){const lengths=[0];for(let n=1;n<49;n++)lengths[n]=lengths[n-1]+Math.hypot(...[0,1,2].map(k=>points[n*3+k]-points[(n-1)*3+k]));const total=lengths[48],out=new Float64Array(75);let index=0;for(let n=0;n<25;n++){const wanted=total*(n/24)**1.3;while(index<47&&lengths[index+1]<wanted)index++;const w=(wanted-lengths[index])/(lengths[index+1]-lengths[index]||1),p=[0,1,2].map(k=>points[index*3+k]*(1-w)+points[(index+1)*3+k]*w);out.set(matrixPoint(frame,p),n*3);}return{points:out,length:total};}

export class PhotoDynamics{
 constructor(fibers,motion,viewer,model){
  this.fibers=fibers;this.motion=motion;this.viewer=viewer;this.model=model;const binding=this.binding=new NativeHeadBinding(model,viewer);const inverseWorld=binding.inverse.clone().multiply(viewer.mesh.matrixWorld);
  const guides=fibers.samples.map(s=>({p:matrixPoint(inverseWorld,s.root),n:s.n,seed:.5,bodySide:1,nativeIds:s.tri,bary:s.bary}));
  binding.rootWorld=r=>{const raw=viewer.geometry.attributes.position.array,points=r.nativeIds.map(id=>motion.sampleDisplay(id,[raw[id*3],raw[id*3+1],raw[id*3+2]])),p=[0,1,2].map(k=>points.reduce((sum,v,j)=>sum+v[k]*r.bary[j],0));return matrixPoint(viewer.mesh.matrixWorld,p);};
  const curves=fibers.samples.map(s=>resample(s.points,inverseWorld)),groom={style:'medium',binding,guides,curves,hairs:guides,roots:Float32Array.from(guides.flatMap(g=>g.p)),traits:Float32Array.from(guides.flatMap((g,i)=>[1,1,i*.73,0]))};
  this.collisions=groom.collisions=new CollisionProxies(binding);groom.collisions.volume=.002;
  const dynamics=this.dynamics=new StrandDynamics(groom);this.restFrame=binding.frame.clone();this.inverseRest=this.restFrame.clone().invert();this.reference=dynamics.equilibrium.slice();this.stepCount=0;this.peak=0;
  dynamics.beforeStep=dt=>{if(motion.playing)motion.advance(dt*this.speed);binding.updateFrame();motion.updateKinematics(binding.frame,dt);};
  dynamics.detail.activeCount=43;this.speed=1;this.wind=false;this.enabled=true;this.weights=new Float32Array(43*25);this.updateStyling();
 }
 updateStyling(){const doc=this.fibers.api.design(),style=doc.styling;this.product=style.product;this.freedom=doc.motionFreedom??.8;this.dynamics.stiffness=style.product==='gel'?1:style.product==='wax'?.75:.4;this.dynamics.damping=style.product==='gel'?3.4:style.product==='wax'?2.4:1.7;
  for(let g=0;g<43;g++){const s=this.fibers.samples[g],context=prepareStyling(s.sourceChart,s.id,this.fibers.api.snapshot(),style),L=this.dynamics.groom.curves[g].length;for(let n=0;n<25;n++){const t=(n/24)**1.3,w=motionWeights(L*t,L,s.id.startsWith('bang')?'fringe':'body',this.freedom,context);this.weights[g*25+n]=Math.min(1,Math.max(0,w.mobility*1.5));}}
 }
 update(dt){const d=this.dynamics;d.active=this.motion.playing||d.active;d.enabled=this.wind;d.setWind(this.wind?.26:0);const changed=d.advance(Math.min(.1,dt));if(changed){this.stepCount++;this.write();}return changed;}
 write(){const d=this.dynamics,F=this.binding.frame.clone().multiply(this.inverseRest),data=this.fibers.deformations;let peak=0;for(let g=0;g<43;g++)for(let n=0;n<25;n++){const i=(g*25+n)*3,expected=matrixPoint(F,Array.from(this.reference.subarray(i,i+3))),delta=[0,1,2].map(k=>d.q[i+k]-expected[k]),len=Math.hypot(...delta),limit=this.fibers.samples[g].id.startsWith('bang')?.008:.035,scale=len>0?limit*Math.tanh(len/limit)/len:1,weight=n<2?0:this.weights[g*25+n],j=(n*43+g)*4;for(let k=0;k<3;k++)data[j+k]=delta[k]*scale*weight;peak=Math.max(peak,Math.hypot(data[j],data[j+1],data[j+2]));}this.peak=peak;this.fibers.deformationTexture.needsUpdate=true;this.fibers.u.physicsOn.value=this.enabled?1:0;this.fibers.u.headCenter.value.fromArray(this.binding.center).applyMatrix4(this.binding.frame);}
 reset(){this.binding.updateFrame();this.dynamics.reset();this.fibers.deformations.fill(0);this.fibers.deformationTexture.needsUpdate=true;this.peak=0;}
 report(){return{guides:43,nodes:25,steps:this.stepCount,underlyingSteps:this.dynamics.steps,rootErrorMM:this.dynamics.snapshot().rootError*1000,peakDeformationMM:this.peak*1000,product:this.product,freedom:this.freedom,wind:this.wind,solver:'copied R08 XPBD rod curvature, length, guide friction and body proxies; mapped as bounded deltas onto exact F12 paths',fullPerStrandSimulation:false,finiteWidthCollisionCertified:false};}
}
