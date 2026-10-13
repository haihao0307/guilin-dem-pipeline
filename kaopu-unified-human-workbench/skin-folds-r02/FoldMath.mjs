/** Original analytic tissue-fold approximation. Millimetres in the retained GNM
 * rest frame. NOT a finite-element skin solver or a borrowed displacement map. */
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const G=x=>Math.exp(-x*x);
export const smoothC2=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(10+t*(-15+6*t));};
/** Smooth both normal and tangential deformation to exact zero at protected edges. */
export function boundaryWeight(x,y){
 let w=smoothC2(204,219,y)*(1-smoothC2(368,383,y))*(1-smoothC2(59,70,Math.abs(x)));
 for(const cx of [-31,31])w*=smoothC2(1,1.6,((x-cx)/18.2)**2+((y-301)/8.4)**2);
 return w*smoothC2(1,1.6,(x/27.8)**2+((y-232)/15.2)**2);
}
/** Single broad shoulder. Integral compensation is only 1D, NOT face-volume conservation. */
export function cheekRoll(d,width,compression){
 const x=d/(width*(1-.18*compression));
 return (G((x-.85)/1.35)-.40*G((x+.10)/.95)-((1.35-.40*.95)/8)*G((x-1.2)/8))*(.55+.45*compression);
}
export const DEFAULTS=Object.freeze({strength:.72,slack:.65,compression:.55,forehead:.55,eyes:.60,nasolabial:.78,cheeks:.55,sag:.55,makeup:.12,light:'natural',chroma:.28,exposure:0,shadows:false,diffusion:false,gray:false});
export const GEOMETRY_KEYS=['strength','slack','compression','forehead','eyes','nasolabial','cheeks','sag'];
export function validate(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid fold settings');
 const s={...DEFAULTS,...input};for(const k of Object.keys(s))if(!(k in DEFAULTS))throw Error('Unknown fold setting: '+k);
 for(const k of [...GEOMETRY_KEYS,'makeup','chroma'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>(k==='strength'?1.5:1))throw Error('Out of range: '+k);
 if(!Number.isFinite(s.exposure)||Math.abs(s.exposure)>1.5)throw Error('Exposure outside bounds');
 for(const k of ['shadows','diffusion','gray'])if(typeof s[k]!=='boolean')throw Error('Invalid boolean: '+k);
 if(!['natural','hair','neutral','raking','original'].includes(s.light))throw Error('Invalid light');return s;
}
/** Wide, asymmetric positive shoulders; shallow narrow valley; a broad signed
 * compensator makes this isolated 1D profile's integral zero, not the whole mesh. */
export function roll(d,width,compression){
 const w=width*(1-.30*compression),x=d/w;
 return (G((x-.75)/.90)+.48*G((x+1)/1.20)-.52*G(x/.55)-((.90+.48*1.20-.52*.55)/3.6)*G(x/3.6))*(.45+.55*compression);
}
export function protectedSkin(x,y){
 for(const cx of [-31,31])if(((x-cx)/18.2)**2+((y-301)/8.4)**2<1)return false;
 if((x/27.8)**2+((y-232)/15.2)**2<1)return false;
 return y>204&&y<383&&Math.abs(x)<70;
}
/** Returns signed normal displacement and head-frame gathering, in mm. */
export function foldAt(x,y,s,coverage=1){
 if(!protectedSkin(x,y)||coverage<=0||!s.strength||!s.slack)return [0,0,0];
 let h=0,dx=0,dy=0;
 const add=(d,w,a,g,nx,ny)=>{if(g<1e-5||Math.abs(d)>w*9)return;h+=roll(d,w,s.compression)*a*g;const q=-d*.095*s.compression*G(d/(w*1.65))*g*a;dx+=q*nx;dy+=q*ny;};
 for(let j=0;j<3;j++){
  const span=[40,35,28][j],center=336+j*10+2.5*(1-(x/span)**2)+.55*Math.sin(x*.083+j);
  const gate=(1-smooth(span*.68,span,Math.abs(x)))*s.forehead*(1-j*.12);
  add(y-center,1.65+j*.20,.58,gate,-.004*x,1);
 }
 const side=x<0?-1:1,a=Math.abs(x);
 if(a>14&&a<64){
  const u=clamp((a-17)/30),gate=smooth(15,21,a)*(1-smooth(43,52,a))*s.eyes;
  const arc=290-3.5*Math.sin(u*Math.PI)-.025*(a-32);
  add(y-arc,1.40,.48,gate,side*.12,1);
  add(y-(arc-5.1),1.75,.13,gate*.65,side*.12,1);
  for(let j=0;j<2;j++){const rise=(a-47)*(.20+j*.36),g=smooth(46,50,a)*(1-smooth(58,64,a))*s.eyes;add(y-(297+rise),1.28,.30,g,-side*(.20+j*.36),1);}
 }
 const t=clamp((264-y)/51),line=18+19*t+3.2*Math.sin(Math.PI*t);
 const slope=-(19+3.2*Math.PI*Math.cos(Math.PI*t))/51,den=Math.hypot(1,slope),d=(a-line)/den;
 const gate=smoothC2(213,230,y)*(1-smoothC2(253,266,y))*s.nasolabial;
 const width=3.55+.65*t,amplitude=.76*gate;
 h+=cheekRoll(d,width,s.compression)*amplitude;
 const gather=-d*.070*s.compression*G(d/(width*1.8))*amplitude;
 dx+=gather*side/den;dy-=gather*slope/den;
 // Lower cheek has a broad roll, not the old narrow double-ridge scar-like rail.
 const lower=42+.27*(y-235)+1.1*Math.sin((y-223)*.055);
 const lowerSlope=.27+.0605*Math.cos((y-223)*.055),lowerDen=Math.hypot(1,lowerSlope);
 const cd=(a-lower)/lowerDen,cg=smoothC2(209,226,y)*(1-smoothC2(244,263,y))*s.cheeks;
 h+=cheekRoll(cd,5.3,s.compression)*.54*cg;
 const cheekGather=-cd*.05*s.compression*G(cd/9.5)*.54*cg;
 dx+=cheekGather*side/lowerDen;dy-=cheekGather*lowerSlope/lowerDen;
 dy-=1.45*s.sag*s.cheeks*G((a-44)/14)*G((y-235)/24);
 const gain=s.strength*s.slack*coverage*boundaryWeight(x,y);
 return [clamp(h*gain,-.48,1.35),clamp(dx*gain,-.70,.70),clamp(dy*gain,-1.8,.70)];
}
export function splitFace(a,b,c,ab,bc,ca,out){
 const n=(ab>=0)+(bc>=0)+(ca>=0);
 if(n===3)out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
 else if(!n)out.push(a,b,c);
 else if(n===1){if(ab>=0)out.push(a,ab,c,ab,b,c);else if(bc>=0)out.push(a,b,bc,a,bc,c);else out.push(a,b,ca,ca,b,c);}
 else if(ab<0)out.push(a,b,bc,a,bc,ca,ca,bc,c);
 else if(bc<0)out.push(a,ab,ca,ab,b,c,ab,c,ca);
 else out.push(a,ab,c,ab,bc,c,ab,b,bc);
}
