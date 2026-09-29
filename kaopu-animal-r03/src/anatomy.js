import * as THREE from 'three';
export {THREE};
export const VERSION='K3.0.0';
export const SCHEMA=Object.freeze({
 B:{name:'北极熊',params:['体长 m（假设）','体躯丰满度','站距','毛长 m','种子'],defaults:[2.7,1,1,.025,41],colors:['e9e3d3']},
 E:{name:'白头海雕',params:['翼展 m（假设）','左翼上举 °','右翼上举 °','尾羽展开','种子'],defaults:[2.04,10,24,.85,73],colors:['40352b','ebe8d9','c39a36']},
 T:{name:'陆龟 · 未定种',params:['背甲长度 m（假设）','背甲隆起','伸颈系数','站距','种子'],defaults:[1.25,1,.85,1,19],colors:['5b594c','797568']}
});
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rand(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const noise=(x,y,z)=>.5*Math.sin(x*16.7+y*19.3+z*8.1)*Math.sin(x*9.1-y*11.4+z*17.7)+.25*Math.sin(x*43.2+y*31.1-z*29.3);
export function parseScore(text){
 if(typeof text!=='string'||text.length>512)throw Error('谱子必须为不超过 512 字符的文本');
 const m=text.trim().match(/^K3\|([BET])((?:,-?(?:\d+(?:\.\d*)?|\.\d+)){0,5})(?:#([0-9a-fA-F,]+))?$/);
 if(!m)throw Error('需要 K3|B、K3|E 或 K3|T 动物谱；不执行 JavaScript');
 const kind=m[1],schema=SCHEMA[kind],p=[...schema.defaults],args=m[2].slice(1).split(',').filter(Boolean).map(Number);
 args.forEach((v,i)=>p[i]=v);
 const limits=kind==='B'?[[.3,6],[.65,1.4],[.7,1.4],[0,.055],[0,1000000]]:kind==='E'?[[.4,4],[-20,50],[-20,50],[.3,1.5],[0,1000000]]:[[.2,2.5],[.65,1.3],[.4,1.3],[.7,1.3],[0,1000000]];
 p.forEach((v,i)=>{if(!Number.isFinite(v)||v<limits[i][0]||v>limits[i][1])throw Error(`${schema.params[i]} 超出 ${limits[i].join('—')}`);});
 if(!Number.isInteger(p[4]))throw Error('种子必须为整数');
 const colors=m[3]?m[3].split(','):schema.colors;
 if(colors.length!==schema.colors.length||colors.some(c=>!/^([a-f\d]{3}|[a-f\d]{6})$/i.test(c)))throw Error('颜色数量或十六进制格式不正确');
 return {kind,p,colors:colors.map(c=>'#'+c),text:text.trim()};
}
function geometry(pos,idx=null,col=null,norm=null){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));if(idx)g.setIndex(idx);if(col)g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));if(norm)g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));else g.computeVertexNormals();g.computeBoundingBox();return g;}
function surface(fn,nu=64,nv=48){let pos=[],idx=[],cols=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const r=fn(i/nu,j/nv);pos.push(...r.p);if(r.c)cols.push(...r.c);}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){let a=i*(nv+1)+j,b=a+nv+1;idx.push(a,a+1,b,b,a+1,b+1);}return geometry(pos,idx,cols.length?cols:null);}
function mat(color,roughness=.9){return new THREE.MeshStandardMaterial({color,roughness,metalness:0});}
function mesh(root,g,m,name){const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
function ell(root,c,r,m,name='detail',rot=null){const g=new THREE.SphereGeometry(1,24,16);g.scale(...r);if(rot)g.rotateX(rot);g.translate(...c);return mesh(root,g,m,name);}
function curveMesh(root,points,radii,m,name='curve',steps=36,sides=10){
 const path=new THREE.CatmullRomCurve3(points.map(p=>V(...p))), frames=path.computeFrenetFrames(steps,false);
 const g=surface((u,v)=>{const pt=path.getPoint(u),f=u*steps,a=Math.min(Math.floor(f),steps-1),t=f-a;
 const n=frames.normals[a].clone().lerp(frames.normals[a+1],t).normalize(),b=frames.binormals[a].clone().lerp(frames.binormals[a+1],t).normalize();
 const ri=u*(radii.length-1),k=Math.min(Math.floor(ri),radii.length-2),w=ri-k,r=THREE.MathUtils.lerp(radii[k],radii[k+1],w);
 pt.addScaledVector(n,Math.cos(v*Math.PI*2)*r).addScaledVector(b,Math.sin(v*Math.PI*2)*r);return {p:pt.toArray()};},steps,sides);
 return mesh(root,g,m,name);
}
function smoothmin(a,b,k){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
// Sample a continuous signed-distance body. Ellipsoids are control volumes, never visible component meshes.
function bodySurface(parts,min,max,step=.032,k=.10,wrinkle=0){
 const nx=Math.ceil((max[0]-min[0])/step)+1,ny=Math.ceil((max[1]-min[1])/step)+1,nz=Math.ceil((max[2]-min[2])/step)+1;
 const sx=(max[0]-min[0])/(nx-1),sy=(max[1]-min[1])/(ny-1),sz=(max[2]-min[2])/(nz-1),n=nx*ny*nz;
 const f=new Float32Array(n),gr=new Float32Array(n*3);
 const pp=parts.map(p=>[...p.slice(0,3),1/p[3],1/p[4],1/p[5],Math.min(...p.slice(3,6))]);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  let wx=min[0]+x*sx,wy=min[1]+y*sy,wz=min[2]+z*sz,d=1e4;
  for(const p of pp){const xx=(wx-p[0])*p[3],yy=(wy-p[1])*p[4],zz=(wz-p[2])*p[5];const q=(Math.sqrt(xx*xx+yy*yy+zz*zz)-1)*p[6];d=smoothmin(d,q,k);}
  f[x+nx*(y+ny*z)]=d+wrinkle*noise(wx*2,wy*2,wz*2);
 }
 for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){let i=x+nx*(y+ny*z);gr[3*i]=(f[i+1]-f[i-1])/(2*sx);gr[3*i+1]=(f[i+nx]-f[i-nx])/(2*sy);gr[3*i+2]=(f[i+nx*ny]-f[i-nx*ny])/(2*sz);}
 const offsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],pos=[],norm=[];
 function edge(a,b){let t=f[a[0]]/(f[a[0]]-f[b[0]]),p=[],g=[];for(let j=0;j<3;j++){p[j]=a[j+1]+t*(b[j+1]-a[j+1]);g[j]=gr[3*a[0]+j]+t*(gr[3*b[0]+j]-gr[3*a[0]+j]);}const len=Math.hypot(...g)||1;return [p,g.map(v=>v/len)];}
 function tri(a,b,c){const u=b[0].map((v,i)=>v-a[0][i]),v=c[0].map((v,i)=>v-a[0][i]),cr=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(cr.reduce((s,v,i)=>s+v*a[1][i],0)<0)[b,c]=[c,b];for(const q of [a,b,c]){pos.push(...q[0]);norm.push(...q[1]);}}
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const ids=offsets.map(([a,b,c])=>[x+a+nx*(y+b+ny*(z+c)),min[0]+(x+a)*sx,min[1]+(y+b)*sy,min[2]+(z+c)*sz]);let ins=0;for(const q of ids)if(f[q[0]]<0)ins++;if(ins===0||ins===8)continue;
  for(const tet of tets){const inside=[],outside=[];for(const j of tet)(f[ids[j][0]]<0?inside:outside).push(ids[j]);if(!inside.length||!outside.length)continue;
   if(inside.length===1)tri(...outside.map(b=>edge(inside[0],b)));
   else if(outside.length===1)tri(...inside.map(a=>edge(a,outside[0])));
   else {const a=edge(inside[0],outside[0]),b=edge(inside[0],outside[1]),c=edge(inside[1],outside[0]),d=edge(inside[1],outside[1]);tri(a,b,c);tri(b,d,c);}
  }
 }
 return geometry(pos,null,null,norm);
}
function coloredBody(g,color,amount=.05){const c=new THREE.Color(color),p=g.attributes.position.array,cols=[];for(let i=0;i<p.length;i+=3){const n=1+amount*noise(p[i],p[i+1],p[i+2]);cols.push(c.r*n,c.g*n,c.b*n);}g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));return g;}
// Real tapered strands, sampled by triangle area; seeded, groomed and shorter around face/paws.
function fur(root,g,color,length,seed,density=42000){if(length<=0)return;const p=g.attributes.position,n=g.attributes.normal,ids=g.index,cdf=[],triCount=(ids?ids.count:p.count)/3;let sum=0;const a=V(),b=V(),c=V();
 for(let j=0;j<triCount;j++){let is=[0,1,2].map(k=>ids?ids.getX(j*3+k):j*3+k);a.fromBufferAttribute(p,is[0]);b.fromBufferAttribute(p,is[1]);c.fromBufferAttribute(p,is[2]);sum+=b.sub(a).cross(c.sub(a)).length()/2;cdf.push(sum);}
 const rng=rand(seed),pos=[],nor=[],col=[],base=new THREE.Color(color);
 for(let i=0;i<density;i++){const pick=rng()*sum;let l=0,r=triCount-1;while(l<r){const m=(l+r)>>1;if(cdf[m]<pick)l=m+1;else r=m;}let is=[0,1,2].map(k=>ids?ids.getX(l*3+k):l*3+k);let u=Math.sqrt(rng()),v=rng(),w=[1-u,u*(1-v),u*v],pt=V(),normal=V();for(let k=0;k<3;k++){pt.addScaledVector(a.fromBufferAttribute(p,is[k]),w[k]);normal.addScaledVector(a.fromBufferAttribute(n,is[k]),w[k]);}normal.normalize();
  if(pt.y<.055)continue;let len=length*(.65+rng()*.8);if(pt.z>1.05)len*=.25;if(pt.y<.32)len*=.55;
  let groom=V(0,-.23,-.8),dir=normal.clone().multiplyScalar(.6).add(groom).normalize(),side=normal.clone().cross(dir);if(side.lengthSq()<.0001)side=V(1,0,0);side.normalize().multiplyScalar(len*.045);
  let middle=pt.clone().addScaledVector(normal,len*.30).addScaledVector(dir,len*.38),tip=pt.clone().addScaledVector(normal,len*.2).addScaledVector(dir,len),v0=pt.clone().sub(side),v1=pt.clone().add(side),v2=middle.clone().sub(side.clone().multiplyScalar(.5)),v3=middle.clone().add(side.clone().multiplyScalar(.5));
  const light=.80+rng()*.28;for(const point of [v0,v1,v2,v1,v3,v2,v2,v3,tip]){pos.push(...point.toArray());nor.push(...normal.toArray());col.push(base.r*light,base.g*light,base.b*light);}
 }
 const m=mat('#ffffff');m.vertexColors=true;m.side=THREE.DoubleSide;mesh(root,geometry(pos,null,col,nor),m,'seeded-groomed-fur');
}
function eye(root,center,radius,iris='#251e16',direction=[0,0,1]){const white=mat('#251f15',.3),ir=mat(iris,.28),black=mat('#080909',.18);const d=V(...direction).normalize();ell(root,center,[radius,radius*.76,radius*.65],white,'eye-socket');let c=V(...center).addScaledVector(d,radius*.40);ell(root,c.toArray(),[radius*.70,radius*.60,radius*.38],ir,'iris');c.addScaledVector(d,radius*.17);ell(root,c.toArray(),[radius*.34,radius*.47,radius*.20],black,'pupil');}
function bear(s){const root=new THREE.Group(),[size,bulk,stance,hair,seed]=s.p,col=s.colors[0],coat=mat('#ffffff');coat.vertexColors=true;
 const parts=[
 [0,1.18,-.32,.48*bulk,.57,1.03],[0,1.18,-.87,.43*bulk,.54,.49],[0,1.30,.28,.48*bulk,.59,.56],
 [0,1.32,.63,.34,.43,.52],[0,1.42,.92,.275,.30,.39],[0,1.44,1.16,.235,.24,.29],
 [0,1.32,1.41,.148,.155,.31],[0,1.255,1.47,.13,.08,.22],
 ];
 for(const side of [-1,1]){const x=side*.355*stance;
 parts.push([x,1.02,.40,.245,.48,.29],[x,.60,.50,.19,.39,.21],[x,.30,.58,.165,.26,.20],[x,.13,.72,.22,.135,.32],
 [x,.99,-.78,.27,.40,.35],[x,.61,-.77,.23,.34,.24],[x,.27,-.90,.15,.24,.20],[x,.115,-.77,.195,.125,.29]);}
 parts.push([0,1.22,-1.36,.08,.12,.14]);
 const g=coloredBody(bodySurface(parts,[-1,-.08,-1.58],[1,2.02,1.85],.032,.10,.002),col,.065);mesh(root,g,coat,'continuous-quadruped-skin');fur(root,g,col,hair,seed);
 const dark=mat('#141817',.32),nose=mat('#111718',.28),inside=mat('#ada999',1);
 ell(root,[0,1.34,1.685],[.107,.085,.069],nose,'nasal-pad');
 for(const side of [-1,1]){ell(root,[side*.061,1.35,1.735],[.025,.019,.008],dark,'nostril');eye(root,[side*.18,1.485,1.315],.031,'#46392b',[side*.5,0,1]);
  ell(root,[side*.224,1.638,1.055],[.09,.11,.052],mat(col),'rounded-pinna');
  ell(root,[side*.229,1.648,1.099],[.049,.067,.012],inside,'ear-cavity');
  for(const z of [.72,-.77])for(let t=0;t<5;t++){const x=side*.355*stance+(t-2)*.07;curveMesh(root,[[x,.115,z+.24],[x,.09,z+.31],[x,.035,z+.34]],[.018,.014,.001],dark,'claw',10,6);}
 }
 curveMesh(root,[[-.128,1.235,1.41],[0,1.225,1.64],[.128,1.235,1.41]],[.006,.005,.006],dark,'mouth-seam',30,5);
 {const b=new THREE.Box3().setFromObject(root);root.scale.setScalar(size/(b.max.z-b.min.z));}root.userData.landmark='body:quadruped;ears:paired;eyes:paired;feet:4;claws:20';return root;}
