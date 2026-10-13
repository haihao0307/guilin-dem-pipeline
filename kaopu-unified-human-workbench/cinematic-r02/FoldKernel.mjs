/** Original bounded buckling construction. The profile has a soft roll AND a shallow
 * attachment trough, plus in-plane shortening; it is not a painted height texture.
 * Analytic art direction, not FEM, clinical skin mechanics or a Disney code port. */
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const g=x=>Math.exp(-x*x);
export const GROUPS=['forehead','underEye','crowsFeet','nasolabial','jowl'];
export function foldProfile(distance,width,s,regional=1){
 const stored=Math.max(0,s.slack*(.2+.8*s.compression)-.45*s.tension);
 const w=width*(.8+1.1*s.softness)/(1+.28*s.compression);
 const amp=Math.min(1.65,w*.45*Math.sqrt(stored)*regional);
 const q=distance/w;
 // The negative side carries the relaxed skin reservoir, not two sharp trench walls.
 const roll=.78*g((q+.92)/1.12)-.30*g((q-.12)/.46)-.26*g((q+2.85)/1.65);
 const shortening=-distance*.075*s.compression*s.slack*(1-s.tension)*g(q/2.25)*regional;
 return{height:amp*roll,tangent:shortening,width:w,stored};
}
export function makeLayout(landmarks){
 const L=i=>landmarks[i].map(x=>x*1000),eyeLeft=L(36),eyeRight=L(45),bridge=L(27),chin=L(8),ml=L(48),mr=L(54),up=L(51),lo=L(57),eyeSpan=Math.abs(eyeRight[0]-eyeLeft[0]),scale=clamp(eyeSpan/88,.5,1.8),s=scale;
 const curves=[],eyeY=(eyeLeft[1]+eyeRight[1])/2,brow=Math.max(eyeY,bridge[1])+18*s,mouthY=(up[1]+lo[1])/2,mouthX=(ml[0]+mr[0])/2;
 const add=(group,axis,a,b,c0,c1,bend,width,phase=0,strength=1,flip=1)=>curves.push({group,axis,a,b,c0,c1,bend,width,phase,strength,flip});
 for(const [row,offset,len,w]of [[0,5,43,1.2],[1,13,48,1.35],[2,24,39,1.15]])add(0,0,-len*s,len*s,brow+offset*s,brow+(offset+.4)*s,1.8*s,w*s,.7+row*1.8,[1,.84,.66][row]);
 const eyes=[];
 for(const side of[-1,1]){
  const outer=side<0?L(36):L(45),inner=side<0?L(39):L(42),center=[(outer[0]+inner[0])/2,(outer[1]+inner[1])/2],width=Math.abs(outer[0]-inner[0]);eyes.push({center,width});
  const x0=Math.min(outer[0],inner[0]),x1=Math.max(outer[0],inner[0]);
  add(1,0,x0-1*s,x1+1*s,center[1]-6.8*s,center[1]-7.2*s,-3.1*s,1.8*s,.9+side,.95);
  add(1,0,x0+.12*width,x1-.08*width,center[1]-12.0*s,center[1]-12.5*s,-1.9*s,1.35*s,2.3+side,.46);
  for(let j=0;j<3;j++){
   let a=outer[0]+side*3.8*s,b=outer[0]+side*(18.5-j*2.2)*s,ya=outer[1]-(j*1.4+1.1)*s,yb=outer[1]+(2-j*5.1)*s;
   if(a>b){[a,b]=[b,a];[ya,yb]=[yb,ya];}add(2,0,a,b,ya,yb,.7*s,.80*s,j+.3*side,[.45,.65,.4][j]);
  }
  const ala=side<0?L(31):L(35),corner=side<0?ml:mr;
  add(3,1,corner[1]-6*s,ala[1]-1.3*s,corner[0]+side*3.4*s,ala[0]+side*3.2*s,side*2.5*s,3.15*s,.4+side,1,-side);
  // Broad lower-cheek reservoir, deliberately not a continuous dark marionette stripe.
  add(4,1,chin[1]+11*s,corner[1]-5*s,side*(Math.abs(corner[0])+9*s),side*(Math.abs(corner[0])+7*s),side*3.8*s,4.0*s,side,0.65,-side);
 }
 return{curves,eyes,scale,eyeSpan,chinY:chin[1],eyeY,mouthY,mouthX,mouthWidth:Math.abs(mr[0]-ml[0])};
}
export function sampleLayout(x,y,z,face,lip,nose,ear,layout){
 let mask=face*(1-smooth(.03,.30,lip))*(1-.85*nose)*(1-ear)*smooth(12,35,z);
 const s=layout.scale;
 for(const e of layout.eyes){const d=Math.hypot((x-e.center[0])/(e.width*.57),(y-e.center[1])/(4.8*s));mask*=smooth(1.0,1.32,d);}
 const mouth=Math.hypot((x-layout.mouthX)/(layout.mouthWidth*.62),(y-layout.mouthY)/(9.0*s));mask*=smooth(1,1.27,mouth);
 if(mask<.0001)return{mask:0,sag:0,folds:[]};
 const folds=[];
 for(const c of layout.curves){const along=c.axis===0?x:y,perp=c.axis===0?y:x,t=(along-c.a)/(c.b-c.a);if(t<=0||t>=1)continue;
  const line=c.c0+(c.c1-c.c0)*t+c.bend*Math.sin(Math.PI*t)+.28*s*Math.sin(t*9+c.phase)*Math.sin(Math.PI*t);
  const derivative=(c.c1-c.c0+c.bend*Math.PI*Math.cos(Math.PI*t)+.28*s*(9*Math.cos(t*9+c.phase)*Math.sin(Math.PI*t)+Math.PI*Math.sin(t*9+c.phase)*Math.cos(Math.PI*t)))/(c.b-c.a);
  const den=Math.hypot(1,derivative),distance=(perp-line)/den*c.flip,gate=Math.sin(Math.PI*t)**.75*c.strength;
  const support=gate*g(distance/(c.width*5));if(support<.003)continue;
  const nx=c.axis===0?-derivative/den:1/den,ny=c.axis===0?1/den:-derivative/den;
  folds.push({distance,gate,width:c.width,group:c.group,nx:nx*c.flip,ny:ny*c.flip,support});
 }
 folds.sort((a,b)=>b.support-a.support);
 const lateral=smooth(layout.mouthWidth*.30,layout.mouthWidth*.75,Math.abs(x-layout.mouthX))*(1-smooth(57*s,76*s,Math.abs(x)));
 const vertical=smooth(layout.chinY+4*s,layout.chinY+25*s,y)*(1-smooth(layout.eyeY-18*s,layout.eyeY-4*s,y));
 return{mask,sag:lateral*vertical,folds:folds.slice(0,2)};
}
