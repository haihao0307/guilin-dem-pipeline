/** Analytic two-link reach boundaries for the retained R03/R04 wrist gate.
 * This is geometry, not a human torque/balance or collision certificate.
 * No angular grid, actor-specific angles, changed bone lengths or prop size.
 */
import {math} from './NativeRig.mjs';
const {add,sub,scale,dot,cross,norm,unit,clamp,axisRotation,mv}=math;
export const PICKUP_REACH_RULES=Object.freeze({wristGateDegrees:65,planningWristDegrees:64.999,planningExtension:.974,sourceSolveExtension:.999,sourceSupportExtension:.992,sourceMaximumPelvisDropOfHeight:.12});
const PI=Math.PI,DEG=PI/180;
const value=(p,x)=>{let y=0;for(let i=p.length-1;i>=0;i--)y=y*x+p[i];return y;};
function trim(p){const a=p.slice(),s=Math.max(1,...a.map(Math.abs));while(a.length>1&&Math.abs(a.at(-1))<s*1e-14)a.pop();return a;}
const pAdd=(a,b,k=1)=>Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+k*(b[i]||0));
const pScale=(a,k)=>a.map(x=>x*k);
const pMul=(a,b)=>{const out=new Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)out[i+j]+=a[i]*b[j];return out;};
/** All real roots on a finite interval, isolated by derivative roots. */
export function polynomialRoots(coefficients,lo,hi){
 const p=trim(coefficients),degree=p.length-1,scaleP=Math.max(1e-20,...p.map(Math.abs)),eps=scaleP*2e-11;
 if(degree===0)return[];
 if(degree===1){const x=-p[0]/p[1];return x>=lo-1e-12&&x<=hi+1e-12?[clamp(x,lo,hi)]:[];}
 const critical=polynomialRoots(p.slice(1).map((x,i)=>x*(i+1)),lo,hi),cuts=[lo,...critical.filter(x=>x>lo+1e-12&&x<hi-1e-12),hi],roots=[];
 const put=x=>{if(!roots.some(y=>Math.abs(x-y)<1e-8))roots.push(x);};
 for(const x of cuts)if(Math.abs(value(p,x))<=eps)put(x);
 for(let i=1;i<cuts.length;i++){let a=cuts[i-1],b=cuts[i],fa=value(p,a),fb=value(p,b);if(fa===0||fb===0||fa*fb>0)continue;for(let j=0;j<65;j++){const m=(a+b)*.5,fm=value(p,m);if(fa*fm<=0){b=m;fb=fm;}else{a=m;fa=fm;}}put((a+b)*.5);}
 return roots.sort((a,b)=>a-b);
}
export function limbMeasure(V,F,upper,lower,{extension=PICKUP_REACH_RULES.planningExtension}={}){
 const d=norm(V),min=Math.abs(upper-lower)+1e-7,max=(upper+lower)*extension;
 if(d<1e-12)return{reachable:false,distanceM:d,minimumDistanceM:min,maximumDistanceM:max,wristDegrees:180};
 const c=clamp((d*d+lower*lower-upper*upper)/(2*d*lower),-1,1),u=clamp(dot(V,F)/d,-1,1);
 const best=clamp(c*u+Math.sqrt(Math.max(0,1-c*c))*Math.sqrt(Math.max(0,1-u*u)),-1,1),wristDegrees=Math.acos(best)/DEG;
 return{reachable:d>=min-1e-10&&d<=max+1e-10,distanceM:d,minimumDistanceM:min,maximumDistanceM:max,wristDegrees,minimumWristCosine:best,valid:d>=min-1e-10&&d<=max+1e-10&&wristDegrees<PICKUP_REACH_RULES.wristGateDegrees};
}
/** Maximum vertical wrist drop with an upright-cylinder horizontal forward
 * and the existing .974 planning reach margin. Strict65 is kept; .001 degree
 * inside it is numerical margin, not a new permissive gate. */
