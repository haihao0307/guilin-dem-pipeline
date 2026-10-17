import {COUNT,STYLES} from './Groom.mjs';
import {airAt} from './wind.mjs';
import {matrixPoint} from './NativeHeadBinding.mjs';
// Per-fiber reduced dynamics. Spatial harmonics are cached at groom-rest roots;
// advecting each harmonic in time is algebraically identical to sin(a-w*t).
// Coarse guide drag still samples the current world-space positions.
export class StrandDetailDynamics{
 constructor(groom){this.activeCount=COUNT;this.groom=groom;this.q=new Float64Array(COUNT*4);this.v=this.q.slice();this.texture=new Float32Array(256*Math.ceil(COUNT/256)*4);this.peak=0;this.basis=new Float32Array(COUNT*12);this.parameters=new Float32Array(COUNT*5);this.airMean=[0,0,0];this.localRoots=groom.roots;
  const length=STYLES[groom.style].length;
  for(let i=0;i<COUNT;i++){const root=groom.hairs[i],p=matrixPoint(groom.binding.frame,root.p),a=p[0]*23+p[2]*15,b=p[1]*32-p[0]*11,f=p[0]*157+p[2]*103,o=p[1]*83-p[2]*139,angles=[a,b,f,o,a*.81+1.3,b+f*.25];for(let j=0;j<6;j++){this.basis[i*12+j*2]=Math.sin(angles[j]);this.basis[i*12+j*2+1]=Math.cos(angles[j]);}const phase=groom.traits[i*4+2],fly=groom.traits[i*4+3],omega=(9+4*(.5+.5*Math.sin(phase*3.7)))*(.20/length),limit=length*(fly?.04:.018);this.parameters.set([omega,.4+.6*Math.abs(root.n[0]),.5+root.seed,fly?2.4:1,1/(limit*limit)],i*5);}
 }
 reset(){this.q.fill(0);this.v.fill(0);this.texture.fill(0);this.peak=0;}
 step(dt,time,strength,style,stiffness=.5,globalDamping=1.7,motion=null){
  const frequencies=[.85,1.25,4.2,3.1,.85*.81,2.3],cs=frequencies.map(w=>Math.cos(time*w)),sn=frequencies.map(w=>Math.sin(time*w)),mean=airAt(0,.7,0,time,strength,this.airMean),scale=Math.sqrt((.45+stiffness*2)/1.45),q=this.q,v=this.v,B=this.basis,P=this.parameters,dt2=dt*dt;let peak=0;
  for(let i=0;i<this.activeCount;i++){const a=i*12,p=i*5,k=i*4,A=B[a]*cs[0]-B[a+1]*sn[0],C=B[a+2]*cs[1]-B[a+3]*sn[1],F=B[a+4]*cs[2]-B[a+5]*sn[2],O=B[a+7]*cs[3]+B[a+6]*sn[3],R=B[a+8]*cs[4]-B[a+9]*sn[4],S=B[a+11]*cs[5]+B[a+10]*sn[5],T=B[a+6]*cs[3]-B[a+7]*sn[3],x=strength*(.58+.22*A+.13*C+.09*F*O),z=strength*(.13*R+.10*S+.05*T),omega=P[p]*scale,exposure=P[p+1]*P[p+3],limitInvSq=P[p+4];let forceX=(x*P[p+2]-mean[0])*exposure,forceZ=(z*P[p+2]-mean[2])*exposure;
   if(motion){const r=i*3,rx=this.localRoots[r],ry=this.localRoots[r+1],rz=this.localRoots[r+2],a=motion.angular,w=motion.omega,cx=w[1]*rz-w[2]*ry,cy=w[2]*rx-w[0]*rz,cz=w[0]*ry-w[1]*rx,ax=motion.linear[0]+a[1]*rz-a[2]*ry+w[1]*cz-w[2]*cy,az=motion.linear[2]+a[0]*ry-a[1]*rx+w[0]*cy-w[1]*cx,difference=(P[p+2]-1)*exposure;forceX+=(-.035*ax+.16*motion.air[0])*difference;forceZ+=(-.035*az+.16*motion.air[2])*difference;}
   for(let j=0;j<4;j++){const w=omega*(j<2?1:2.8),position=q[k+j],ks=w*w*(1+position*position*limitInvSq),force=(j%2?forceZ:forceX)*(j<2?1.3:.6),damping=w*.96+globalDamping*.5,speed=(v[k+j]+dt*(force-ks*position))/(1+dt*damping+dt2*ks),next=position+dt*speed;v[k+j]=speed;q[k+j]=next;peak=Math.max(peak,Math.abs(next));}
  }this.peak=peak;
 }
 write(){this.texture.set(this.q);}
}
