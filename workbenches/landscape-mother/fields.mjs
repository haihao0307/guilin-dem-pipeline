/* Landscape Mother Studio 01. Original numeric examples. No GIS truth binding. */
export const SPEC=Object.freeze({version:'1.0.0',extent:2048,spacing:1,grid:2049,chunk:128,lod:false,textures:false});
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function hash(x,z,s=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(s|0,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295}
export function noise(x,z,s=0){const i=Math.floor(x),j=Math.floor(z);let u=x-i,v=z-j;u=u*u*u*(u*(u*6-15)+10);v=v*v*v*(v*(v*6-15)+10);return mix(mix(hash(i,j,s),hash(i+1,j,s),u),mix(hash(i,j+1,s),hash(i+1,j+1,s),u),v)*2-1}
export function fbm(x,z,s=0,n=4){let v=0,a=.54,f=1;for(let i=0;i<n;i++){v+=a*noise(x*f,z*f,s+i*97);f*=2.03;a*=.48}return v}
export const CASES={
 karst:{id:'karst',number:'01',name:'喀斯特岩谷',en:'KARST / LIMESTONE',note:'塔峰、裸岩、坡脚与开阔谷地',waterWidth:20,amplitude:122,wavelength:360,height:1},
 river:{id:'river',number:'02',name:'连续河谷',en:'RIVER / ALLUVIUM',note:'连续主槽、凹岸岩壁与凸岸滩地',waterWidth:31,amplitude:182,wavelength:340,height:.84},
 paddy:{id:'paddy',number:'03',name:'稻田台地',en:'PADDY / EARTHWORK',note:'空田、等高台面、田埂与灌排',waterWidth:12,amplitude:100,wavelength:420,height:.68}
};
export function makeRecipe(id='karst',seed=31415){
 if(!CASES[id])throw Error('Unknown case'); if(!Number.isSafeInteger(seed)||seed<0||seed>999999)throw Error('Seed must be an integer from 0 to 999999');
 const c={...CASES[id],seed,peaks:[],bins:new Map()};
 // Stable world-space macro structure. Deliberate variation in shoulders, saddles and feet.
 for(let iz=-4;iz<=4;iz++)for(let ix=-4;ix<=4;ix++){
  const px=ix*235+(hash(ix,iz,seed)-.5)*115, pz=iz*235+(hash(ix,iz,seed+9)-.5)*110;
  const d=Math.abs(px-riverAt(c,pz).x),gate=id==='paddy'?205:130;
  if(d<gate||hash(ix,iz,seed+13)<.23)continue;
  if(id==='paddy'&&pz>-260&&Math.abs(px)<850)continue;
  if(id==='river'&&pz>-130&&Math.abs(px)<370)continue;
  const r=70+hash(ix,iz,seed+19)*63,h=(122+hash(ix,iz,seed+23)*173)*c.height;
  const p={x:px,z:pz,rx:r,rz:r*(.68+hash(ix,iz,seed+27)*.7),height:h,angle:hash(ix,iz,seed+31)*6.283,phase:hash(ix,iz,seed+33)*6.283,crown:.45+hash(ix,iz,seed+35)*.26,id:c.peaks.length};
  if(id==='paddy'&&pz>0){p.height*=.42;p.rx*=1.45;p.rz*=1.4}
  p.ca=Math.cos(p.angle);p.sa=Math.sin(p.angle);c.peaks.push(p);
  const rmax=Math.max(p.rx,p.rz)*1.7;
  for(let bz=Math.floor((pz-rmax)/160);bz<=Math.floor((pz+rmax)/160);bz++)for(let bx=Math.floor((px-rmax)/160);bx<=Math.floor((px+rmax)/160);bx++){
   const key=bx+','+bz;if(!c.bins.has(key))c.bins.set(key,[]);c.bins.get(key).push(p);
  }
 }
 return c;
}
export function riverAt(c,z){
 const q=z/c.wavelength,phase=(c.seed%101)*.003;
 const x=c.amplitude*Math.sin(q+phase)+c.amplitude*.25*Math.sin(q*1.79+.6+phase);
 const dx=c.amplitude/c.wavelength*Math.cos(q+phase)+c.amplitude*.25*1.79/c.wavelength*Math.cos(q*1.79+.6+phase);
 const width=c.waterWidth*(1+.16*Math.sin(z*.007+.8)+.07*Math.sin(z*.017));
 const level=13-z*.003;
 return {x,dx,width,level};
}
function landMass(c,x,z){
 let top=0,rock=0;
 const candidates=c.bins.get(Math.floor(x/160)+','+Math.floor(z/160))||[];
 for(const p of candidates){
  let dx=x-p.x,dz=z-p.z,qx=(dx*p.ca+dz*p.sa)/p.rx,qz=(-dx*p.sa+dz*p.ca)/p.rz;
  const theta=Math.atan2(qz,qx);
  const radius=1+.11*Math.sin(theta*3+p.phase)+.045*Math.sin(theta*5-p.phase);
  const r=Math.hypot(qx,qz)/radius;
  if(r>1.4)continue;
  const lobes=1+.07*Math.sin(theta*2+p.phase)+noise(x*.014,z*.014,c.seed+37)*.09+noise(x*.043,z*.039,c.seed+38)*.019;
  const rr=r/lobes;const family=hash(p.id,7,c.seed+91);
  let crown=1-(.13+.24*family)*Math.pow(clamp(rr/p.crown),1.22+family*.6);
  let wall=1-smooth(p.crown,1.15,rr);
  let profile=rr<p.crown?crown:(.87-.24*family)*Math.pow(wall,.68+family*.3);
  // Off-centre crest prevents cylinders and cloned conical peaks.
  profile*=.90+.10*smooth(-1,1,qx*.9+qz*.5);
  let h=p.height*profile;
  const face=smooth(.12,.36,rr)*(1-smooth(1.02,1.2,rr));
  // Joint-guided weathering in projected world space. No radial rings.
  const q=x*p.ca+z*p.sa, j=-x*p.sa+z*p.ca;
  const joints=noise(q*.055+noise(j*.014,h*.009,c.seed+39)*.45,j*.021,c.seed+41);
  const furrow=Math.pow(Math.max(0,1-Math.abs(joints)*4),3);
  const blocks=noise(x*.068,z*.071,c.seed+43);
  h-=furrow*1.5*face;
  h+=blocks*1.1*face+noise(x*.21,z*.19,c.seed+47)*.20*face;
  const foot=p.height*.019*(1-smooth(.84,1.40,rr));
  h+=foot;
  if(h>top){top=h;rock=face*.35+smooth(.025,.13,profile)*.62}
 }
 return [Math.max(0,top),clamp(rock)];
}
// The same absolute metre coordinate defines geometry, riverbed, event and material fields.
export function sample(c,x,z,details=true){
 const rv=riverAt(c,z),d=Math.abs(x-rv.x),w=rv.width;
 const broad=fbm(x*.0018,z*.0018,c.seed+53,3);
 let valley=rv.level+5.8+broad*1.8+noise(x*.016,z*.016,c.seed+59)*.15;
 let [mount,rock]=landMass(c,x,z);
 const setback=smooth(w+24,w+(c.id==='river'?85:140),d);
 mount*=setback;rock*=setback;
 let h=valley+mount,bund=0,wet=0,water=NaN,parcel=0;
 if(c.id==='paddy'){
  const hill=26*Math.exp(-((x-300)**2/170000+(z-360)**2/310000))+13*Math.exp(-((x+380)**2/100000+(z-180)**2/220000));
  const drift=fbm(x*.005,z*.004,c.seed+71,3)*1.45;
  const datum=15+hill+drift+z*.0025;
  const step=1.25,layer=Math.floor(datum/step),t=datum/step-layer;
  const edge=smooth(.78,.99,t);
  const terrace=layer*step+edge*step;
  const tu=(x+fbm(x*.003,z*.004,c.seed+73,3)*33+Math.sin(z*.013)*9)/94;
  const strip=Math.floor(tu),ft=tu-strip;
  const split=1-smooth(.006,.033,Math.min(ft,1-ft));
  const rim=Math.exp(-(((t-.76)/.055)**2))*.22+split*.20;
  const parent=(1-smooth(9,25,mount))*smooth(w+35,w+75,d);
  h=mix(h,terrace+rim+mount,parent);
  bund=(Math.exp(-(((t-.76)/.065)**2))+split)*parent;
  parcel=hash(strip,layer,c.seed+79);
  wet=parent*(.35+.45*parcel);
  // Flooded parcels are clipped to complete engineering cells during compilation.
  if(parent>.97&&t>.06&&t<.67&&split<.08&&parcel>.32&&mount<.12)water=layer*step+.13;
 }
 // Floodplain and bed are an explicitly authored example, not an inferred real river.
 const bed=rv.level-5.4+5.16*smooth(0,w,d);
 const bank=rv.level-.24+3.45*smooth(w,w+11,d)+1.1*smooth(w+11,w+40,d);
 const riverH=d<w?bed:bank;
 const near=1-smooth(w+25,w+65,d);
 h=mix(h,riverH,near);rock*=1-near;bund*=1-near;
 wet=Math.max(wet,(1-smooth(w,w+15,d))*.9);
 // Submetre bank relief is a geometry field, gated clear of the water edge.
 const gravelMask=smooth(w+3,w+7,d)*(1-smooth(w+14,w+34,d));
 if(gravelMask>0){
  const gx=Math.floor(x/3.6),gz=Math.floor(z/3.6);let stones=0;
  for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
   const a=gx+ox,b=gz+oz,q=hash(a,b,c.seed+101),xx=(a+.18+.64*q)*3.6,zz=(b+.16+.7*hash(a,b,c.seed+103))*3.6;
   const r2=((x-xx)**2+(z-zz)**2)/(.34+q*.85);stones=Math.max(stones,(.12+q*.62)*Math.exp(-r2*2));
  }
  h+=stones*gravelMask;rock=Math.max(rock,smooth(.025,.25,stones)*gravelMask*.8);
 }
 const soil=clamp(.5+.25*broad+.12*noise(x*.019,z*.019,c.seed+83));
 return {h,rock,wet,bund:clamp(bund),soil,water,parcel};
}
export function heightAt(c,x,z){return sample(c,x,z).h}
export function waterMesh(c){
 const rows=2049,cols=65,positions=new Float32Array(rows*cols*3),depths=new Float32Array(rows*cols),indices=new Uint32Array((rows-1)*(cols-1)*6);
 let minClear=Infinity,maxClear=-Infinity,k=0;
 for(let r=0;r<rows;r++){
  const z=-1024+r,rv=riverAt(c,z);
  for(let j=0;j<cols;j++){
   const t=j/(cols-1)*2-1,x=rv.x+rv.width*t,i=r*cols+j;
   const yy=rv.level+.035;positions.set([x,yy,z],i*3);
   const depth=yy-heightAt(c,x,z);depths[i]=Math.max(.001,depth);
   minClear=Math.min(minClear,depth);maxClear=Math.max(maxClear,depth);
  }
 }
 for(let r=0;r<rows-1;r++)for(let j=0;j<cols-1;j++){
  const a=r*cols+j,b=a+1,d=a+cols,e=d+1;indices.set([a,d,b,b,d,e],k);k+=6;
 }
 return {positions,depths,indices,audit:{sourceType:'authored-procedural-curve',rows,columns:cols,analyticMinBedClearanceM:minClear,analyticMaxBedClearanceM:maxClear,technicalPass:false,visualGapCount:null,truthHydrologyClaim:false}};
}
