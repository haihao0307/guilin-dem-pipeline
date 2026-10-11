/** Native GNM landmark rails; metres, reference Y up. No donor face or mesh. */
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export const gauss=(x,s)=>Math.exp(-((x/s)**2));
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const unit=a=>{const n=Math.hypot(...a);return n>1e-9?a.map(v=>v/n):[1,0,0];};
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const point=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
export function rail(points,x){
 const a=points;if(x<=a[0][0])return a[0][1];if(x>=a.at(-1)[0])return a.at(-1)[1];
 for(let i=0;i<a.length-1;i++)if(x<=a[i+1][0]){const p=a[i],q=a[i+1],l=a[Math.max(0,i-1)],r=a[Math.min(a.length-1,i+2)],h=q[0]-p[0],t=(x-p[0])/h,m=(q[1]-l[1])/(q[0]-l[0]),n=(r[1]-p[1])/(r[0]-p[0]);return (2*t**3-3*t*t+1)*p[1]+(t**3-2*t*t+t)*h*m+(-2*t**3+3*t*t)*q[1]+(t**3-t*t)*h*n;}
}
export function createLipRails(model){
 const f=model.faceSurface.fields,L=i=>f.landmark(f.rest,i),sort=ids=>ids.map(L).sort((a,b)=>a[0]-b[0]);
 const r={top:sort([48,49,50,51,52,53,54]),bottom:sort([48,59,58,57,56,55,54]),innerTop:sort([60,61,62,63,64]),innerBottom:sort([60,67,66,65,64]),nose:L(33)};
 r.cx=(L(48)[0]+L(54)[0])*.5;r.half=(L(54)[0]-L(48)[0])*.5;r.cy=(L(62)[1]+L(66)[1])*.5;r.front=Math.min(L(48)[2],L(54)[2])-.008;
 r.sample=(p,type=0)=>{const x=p[0],y=p[1],u=(x-r.cx)/r.half,top=rail(r.top,x),bot=rail(r.bottom,x),it=rail(r.innerTop,x),ib=rail(r.innerBottom,x),upper=y>=(it+ib)*.5,v=upper?(y-it)/Math.max(.001,top-it):(ib-y)/Math.max(.001,ib-bot),front=smooth(r.front,r.front+.006,p[2]);return {u,v,upper,top,bot,it,ib,front,roi:type<.5&&Math.abs(u)<1.25&&y>bot-.010&&y<top+.014&&front>.001};};
 return r;
}
export function currentLipFrame(model){
 const L=i=>model.faceSurface.fields.landmark(model.positions,i),left=L(48),right=L(54),center=L(62).map((v,k)=>(v+L(66)[k])*.5),X=unit(sub(right,left)),U=sub(L(27),L(8)),Y=unit(U.map((v,k)=>v-X[k]*dot(U,X)));let Z=unit(cross(X,Y));if(dot(Z,sub(L(30),center))<0)Z=Z.map(v=>-v);
 const display=a=>[a[0],a[2],-a[1]];return {x:display(X),up:display(Y),front:display(Z),center:display(center),width:Math.hypot(...sub(right,left)),gap:Math.abs(dot(sub(L(62),L(66)),Y))};
}
