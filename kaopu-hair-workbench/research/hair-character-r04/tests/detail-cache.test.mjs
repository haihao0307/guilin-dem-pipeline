import assert from 'node:assert/strict';
import {StrandDetailDynamics} from '../src/detail-dynamics.mjs';
import {airAt} from '../src/wind.mjs';
import {COUNT,STYLES} from '../src/Groom.mjs';
import * as THREE from '../references/three.module.js';
const frame=new THREE.Matrix4().makeRotationY(.21);frame.setPosition(.01,.73,.1);
const hairs=Array.from({length:COUNT},(_,i)=>({p:[((i%97)/96-.5)*.15,.01+(i%71)/71*.10,-.08+(i%83)/83*.07],n:[Math.sin(i*.17),.6,.2],seed:(i%997)/997}));
const traits=new Float32Array(COUNT*4);for(let i=0;i<COUNT;i++)traits.set([.86+.14*hairs[i].seed,1,hairs[i].seed*Math.PI*2,i%73===0?1:0],i*4);
const groom={style:'long',binding:{frame},hairs,traits},solver=new StrandDetailDynamics(groom),selected=[0,17,235,6183,COUNT-1],references=selected.map(i=>({q:new Float64Array(4),v:new Float64Array(4)}));let maxError=0;
for(let step=1;step<=40;step++){const dt=1/120,time=step*dt,strength=step<20?.38:0,stiffness=.5,damping=1.7,mean=airAt(0,.7,0,time,strength);solver.step(dt,time,strength,'long',stiffness,damping);for(let h=0;h<selected.length;h++){const i=selected[h],root=hairs[i],r=references[h],p=new THREE.Vector3(...root.p).applyMatrix4(frame).toArray(),air=airAt(...p,time,strength),omega=(9+4*(.5+.5*Math.sin(traits[i*4+2]*3.7)))*(.20/STYLES.long.length),exposed=.4+.6*Math.abs(root.n[0]),fly=traits[i*4+3],limit=STYLES.long.length*(fly?.04:.018);for(let j=0;j<4;j++){const mode=j>>1,axis=j&1,w=omega*(mode?2.8:1),ks=w*w*(1+(r.q[j]/limit)**2),force=(air[axis?2:0]*(.5+root.seed)-mean[axis?2:0])*exposed*(mode?.6:1.3)*(fly?2.4:1);r.v[j]=(r.v[j]+dt*(force-ks*r.q[j]))/(1+dt*(.96*w+damping*.5)+dt*dt*ks);r.q[j]+=dt*r.v[j];maxError=Math.max(maxError,Math.abs(r.q[j]-solver.q[i*4+j]));}}}
assert(maxError<1e-7,`cached harmonic integration differs by ${maxError}m`);assert(solver.q.every(Number.isFinite));console.log(JSON.stringify({passed:true,samples:selected.length,steps:40,maximumDisplacementErrorMetres:maxError,storedModes:COUNT*2}));