// Curved asymmetric feather vanes; the shaft and barbs are geometry rather than textures.
function featherBatch(){return {pos:[],col:[]};}
function feather(batch,start,end,width,color,rng,shape=1){const a=V(...start),d=V(...end).sub(a),side=V(d.y,-d.x,0).normalize(),base=new THREE.Color(color),rows=16,cols=6,points=[],colors=[];
 for(let i=0;i<=rows;i++){const u=i/rows,prof=Math.pow(Math.sin(Math.PI*Math.pow(u,.72)),.55)*width;for(let j=0;j<=cols;j++){const v=j/cols*2-1,ww=prof*v*(v<0?.85:1.12),p=a.clone().addScaledVector(d,u).addScaledVector(side,ww);
 p.z+=.013*Math.sin(Math.PI*u)*(1-Math.abs(v))+.004*Math.sin(u*140+Math.abs(v)*8)*Math.sin(Math.PI*u);p.y-=.017*u*u*shape;
 const rachis=Math.exp(-v*v*120),edge=Math.pow(Math.abs(v),9),pattern=.90+.10*Math.sin(u*94-Math.abs(v)*13),shade=pattern+.14*edge+.08*rachis;
 points.push(p);colors.push([base.r*shade,base.g*shade,base.b*shade]);}}
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;for(const k of [a,b,a+1,b,b+1,a+1]){batch.pos.push(...points[k].toArray());batch.col.push(...colors[k]);}}
}
function finishFeathers(root,batch,name){const m=mat('#ffffff',.94);m.vertexColors=true;m.side=THREE.DoubleSide;return mesh(root,geometry(batch.pos,null,batch.col),m,name);}
function eagle(s){const root=new THREE.Group(),[span,left,right,fan,seed]=s.p,[dark,white,gold]=s.colors,rng=rand(seed);
 const bodyG=coloredBody(bodySurface([[0,.66,0,.125,.30,.14],[0,.90,.045,.12,.17,.13],[0,1.052,.105,.11,.135,.12],[0,1.122,.13,.098,.09,.112]],[-.25,.28,-.24],[.25,1.25,.32],.012,.035,.0005),dark,.18);
 const col=bodyG.attributes.color,p=bodyG.attributes.position;const dc=new THREE.Color(dark),wc=new THREE.Color(white);
 for(let i=0;i<p.count;i++){let y=p.getY(i),x=p.getX(i),z=p.getZ(i),h=y>(.965+.014*noise(x*8,y*8,z*8)),c=h?wc:dc;let shade=.94+.06*noise(x*7,y*7,z*7);col.setXYZ(i,c.r*shade,c.g*shade,c.b*shade);}
 const bodyMat=mat('#ffffff');bodyMat.vertexColors=true;mesh(root,bodyG,bodyMat,'continuous-avian-trunk');
 const chest=featherBatch();for(let i=0;i<500;i++){let y=.40+rng()*.58,theta=rng()*Math.PI*2,ry=Math.sqrt(Math.max(.02,1-Math.pow((y-.70)/.35,2))),x=.126*ry*Math.cos(theta),z=.139*ry*Math.sin(theta)+.02;const c=y>.96?white:dark;feather(chest,[x,y,z],[x*.98,y-.055-rng()*.035,z+.008*Math.sign(z)],.015,c,rng);}
 finishFeathers(root,chest,'body-coverts');
 const wings=[];
 for(const sign of [-1,1]){const wing=new THREE.Group();wing.position.set(sign*.10,.88,0);root.add(wing);wings.push(wing);const batch=featherBatch();
  const patch=surface((u,v)=>{let x=.67*u,y=.07*Math.sin(Math.PI*u)+.05*u-(.13+.09*Math.sin(u*Math.PI))*v,z=-.035+.045*Math.sin(Math.PI*v);return{p:[sign*x,y,z]};},36,12);const wm=mat(dark);wm.side=THREE.DoubleSide;mesh(wing,patch,wm,'wing-leading-surface');
  for(let i=0;i<16;i++){const u=i/15,x=.035+.56*u,y=.075*Math.sin(Math.PI*u);let c=new THREE.Color(dark).multiplyScalar(.84+.25*rng()).getHexString();feather(batch,[sign*x,y,.0],[sign*(x+.025),y-.31+.035*u,.01],.044,'#'+c,rng);}
  for(let i=0;i<10;i++){const u=i/9,x=.50+.14*u,y=.01+.06*u,angle=-1.12+1.69*u,len=.36+.08*Math.sin(Math.PI*u);const ex=x+Math.cos(angle)*len,ey=y+Math.sin(angle)*len;
   feather(batch,[sign*x,y,-.015],[sign*ex,ey,.012+.015*u],.036*(1-.2*u),dark,rng);}
  for(let row=0;row<4;row++)for(let i=0;i<23;i++){const u=i/22,x=.025+.66*u,y=.075*Math.sin(Math.PI*u)-row*.035;const cc=new THREE.Color(dark).multiplyScalar(1.05+.30*rng());
   feather(batch,[sign*x,y,.035+row*.002],[sign*(x+.026),y-.10-row*.008,.04],.024,cc,rng);}
  finishFeathers(wing,batch,'layered-remiges-and-coverts');wing.rotation.z=sign*THREE.MathUtils.degToRad(sign<0?left:right);
 }
 const tail=featherBatch();for(let i=0;i<12;i++){let a=(i-5.5)*.066*fan;feather(tail,[i*.006-.033,.44,-.045],[Math.sin(a)*.32,.12+Math.abs(a)*.055,-.08],.033,white,rng);}finishFeathers(root,tail,'twelve-tail-vanes');
 const gmat=mat(gold,.58),claw=mat('#302d24',.42);
 curveMesh(root,[[0,1.105,.215],[0,1.098,.28],[0,1.075,.327],[0,1.015,.329]],[.043,.035,.021,.001],gmat,'hooked-upper-beak',30,14);
 curveMesh(root,[[0,1.073,.212],[0,1.052,.27],[0,1.038,.309]],[.025,.022,.001],gmat,'lower-mandible',20,12);
 for(const sign of [-1,1]){eye(root,[sign*.084,1.133,.190],.0155,'#ae842e',[sign*.5,0,1]);
 curveMesh(root,[[sign*.06,1.15,.207],[sign*.09,1.154,.186],[sign*.105,1.14,.15]],[.009,.012,.005],mat(white),'brow',18,7);
 ell(root,[sign*.027,1.111,.266],[.006,.004,.007],claw,'beak-nares');
 curveMesh(root,[[sign*.07,.53,.055],[sign*.073,.39,.10],[sign*.065,.29,.14]],[.035,.027,.019],gmat,'tarsus',24,10);
 for(let toe=0;toe<3;toe++){const x=sign*.065+(toe-1)*.025,xx=x+(toe-1)*.02;curveMesh(root,[[x,.30,.14],[xx,.255,.19],[xx,.24,.235]],[.012,.009,.005],gmat,'toe',12,7);curveMesh(root,[[xx,.24,.235],[xx,.21,.24],[xx,.188,.21]],[.006,.004,.0005],claw,'talon',12,6);}
 curveMesh(root,[[sign*.066,.29,.14],[sign*.09,.25,.085],[sign*.09,.20,.08]],[.012,.01,.001],claw,'rear-talon',15,7);
 }
 {const b=new THREE.Box3().setFromObject(root);root.scale.setScalar(span/(b.max.x-b.min.x));}root.userData.landmark='wings:2;primaries:10/side;tail:12;feet:2;eyes:paired';return root;}
