const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;function sm(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}
function hash(x,z){const v=Math.sin(x*127.1+z*311.7)*43758.5453123;return v-Math.floor(v)}
function noise(x,z){const i=Math.floor(x),j=Math.floor(z),u=sm(0,1,x-i),v=sm(0,1,z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v)}
function ridged(x,z){return 1-Math.abs(noise(x,z)*2-1)}
function rng(seed=390914){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng();
function geomDetail(x,z){let qx=x*.006,qz=z*.006,s=0,a=.34;for(let i=0;i<5;i++){const k=1<<i;s+=(noise(qx*k,qz*k)-.5)*a;a*=.52;}return s}
function fineDetail(x,z){let qx=x*.018,qz=z*.018,s=0,a=.55;for(let i=0;i<5;i++){const k=1<<i;s+=(noise(qx*k,qz*k)-.5)*a;a*=.48;}return s}
const mountains=[[-176,-236,58,52,48],[-122,-254,72,58,52],[-63,-235,64,55,48],[-5,-267,86,68,58],[62,-244,69,60,52],[124,-258,77,64,55],[182,-226,59,55,48],[-206,-168,52,52,46],[194,-170,54,52,48],[-150,-188,43,45,42],[142,-190,47,48,43]];
function mountainField(x,z){let h=0;for(let i=0;i<mountains.length;i++){const[cx,cz,H,rx,rz]=mountains[i],dx=(x-cx)/rx,dz=(z-cz)/rz,theta=Math.atan2(dz,dx);const warp=1+.14*Math.sin(theta*3+i*.7)+.055*Math.sin(theta*7-i*.4);const rr=Math.hypot(dx,dz)/warp;if(rr<1.5){const core=Math.pow(Math.max(0,1-Math.pow(rr,1.55)),.58);const ribs=.78+.22*ridged(x*.026+i*.7,z*.022-i*.3);h=Math.max(h,H*core*ribs);}}return h}
function baseNatural(x,z){const back=1-sm(-145,38,z);let y=.35+24*Math.pow(back,1.34);y+=geomDetail(x,z)*(1.3+.8*back);const mf=mountainField(x,z);y+=mf;const valley=Math.exp(-Math.pow((x+4+10*Math.sin(z*.009))/92,2))*(1-sm(-260,-105,z));y-=valley*(2.2+5.2*back);return y}
function terraceMask(x,z){let m=sm(-150,-122,x)*(1-sm(92,116,x))*sm(-142,-120,z)*(1-sm(17,34,z));const g1=Math.exp(-Math.pow((x+52+.08*(z+70))/9,2));const g2=Math.exp(-Math.pow((x-46-.05*(z+70))/10,2));m*=1-clamp(g1*.93+g2*.82,0,.96);return m}
function terraceInfoFromNatural(nat,x,z){const step=1.48,warp=.36*Math.sin(x*.031)+.22*Math.sin((x+z)*.019)+.24*(noise(x*.017,z*.017)-.5);const q=(nat+warp)/step,k=Math.floor(q),f=q-k;const rise=sm(.79,.975,f);let y=(k+rise)*step;const bund=.28*Math.exp(-Math.pow((f-.72)/.035,2));y+=bund;return{y,k,f,warp,bund}}
const gx=[-118,-60,4,70,128],gz=[22,50,82,116];const nodes=[];for(let j=0;j<gz.length;j++){nodes[j]=[];for(let i=0;i<gx.length;i++){const edge=i===0||i===gx.length-1||j===0||j===gz.length-1;nodes[j][i]=[gx[i]+(edge?0:(R()-.5)*8),gz[j]+(edge?0:(R()-.5)*6)];}}
const flatFields=[];let fid=0;for(let j=0;j<gz.length-1;j++)for(let i=0;i<gx.length-1;i++){const poly=[nodes[j][i],nodes[j][i+1],nodes[j+1][i+1],nodes[j+1][i]];flatFields.push({id:`F${++fid}`,poly,bed:.42+j*.035+(i%2)*.018,wet:(i+j)%3!==1,stage:(i+j)%4});}
function pointInPoly(x,z,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],zi=p[i][1],xj=p[j][0],zj=p[j][1];if(((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi+1e-9)+xi))c=!c;}return c}
function flatFieldAt(x,z){for(const f of flatFields)if(pointInPoly(x,z,f.poly))return f;return null}
function riverZ(x){return 151+11*Math.sin((x+35)*.019)+4*Math.sin(x*.053)}
const sourcePath=[[-6,-205],[-18,-188],[-34,-171],[-51,-151],[-68,-131],[-82,-113]];
const mainCanal=[[-102,-108],[-72,-104],[-42,-100],[-10,-97],[25,-92],[60,-86],[88,-78]];
const branchA=[[-66,-103],[-70,-78],[-63,-50],[-58,-21],[-45,12]];
const branchB=[[-12,-97],[-20,-68],[-14,-38],[-8,-8],[5,22]];
const branchC=[[55,-87],[48,-58],[55,-28],[48,0],[52,27]];
const plainCanal=[[5,22],[8,44],[2,67],[13,93],[20,121],[24,143]];
function dseg(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz),0,1),x=mix(a[0],b[0],t),z=mix(a[1],b[1],t);return{d:Math.hypot(px-x,pz-z),t,x,z}}
function polyProjection(x,z,p){const lens=[];let total=0;for(let i=0;i<p.length-1;i++){const l=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);lens.push(l);total+=l}let best={d:1e9,t:0},acc=0;for(let i=0;i<p.length-1;i++){const q=dseg(x,z,p[i],p[i+1]);if(q.d<best.d)best={d:q.d,t:(acc+q.t*lens[i])/(total||1)};acc+=lens[i]}return best}
function dpoly(x,z,p){return polyProjection(x,z,p).d}
function terrainNoCuts(x,z){let nat=baseNatural(x,z);const tm=terraceMask(x,z);if(tm>.001){const ti=terraceInfoFromNatural(nat,x,z);nat=mix(nat,ti.y,tm)}const ff=flatFieldAt(x,z);if(ff)nat=mix(nat,ff.bed,.96);return nat}
const channelSpecs=[{p:sourcePath,w:1.0,y0:18.1,y1:16.35},{p:mainCanal,w:1.28,y0:16.0,y1:10.45},{p:branchA,w:.82,y0:14.4,y1:.72},{p:branchB,w:.82,y0:11.5,y1:.68},{p:branchC,w:.82,y0:10.5,y1:.62},{p:plainCanal,w:1.0,y0:.62,y1:-.38}];
function channelSurface(spec,t){return mix(spec.y0,spec.y1,t)}
function terrainY(x,z){let y=terrainNoCuts(x,z);for(const spec of channelSpecs){const q=polyProjection(x,z,spec.p),d=q.d;if(d<spec.w+1.45){const bed=channelSurface(spec,q.t)-.18;const cut=mix(bed,y,sm(spec.w,spec.w+1.45,d));y=Math.min(y,cut)}}const rz=riverZ(x),d=Math.abs(z-rz),rw=10.5+1.5*Math.sin(x*.024);if(z>125)y=mix(-.72,y,sm(rw,rw+5,d));return y}
window.W={clamp,mix,sm,hash,noise,ridged,rng,geomDetail,fineDetail,mountains,mountainField,baseNatural,terraceMask,terraceInfoFromNatural,gx,gz,nodes,flatFields,pointInPoly,flatFieldAt,riverZ,sourcePath,mainCanal,branchA,branchB,branchC,plainCanal,dseg,polyProjection,dpoly,terrainNoCuts,channelSpecs,channelSurface,terrainY};
