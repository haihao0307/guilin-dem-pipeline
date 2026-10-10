import {PRESETS} from './EyeParameters.mjs';
const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
export function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
/** Exact ET08 scalar generator, moved out of Three.js. Pixel output is regression locked.
 * Source: EyeSystem.js irisField(), blob 134f82d8f26b2ab46fdd7cb32fefe4e3e828175f.
 * Owned implementation: no external photo, model, Unity or XG code in this function.
 */
export function reproduceET08(){
 const W=1024,H=256,data=new Uint8Array(W*H*4),rnd=random(7813),table=Float32Array.from({length:2048},rnd);
 const ns=(x,salt=0)=>{let i=Math.floor(x),t=x-i;t=smooth(t);return mix(table[(i+salt)&2047],table[(i+1+salt)&2047],t);};
 for(let y=0;y<H;y++){let r=y/(H-1);for(let x=0;x<W;x++){let a=x/W,flow=x+11*Math.sin(r*5+a*TAU*3)+5*Math.sin(r*11+a*TAU*7),coarse=ns(flow*.075,97),fiber=ns(flow*.49,213),fine=ns(flow*1.7,579),band=ns(r*16+a*3,731);
  let crypt=ns(flow*.043,1091)*ns(r*24+coarse*7,1331);crypt=smooth(clamp((crypt-.47)*5,0,1))*Math.exp(-Math.pow((r-.38)/.23,2));
  const i=(y*W+x)*4;data[i]=clamp((.33+.46*coarse+.15*band-.35*crypt)*255,0,255);data[i+1]=clamp((.2+.48*fiber+.23*fine)*255,0,255);data[i+2]=clamp(crypt*255,0,255);data[i+3]=255;
 }}return{data,width:W,height:H};
}
/** E1 adds morphological height/pigment channels to the retained ET08 noise basis.
 * Polar atlas: u=azimuth, v=material coordinate from pupil edge to limbus.
 * RGBA: reflected intensity / height encoded [-1,+1] / crypt openness / pigment variation.
 * Relief is in normalized atlas units here; the shader applies irisReliefMM exactly once.
 * Presets vary structure, not merely RGB. They represent invented eyes, not demographic classes.
 */
export function createIrisAtlas(name='dense-brown',{width=1024,height=256,seed}={}){
 const p=PRESETS[name];if(!p)throw Error('Unknown iris preset');
 if(!Number.isInteger(width)||width<64||!Number.isInteger(height)||height<32)throw RangeError('Insufficient atlas resolution');
 const rnd=random(seed??p.seed),table=Float32Array.from({length:2048},rnd),data=new Uint8Array(width*height*4);
 // Periodic angular field fixes the original ET08 texture seam without duplicating edge texels.
 const ns=(x,salt=0,period=2048)=>{let i=Math.floor(x),t=smooth(x-i);const at=j=>table[((j%period+period)%period+salt)&2047];return mix(at(i),at(i+1),t);};
 const crypts=Array.from({length:p.cryptCount},()=>({a:rnd(),r:p.collarettePosition+(rnd()-.42)*.26,angular:.004+rnd()*.012,radial:.035+rnd()*.105,depth:.55+rnd()*.45}));
 let minH=1,maxH=-1,cryptPixels=0;
 for(let y=0;y<height;y++){const r=y/(height-1);for(let x=0;x<width;x++){
  const a=x/width,flow=a+(.011*Math.sin(r*5+a*TAU*3)+.005*Math.sin(r*11+a*TAU*7));
  const coarse=ns(flow*64,97,64),fibers=ns(flow*Math.round(384*p.fiberScale),213,Math.round(384*p.fiberScale)),fine=ns(flow*1024,579,1024),band=ns(r*16+coarse*3,731);
  const collarR=p.collarettePosition+.018*Math.sin(a*TAU*7)+.026*(ns(a*32,899,32)-.5);
  const collar=Math.exp(-(((r-collarR)/.032)**2)),ruff=Math.exp(-((r/.035)**2));
  let crypt=0;for(const c of crypts){const da=Math.min(Math.abs(a-c.a),1-Math.abs(a-c.a));const e=(da/c.angular)**2+((r-c.r)/c.radial)**2;crypt=Math.max(crypt,Math.exp(-e*1.7)*c.depth);}
  crypt*=p.cryptDepth*(1-Math.exp(-r*30))*(1-Math.exp(-(1-r)*30));
  const furrow=(Math.exp(-(((r-(.73+.017*Math.sin(a*TAU*5)))/.018)**2))+.65*Math.exp(-(((r-(.88+.01*Math.sin(a*TAU*9)))/.012)**2)))*p.furrowStrength;
  const stroma=(fibers-.5)*.27+(coarse-.5)*.20+(fine-.5)*.075;
  const h=clamp(stroma+collar*.32*p.collaretteRelief-crypt*.9-furrow*.17+ruff*.12,-1,1);
  const pigment=clamp(.5+p.pigmentVariation*((coarse-.5)*.60+(band-.5)*.30));
  const intensity=clamp(.52+(coarse-.5)*.28+(fibers-.5)*.20-crypt*.12-furrow*.035);
  const i=(y*width+x)*4;data[i]=Math.round(intensity*255);data[i+1]=Math.round((h*.5+.5)*255);data[i+2]=Math.round(crypt*255);data[i+3]=Math.round(pigment*255);
  minH=Math.min(minH,h);maxH=Math.max(maxH,h);if(crypt>.4)cryptPixels++;
 }}return{data,width,height,preset:name,seed:seed??p.seed,report:{minHeight:minH,maxHeight:maxH,cryptCoverage:cryptPixels/(width*height),cryptCount:crypts.length,externalPhotos:0,geometryClaim:'height-field mesostructure; not measured iris geometry'}};
}

