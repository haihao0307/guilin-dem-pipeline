/** Stable reference-space anatomy. Coordinates use the frozen GNM template,
 * metres, Y up, Z forward. These authored landmarks are not clinical measures. */
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export const point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
const sub=(a,b)=>a.map((v,k)=>v-b[k]);const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const gauss=(z,y,sz,sy,p)=>Math.exp(-(((p[2]-z)/sz)**2)-((p[1]-y)/sy)**2),CENTER={y:.274,z:.023};
export function earMask(p,type=0){return type<.5?smooth(.060,.075,Math.abs(p[0]))*smooth(.229,.244,p[1])*(1-smooth(.301,.317,p[1]))*smooth(-.012,.000,p[2])*(1-smooth(.041,.056,p[2])):0;}
export function earROI(p,type=0){return type<.5&&Math.abs(p[0])>.058&&p[1]>.224&&p[1]<.322&&p[2]>-.017&&p[2]<.061;}
function spline(points){const out=[];for(let i=0;i<points.length-1;i++){const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];for(let j=0;j<16;j++){const t=j/16;out.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));}}out.push(points.at(-1));return out;}
const rails={
 helix:spline([[.030,.248],[.018,.254],[.009,.266],[.004,.282],[.007,.294],[.016,.299],[.026,.294]]),
 antihelix:spline([[.027,.263],[.019,.267],[.0155,.276],[.016,.284],[.020,.293]]),
 inferiorCrus:spline([[.016,.284],[.023,.287],[.029,.289]]),
 helicalCrus:spline([[.010,.296],[.017,.294],[.024,.291],[.031,.287],[.036,.282]])};
function ridge(p,rail,width){let d=Infinity;for(let i=0;i<rail.length-1;i++){const a=rail[i],b=rail[i+1],x=b[0]-a[0],y=b[1]-a[1],t=clamp(((p[2]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y));d=Math.min(d,(p[2]-a[0]-x*t)**2+(p[1]-a[1]-y*t)**2);}return Math.exp(-d/(width*width));}
export function sampleEar(p,type,nx=1){const mask=earMask(p,type);if(mask<1e-8)return null;return{side:p[0]<0?-1:1,mask,front:smooth(-.10,.55,nx*Math.sign(p[0])),x:Math.abs(p[0]),y:p[1],z:p[2],
 helix:ridge(p,rails.helix,.0020),anti:ridge(p,rails.antihelix,.0021),branch:ridge(p,rails.inferiorCrus,.0018),root:ridge(p,rails.helicalCrus,.0018),
 cymba:gauss(.023,.288,.0060,.0048,p),cavum:gauss(.027,.273,.0072,.0070,p),fossa:gauss(.020,.292,.0032,.0024,p),tragus:gauss(.034,.274,.0028,.0038,p),antitragus:gauss(.027,.263,.0030,.0026,p),notch:gauss(.031,.265,.0026,.0023,p),lobe:gauss(.025,.248,.010,.0060,p),scapha:gauss(.009,.282,.0032,.010,p)};}
function frameFrom(L){const x=unit(sub(L(45),L(36)));let up=sub(L(27),L(8));up=unit(up.map((v,k)=>v-x[k]*dot(up,x)));let front=unit(cross(x,up));if(dot(front,sub(L(30),L(27)))<0)front=front.map(v=>-v);return{x,up,front,wx:Math.hypot(...sub(L(45),L(36))),hy:Math.hypot(...sub(L(27),L(8)))};}
/** FaceFields positions already use the retained common-person Y-up/Z-forward
 * coordinates. Do not rotate them a second time when deriving the head frame. */
export function headFrame(model){const f=model.faceSurface.fields,L=i=>f.landmark(model.positions,i);const now=frameFrom(L);const ref=frameFrom(i=>f.landmark(f.rest,i));return{...now,sx:clamp(now.wx/ref.wx,.35,2),sy:clamp(now.hy/ref.hy,.35,2)};}
export function earDelta(q,s){const f=q.mask*q.front;let dx=(-.00135*s.concha*q.cymba-.00215*s.concha*q.cavum+.00055*s.helix*q.root+.00120*s.antihelix*q.anti+.00092*s.antihelix*q.branch-.00065*s.fold*q.fossa+.00160*s.tragus*q.tragus+.00108*s.antitragus*q.antitragus-.00082*s.fold*q.notch+.00042*s.helix*q.helix-.00026*s.helix*q.scapha)*f;
 dx+=.001*s.projection*q.mask+.00070*s.lobule*q.lobe*q.mask;
 let dy=((q.y-CENTER.y)*(s.size-1)-.0010*s.lobule*q.lobe)*q.mask;
 let dz=((q.z-CENTER.z)*(s.width-1)+.00065*s.lobule*q.lobe)*q.mask;
 const a=s.tilt*Math.PI/180;dy+=((q.y-CENTER.y)*(Math.cos(a)-1)-(q.z-CENTER.z)*Math.sin(a))*q.mask;dz+=((q.y-CENTER.y)*Math.sin(a)+(q.z-CENTER.z)*(Math.cos(a)-1))*q.mask;
 return[dx*q.side,dy,dz];}
export const EAR_LANDMARKS=[['耳轮',.009,.291],['对耳轮',.016,.280],['三角窝',.020,.292],['耳甲艇',.023,.288],['耳甲腔',.027,.273],['耳屏',.034,.274],['对耳屏',.027,.263],['耳垂',.025,.248]];
