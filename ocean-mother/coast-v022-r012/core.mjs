export const VERSION='0.2.2-coast-r012';
export const TAU=Math.PI*2;
export const DOMAIN=Object.freeze({minX:-58,maxX:58,minZ:-48,maxZ:54,width:116,depth:102});
export const FIRE_CENTER=Object.freeze([-17,0,-16]);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
export function smoother(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*t*(t*(t*6-15)+10)}
export function fract(v){return v-Math.floor(v)}
export function hash2(x,z,seed=0){return fract(Math.sin(x*127.1+z*311.7+seed*74.7)*43758.5453123)}
export function noise2(x,z,seed=0){const ix=Math.floor(x),iz=Math.floor(z),fx=fract(x),fz=fract(z),ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz),a=hash2(ix,iz,seed),b=hash2(ix+1,iz,seed),c=hash2(ix,iz+1,seed),d=hash2(ix+1,iz+1,seed);return mix(mix(a,b,ux),mix(c,d,ux),uz)}
export function fbm2(x,z,seed=0,octaves=5){let v=0,a=.5,px=x,pz=z;for(let i=0;i<octaves;i++){v+=a*noise2(px,pz,seed+i*17);const nx=.8*px+.6*pz,nz=-.6*px+.8*pz;px=nx*2.03+13.7;pz=nz*2.03-9.1;a*=.5}return v}
export function shorelineZ(x){return-8.8+2.65*Math.sin(x*.038+.32)+1.08*Math.sin(x*.115+1.3)+.42*Math.sin(x*.31-.8)}
export function bedHeight(x,z){const shore=shorelineZ(x),s=z-shore,n=.035*Math.sin(x*.27+z*.16)+.022*Math.sin(x*.69-z*.24)+.026*(fbm2(x*.12,z*.12,9,4)-.48);if(s>=0){const nearBar=.18*Math.exp(-Math.pow((s-12)/5.6,2))*(.62+.38*Math.sin(x*.1+s*.25)),trough=-.10*Math.exp(-Math.pow((s-5.2)/2.6,2)),offshore=-.045*s-.00046*s*s;return-.055+offshore+nearBar+trough+n}const inland=-s,dune=.18*Math.sin(x*.075-inland*.12)*smooth(5,24,inland)+.10*(fbm2(x*.055,inland*.08,21,4)-.48)*smooth(4,30,inland);return.02+inland*.066+.00115*inland*inland+dune+n}
export function terrainMaterial(x,z){const shore=shorelineZ(x),s=z-shore,base=fbm2(x*.12,z*.14,31,5),grit=noise2(x*1.8,z*1.8,61);return{shoreDistance:s,sandVariation:clamp(.42+base*.48+grit*.10,0,1)}}
export const WAVE_DEFS=Object.freeze([
  {dx:.06,dz:-.998,wl:20.5,amp:.54,phase:.1},
  {dx:-.24,dz:-.971,wl:11.2,amp:.24,phase:1.8},
  {dx:.38,dz:-.925,wl:6.4,amp:.12,phase:3.25},
  {dx:-.70,dz:-.714,wl:3.35,amp:.054,phase:.72},
  {dx:.88,dz:-.475,wl:1.65,amp:.018,phase:2.3}
]);
export function waveAt(x,z,time,config){const bed=bedHeight(x,z),seaLevel=config.tide,depth0=seaLevel-bed,wet=smooth(.012,.62,depth0),shallow=1-smooth(.75,4.7,depth0),periodScale=config.period/8.0;let eta=seaLevel,dx=0,dz=0,primary=0,slopeEnergy=0;for(let i=0;i<WAVE_DEFS.length;i++){const w=WAVE_DEFS[i],k=TAU/(w.wl*periodScale),omega=Math.sqrt(9.81*k*Math.tanh(k*Math.max(depth0,.12))),phase=k*(w.dx*x+w.dz*z)-omega*time+w.phase,shoal=.72+.67*shallow,amp=config.swell*w.amp*shoal*wet,s=Math.sin(phase),c=Math.cos(phase),shape=i===0?s+shallow*(.21*Math.sin(2*phase+.18)+.072*Math.sin(3*phase+.42)):s;eta+=amp*shape;const dshape=i===0?c+shallow*(.42*Math.cos(2*phase+.18)+.216*Math.cos(3*phase+.42)):c;dx+=amp*k*w.dx*dshape;dz+=amp*k*w.dz*dshape;slopeEnergy+=Math.abs(amp*k*dshape);if(i===0)primary=s}const depth=eta-bed,phaseGate=smooth(.34,.94,primary),depthGate=(1-smooth(.68,2.9,depth0))*smooth(.055,.62,depth),breaker=clamp(phaseGate*depthGate*smooth(.18,.57,slopeEnergy),0,1),normal=normalize3([-dx,1,-dz]);return{eta,bed,depth0,depth,breaker,slopeEnergy,normal}}
export function normalize3(a){const d=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/d,a[1]/d,a[2]/d]}
export function sub3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
export function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
export function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
export function mat4Perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=2*far*near/(near-far);return out}
export function mat4LookAt(out,eye,center,up){const z=normalize3(sub3(eye,center)),x=normalize3(cross3(up,z)),y=cross3(z,x);out[0]=x[0];out[1]=y[0];out[2]=z[0];out[3]=0;out[4]=x[1];out[5]=y[1];out[6]=z[1];out[7]=0;out[8]=x[2];out[9]=y[2];out[10]=z[2];out[11]=0;out[12]=-dot3(x,eye);out[13]=-dot3(y,eye);out[14]=-dot3(z,eye);out[15]=1;return out}
export const COAST_ROCKS=Object.freeze([
  [-31,-10.0,4.9,3.5,4.0,11],[-24,-5.8,3.1,2.4,2.7,17],[-19,-1.8,2.5,1.9,2.4,23],[-13,-7.0,4.0,3.0,3.5,29],[-7,-3.5,2.6,2.0,2.3,31],[-2,-9.0,3.7,2.9,3.0,37],[5,-4.6,2.2,1.7,2.1,41],[10,-11.2,4.4,3.2,3.8,43],[17,-5.0,3.0,2.3,2.7,47],[23,-9.2,4.0,2.8,3.5,53],[30,-3.0,2.4,1.9,2.2,59],[36,-8.8,4.7,3.2,4.0,61],[-39,2.0,2.0,1.55,1.9,67],[-28,4.8,2.4,1.8,2.2,71],[-15,5.5,1.9,1.4,1.8,73],[-4,3.6,2.1,1.55,1.9,79],[9,5.9,2.5,1.9,2.3,83],[21,3.8,2.0,1.5,1.8,89],[33,5.1,2.4,1.8,2.2,97],[43,0.5,2.7,2.0,2.5,101],[-45,-13.0,3.4,2.5,3.0,103],[42,-14.2,3.6,2.7,3.1,107]
]);
export const FIRE_RING=Object.freeze(Array.from({length:12},(_,i)=>{const a=i/12*TAU,r=2.25+(i%3)*.12;return[FIRE_CENTER[0]+Math.cos(a)*r,FIRE_CENTER[2]+Math.sin(a)*r,.68,.45,.62,131+i*7]}));
export const LOGS=Object.freeze([
  [FIRE_CENTER[0],FIRE_CENTER[2],4.6,.45,.42,.58],[FIRE_CENTER[0],FIRE_CENTER[2],4.6,.45,.42,-.58],[FIRE_CENTER[0]-.15,FIRE_CENTER[2]+.2,3.8,.38,.36,1.54],[FIRE_CENTER[0]+.18,FIRE_CENTER[2]-.15,3.8,.38,.36,.02]
]);
export class RNG{constructor(seed=0x51a7c39d){this.state=seed>>>0}next(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state/4294967296}range(a,b){return mix(a,b,this.next())}}
