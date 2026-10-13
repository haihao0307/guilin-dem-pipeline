/** Stable reference-space anatomy. Coordinates use the frozen GNM template,
 * metres, Y up, Z forward. These authored landmarks are not clinical measures. */
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export const point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
const sub=(a,b)=>a.map((v,k)=>v-b[k]);const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const gauss=(z,y,sz,sy,p)=>Math.exp(-(((p[2]-z)/sz)**2)-((p[1]-y)/sy)**2),CENTER={y:.274,z:.023};
function spline(points){const out=[];for(let i=0;i<points.length-1;i++){const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];for(let j=0;j<16;j++){const t=j/16;out.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}}out.push(points.at(-1));return out;}
const rails={
 helix:spline([[.030,.248],[.018,.254],[.009,.266],[.004,.282],[.007,.294],[.016,.299],[.026,.294]]),
 antihelix:spline([[.027,.263],[.019,.267],[.0155,.276],[.016,.284],[.020,.293]]),
 inferiorCrus:spline([[.016,.284],[.023,.287],[.029,.289]]),
 helicalCrus:spline([[.010,.296],[.017,.294],[.024,.291],[.031,.287],[.036,.282]])};
function ridge(p,rail,width){let d=Infinity;for(let i=0;i<rail.length-1;i++){const a=rail[i],b=rail[i+1],x=b[0]-a[0],y=b[1]-a[1],t=clamp(((p[2]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y));d=Math.min(d,(p[2]-a[0]-x*t)**2+(p[1]-a[1]-y*t)**2);}return Math.exp(-d/(width*width));}
export function sampleEar(p,type,nx=1,weight=0){
 const mask=type<.5?clamp(weight):0;if(mask<1e-8)return null;
 return {side:p[0]<0?-1:1,mask,front:smooth(-.10,.55,nx*Math.sign(p[0])),nx:nx*Math.sign(p[0]),x:Math.abs(p[0]),y:p[1],z:p[2],
 helix:ridge(p,rails.helix,.0019),anti:ridge(p,rails.antihelix,.00185),branch:ridge(p,rails.inferiorCrus,.00155),root:ridge(p,rails.helicalCrus,.0017),
 cymba:gauss(.023,.288,.0060,.0048,p),cavum:gauss(.027,.273,.0072,.0070,p),fossa:gauss(.023,.292,.0037,.0027,p),tragus:gauss(.034,.274,.0028,.0038,p),antitragus:gauss(.027,.263,.0030,.0026,p),notch:gauss(.031,.265,.0026,.0023,p),lobe:gauss(.025,.248,.010,.0060,p),scapha:gauss(.009,.282,.0032,.010,p),
 top:gauss(.015,.295,.013,.008,p),posterior:gauss(.006,.280,.007,.021,p),upperBranch:ridge(p,splineUpper,.0030),
 lobeZone:1-smooth(.253,.265,p[1]),attachment:gauss(.034,.249,.006,.008,p),darwin:gauss(.006,.288,.003,.0035,p),
 upperField:gauss(.019,.290,.009,.009,p),bowl:gauss(.026,.278,.010,.014,p)};
}
const splineUpper=spline([[.016,.283],[.0165,.288],[.020,.293]]);
function frameFrom(L){const x=unit(sub(L(45),L(36)));let up=sub(L(27),L(8));up=unit(up.map((v,k)=>v-x[k]*dot(up,x)));let front=unit(cross(x,up));if(dot(front,sub(L(30),L(27)))<0)front=front.map(v=>-v);return{x,up,front,wx:Math.hypot(...sub(L(45),L(36))),hy:Math.hypot(...sub(L(27),L(8)))};}
/** Barycentric landmarks read canonical Z-up model.positions, while the rendered
 * mesh is [x,z,-y]. Transform only the CURRENT basis; the template is already Y-up. */
export function headFrame(model){const f=model.faceSurface.fields,L=i=>f.landmark(model.positions,i);const source=frameFrom(L),toDisplay=a=>[a[0],a[2],-a[1]],now={...source,x:toDisplay(source.x),up:toDisplay(source.up),front:toDisplay(source.front)};const ref=frameFrom(i=>f.landmark(f.rest,i));return{...now,sx:clamp(now.wx/ref.wx,.35,2),sy:clamp(now.hy/ref.hy,.35,2)};}
/** Coupled regional phenotype. These are authored geometric relations, not
 * measured growth rates. The same plan acts on both sides of the cartilage
 * sheet; the non-cartilaginous lobule has a separate area/thickness budget. */
export function resolvePhenotype(s){
 const c=(s.cartilageGrowth-.5)*2,b=(s.conchaGrowth-.5)*2,l=(s.lobuleGrowth-.5)*2;
 const roll=(s.helixRoll-.5)*2,spread=(s.crusSpread-.5)*2,attach=s.lobuleAttachment;
 const depth=s.concha*(1+.22*b),stem=s.antihelix*(1+.12*c),
   projectionAngle=(s.rootAngle+2.8*b-1.5*(stem-1))*Math.PI/180,
   lobeLength=1+.14*l+.22*(s.lobuleHang-.35)*(1-.5*attach),
   lobeArea=1+.20*l+.18*(s.lobuleFullness-.5),
   lobeWidth=Math.sqrt(lobeArea/lobeLength);
 return {c,b,l,roll,spread,attach,depth,stem,projectionAngle,lobeLength,lobeWidth,
   cartilageScaleY:1+.055*c,cartilageScaleZ:1+.075*c,
   conchaScale:1+.14*(s.conchaWidth-.5)*2+.075*b,
   cymbaGain:1+.48*(s.cymbaRatio-.52),cavumGain:1-.32*(s.cymbaRatio-.52),
   superior:s.superiorCrus*(1+.10*c),inferior:s.inferiorCrus*(1+.14*b),
   fold:s.fold*(.9+.2*s.crusSpread),sheetSupport:1.0,
   description:'regional cartilage expansion → conchal support and crura → root rotation → separate lobule area/length budget'};
}
export function earDelta(q,s,p=resolvePhenotype(s)){
 const w=q.mask,front=q.front,back=1-front,cart=1-q.lobeZone;
 // The front folds and the posterior support come from the same relief field,
 // rather than adding floating tubes, cavity decals, or a second skin.
 // Smooth union avoids summing three crests into a bead at the Y junction.
 const crest=Math.pow(Math.pow(1.32*p.stem*q.anti,4)+Math.pow(1.26*p.inferior*q.branch,4)+Math.pow(.95*p.superior*q.upperBranch,4),.25)*.001;
 const entry=Math.exp(-(((q.z-.0315)/.0038)**2)-((q.y-.2735)/.0044)**2);
 const relief=-.00160*p.depth*p.cymbaGain*q.cymba-.00240*p.depth*p.cavumGain*q.cavum
  +.00076*s.helix*q.root+crest-.00090*p.fold*q.fossa
  +.00192*s.tragus*q.tragus+.00120*s.antitragus*q.antitragus
  -.00108*p.fold*q.notch+.00073*s.helix*q.helix-.00050*s.helix*q.scapha
  -.00052*p.depth*entry;
 let dx=relief*(front+p.sheetSupport*back);
 // Non-uniform expansion transports the existing anatomical surface.
 let dy=(q.y-.267)*(p.cartilageScaleY-1)*cart;
 let dz=(q.z-.035)*(p.cartilageScaleZ-1)*cart;
 dy+=(q.y-.274)*(s.size-1);dz+=(q.z-.023)*(s.width-1);
 // Round the upper rim by distributing curvature across the upper arc.
 const round=(s.upperRoundness-.6)*2;
 dy+=-.0018*round*q.top;
 dz+=-.0027*round*q.top*Math.tanh((.019-q.z)/.010);
 // Rolling rim narrows its inward lip and changes the adjacent scapha.
 dx+=.00070*p.roll*q.helix*(front-.35*back);
 dz+=.00105*p.roll*q.helix-.00068*p.roll*q.scapha;
 dz+=-.0016*(s.scaphaWidth-.5)*2*q.scapha;
 // A connected Y ridge: moving the branches also opens the intervening fossa.
 dz+=.0017*p.spread*q.upperField*((q.z-.018)/.010);
 dy+=.00080*p.spread*q.upperBranch-.00045*p.spread*q.branch;
 dx-=.00038*p.spread*q.fossa*front;
 dz+=(q.z-.026)*(p.conchaScale-1)*q.bowl;
 dy+=.0019*(s.cymbaRatio-.52)*q.bowl;
 // Natural local helix variation, compactly supported.
 dx+=.0012*s.darwin*q.darwin*(front+.4*back);
 dz-=.0011*s.darwin*q.darwin;
 // Tragus orientation and the notch remain related to the cavity entrance.
 const ta=s.tragusAngle*Math.PI/180;
 dx+=Math.sin(ta)*.004*q.tragus;dz+=(Math.cos(ta)-1)*.004*q.tragus;
 const notch=(s.notchWidth-.5)*2;
 dy+=.00075*notch*(q.tragus-q.antitragus);
 dz+=.00065*notch*(q.tragus-q.antitragus);
 dx-=.00045*notch*q.notch*front;
 // Lobule is NOT part of the cartilage growth field. Increasing length
 // compensates its width; fullness independently changes its thickness.
 const tip=Math.exp(-(((q.y-.2435)/.0055)**2)-((q.z-.028)/.012)**2);
 dy+=.00175*tip*(.72+.28*p.attach);
 dz+=(.026-q.z)*.16*tip;
 dy+=(q.y-.259)*(p.lobeLength-1)*q.lobeZone-.00060*s.lobule*q.lobe;
 dz+=(q.z-.029)*(p.lobeWidth-1)*q.lobeZone+.00065*s.lobule*q.lobe;
 dx+=(.00070*s.lobule+.00165*(s.lobuleFullness-.5))*q.lobe*(front-.55*back);
 const attach=p.attach-.45;
 dx-=.0020*attach*q.attachment;
 dy+=.0030*attach*q.attachment-.0013*(1-p.attach)*s.lobuleHang*q.lobe;
 dz+=.0018*attach*q.attachment;
 // Tilt remains local. Projection rotates around the fixed anatomical root
 // axis, with the angle feathered INSIDE the pinna, not a moving skull box.
 const t=s.tilt*Math.PI/180;
 dy+=(q.y-CENTER.y)*(Math.cos(t)-1)-(q.z-CENTER.z)*Math.sin(t);
 dz+=(q.y-CENTER.y)*Math.sin(t)+(q.z-CENTER.z)*(Math.cos(t)-1);
 const H=p.hinge||{origin:[.070,.247,.038],axis:[0,1,0]},a=H.axis;
 const v=[q.x+dx*w-H.origin[0],q.y+dy*w-H.origin[1],q.z+dz*w-H.origin[2]],A=-p.projectionAngle*w,C=Math.cos(A),S=Math.sin(A),dot=a.reduce((n,x,k)=>n+x*v[k],0),cross=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]];
 const r=v.map((x,k)=>x*C+cross[k]*S+a[k]*dot*(1-C)+H.origin[k]);
 return [(r[0]-q.x+.001*s.projection*w)*q.side,r[1]-q.y,r[2]-q.z];
}
export const EAR_LANDMARKS=[['耳轮',.009,.291],['对耳轮',.016,.280],['三角窝',.020,.292],['耳甲艇',.023,.288],['耳甲腔',.027,.273],['耳屏',.034,.274],['对耳屏',.027,.263],['耳垂',.025,.248]];