function shellScutes(x,z){const sites=[];for(let i=0;i<5;i++)sites.push([0,(i-2)*.33]);for(const sign of [-1,1])for(let i=0;i<4;i++)sites.push([sign*.48,(i-1.5)*.35]);for(let i=0;i<24;i++){let a=i*Math.PI/12;sites.push([.97*Math.cos(a),.97*Math.sin(a)]);}let d1=1e6,d2=1e6,a1=0,a2=0;
 for(let i=0;i<sites.length;i++){const d=Math.pow(x-sites[i][0],2)+Math.pow(z-sites[i][1],2);if(d<d1){d2=d1;a2=a1;d1=d;a1=i;}else if(d<d2){d2=d;a2=i;}}
 const edge=(d2-d1)/(2*Math.hypot(sites[a1][0]-sites[a2][0],sites[a1][1]-sites[a2][1]));return {edge,r:Math.sqrt(d1),i:a1};}
function tortoise(s){const root=new THREE.Group(),[len,dome,neck,stance,seed]=s.p,[shell,skin]=s.colors;
 const base=new THREE.Color(shell),shellG=surface((u,v)=>{const th=u*Math.PI*.5,ph=v*Math.PI*2,xx=Math.sin(th)*Math.cos(ph),zz=Math.sin(th)*Math.sin(ph),sc=shellScutes(xx,zz);
 const seam=Math.exp(-Math.pow(sc.edge/.011,2)),rings=.0025*Math.sin(sc.r*230),bulge=.02*(1-Math.exp(-sc.edge*38)),front=Math.pow(Math.max(0,Math.sin(ph)),14);
 const x=.55*xx*(1+.025*Math.sin(ph*5)*Math.pow(u,6)),z=.77*zz,y=.29+.60*dome*Math.cos(th)+.15*front*Math.pow(u,6)+bulge-.014*seam+rings*Math.sin(th);
 const shade=.91+.12*noise(xx*2,zz*2,.4)+.018*Math.sin(sc.r*230)-.45*seam+.08*Math.exp(-sc.edge*15);return{p:[x,y,z],c:[base.r*shade,base.g*shade,base.b*shade]};},104,192);
 const sm=mat('#ffffff');sm.vertexColors=true;sm.side=THREE.DoubleSide;mesh(root,shellG,sm,'domed-scute-shell');
 const rimPoints=[];for(let i=0;i<=96;i++){let a=i/96*Math.PI*2;rimPoints.push([.55*Math.cos(a),.298+.15*Math.pow(Math.max(0,Math.sin(a)),14),.77*Math.sin(a)]);}curveMesh(root,rimPoints,Array(3).fill(.018),mat(shell),'thick-marginal-rim',150,8);
 const parts=[[0,.30,-.03,.47,.21,.66],[0,.37,.60,.16,.17,.30],[0,.32,.80+neck*.06,.12,.13,.25],[0,.29,.97+neck*.11,.145,.12,.18]];
 for(const side of [-1,1]){const x=side*.47*stance;parts.push([side*.36,.34,.39,.185,.22,.23],[x,.22,.52,.17,.22,.18],[side*.57*stance,.105,.64,.19,.11,.21],[side*.36,.31,-.42,.20,.20,.22],[x,.15,-.55,.15,.17,.18],[side*.50*stance,.085,-.62,.17,.10,.18]);}
 const g=coloredBody(bodySurface(parts,[-.95,-.04,-.95],[.95,.68,1.42],.022,.055,.003),skin,.30),skinMat=mat('#ffffff');skinMat.vertexColors=true;mesh(root,g,skinMat,'continuous-scaled-limbs-and-neck');
 const rng=rand(seed),p=g.attributes.position,n=g.attributes.normal;
 const scaleG=new THREE.CylinderGeometry(1,1.13,.18,6,1);scaleG.rotateX(Math.PI/2);
 const plateMat=mat(new THREE.Color(skin).multiplyScalar(.85));const inst=new THREE.InstancedMesh(scaleG,plateMat,900),q=new THREE.Quaternion(),matrix=new THREE.Matrix4();let count=0;
 for(let attempt=0;attempt<18000&&count<900;attempt++){const i=Math.floor(rng()*p.count),pt=V().fromBufferAttribute(p,i),nr=V().fromBufferAttribute(n,i);if(pt.y<.04||pt.y>.48||Math.abs(pt.x)<.26||pt.z<-.79||nr.y<-.1)continue;const size=.017+rng()*.014;
 pt.addScaledVector(nr,.003);q.setFromUnitVectors(V(0,0,1),nr);matrix.compose(pt,q,V(size,size*.80,.025));inst.setMatrixAt(count,matrix);inst.setColorAt(count,new THREE.Color(skin).multiplyScalar(.78+rng()*.40));count++;}
 inst.count=count;inst.name='keratin-leg-scales';inst.castShadow=true;inst.receiveShadow=true;root.add(inst);
 const dark=mat('#34362e',.8),horn=mat('#969183',.72);
 for(const side of [-1,1]){let headZ=.97+neck*.11;eye(root,[side*.122,.33,headZ+.065],.021,'#655430',[side*.7,0,1]);
 ell(root,[side*.04,.319,headZ+.168],[.010,.007,.004],dark,'nostril');
 for(const [x,z] of [[side*.57*stance,.64],[side*.50*stance,-.62]])for(let t=0;t<4;t++)curveMesh(root,[[x+(t-1.5)*.055,.065,z+.125],[x+(t-1.5)*.056,.038,z+.19],[x+(t-1.5)*.056,.022,z+.20]],[.024,.016,.002],horn,'toe-nail',10,7);
 }
 curveMesh(root,[[-.111,.245,1.105+neck*.05],[0,.237,1.157+neck*.05],[.111,.245,1.105+neck*.05]],[.005,.004,.005],dark,'horn-beak-line',24,6);
 for(let j=0;j<12;j++){let z=.74+j*.026,rr=.123+Math.sin(j*.6)*.005;const pts=[];for(let i=0;i<=24;i++){let a=i/24*Math.PI*2;pts.push([rr*Math.cos(a),.335+rr*.80*Math.sin(a),z]);}curveMesh(root,pts,[.0025,.0025],mat(new THREE.Color(skin).multiplyScalar(.79)),'neck-fold',28,5);}
 root.scale.setScalar(len/1.54);root.userData.landmark='carapace:1;feet:4;eyes:paired;neck:extended;species:unresolved';return root;}
