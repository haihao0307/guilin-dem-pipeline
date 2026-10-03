function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=ss(0,1,x-a),v=ss(0,1,z-b);return mix(mix(rnd(a,b),rnd(a+1,b),u),mix(rnd(a,b+1),rnd(a+1,b+1),u),v);}
const C=D.camera,R=C.R,E=C.eye,SIZE=C.worldSize;
function ray(pixel){let p=[(pixel[0]-720)/C.focal_px,(pixel[1]-390.5)/C.focal_px,1];return [dot([R[0][0],R[1][0],R[2][0]],p),dot([R[0][1],R[1][1],R[2][1]],p),dot([R[0][2],R[1][2],R[2][2]],p)];}
function onPlane(pixel,y=0){const r=ray(pixel);return add(E,mul(r,(y-E[1])/r[1]));}
const shore=D.shore_world.map(p=>[p[2],p[0]]).sort((a,b)=>a[0]-b[0]);
const grass=D.grass_world.map(p=>[p[2],p[0]]).sort((a,b)=>a[0]-b[0]);
function at(points,z){if(z<=points[0][0])return points[0][1];if(z>=points.at(-1)[0])return points.at(-1)[1];let i=0;while(points[i+1][0]<z)i++;const a=points[i],b=points[i+1];return mix(a[1],b[1],ss(a[0],b[0],z));}
function shoreX(z){return at(shore,z);}
function grassX(z){return Math.max(shoreX(z)+2,Math.min(15,at(grass,z)));}
function bedBase(x,z){let s=shoreX(z),g=grassX(z),d=x-s;if(d<0)return Math.max(-4.8,d*.145-d*d*.0035);if(x<g)return 1.1*d/(g-s);return 1.1+.9*(x-g)/(16-g);}
function bed(x,z){let y=bedBase(x,z),d=x-shoreX(z);return y+Math.sin(d*1.15+z*.7)*.012*ss(0,1,Math.abs(d));}
function surfaceIntersection(pixel,offset=0){let r=ray(pixel),lo=1,hi=200;for(let j=0;j<50;j++){let tt=(lo+hi)/2,p=add(E,mul(r,tt)),d=p[1]-bed(p[0],p[2])-offset;if(d>0)lo=tt;else hi=tt;}return add(E,mul(r,(lo+hi)/2));}
function project(p){let q=add(R.map(r=>dot(r,p)),C.t);return [720+C.focal_px*q[0]/q[2],390.5+C.focal_px*q[1]/q[2]];}
function sample(poly,t){let l=poly.length-1,j=Math.min(l-1,Math.floor(t*l)),f=t*l-j;return poly[j].map((a,k)=>mix(a,poly[j+1][k],f));}
function makeMesh(v,idx,dat,kind){
 if(v.some(x=>!Number.isFinite(x)))throw Error('Non-finite geometry');const n=new Float32Array(v.length);for(let i=0;i<idx.length;i+=3){const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3,pa=v.slice(a,a+3),pb=v.slice(b,b+3),pc=v.slice(c,c+3),q=cross(sub(pb,pa),sub(pc,pa));for(const j of [a,b,c])for(let k=0;k<3;k++)n[j+k]+=q[k];}
 for(let j=0;j<v.length;j+=3){const q=norm(Array.from(n.slice(j,j+3)));n.set(q,j);}
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 function buf(vals,loc,size){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,vals,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}
 buf(new Float32Array(v),A.p,3);buf(n,A.n,3);buf(new Float32Array(dat),A.d,4);let ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(idx),gl.STATIC_DRAW);gl.bindVertexArray(null);return {vao,count:idx.length,kind};
}
let meshes=[];
function grid(water=false){const nx=192,nz=256,v=[],idx=[],d=[];for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){let x=-16+i*32/nx,z=-SIZE[1]/2+j*SIZE[1]/nz,y=bed(x,z),sd=x-shoreX(z),gm=ss(-.05,.20,x-grassX(z));v.push(x,water?.002:y,z);d.push(water?-y:sd,gm,0,0);}for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){let a=j*(nx+1)+i,b=a+1,c=a+nx+1,e=c+1;idx.push(a,c,b,b,c,e);}return makeMesh(v,idx,d,water?1:0);}
meshes.push(grid(false));
// Cutaway walls share exactly the terrain surface. The depth below the visible surface is an inferred display volume.
function walls(water){const v=[],ix=[],d=[];let edges=[[-16,-SIZE[1]/2,16,-SIZE[1]/2],[16,-SIZE[1]/2,16,SIZE[1]/2],[16,SIZE[1]/2,-16,SIZE[1]/2],[-16,SIZE[1]/2,-16,-SIZE[1]/2]];for(let ed of edges){for(let j=0;j<180;j++){let q=[];for(let u of [j/180,(j+1)/180]){let x=mix(ed[0],ed[2],u),z=mix(ed[1],ed[3],u);q.push([x,z,bed(x,z)]);}if(water&&q.every(p=>p[2]>=0))continue;let base=v.length/3;for(let p of q){let top=water?0:p[2],bottom=water?Math.min(0,p[2]):-6.0;v.push(p[0],top,p[1],p[0],bottom,p[1]);d.push(0,0,0,0,top-bottom,0,0,0);}ix.push(base,base+1,base+2,base+2,base+1,base+3);}}return makeMesh(v,ix,d,water?6:5);}
meshes.push(walls(false));
// A rock formation bounded by traced silhouette points, rather than a tube or a repeated cylinder.
const ridgeControl=[];for(let j=0;j<=36;j++){const tt=j/36,topPix=sample(D.ridge_top_pixels,tt),lowPix=sample(D.ridge_lower_pixels,tt);const lo=surfaceIntersection(lowPix,-.015),r=ray(topPix);const axisA=.37423179676126445,axisB=14.450138487855908;let rayT=(axisA*E[0]+axisB-E[2])/(r[2]-axisA*r[0]);let top=add(E,mul(r,rayT));if(top[1]<.025)top=onPlane(topPix,.025);ridgeControl.push({top,lo,pix:topPix});}
function ridgeMesh(){const v=[],ix=[],d=[],N=216,K=14;for(let j=0;j<=N;j++){let t=j/N,l=(ridgeControl.length-1)*t,a=Math.min(ridgeControl.length-2,Math.floor(l)),f=l-a;let top=ridgeControl[a].top.map((x,k)=>mix(x,ridgeControl[a+1].top[k],f)),lo=ridgeControl[a].lo.map((x,k)=>mix(x,ridgeControl[a+1].lo[k],f));let across=sub(lo,top),back=add(top,mul([across[0],0,across[2]],-.27));back[1]=bed(back[0],back[2]);for(let k=0;k<=K;k++){let u=k/K,p;if(u<.3)p=add(back,mul(sub(top,back),ss(0,.3,u)));else p=add(top,mul(sub(lo,top),(u-.3)/.7));let env=Math.sin(u*Math.PI)*Math.sin(t*Math.PI);let crack=.09*Math.sin(t*147+u*6)+.04*(noise(t*75,u*8)-.5);p[1]+=env*crack;v.push(...p);d.push(0,0,0,0);}}for(let j=0;j<N;j++)for(let k=0;k<K;k++){let a=j*(K+1)+k,b=a+1,c=a+K+1,e=c+1;ix.push(a,c,b,b,c,e);}return makeMesh(v,ix,d,2);}
meshes.push(ridgeMesh());
function verticalHeight(base,pixelTop){let best=0,err=1e9;for(let h=.02;h<4;h+=.005){let p=project(add(base,[0,h,0])),e=Math.hypot(p[0]-pixelTop[0],p[1]-pixelTop[1]);if(e<err){err=e;best=h;}}return best;}
const rocks=[];
D.detached_rocks_pixels.forEach((b,j)=>{let p=onPlane(b[0],0);if(bed(p[0],p[2])>.025)p=surfaceIntersection(b[0],0);let h=verticalHeight(p,b[1]),pp=project(p),p2=project(add(p,[1,0,0])),r=b[2]/Math.hypot(pp[0]-p2[0],pp[1]-p2[1]);r*=.98;rocks.push({p,h,r});const v=[],d=[],ix=[],seg=24,rings=16;for(let a=0;a<=rings;a++){let t=a/rings,y=p[1]+h*(1-t),rad=Math.pow(Math.sin(t*Math.PI*.65),.7);for(let k=0;k<=seg;k++){let ang=k/seg*Math.PI*2,rr=rad*r*(.86+.22*noise(Math.cos(ang)*3+j,t*5)+.13*Math.sin(ang*5+j));v.push(p[0]+Math.cos(ang)*rr,y+.035*Math.sin(ang*3+t*20)*Math.sin(t*Math.PI),p[2]+Math.sin(ang)*rr*.72);d.push(0,0,0,0);}}for(let a=0;a<rings;a++)for(let k=0;k<seg;k++){let q=a*(seg+1)+k;ix.push(q,q+1,q+seg+1,q+1,q+seg+2,q+seg+1);}meshes.push(makeMesh(v,ix,d,2));});
// The avatar dimensions are fitted once against the actual visible height in the reference.
let bodyBase=surfaceIntersection(D.body_pixels.base,.02),bodyH=verticalHeight(bodyBase,D.body_pixels.top);let bp=project(bodyBase),bpx=project(add(bod