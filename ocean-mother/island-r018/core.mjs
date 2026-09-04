import {DEFAULTS} from './params.mjs';
export const VERSION='0.3.0-island-r018';
export const TAU=Math.PI*2;
export const DOMAIN=Object.freeze({minX:-100,maxX:100,minZ:-100,maxZ:100,width:200,depth:200});
export let SURFACE={...DEFAULTS};
export const COAST_ROCKS=[],FIRE_RING=[],LOGS=[],FIRE_SOURCES=[],FIRE_CENTER=[0,0,0];
export function bindConfig(c){SURFACE=c;}
export function islandRadius(theta,c=SURFACE){return c.radius*(1+c.roundness*(.64*Math.sin(theta*3+.4)+.36*Math.sin(theta*5-1.2)));}
export function bedHeight(x,z){
 const c=SURFACE,r=Math.hypot(x,z),R=islandRadius(Math.atan2(z,x),c),s=r-R;
 const n=c.bedRelief*(.60*Math.sin(x*.37+z*.21)+.40*Math.sin(x*.76-z*.33))*smooth(R*.7,R+8,r);
 if(s>=0){const q=s/c.shelfWidth;return -.065*s-.22*q*q-Math.max(0,s-c.shelfWidth)*c.seaDepth/45+n;}
 const inland=-s,beach=.95*Math.pow(clamp(inland/c.beachWidth,0,1),c.beachSlope);
 return beach+(c.islandHeight-.95)*smooth(0,Math.max(2,R-c.beachWidth),inland-c.beachWidth)+n;
}
export function shorelineZ(x){return Math.sqrt(Math.max(0,SURFACE.radius*SURFACE.radius-x*x));}
export function waterLevel(t,c=SURFACE){return c.tide+c.tideAmplitude*Math.sin(TAU*t/c.tidePeriod);}
export function flowDirection(degrees){const a=degrees*Math.PI/180;return[-Math.sin(a),Math.cos(a)];}
export function windAt(x,y,z,t,c=SURFACE){
 const d=flowDirection(c.windDir),gust=1+c.gust*Math.sin(TAU*t/c.gustPeriod)+c.gust*.3*Math.sin(t*1.713);
 const ground=c.groundDamping+(1-c.groundDamping)*smooth(0,5,Math.max(0,y));
 const speed=c.wind*Math.max(.12,gust)*ground*(1+c.windShear*Math.log1p(Math.max(0,y)/4));
 return[d[0]*speed+c.turbulence*Math.sin(z*.12+t*.8),c.turbulence*.15*Math.sin(x*.1+t*.7),d[1]*speed+c.turbulence*Math.cos(x*.13-t*.73)];
}
export function surfBandOffsets(time,c=SURFACE){
 const travel=fract(time/Math.max(.001,c.period)),spacing=5.6;
 return [3,2,1].map(order=>order*spacing-travel*spacing);
}
export function waveAt(x,z,time,c=SURFACE){
 const bed=bedHeight(x,z),level=waterLevel(time,c),depth0=level-bed,r=Math.hypot(x,z),s=r-islandRadius(Math.atan2(z,x),c);
 const wet=smooth(-.12,.65,depth0),shallow=1-smooth(.7,4.0,depth0),d=flowDirection(c.swellDir);
 const incidence=.40+.60*smooth(-.55,.5,-(x*d[0]+z*d[1])/Math.max(1,r));
 let eta=level,slopeEnergy=0,primary=0;
 for(let i=0;i<5;i++){
  const dir=flowDirection(i===0?c.swellDir:i===1?c.secondaryDir:c.windDir+(i-3)*34),per=i===0?c.period:i===1?c.secondaryPeriod:2.1+(i-2)*.66;
  const wavelength=i<2?1.56*per*per:(2.2+(i-2)*2.5),k=TAU/wavelength,omega=TAU/per;
  const planar=dir[0]*x+dir[1]*z,phase=k*planar-omega*time+i*1.73;
  const h=i===0?c.swell*.5:i===1?c.secondary*.5:c.windWave*c.wind*.0025/(i-1);
  const group=1+c.groupScale*.23*Math.sin(phase*.22+time*.12);
  const amp=Math.min(h*(.85+c.shoal*.32*shallow)*incidence*group,Math.max(.016,depth0*.34))*wet;
  const shape=Math.sin(phase)+(i===0?c.crest*shallow*Math.sin(2*phase):0);
  eta+=amp*shape;slopeEnergy+=Math.abs(amp*k*(Math.cos(phase)+(i===0?2*c.crest*shallow*Math.cos(2*phase):0)));
  if(i===0)primary=Math.sin(phase);
 }
 const run=c.runup*.10*Math.sin(time*TAU/c.period-r*.60)*Math.exp(-s*s/10);
 eta+=run;const gains=[c.curlOuter,c.curlMiddle,c.curlInner],offsets=surfBandOffsets(time,c),bandStrengths=[];
 let bands=0;
 for(let i=0;i<3;i++){
  const radiusOffset=offsets[i],widthScale=i===0?1.12:i===1?1:.88;
  const dist=(s-radiusOffset)/(c.breakWidth*widthScale),shoreDissipation=smooth(-.75,1.35,radiusOffset);
  const strength=Math.exp(-dist*dist*1.8)*gains[i]*incidence*shoreDissipation;
  bandStrengths.push(strength);bands+=strength;eta+=.14*c.swell*strength*wet;
 }
 const depth=eta-bed,breaker=clamp((bands*.68+smooth(c.breakThreshold,.99,primary)*slopeEnergy*2.8)*smooth(.03,.22,depth),0,1.5);
 return {eta,bed,depth0,depth,breaker,slopeEnergy,normal:[0,1,0],bands,bandStrengths,bandOffsets:offsets,level};
}
export function rebuildDefinitions(c=SURFACE){
 COAST_ROCKS.length=0;FIRE_RING.length=0;LOGS.length=0;FIRE_SOURCES.length=0;
 const rng=new RNG(0x517b361d);
 for(let i=0;i<Math.round(c.rockCount);i++){
  const a=(i/Math.max(1,c.rockCount))*TAU+(rng.next()-.5)*c.rockScatter*.5;
  const radius=c.radius+(rng.next()-.3)*(4+c.rockScatter*9),s=c.rockScale*(.75+rng.next()*1.50);
  COAST_ROCKS.push([Math.cos(a)*radius,Math.sin(a)*radius,1.45*s,1.10*s,1.35*s,11+i*7]);
 }
 for(let i=0;i<Math.round(c.fireCount);i++){
  const a=-.15+i*TAU/Math.max(3,c.fireCount),r=c.radius*.46,x=Math.cos(a)*r,z=Math.sin(a)*r;
  FIRE_SOURCES.push([x,bedHeight(x,z)+.06,z]);
  for(let j=0;j<9;j++){const t=j/9*TAU;FIRE_RING.push([x+Math.cos(t)*1.5,z+Math.sin(t)*1.5,.36,.30,.38,140+i*19+j*7]);}
  for(let j=0;j<4;j++)LOGS.push([x,z,2.2,.24,.20,j*.83]);
 }
 FIRE_CENTER.splice(0,3,...FIRE_SOURCES[0]);
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
export function smoother(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*t*(t*(t*6-15)+10)}
export function fract(v){return v-Math.floor(v)}
export function hash2(x,z,seed=0){return fract(Math.sin(x*127.1+z*311.7+seed*74.7)*43758.5453123)}
export function noise2(x,z,seed=0){const ix=Math.floor(x),iz=Math.floor(z),fx=fract(x),fz=fract(z),ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz),a=hash2(ix,iz,seed),b=hash2(ix+1,iz,seed),c=hash2(ix,iz+1,seed),d=hash2(ix+1,iz+1,seed);return mix(mix(a,b,ux),mix(c,d,ux),uz)}
export function fbm2(x,z,seed=0,octaves=5){let v=0,a=.5,px=x,pz=z;for(let i=0;i<octaves;i++){v+=a*noise2(px,pz,seed+i*17);const nx=.8*px+.6*pz,nz=-.6*px+.8*pz;px=nx*2.03+13.7;pz=nz*2.03-9.1;a*=.5}return v}
export function normalize3(a){const d=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/d,a[1]/d,a[2]/d]}
export function sub3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
export function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
export function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
export function mat4Perspective(out,fovy,aspect,near,far){const f=1/Math.tan(fovy/2);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=2*far*near/(near-far);return out}
export function mat4LookAt(out,eye,center,up){const z=normalize3(sub3(eye,center)),x=normalize3(cross3(up,z)),y=cross3(z,x);out[0]=x[0];out[1]=y[0];out[2]=z[0];out[3]=0;out[4]=x[1];out[5]=y[1];out[6]=z[1];out[7]=0;out[8]=x[2];out[9]=y[2];out[10]=z[2];out[11]=0;out[12]=-dot3(x,eye);out[13]=-dot3(y,eye);out[14]=-dot3(z,eye);out[15]=1;return out}
export class RNG{constructor(seed=0x51a7c39d){this.state=seed>>>0}next(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state/4294967296}range(a,b){return mix(a,b,this.next())}}

rebuildDefinitions();