export function verticalReach(upper,lower,F){
 const beta=PICKUP_REACH_RULES.planningWristDegrees*DEG,R=(upper+lower)*PICKUP_REACH_RULES.planningExtension;
 const lowerDirection=add(scale(F,Math.cos(beta)),[0,0,-Math.sin(beta)]),vertical=[0,0,-1];
 let upperDirection=vertical,V=add(scale(upperDirection,upper),scale(lowerDirection,lower));
 if(norm(V)>R){const delta=Math.acos(clamp((R*R-upper*upper-lower*lower)/(2*upper*lower),-1,1));upperDirection=add(scale(F,Math.cos(beta+delta)),[0,0,-Math.sin(beta+delta)]);V=add(scale(upperDirection,upper),scale(lowerDirection,lower));}
 return{V,dropM:-V[2],upperDirection,lowerDirection,measure:limbMeasure(V,F,upper,lower)};
}
export function minimumHingeForHeight(shoulder,pivot,axis,wristZ,drop){
 const v=sub(shoulder,pivot),parallel=scale(axis,dot(axis,v)),A=v[2]-parallel[2],B=cross(axis,v)[2],C=pivot[2]+parallel[2]-wristZ-drop;
 if(C+A<=0)return{angle:0,roots:[],method:'source shoulder already satisfies bounded vertical wrist reach'};
 const roots=polynomialRoots([C+A,2*B,C-A],0,1).map(t=>2*Math.atan(t));
 const feasible=roots.filter(t=>C+A*Math.cos(t)+B*Math.sin(t)<=1e-9);
 if(!feasible.length)return{angle:null,roots,method:'no hip-axis root in[0,90deg]'};
 return{angle:Math.min(...feasible),roots,method:'quadratic tan(theta/2) of actual hip-axis shoulder height'};
}
function trigPolynomial([c,a,b]){return[c+a,2*b,c-a];}
/** Squared wrist-cone boundary. Actual unsquared limbMeasure below discards
 * extraneous roots. D2 and u=V dot F are each constant+cos+sin. */
export function angularReachIntervals({d2,u,measure,lower,upper,minAngle=-PI/2,maxAngle=PI/2}){
 const Q=[1,0,1],D=trigPolynomial(d2),U=trigPolynomial(u),beta=PICKUP_REACH_RULES.planningWristDegrees*DEG,cb=Math.cos(beta),sb=Math.sin(beta);
 const A=pAdd(pAdd(D,pScale(Q,lower*lower-upper*upper)),pScale(U,2*lower*cb),-1);
 const equation=pAdd(pMul(A,A),pScale(pAdd(pMul(D,Q),pMul(U,U),-1),4*lower*lower*sb*sb),-1);
 const max=(upper+lower)*PICKUP_REACH_RULES.planningExtension,min=Math.abs(upper-lower)+1e-7;
 const bounds=[equation,pAdd(D,pScale(Q,max*max),-1),pAdd(D,pScale(Q,min*min),-1)];
 const lo=Math.tan(minAngle/2),hi=Math.tan(maxAngle/2),roots=bounds.flatMap(p=>polynomialRoots(p,lo,hi)).map(x=>2*Math.atan(x));
 const cuts=[minAngle,...roots,maxAngle,0].filter(x=>x>=minAngle-1e-12&&x<=maxAngle+1e-12).sort((a,b)=>a-b).filter((x,i,a)=>!i||Math.abs(x-a[i-1])>1e-8);
 const good=x=>{const r=measure(x);return r.reachable&&r.wristDegrees<=PICKUP_REACH_RULES.planningWristDegrees+2e-7;};
 const intervals=[];for(let i=1;i<cuts.length;i++)if(good((cuts[i-1]+cuts[i])/2))intervals.push([cuts[i-1],cuts[i]]);
 const candidates=cuts.filter(good);for(const [a,b]of intervals){const nearest=clamp(0,a,b);if(good(nearest))candidates.push(nearest);else{const x=nearest+(nearest===a?1:-1)*Math.min(1e-7,(b-a)*.0001);if(good(x))candidates.push(x);}}
 candidates.sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b);
 return{angle:candidates[0]??null,intervals,roots,cuts,polynomial:equation,method:'all quartic/length boundaries; derivative-recursive real root isolation; actual unsquared reach/wrist classification',measure:candidates.length?measure(candidates[0]):null};
}
/** V(theta)=A+R_axis(theta)B. F remains in the object contact frame. */
export function hingeReach(A,B,axis,F,upper,lower,maxAngle=PI/2){
 const parallel=scale(axis,dot(axis,B)),perp=sub(B,parallel),sine=cross(axis,B),C=add(A,parallel);
 const d2=[dot(A,A)+dot(B,B)+2*dot(A,parallel),2*dot(A,perp),2*dot(A,sine)],u=[dot(C,F),dot(perp,F),dot(sine,F)];
 return angularReachIntervals({d2,u,upper,lower,minAngle:0,maxAngle,measure:t=>limbMeasure(add(A,mv(axisRotation(axis,t),B)),F,upper,lower)});
}
/** At the actual bag, only the upright-cylinder yaw turns; pelvis extra hinge
 * is zero. Both +/-90 domains are searched algebraically, not one guessed sign. */
export function minimumBagTurn(bagMinusShoulder,palmOffset,sign,upper,lower){
 const [x,y,z]=bagMinusShoulder,[a,b,c]=palmOffset;
 const d2=[x*x+y*y+(z-c)*(z-c)+a*a+b*b,-2*(x*a+y*b),2*x*b-2*y*a],u=[-sign*a,sign*x,sign*y];
 return angularReachIntervals({d2,u,upper,lower,measure:t=>{const R=axisRotation([0,0,1],t),F=mv(R,[sign,0,0]);return limbMeasure(sub(bagMinusShoulder,mv(R,palmOffset)),F,upper,lower);}});
}
