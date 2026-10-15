import {makeRoots,COUNT,STYLES} from './specimen.mjs';
import {airAt,exposureAt} from './wind.mjs';
const ROWS=Math.ceil(COUNT/256);
// Two transverse damped bending modes for EACH visible strand, evaluated in
// the transported guide frame. Fixed roots and zero root slope are built into
// the mode functions. These reduced residuals do not implement strand contact.
export class StrandDetailDynamics{
 constructor(){this.bank=makeRoots();this.q=new Float64Array(COUNT*4);this.v=new Float64Array(COUNT*4);this.texture=new Float32Array(256*ROWS*2*4);this.peak=0;}
 reset(){this.q.fill(0);this.v.fill(0);this.texture.fill(0);this.peak=0;}
 step(dt,time,strength,style,stiffness=.5,globalDamping=1.7){
  const air=[0,0,0],mid=[0,0,0],base=STYLES[style],ratio=.14/base.length;this.peak=0;
  airAt(0,base.rootY-base.length*.7,0,time,strength,mid);
  for(let i=0;i<COUNT;i++){
   const k=i*4,root=this.bank.roots,tr=this.bank.traits,x=root[k],z=root[k+1],seed=root[k+3],length=tr[k];
   airAt(x,base.rootY-base.length*length*.72,z,time,strength,air);
   const exposed=exposureAt(x,z,.65),phase=tr[k+2],omega=(8.0+5.*(.5+.5*Math.sin(phase*3.7)))*ratio*Math.sqrt((.45+stiffness*2)/1.45)/(length*length),gain=.28+.72*exposed;
   for(let mode=0;mode<2;mode++)for(let axis=0;axis<2;axis++){
    const j=k+mode*2+axis,w=omega*(mode?2.8:1),damping=2*w*(mode?.40:.48)+globalDamping*.5,component=axis?2:0;
    const sensitivity=.50+seed;
    const differential=air[component]*sensitivity-mid[component];
    // Strand-dependent drag and stiffness create independent responses. Forcing
    // remains correlated in space; phase modifies sensitivity, never time itself.
    const f=differential*gain*(mode?.8:1.8)*(tr[k+3]?3.2:1.);
    // Geometric stiffening bounds the reduced, small-bending residual under
    // strong air loads without imposing a time-driven displacement clamp.
    const limit=base.length*(tr[k+3]?.055:.025),stiff=w*w*(1+(this.q[j]/limit)**2);
    this.v[j]=(this.v[j]+dt*(f-stiff*this.q[j]))/(1+dt*damping+dt*dt*stiff);
    this.q[j]+=dt*this.v[j];this.peak=Math.max(this.peak,Math.abs(this.q[j]));
   }
  }
 }
 write(){for(let i=0;i<COUNT;i++){const row=Math.floor(i/256),col=i%256,k=i*4;this.texture.set(this.q.subarray(k,k+4),(row*256+col)*4);}}
}
