const palette={
 reefDark:c4('#173936'), reefMid:c4('#566044'), reefWarm:c4('#85543d'),
 bodyA:c4('#b85f4f'), bodyB:c4('#e49a68'), bodyC:c4('#8f6f59'),
 tip:c4('#f4d6a0'), groove:c4('#3d2631'), rust:c4('#c65f4b'), blue:c4('#4c8990'),
 sandA:c4('#627265'), sandB:c4('#87917a'), fish1:c4('#e6934d'), fish2:c4('#61b8b5'), fish3:c4('#d7c9a3')
};
function addCylinder(m,a,b,r0,r1,col0,col1=col0,segments=9,caps=true){
 const w=norm(sub(b,a));let u=norm(cross(Math.abs(w[1])<.88?[0,1,0]:[1,0,0],w));let v=cross(w,u);
 const ringA=[],ringB=[];
 for(let i=0;i<segments;i++){const q=i/segments*TAU,cs=Math.cos(q),sn=Math.sin(q),n=norm(add(mul(u,cs),mul(v,sn)));ringA.push({p:add(a,mul(n,r0)),n});ringB.push({p:add(b,mul(n,r1)),n})}
 for(let i=0;i<segments;i++){const j=(i+1)%segments,A=ringA[i],B=ringA[j],C=ringB[j],D=ringB[i];m.quad(A.p,B.p,C.p,D.p,col0,col0,col1,col1,A.n,B.n,C.n,D.n)}
 if(caps){for(let i=1;i<segments-1;i++){m.tri(a,ringA[i].p,ringA[i+1].p,col0,col0,col0,mul(w,-1),mul(w,-1),mul(w,-1));m.tri(b,ringB[i+1].p,ringB[i].p,col1,col1,col1,w,w,w)}}
}
function addSphere(m,center,scale,color,lat=8,lon=12,deform=null,colorFn=null,basis=null){
 const B=basis||[[1,0,0],[0,1,0],[0,0,1]];
 const point=(i,j)=>{const th=PI*i/lat,ph=TAU*j/lon,sn=Math.sin(th),base=[sn*Math.cos(ph),Math.cos(th),sn*Math.sin(ph)],f=deform?deform(th,ph,base):1,local=[base[0]*scale[0]*f,base[1]*scale[1]*f,base[2]*scale[2]*f],p=add(center,add(add(mul(B[0],local[0]),mul(B[1],local[1])),mul(B[2],local[2]))),nl=norm([base[0]/Math.max(.001,scale[0]),base[1]/Math.max(.001,scale[1]),base[2]/Math.max(.001,scale[2])]),n=norm(add(add(mul(B[0],nl[0]),mul(B[1],nl[1])),mul(B[2],nl[2]))),c=colorFn?colorFn(th,ph,base,f):color;return{p,n,c}}
 for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const A=point(i,j),B0=point(i+1,j),C=point(i+1,j+1),D=point(i,j+1);m.tri(A.p,C.p,B0.p,A.c,C.c,B0.c,A.n,C.n,B0.n);m.tri(A.p,D.p,C.p,A.c,D.c,C.c,A.n,D.n,C.n)}
}
function addPlate(m,center,R,thickness,params){
 const seg=64,rings=7,top=[],bot=[];
 const sample=(k,j,down=false)=>{const rho=k/rings,q=j/seg*TAU,edge=1+.055*Math.sin(q*(5+Math.round(params.growthWave*2))+params.phase)+.028*Math.sin(q*11-params.phase*.7),rr=R*rho*(1+(rho>.65?(edge-1)*(rho-.65)/.35:0)),wave=(.07+.08*params.secondaryWave)*Math.sin(q*3.0+params.phase)*Math.pow(rho,1.65)+.035*params.roughness*Math.sin(q*13+rho*8),dish=.25*Math.pow(rho,2),y=center[1]+dish+wave+(down?-thickness*(.78+.22*Math.cos(q*4)):0),p=[center[0]+Math.cos(q)*rr,y,center[2]+Math.sin(q)*rr],n=norm([-.12*Math.cos(q),down?-1:1,-.12*Math.sin(q)]),c=cmix(params.colorA,params.colorB,.25+.65*rho);return{p,n,c}}
 for(let k=1;k<=rings;k++){top[k]=[];bot[k]=[];for(let j=0;j<=seg;j++){top[k][j]=sample(k,j,false);bot[k][j]=sample(k,j,true)}}
 const ct={p:[center[0],center[1],center[2]],n:[0,1,0],c:params.colorA},cb={p:[center[0],center[1]-thickness,center[2]],n:[0,-1,0],c:cmix(params.colorA,palette.groove,.35)};
 for(let j=0;j<seg;j++){let A=top[1][j],B=top[1][j+1];m.tri(ct.p,A.p,B.p,ct.c,A.c,B.c,ct.n,A.n,B.n);A=bot[1][j+1];B=bot[1][j];m.tri(cb.p,A.p,B.p,cb.c,A.c,B.c,cb.n,A.n,B.n)}
 for(let k=1;k<rings;k++)for(let j=0;j<seg;j++){const A=top[k][j],B=top[k+1][j],C=top[k+1][j+1],D=top[k][j+1];m.quad(A.p,B.p,C.p,D.p,A.c,B.c,C.c,D.c,A.n,B.n,C.n,D.n);const E=bot[k][j+1],F=bot[k+1][j+1],G=bot[k+1][j],H=bot[k][j];m.quad(E.p,F.p,G.p,H.p,E.c,F.c,G.c,H.c,E.n,F.n,G.n,H.n)}
 for(let j=0;j<seg;j++){const A=top[rings][j],B=bot[rings][j],C=bot[rings][j+1],D=top[rings][j+1],n=norm([Math.cos(j/seg*TAU),.08,Math.sin(j/seg*TAU)]);m.quad(A.p,B.p,C.p,D.p,A.c,cmix(A.c,palette.groove,.28),cmix(D.c,palette.groove,.28),D.c,n,n,n,n)}
}
function floorHeight(x,z){return -.55+.08*Math.sin(x*.37)+.055*Math.cos(z*.49)+.045*Math.sin((x+z)*.74)+.22*Math.exp(-(x*x+z*z)/70)}
function addFloor(m){const N=34,S=36;for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++){const x0=(ix/N-.5)*S,x1=((ix+1)/N-.5)*S,z0=(iz/N-.5)*S,z1=((iz+1)/N-.5)*S;const p=(x,z)=>[x,floorHeight(x,z),z],A=p(x0,z0),B=p(x1,z0),C=p(x1,z1),D=p(x0,z1),col=(x,z)=>cmix(palette.sandA,palette.sandB,.45+.28*Math.sin(x*.28+z*.33));m.quad(A,B,C,D,col(x0,z0),col(x1,z0),col(x1,z1),col(x0,z1))}}
function addWaterSurface(m){const N=16,S=56,y=8.4;const col=[.13,.65,.70,.15];for(let iz=0;iz<N;iz++)for(let ix=0;ix<N;ix++){const x0=(ix/N-.5)*S,x1=((ix+1)/N-.5)*S,z0=(iz/N-.5)*S,z1=((iz+1)/N-.5)*S;const p=(x,z)=>[x,y+.08*Math.sin(x*.23+z*.18),z];m.quad(p(x0,z0),p(x1,z0),p(x1,z1),p(x0,z1),col,col,col,col,[0,-1,0],[0,-1,0],[0,-1,0],[0,-1,0])}}
function addLightShafts(m){for(let i=0;i<5;i++){const x=-8+i*4.1,z=-7+(i%2)*5,a=[x,8.1,z],b=[x+1.9,-.4,z+1.2],alpha=.018+i*.004;addCylinder(m,a,b,.55,1.75,[.55,.95,.88,alpha],[.25,.75,.72,0],10,false)}}
function addReefBase(m,seed,rough){const r=rng32(seed);for(let i=0;i<7;i++){const q=i/7*TAU+r()*.45,rad=.9+r()*1.35,c=[Math.cos(q)*rad-.18,r()*.16-.25,Math.sin(q)*rad],s=[.72+r()*.78,.32+r()*.48,.68+r()*.72],col=cmix(palette.reefDark,cmix(palette.reefWarm,palette.reefMid,r()),.55+r()*.35);addSphere(m,c,s,col,7,10,(th,ph)=>1+rough*.09*Math.sin(ph*5+th*7+i))}}

