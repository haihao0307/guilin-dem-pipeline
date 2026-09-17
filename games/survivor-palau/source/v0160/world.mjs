// Palau scene adapter. Procedural design coordinates, not a surveyed map.
// Landscape source: workbenches/landscape-mother-v012/build_scene.py@a3511d67,
// tower_field: periodic angular harmonics, localized ledges and solution channels.
// Palau adds a broad dome crown and a tidal notch; no Guilin shape is called Palau truth.
const PALAU_ISLES=Object.freeze([
 [0,0,17,23,14,801],[-210,70,39,48,32,829],[200,25,44,42,31,857],
 [-90,-205,32,37,39,883],[120,-210,40,51,32,911],[-290,-145,31,36,23,937],
 [325,-160,36,45,29,953],[-255,280,43,49,32,977],[-25,230,35,40,28,991],[240,275,49,55,36,1021]
]);
const BED_N=641;
let palauBed=null,palauBedTexture=null,reefDecorGeo=null,tackleGeo=null;
function addKarstDefinitions(){KARST_ROCKS.length=0;KARST_ROCKS.push(...PALAU_ISLES.map(a=>[...a]));}
function periodicRockProfile(a,t,phase){
 // angular distance is periodic, avoiding the former closed-angle seam defect.
 let r=1+.070*Math.sin(5*a+phase)+.030*Math.sin(7*a-phase*.57)+.018*Math.sin(9*a+phase*1.31);
 r+=(.045*Math.sin(a*2+t*5.1+phase*.8)+.03*Math.sin(a*3-t*3.7+phase*1.6))*smooth(.08,.92,t);
 for(let k=0;k<6;k++){const at=phase+k*2.39996+.05*Math.sin(t*5.2+k),d=Math.atan2(Math.sin(a-at),Math.cos(a-at));r-=.038*Math.exp(-((d/.09)**2))*smooth(.04,.16,t)*(1-smooth(.78,.95,t));}
 return r;
}
function rawPalauBed(x,z){
 const radius=Math.hypot(x*.96,z*1.05),n=.5+.5*Math.sin(x*.021+.7*Math.cos(z*.029))*Math.cos(z*.017-x*.009);
 let bed=-18-8*n-48*smooth(355,530,radius);
 for(let i=1;i<PALAU_ISLES.length;i++){
  const [cx,cz,rx,h,rz,s]=PALAU_ISLES[i],dx=x-cx,dz=z-cz;
  const a=Math.atan2(dz/rz,dx/rx),r=Math.hypot(dx/rx,dz/rz),d=(r-1-.07*Math.sin(3*a+s))*(rx+rz)*.5;
  if(d<95){
   const margin=1+.18*Math.sin(2*a+s)+.08*Math.sin(5*a-s),u=Math.max(0,d)/margin;
   const sand=.5+.5*Math.sin(x*.09+Math.sin(z*.037)*2)*Math.sin(z*.084);
   const shelf=-.75-.034*u-.35*n-.38*sand;
   const reef=Math.max(-55,shelf-24*smooth(32,84,u));
   bed=Math.max(bed,reef);
  }
 }
 // A discontinuous common reef bank between islands, cut by a deeper navigation channel.
 const bank=Math.hypot((x+75)/260,(z-145)/195);
 const breaks=.055*Math.sin(x*.043+z*.029)+.04*Math.sin(x*.087-z*.061);
 if(bank+breaks<1.12&&Math.hypot(x,z)>58){
  const flat=-2.3-.7*n-16*smooth(.92,1.12,bank+breaks);
  const channelX=55+22*Math.sin(z*.014),channel=1-smooth(12,31,Math.abs(x-channelX));
  bed=Math.max(bed,flat-15*channel);
 }
 const camp=campBedHeight(x,z);if(Math.hypot(x,z)<120)bed=Math.max(bed,camp-25*smooth(72,120,Math.hypot(x,z)));
 return bed;
}
function samplePalauBed(x,z){
 if(!palauBed)return rawPalauBed(x,z);
 const u=(x-DOMAIN.minX)/DOMAIN.width*(BED_N-1),v=(z-DOMAIN.minZ)/DOMAIN.depth*(BED_N-1);
 if(u<0||v<0||u>=BED_N-1||v>=BED_N-1)return -80;
 const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,k=j*BED_N+i;
 return mix(mix(palauBed[k],palauBed[k+1],a),mix(palauBed[k+BED_N],palauBed[k+BED_N+1],a),b);
}
function bedHeight(x,z){return samplePalauBed(x,z);}
function rebuildPalauBed(){
 palauBed=new Float32Array(BED_N*BED_N);
 for(let j=0;j<BED_N;j++)for(let i=0;i<BED_N;i++)palauBed[j*BED_N+i]=rawPalauBed(mix(DOMAIN.minX,DOMAIN.maxX,i/(BED_N-1)),mix(DOMAIN.minZ,DOMAIN.maxZ,j/(BED_N-1)));
 if(!palauBedTexture)palauBedTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,palauBedTexture);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,BED_N,BED_N,0,gl.RED,gl.FLOAT,palauBed);
}
function karstApproxTop(x,z){return rockField?.sample(x,z)??-1e9;}
class PalauGeometry{
 constructor(){this.v=[];this.i=[];}
 vertex(p,kind=1){const i=this.v.length/7;this.v.push(...p,0,0,0,kind);return i;}
 tri(a,b,c){const v=this.v,A=a*7,B=b*7,C=c*7,ux=v[B]-v[A],uy=v[B+1]-v[A+1],uz=v[B+2]-v[A+2],vx=v[C]-v[A],vy=v[C+1]-v[A+1],vz=v[C+2]-v[A+2],n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];if(Math.hypot(...n)<1e-9)return;this.i.push(a,b,c);for(const k of [A,B,C])for(let j=0;j<3;j++)v[k+3+j]+=n[j];}
 sphere(cx,cy,cz,rx,ry,rz,kind=4,seed=0,lat=6,lon=10){
  const b=this.v.length/7;this.vertex([cx,cy+ry,cz],kind);
  for(let j=1;j<lat;j++)for(let i=0;i<lon;i++){const t=j/lat*Math.PI,a=i/lon*TAU,nx=Math.sin(t)*Math.cos(a),ny=Math.cos(t),nz=Math.sin(t)*Math.sin(a),q=1+.10*Math.sin(a*3+seed)*Math.sin(t*2)+.045*Math.sin(a*7-seed)*Math.sin(t);this.vertex([cx+rx*nx*q,cy+ry*ny*q,cz+rz*nz*q],kind);}
  const end=this.vertex([cx,cy-ry,cz],kind);
  for(let i=0;i<lon;i++)this.tri(b,b+1+(i+1)%lon,b+1+i);
  for(let j=0;j<lat-2;j++)for(let i=0;i<lon;i++){const a=b+1+j*lon+i,c=b+1+j*lon+(i+1)%lon;this.tri(a,c,a+lon);this.tri(c,c+lon,a+lon);}
  for(let i=0;i<lon;i++)this.tri(end,b+1+(lat-2)*lon+i,b+1+(lat-2)*lon+(i+1)%lon);
 }
 tube(a,b,r,kind=6,sides=7){
  const d=normalize3(sub3(b,a)),u=normalize3(cross3(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),v=cross3(d,u),k=this.v.length/7;
  for(const p of [a,b])for(let j=0;j<sides;j++){const t=j/sides*TAU;this.vertex(p.map((x,i)=>x+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t))),kind);}
  for(let j=0;j<sides;j++){const n=(j+1)%sides;this.tri(k+j,k+n,k+j+sides);this.tri(k+n,k+n+sides,k+j+sides);}
 }
 finish(){for(let i=0;i<this.v.length;i+=7){const n=normalize3(this.v.slice(i+3,i+6));this.v[i+3]=n[0];this.v[i+4]=n[1];this.v[i+5]=n[2];}return{data:new Float32Array(this.v),indices:new Uint32Array(this.i),degenerate:0,windingCorrections:0};}
 upload(){const g=this.finish();return mesh(gl,g.data,g.indices);}
}
function rockGeometry(defs){
 const coast=coastRockGeometry(defs.filter(d=>d[5]<800)),g=new PalauGeometry();g.v=Array.from(coast.data);g.i=Array.from(coast.indices);
 // Recompute normals for all joined geometry, once at construction.
 for(let i=0;i<g.v.length;i+=7){g.v[i+3]=0;g.v[i+4]=0;g.v[i+5]=0;}
 const oldI=[...g.i];g.i=[];for(let i=0;i<oldI.length;i+=3)g.tri(...oldI.slice(i,i+3));
 for(const [cx,cz,rx,h,rz,seed]of defs.filter(d=>d[5]>=800)){
  const lon=72,rows=30,b=g.v.length/7,base=-4,phase=seed*.173;
  for(let j=0;j<rows;j++){
   const t=j/(rows-1),y=base+(h-base)*t;
   const cap=Math.sqrt(Math.max(.0005,1-Math.max(0,(y-4)/(h-4))**2));
   const notch=1-.18*Math.exp(-(((y-.6)/1.3)**2));
   for(let i=0;i<lon;i++){const a=i/lon*TAU,rad=cap*notch*periodicRockProfile(a,t,phase),lean=.035*Math.sin(t*2.8+phase)*t;
    g.vertex([cx+rx*(Math.cos(a)*rad+lean),y+.28*Math.sin(a*3+phase)*Math.sin(t*Math.PI),cz+rz*(Math.sin(a)*rad+.04*Math.sin(t*3.2-phase)*t)],1);
   }
  }
  for(let j=0;j<rows-1;j++)for(let i=0;i<lon;i++){const a=b+j*lon+i,c=b+j*lon+(i+1)%lon;g.tri(a,a+lon,c);g.tri(c,a+lon,c+lon);}
  const top=g.vertex([cx+rx*.035*Math.sin(2.8+phase),h+.04,cz+rz*.04*Math.sin(3.2-phase)],1),bottom=g.vertex([cx,base,cz],1);
  for(let i=0;i<lon;i++){const n=(i+1)%lon;g.tri(top,b+(rows-1)*lon+n,b+(rows-1)*lon+i);g.tri(bottom,b+i,b+n);}
 }
 return g.finish();
}
function palauForestMesh(){
 const g=new PalauGeometry(),rng=new RNG(0x504c3630);let count=0;
 for(let k=0;k<PALAU_ISLES.length;k++){
  const [cx,cz,rx,h,rz,seed]=PALAU_ISLES[k],n=k===0?90:160;
  for(let i=0;i<n;i++){
   const a=i*2.399963+seed,r=Math.sqrt((i+.5)/n)*.985,x=cx+Math.cos(a)*rx*r,z=cz+Math.sin(a)*rz*r,y=rockField.sample(x,z);
   if(y<3||y>h+4)continue;
   const size=(k===0?2.3:4.4)*(.72+rng.next()*.65),crownY=y+.1;
   g.sphere(x,crownY,z,size,size*.69,size*(.82+rng.next()*.34),4,seed+i,5,9);
   if(i%3===0)g.sphere(x+size*.37,crownY+size*.28,z-size*.19,size*.65,size*.50,size*.62,4,seed-i,4,8);
   count++;
  }
 }
 // Camp's lower woodland is grounded in the same terrain; retain a sandy landing cove.
 for(let i=0;i<70;i++){const a=i*2.39996,r=14+Math.sqrt(rng.next())*11,x=Math.cos(a)*r,z=Math.sin(a)*r,y=bedHeight(x,z);if(y>1.8&&rockField.sample(x,z)<y+1&&!(x>8&&z>0)){g.sphere(x,y+1.6,z,2.5,2.2,2.4,4,i,5,9);count++;}}
 VEGETATION_COUNT=count;return g.upload();
}
function buildReefDecor(){
 const g=new PalauGeometry(),rng=new RNG(0x52454546);let colonies=0;
 for(let i=0;i<1400;i++){
  const island=PALAU_ISLES[1+i%9],a=rng.next()*TAU,r=1.04+rng.next()*.95,x=island[0]+Math.cos(a)*island[2]*r,z=island[1]+Math.sin(a)*island[4]*r,y=bedHeight(x,z);
  if(y>-.65||y< -7)continue;
  const sc=.32+rng.next()*.85,kind=7+i%3;
  if(i%3===0){g.sphere(x,y+.24*sc,z,1.1*sc,.19*sc,.9*sc,kind,i,4,9);g.sphere(x,y+.52*sc,z,.70*sc,.16*sc,.6*sc,kind,i+9,4,8);}
  else if(i%3===1){g.sphere(x,y+.33*sc,z,.55*sc,.44*sc,.61*sc,kind,i,5,8);}
  else{for(let j=0;j<4;j++){const t=j*1.57;g.tube([x,y-.05,z],[x+Math.cos(t)*.42*sc,y+.55*sc,z+Math.sin(t)*.42*sc],.075*sc,kind,5);}}
  colonies++;
 }
 function disk(x,z,r,thick,angle){const y=bedHeight(x,z)+r*.92,k=g.v.length/7,N=64,cs=Math.cos(angle),sn=Math.sin(angle),rs=[r*.19,r*.23,r*.93,r];
  for(let face=0;face<2;face++)for(let j=0;j<4;j++)for(let i=0;i<N;i++){const a=i/N*TAU,rr=rs[j]*(1+.018*Math.sin(a*5+3.2)+.01*Math.sin(a*11)),u=Math.cos(a)*rr,v=Math.sin(a)*rr,w=(face?1:-1)*thick*(j===0||j===3?.37:.5);g.vertex([x+u*cs-w*sn,y+v,z+u*sn+w*cs],1);}
  const tri=(a,b,c,flip)=>flip?g.tri(a,c,b):g.tri(a,b,c);
  for(let f=0;f<2;f++)for(let j=0;j<3;j++)for(let i=0;i<N;i++){const a=k+f*4*N+j*N+i,b=k+f*4*N+j*N+(i+1)%N;tri(a,b,a+N,!!f);tri(b,b+N,a+N,!!f);}
  for(const j of [0,3])for(let i=0;i<N;i++){const a=k+j*N+i,b=k+j*N+(i+1)%N;tri(a,a+4*N,b,j===0);tri(b,a+4*N,b+4*N,j===0);}
 }
 disk(18,10,1.55,.36,-.22);disk(21.2,9,.88,.25,.25);disk(16.1,8.2,.55,.19,-.35);
 qa.coralColonyCount=colonies;qa.stoneMoneyCount=3;return g.upload();
}