export function buildScore(text){const s=parseScore(text),t=performance.now();let root=s.kind==='B'?bear(s):s.kind==='E'?eagle(s):tortoise(s);root.name=SCHEMA[s.kind].name;root.userData={...root.userData,kind:s.kind,version:VERSION,source:'procedural-rules',inferredGeometry:true};root.updateMatrixWorld(true);return {root,score:s.text,kind:s.kind,buildMs:performance.now()-t};}
export function dispose(root){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());root.removeFromParent();}
export function measure(root,score=''){let meshes=0,triangles=0,vertices=0,geometryBytes=0;root.traverse(o=>{if(!o.isMesh)return;meshes++;const g=o.geometry,n=o.isInstancedMesh?o.count:1;vertices+=g.attributes.position.count*n;triangles+=(g.index?g.index.count:g.attributes.position.count)/3*n;for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;if(g.index)geometryBytes+=g.index.array.byteLength;if(o.instanceMatrix)geometryBytes+=o.instanceMatrix.array.byteLength;});const box=new THREE.Box3().setFromObject(root);return {scoreBytes:new TextEncoder().encode(score).length,meshes,triangles,vertices,geometryBytes,bounds:{min:box.min.toArray(),max:box.max.toArray()}};}
export function snapshot(root){root.updateMatrixWorld(true);const chunks=[];const enc=new TextEncoder();root.traverse(o=>{if(!o.isMesh)return;chunks.push(enc.encode(o.name));for(const key of Object.keys(o.geometry.attributes).sort()){const a=o.geometry.attributes[key].array;chunks.push(enc.encode(key),new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}if(o.geometry.index){const a=o.geometry.index.array;chunks.push(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}chunks.push(new Uint8Array(new Float64Array(o.matrixWorld.elements).buffer));if(o.instanceMatrix)chunks.push(new Uint8Array(o.instanceMatrix.array.buffer));if(o.instanceColor)chunks.push(new Uint8Array(o.instanceColor.array.buffer));const m=o.material;chunks.push(enc.encode(JSON.stringify([m.color?.toArray(),m.roughness,m.metalness,m.side,m.vertexColors,o.count||1])));});let len=chunks.reduce((s,a)=>s+a.length,0),out=new Uint8Array(len),off=0;for(const a of chunks){out.set(a,off);off+=a.length;}return out;}
export function fingerprint(root){let h=2166136261;for(const b of snapshot(root)){h^=b;h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export function verifyReplay(result){const other=buildScore(result.score);try{const a=snapshot(result.root),b=snapshot(other.root);return a.length===b.length&&a.every((v,i)=>v===b[i]);}finally{dispose(other.root);}}
