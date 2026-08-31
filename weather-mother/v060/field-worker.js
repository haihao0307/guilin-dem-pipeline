'use strict';
// Weather Mother: deterministic scalar fields; no image inputs or persisted volumes.
function hash(x,y,z,s){let a=Math.imul(x,1597334677)^Math.imul(y,3812015801)^Math.imul(z,958282193)^s;a=Math.imul(a^(a>>>16),2246822519);a=Math.imul(a^(a>>>13),3266489917);return((a^(a>>>16))>>>0)/4294967295;}

let shadowRho=null,shadowSize=null,shadowSpacing=null,volumeId=0;
function shadowField(sun){
 const [nx,ny,nz]=shadowSize,[hx,hy,hz]=shadowSpacing,n=nx*ny*nz;
 const tau=new Float32Array(n),out=new Float32Array(n*2);
 const sx=sun[0]>=0?1:-1,sy=sun[1]>=0?1:-1,sz=sun[2]>=0?1:-1;
 const ax=Math.abs(sun[0])/hx,ay=Math.abs(sun[1])/hy,az=Math.abs(sun[2])/hz,inv=1/Math.max(ax+ay+az,1e-5);
 for(let zz=0;zz<nz;zz++){let z=sz>0?nz-1-zz:zz;for(let yy=0;yy<ny;yy++){let y=sy>0?ny-1-yy:yy;for(let xx=0;xx<nx;xx++){let x=sx>0?nx-1-xx:xx,k=(z*ny+y)*nx+x;
 let a=x+sx>=0&&x+sx<nx?tau[k+sx]:0,b=y+sy>=0&&y+sy<ny?tau[k+sy*nx]:0,d=z+sz>=0&&z+sz<nz?tau[k+sz*nx*ny]:0;
 tau[k]=Math.min(60,(shadowRho[k]*2.4+ax*a+ay*b+az*d)*inv);
 out[k*2]=tau[k];}}}
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){let sum=0;for(let y=ny-1;y>=0;y--){let k=(z*ny+y)*nx+x;out[k*2+1]=sum+shadowRho[k]*hy*.5;sum+=shadowRho[k]*hy;}}
 return out;
}
function prepareShadows(data,dims,spacing){
 shadowSize=dims.map(n=>Math.max(8,Math.floor(n/2)));
 shadowSpacing=spacing.map((v,k)=>v*dims[k]/shadowSize[k]);
 const [nx,ny,nz]=shadowSize,[mx,my,mz]=dims;shadowRho=new Float32Array(nx*ny*nz);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
 let sum=0;for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)sum+=data[(((z*2+dz)*my+y*2+dy)*mx+x*2+dx)]/255;
 let v=Math.max(0,Math.min(1,(sum/8-.075)/.315));shadowRho[(z*ny+y)*nx+x]=v*v*(3-2*v)*.82;
 }
}
self.onmessage=({data:c})=>{try{
if(c.light){if(shadowRho&&c.id===volumeId){const tau=shadowField(c.sun);self.postMessage({light:true,id:volumeId,revision:c.revision,tau,shadowSize},[tau.buffer]);}return;}


if(c.noise){
 const data=new Uint8Array(64**3*2),wrap=x=>(x%8+8)%8,H=(x,y,z,s)=>hash(wrap(x),wrap(y),wrap(z),s),fade=t=>t*t*t*(t*(t*6-15)+10),mix=(a,b,t)=>a+(b-a)*t;
 function grad(x,y,z,dx,dy,dz){let n=Math.floor(H(x,y,z,271)*256)&15,u=n<8?dx:dy,v=n<4?dy:(n===12||n===14?dx:dz);return((n&1)?-u:u)+((n&2)?-v:v);}
 function perlin(x,y,z){let X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),a=x-X,b=y-Y,c=z-Z,u=fade(a),v=fade(b),w=fade(c);return mix(mix(mix(grad(X,Y,Z,a,b,c),grad(X+1,Y,Z,a-1,b,c),u),mix(grad(X,Y+1,Z,a,b-1,c),grad(X+1,Y+1,Z,a-1,b-1,c),u),v),mix(mix(grad(X,Y,Z+1,a,b,c-1),grad(X+1,Y,Z+1,a-1,b,c-1),u),mix(grad(X,Y+1,Z+1,a,b-1,c-1),grad(X+1,Y+1,Z+1,a-1,b-1,c-1),u),v),w);}
 let k=0;for(let z=0;z<64;z++)for(let y=0;y<64;y++)for(let x=0;x<64;x++){
 let px=(x+.5)/8,py=(y+.5)/8,pz=(z+.5)/8,X=Math.floor(px),Y=Math.floor(py),Z=Math.floor(pz),best=8;
 for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=X+dx,yy=Y+dy,zz=Z+dz,a=xx+H(xx,yy,zz,71)-px,b=yy+H(xx,yy,zz,137)-py,c=zz+H(xx,yy,zz,311)-pz;best=Math.min(best,a*a+b*b+c*c);}
 data[k++]=Math.round(Math.max(0,Math.min(1,.5+perlin(px,py,pz)*.65))*255);
 data[k++]=Math.round(Math.max(0,Math.min(1,1-Math.sqrt(best)*.85))*255);
 }
 self.postMessage({noise:true,data},[data.buffer]);return;
}
let seed=c.seed>>>0;const random=()=>{seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};const lobes=[],groups=[];
function lobe(x,y,z,rx,ry,rz,angle=0){lobes.push([x,y,z,rx,ry,rz,angle]);}
function group(start){let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const a of lobes.slice(start)){const r=[Math.max(a[3],a[5]),a[4],Math.max(a[3],a[5])];for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a[k]-r[k]-1.65);hi[k]=Math.max(hi[k],a[k]+r[k]+1.65);}}groups.push({lo,hi});}
function cumulus(x,z,scale,tall){const start=lobes.length,base=1.15+random()*.16,height=(tall?6.0:2.1)*(.80+c.instability*.38)*scale;const tilt=(random()-.5)*.44;
for(let k=0;k<6;k++){const a=k*2.399+random()*.5,rr=k?(.5+random()*.65)*scale:0;lobe(x+Math.cos(a)*rr,base+.43*scale,z+Math.sin(a)*rr*.74,(1.06+random()*.4)*scale,(.45+random()*.10)*scale,(.85+random()*.27)*scale);}
for(let col=0;col<6;col++){const a=col*2.399+random(),r=(col?.62+random()*.55:0)*scale,cx=x+Math.cos(a)*r,cz=z+Math.sin(a)*r*.8,ht=height*(col===0?1:.40+random()*.57),levels=tall?5:3;for(let j=0;j<levels;j++){const h=(j+.55)/levels,ry=(tall?.86:.62)*scale*(.83+random()*.38),rad=(tall?1.02:1.0)*scale*(.80+random()*.36)*(1.-.25*h);const px=cx+tilt*h*height+Math.sin(col+j)*.13*scale,py=base+.4*scale+h*ht,pz=cz+Math.cos(col*.7+j)*.10*scale;lobe(px,py,pz,rad,ry,rad*(.85+random()*.16));if((col+j)%2===0)for(let b=0;b<3;b++){const th=b*2.4+col+random()*.7,sz=(.32+random()*.20)*scale;lobe(px+Math.cos(th)*rad*.85,py+(random()-.15)*ry*.65,pz+Math.sin(th)*rad*.70,sz,sz*(.82+random()*.5),sz*.85);}if(j===levels-1)for(let b=0;b<4;b++){const theta=b*2.4+random(),sz=(.27+random()*.22)*scale;lobe(px+Math.cos(theta)*rad*.65,py+(random()*.45+.1)*ry,pz+Math.sin(theta)*rad*.6,sz,sz*(.85+random()*.45),sz*.88);}}}
if(tall){for(let j=0;j<7;j++){const xx=(j-2)*.47*scale,sz=(.85+random()*.48)*scale;lobe(x+tilt*height+xx,base+height+.22+(random()-.5)*.20,z-.12+Math.sin(j)*.27,sz*1.38,(.32+random()*.2)*scale,sz*.85,tilt);}}
group(start);}
if(c.kind==='Cu'||c.kind==='Cb'){const pos=[[0,0,1],[-6.6,-1.5,.71],[6.0,-3.2,.76],[-6.0,-7.0,.58],[7.,3.9,.59],[.8,-8.,.61],[-10.2,4.,.43],[10.4,-6.7,.45],[1.,7.,.44]];for(let k=0;k<c.count;k++){let[x,z,s]=pos[k];cumulus(x+(random()-.5)*.6,z+(random()-.5)*.6,s,c.kind==='Cb'&&k===0);}}
else{const bank={Ci:[6.1,.12,2.8,.20,5],Cc:[6.,.24,.47,.50,12],Cs:[6.2,.20,3.6,2.3,5],Ac:[4.0,.43,.91,.80,9],As:[4.1,.46,3.5,2.5,5],Sc:[2.2,.61,1.85,1.5,6],St:[1.40,.30,3.3,2.5,5],Ns:[3.,1.05,3.8,2.8,5]};const[h,ry,rx,rz,n]=bank[c.kind];for(let k=0;k<n*c.count;k++){const s=.63+random()*.59,x=(random()-.5)*24,z=(random()-.5)*18,a=c.kind==='Ci'?.23+random()*.23:random()*.45;if(c.kind==='Ci'){for(let j=0;j<3;j++)lobe(x+j*.58,h+Math.sin(j*.9+k)*.16,z+j*.22,rx*s*.72,ry*s,rz*s*(.5+j*.2),a);}else lobe(x,h+(random()-.5)*ry*.60,z,rx*s,ry*s,rz*s,a);}group(0);}
const[nx,ny,nz]=c.dims,lo=c.min,hi=c.max,spacing=hi.map((v,k)=>(v-lo[k])/c.dims[k]),out=new Uint8Array(nx*ny*nz);let supportSafe=true;
for(const[cx,cy,cz,rx,ry,rz,ang]of lobes){const ca=Math.cos(ang),sa=Math.sin(ang),br=Math.max(rx,rz);if(cx-br<=lo[0]+.7||cx+br>=hi[0]-.7||cy-ry<=lo[1]+.7||cy+ry>=hi[1]-.7||cz-br<=lo[2]+.7||cz+br>=hi[2]-.7)supportSafe=false;const a=[Math.max(0,Math.floor((cx-br-lo[0])/spacing[0])),Math.max(0,Math.floor((cy-ry-lo[1])/spacing[1])),Math.max(0,Math.floor((cz-br-lo[2])/spacing[2]))],b=[Math.min(nx-1,Math.ceil((cx+br-lo[0])/spacing[0])),Math.min(ny-1,Math.ceil((cy+ry-lo[1])/spacing[1])),Math.min(nz-1,Math.ceil((cz+br-lo[2])/spacing[2]))];for(let z=a[2];z<=b[2];z++)for(let y=a[1];y<=b[1];y++)for(let x=a[0];x<=b[0];x++){let dx=lo[0]+(x+.5)*spacing[0]-cx,dy=(lo[1]+(y+.5)*spacing[1]-cy)/ry,dz=lo[2]+(z+.5)*spacing[2]-cz,xx=(dx*ca+dz*sa)/rx,zz=(-dx*sa+dz*ca)/rz,rr=xx*xx+dy*dy+zz*zz;if(rr>=1)continue;let v=Math.min(1,(1-Math.sqrt(rr))*2.10),i=(z*ny+y)*nx+x,prev=out[i]/255,k=.14,d=Math.abs(v-prev);out[i]=Math.min(255,Math.round((Math.max(v,prev)+Math.max(k-d,0)**2/(4*k))*255));}}
let border=0;for(let z=0;z<nz;z++)for(let y=0;y<ny;y++){for(let x of[0,1,nx-2,nx-1])border=Math.max(border,out[(z*ny+y)*nx+x]);if(y<2||y>=ny-2||z<2||z>=nz-2)for(let x=0;x<nx;x++)border=Math.max(border,out[(z*ny+y)*nx+x]);}
prepareShadows(out,c.dims,spacing);volumeId=c.id;const tau=shadowField(c.sun||[-.5,.75,.4]);
self.postMessage({id:c.id,kind:c.kind,data:out,groups,lobes:lobes.length,borderMax:border,supportSafe,seed:c.seed,spacing,tau,shadowSize},[out.buffer,tau.buffer]);
}catch(e){self.postMessage({id:c.id,error:e.stack||e.message});}};
