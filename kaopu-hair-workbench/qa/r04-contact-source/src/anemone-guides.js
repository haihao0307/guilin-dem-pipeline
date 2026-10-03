/* Original coherent thick-curve guide field, r04 candidate.
 * This is a new collision-feasible reference pose, not a fit of the old tangled
 * kinematic curves. Geometry remains subject to independent capsule/body gates. */
(function(root){'use strict';const C=root.AnemoneCore||(typeof require==='function'?require('./anemone-core.js'):null);
function target(system,time,out=system.target){const S=system.S,state=system.state,d=state.direction*Math.PI/180,dx=Math.cos(d),dz=Math.sin(d),phase=time*state.frequency*Math.PI*2,radial=3*state.curvature/1.4,shared=state.current*.30*Math.sin(phase);
 for(let c=0;c<system.roots.length;c++){const r=system.roots[c],a=c*(S+1)*3,l=r.length/S,local=C.noise(time*state.frequency*.8+r.x*.2+r.z*.1,state.seed)*state.turbulence*.10;out[a]=r.x;out[a+1]=r.y;out[a+2]=r.z;for(let j=1;j<=S;j++){const k=a+j*3,arc=(j-.5)*l,w=Math.min(1,arc/.28),rad=radial*Math.sin(arc*1.65)*w,flow=(.3+shared+local)*(1-Math.cos(arc*3.3))*w,x=r.x*rad+flow*dx,z=r.z*rad+flow*dz,n=Math.hypot(x,1,z);out[k]=out[k-3]+l*x/n;out[k+1]=out[k-2]+l/n;out[k+2]=out[k-1]+l*z/n;}}
 return out;
}
function prepare(system,{maxSweeps=96}={}){const started=performance.now();target(system,0);system.positions.set(system.target);system.contactAnchor=null;let metrics=system.measure(),sweeps=0;
 while(!system.valid(metrics)&&sweeps<maxSweeps){system.projectBends();system.projectCollars();system.projectLengths();if(system.body)system.body.project(system);system.projectContacts();sweeps++;if(sweeps%4===0)metrics=system.measure();}
 if(!system.valid(metrics))throw Object.assign(Error('这个形态与密度组合未找到合法接触母本；原状态保持不变。'),{code:'REST_CONSTRAINTS_UNRESOLVED',metrics,sweeps});
 system.previous.set(system.positions);system.lastValid.set(system.positions);system.initial=system.positions.slice();system.restPositions=system.positions.slice();system.time=0;system.steps=0;system.proposalScale=1;system.lastDt=1/30;system.metricsLast=metrics;system.updateTarget=function(t){return target(this,t)};
 const former=C.solve({...system.state,current:0,turbulence:0},system.roots,0);let chord=0,oldDifference=0,oldTipDifference=0;for(let c=0;c<system.roots.length;c++){const r=system.roots[c],a=c*(system.S+1)*3,b=a+system.S*3;chord+=Math.hypot(...[0,1,2].map(k=>system.positions[b+k]-system.positions[a+k]))/r.length;oldTipDifference+=Math.hypot(...[0,1,2].map(k=>system.positions[b+k]-former[(c*(system.S+1)+system.S)*4+k]));}for(let n=0;n<system.N;n++)for(let k=0;k<3;k++)oldDifference+=(system.positions[n*3+k]-former[n*4+k])**2;
 const receipt={version:'coherent-radial-v1',elapsedMs:performance.now()-started,sweeps,metrics,meanChordArc:chord/system.roots.length,oldGuideNodeRms:Math.sqrt(oldDifference/system.N),oldGuideMeanTipDeviation:oldTipDifference/system.roots.length,scope:'New valid pose; no claim to reproduce old r03 curves or measured biology'};system.restReceipt=receipt;return receipt;
}
const api={target,prepare};root.AnemoneGuides=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