const morphNames={table:'桌面型 / table',staghorn:'鹿角型 / staghorn',fan:'扇型 / fan',cauliflower:'菜花型 / cauliflower',brain:'脑纹型 / brain'};

function hash01(n){const x=Math.sin(n*12.9898+78.233)*43758.5453123;return x-Math.floor(x)}
function curlish(p,k){return norm([
 Math.sin(p[1]*1.73+p[2]*2.11+k*.71)-Math.cos(p[2]*1.21-k*.33),
 .45*Math.sin(p[0]*1.41-p[2]*1.17+k*.57),
 Math.cos(p[0]*1.89+p[1]*1.33-k*.43)-Math.sin(p[1]*1.07+k*.29)
])}
function projectPlane(v,n){return sub(v,mul(n,dot(v,n)))}
function pointSegment(p,a,b){const ab=sub(b,a),q=dot(ab,ab),t=q>1e-9?clamp(dot(sub(p,a),ab)/q,0,1):0,c=add(a,mul(ab,t));return{d:len(sub(p,c)),t,c}}
function addOrganicTube(m,a,b,r0,r1,c0,c1,rough=.5,seed=1,sides=8){
 const axis=sub(b,a),L=len(axis);if(L<1e-4)return;const w=mul(axis,1/L),u=norm(cross(Math.abs(w[1])<.9?[0,1,0]:[1,0,0],w)),v=cross(w,u),rings=clamp(Math.ceil(L/.28)+1,3,10),rows=[];
 for(let j=0;j<=rings;j++){
  const t=j/rings,center=lerp3(a,b,t),base=mix(r0,r1,t),row=[];
  for(let i=0;i<sides;i++){
   const q=i/sides*TAU,macro=.035*Math.sin((t*5.3+seed*.13)*TAU+q*2.0),micro=.018*Math.sin((t*11.7-seed*.07)*TAU-q*3.0),r=base*(1+rough*(macro+micro)),rad=norm(add(mul(u,Math.cos(q)),mul(v,Math.sin(q)))),p=add(center,mul(rad,r)),col=cmix(c0,c1,t);
   row.push({p,n:rad,c:col});
  }
  rows.push(row);
 }
 for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const k=(i+1)%sides,A=rows[j][i],B=rows[j][k],C=rows[j+1][k],D=rows[j+1][i];m.quad(A.p,B.p,C.p,D.p,A.c,B.c,C.c,D.c,A.n,B.n,C.n,D.n)}
 const na=mul(w,-1),nb=w;for(let i=1;i<sides-1;i++){m.tri(a,rows[0][i+1].p,rows[0][i].p,c0,c0,c0,na,na,na);m.tri(b,rows[rings][i].p,rows[rings][i+1].p,c1,c1,c1,nb,nb,nb)}
}
function grayScott(w,h,seed,steps=440){
 let u=new Float32Array(w*h);u.fill(1);let v=new Float32Array(w*h),u2=new Float32Array(w*h),v2=new Float32Array(w*h);const rng=rng32(seed);
 for(let s=0;s<18;s++){const cx=Math.floor(rng()*w),cy=Math.floor((.12+.76*rng())*h),rad=2+Math.floor(rng()*4);for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++){const xx=(cx+x+w)%w,yy=clamp(cy+y,0,h-1),i=yy*w+xx;if(x*x+y*y<=rad*rad){u[i]=.45+.08*rng();v[i]=.30+.15*rng()}}}
 const Du=.16,Dv=.08,F=.0355,K=.0615,dt=1;
 for(let it=0;it<steps;it++){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,xm=(x+w-1)%w,xp=(x+1)%w,ym=Math.max(0,y-1),yp=Math.min(h-1,y+1),lapU=u[y*w+xm]+u[y*w+xp]+u[ym*w+x]+u[yp*w+x]-4*u[i],lapV=v[y*w+xm]+v[y*w+xp]+v[ym*w+x]+v[yp*w+x]-4*v[i],uvv=u[i]*v[i]*v[i];u2[i]=clamp(u[i]+(Du*lapU-uvv+F*(1-u[i]))*dt,0,1);v2[i]=clamp(v[i]+(Dv*lapV+uvv-(F+K)*v[i])*dt,0,1)}
  [u,u2]=[u2,u];[v,v2]=[v2,v];
 }
 return{w,h,u,v};
}
function sampleGrid(grid,u,v){const {w,h}=grid;u=(u%1+1)%1;v=clamp(v,0,1);const x=u*w-.5,y=v*(h-1),x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0,x1=x0+1,y1=Math.min(h-1,y0+1),ix0=(x0%w+w)%w,ix1=(x1%w+w)%w;const a=grid.v[y0*w+ix0],b=grid.v[y0*w+ix1],c=grid.v[y1*w+ix0],d=grid.v[y1*w+ix1];return mix(mix(a,b,tx),mix(c,d,tx),ty)}
function addAccretivePlate(m,obj){
 const P=obj.plate,seg=72,rings=10,top=[],bot=[];
 const sample=(k,j,down=false)=>{const rho=k/rings,q=j/seg*TAU,R=obj.plateRadius(q),rr=R*rho,topY=obj.plateTop(rr,q),th=P.thickness*(.74+.26*(1-rho)),p=[P.center[0]+Math.cos(q)*rr,topY-(down?th:0),P.center[2]+Math.sin(q)*rr],n=norm([-.08*Math.cos(q),down?-1:1,-.08*Math.sin(q)]),edge=clamp(rho,0,1),c=cmix(palette.bodyA,palette.tip,.12+.62*edge);return{p,n,c}};
 for(let k=1;k<=rings;k++){top[k]=[];bot[k]=[];for(let j=0;j<=seg;j++){top[k][j]=sample(k,j,false);bot[k][j]=sample(k,j,true)}}
 const ct={p:[P.center[0],obj.plateTop(0,0),P.center[2]],n:[0,1,0],c:palette.bodyA},cb={p:[P.center[0],obj.plateTop(0,0)-P.thickness,P.center[2]],n:[0,-1,0],c:cmix(palette.bodyA,palette.groove,.4)};
 for(let j=0;j<seg;j++){m.tri(ct.p,top[1][j].p,top[1][j+1].p,ct.c,top[1][j].c,top[1][j+1].c,ct.n,top[1][j].n,top[1][j+1].n);m.tri(cb.p,bot[1][j+1].p,bot[1][j].p,cb.c,bot[1][j+1].c,bot[1][j].c,cb.n,bot[1][j+1].n,bot[1][j].n)}
 for(let k=1;k<rings;k++)for(let j=0;j<seg;j++){const A=top[k][j],B=top[k+1][j],C=top[k+1][j+1],D=top[k][j+1];m.quad(A.p,B.p,C.p,D.p,A.c,B.c,C.c,D.c,A.n,B.n,C.n,D.n);const E=bot[k][j+1],F=bot[k+1][j+1],G=bot[k+1][j],H=bot[k][j];m.quad(E.p,F.p,G.p,H.p,E.c,F.c,G.c,H.c,E.n,F.n,G.n,H.n)}
 for(let j=0;j<seg;j++){const A=top[rings][j],B=bot[rings][j],C=bot[rings][j+1],D=top[rings][j+1],q=j/seg*TAU,n=norm([Math.cos(q),.12,Math.sin(q)]);m.quad(A.p,B.p,C.p,D.p,A.c,cmix(A.c,palette.groove,.38),cmix(D.c,palette.groove,.38),D.c,n,n,n,n)}
}
