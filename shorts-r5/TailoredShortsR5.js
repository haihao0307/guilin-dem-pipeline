/* R5: a connected four-panel shorts block, fitted to the SAME R2 source body.
 * Geometry is transient. The card stores measurements, seam identities and rules.
 * Pose following is DQS + bounded thigh clearance, NOT a cloth force solver.
 */
const SHORTS_R5_SOURCE='3c3e9a4b7b250f4c8db20c15e2e5fab4ca9ce568';
const shortsSmooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function shortsFitR5(surface,meshes){
 const h=surface.boundHuman,s=surface.statureScale,hip=h.sourceBind.get('hips').p;
 const fem=['left','right'].map(side=>h.sourceBind.get(side+'_femur').p),knees=['left','right'].map(side=>h.sourceBind.get(side+'_tibia').p);
 const legLength=(Math.hypot(...fem[0].map((v,k)=>v-knees[0][k]))+Math.hypot(...fem[1].map((v,k)=>v-knees[1][k])))/2;
 const waistY=hip[1]+.16*s,crotchY=hip[1]-.185*s,hemY=Math.max((knees[0][1]+knees[1][1])/2+.14*s,waistY-.455*s);
 const sections=Array.from({length:35},(_,i)=>({y:waistY-i*(waistY-hemY)/34,points:[]}));
 const jointIds=['hips','left_femur','right_femur'].map(id=>h.joints.findIndex(j=>j.id===id));
 const radiusBins=Array.from({length:2},()=>Array.from({length:9},()=>[]));let used=0,rejected=0;
 for(const m of meshes){if(m.name!=='skin')continue;
  for(let i=0;i<m.vertices;i++){
   const mask=m.regionMasks?.[i]??0;
   const p=[-(m.positions[i*3]*m.extent[0]+m.origin[0]),m.positions[i*3+1]*m.extent[1]+m.origin[1],m.positions[i*3+2]*m.extent[2]+m.origin[2]];
   if(p[1]<hemY-.05*s||p[1]>waistY+.025*s)continue;
   if(mask&(16|32|256|512)||Math.abs(p[0]-hip[0])>.25*s){rejected++;continue;}
   used++;
   const at=Math.round((waistY-p[1])/(waistY-hemY)*34);
   for(let j=Math.max(0,at-1);j<=Math.min(34,at+1);j++)sections[j].points.push(p);
   if(m.binding)for(let side=0;side<2;side++){
    let weight=0;for(let k=0;k<8;k++)if(m.binding.ids[i*8+k]===jointIds[side+1])weight+=m.binding.weights[i*8+k]/65535;
    if(weight<.6)continue;
    const a=fem[side],axis=knees[side].map((v,k)=>v-a[k]),l2=axis.reduce((n,v)=>n+v*v,0),t=p.reduce((n,v,k)=>n+(v-a[k])*axis[k],0)/l2;
    if(t<.10||t>.94)continue;
    const r=Math.hypot(...p.map((v,k)=>v-a[k]-t*axis[k]));radiusBins[side][Math.max(0,Math.min(8,Math.floor(t*9)))].push(r);
   }
  }
 }
 if(used<100)throw Error('R5：缺少原人物腰臀/大腿表面，禁止用默认人体代替。');
 let previous={rx:.17*s,rz:.12*s,cz:hip[2]};
 for(const sec of sections){
  if(sec.points.length<8){Object.assign(sec,previous);continue;}
  let rx=0,zmin=Infinity,zmax=-Infinity;
  for(const p of sec.points){rx=Math.max(rx,Math.abs(p[0]-hip[0]));zmin=Math.min(zmin,p[2]);zmax=Math.max(zmax,p[2]);}
  const cz=(zmin+zmax)/2,rz=(zmax-zmin)/2;let gain=1;
  for(const p of sec.points)gain=Math.max(gain,Math.hypot((p[0]-hip[0])/rx,(p[2]-cz)/rz));
  Object.assign(sec,{rx:rx*gain,rz:rz*gain,cz});previous=sec;
 }
 const waist=sections[0],hipRows=sections.filter(r=>r.y>hip[1]-.09*s&&r.y<hip[1]+.075*s);
 const hipRx=Math.max(...hipRows.map(r=>r.rx)),hipRz=Math.max(...hipRows.map(r=>r.rz));
 const pelvisZ=hipRows.reduce((n,r)=>n+r.cz,0)/hipRows.length;
 const perimeter=(a,b)=>Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));
 const radii=radiusBins.map(bins=>bins.map((a,i)=>{a.sort((a,b)=>a-b);return (a.length?a[Math.floor((a.length-1)*.985)]:.075*s)+.006*s;}));
 const card={schema:'hrl-shorts-fit-card@5',source:{repository:'haihao0307/Humanoid-Rig-Lab-Next',commit:SHORTS_R5_SOURCE,body:'original-R2',heightM:h.bodyMetrics.statureM},units:'m',
  construction:{panels:['front-left','back-left','front-right','back-right'],seams:['left-side','right-side','left-inseam','right-inseam','front-rise','back-rise'],waist:'continuous folded elastic casing',hem:'two separately turned leg hems',openings:['waist','left-leg','right-leg'],gusset:'integrated crotch junction; no separate floating patch'},
  fit:{waistY,crotchY,hemY,waistCircumference:perimeter(waist.rx,waist.rz),hipCircumference:perimeter(hipRx,hipRz),outseam:waistY-hemY,waistbandHeight:.035*s,bodyClearance:.014*s,hipEaseRadial:.023*s,scale:s,hipCentre:[...hip],waist:{rx:waist.rx,rz:waist.rz,cz:waist.cz},hip:{rx:hipRx,rz:hipRz,cz:pelvisZ},thighRadii:radii},
  evidence:{surfaceSamplesUsed:used,armHandSamplesExcluded:rejected},limits:{physicalClothSolved:false,realWorldCutPattern:false,fullTriangleCollisionCertified:false}};
 return {card,hip,fem,knees,jointIds,radii,sections};
}
function shortsMeshR5(fit){
 const {card}=fit,f=card.fit,s=f.scale,cx=f.hipCentre[0],cy=f.hipCentre[1];
 const values=[],faces=[],map=new Map(),N=96,UP=30,DOWN=14,grids=[];
 const add=(p,u,v,w,kind=0)=>{
  const key=p.map(x=>Math.round(x*1e7)).join(',')+'/'+kind;
  if(map.has(key))return map.get(key);
  const id=values.length;values.push({p,uv:[u,v],w,kind});map.set(key,id);return id;
 };
 const triangle=(a,b,c,flip)=>{if(a===b||b===c||c===a)return;if(flip)faces.push(a,c,b);else faces.push(a,b,c);};
 const quad=(a,b,c,d,flip)=>{triangle(a,c,b,flip);triangle(b,c,d,flip);};
 const point=(side,u,y)=>{
  const t=(f.waistY-y)/(f.waistY-f.crotchY),up=y>=f.crotchY;
  const hipBlend=shortsSmooth((f.waistY-y)/(.15*s));
  const rx=f.waist.rx*(1-hipBlend)+f.hip.rx*hipBlend+(.011+.012*hipBlend)*s;
  const rz=f.waist.rz*(1-hipBlend)+f.hip.rz*hipBlend+(.012+.012*hipBlend)*s;
  const cz=f.waist.cz*(1-hipBlend)+f.hip.cz*hipBlend;
  const gather=.0018*s*(Math.sin(24*Math.PI*u)+.45*Math.sin(42*Math.PI*u+.7))*Math.exp(-Math.max(0,f.waistY-y)/(.12*s));
  if(up){
   const join=shortsSmooth((cy-.12*s-y)/(.065*s));
   const lx=(f.hip.rx+.030*s)*.5,lz=Math.max(.097*s,f.hip.rz*.90)+.009*s;
   const ax=rx*Math.sin(Math.PI*u),az=rz*Math.cos(Math.PI*u);
   const bx=lx*(1-Math.cos(2*Math.PI*u)),bz=lz*Math.sin(2*Math.PI*u);
   return[cx+side*(ax*(1-join)+bx*join+gather*(1-join)*Math.sin(Math.PI*u)),y,cz*(1-join)+fit.hip[2]*join+az*(1-join)+bz*join+gather*(1-join)*Math.cos(Math.PI*u)];
  }
  const v=shortsSmooth((f.crotchY-y)/(f.crotchY-f.hemY));
  const lx=(f.hip.rx+.030*s)*.5,rxLeg=lx*(1-v)+.093*s*v,centre=lx*(1-v)+.103*s*v;
  const rzLeg=(Math.max(.097*s,f.hip.rz*.90)+.009*s)*(1-v)+.105*s*v;
  const fold=.0017*s*Math.sin(6*Math.PI*u+.8)*(1-.5*v);
  return[cx+side*(centre-(rxLeg+fold)*Math.cos(2*Math.PI*u)),y,fit.hip[2]+(rzLeg+fold)*Math.sin(2*Math.PI*u)];
 };
 const weights=(side,u,y)=>{
  const leg=shortsSmooth((cy+.025*s-y)/(.19*s));
  // Shared rise and crotch vertices have one symmetric weight field.
  const medial=Math.pow(Math.abs(Math.cos(Math.PI*u)),12)*(1-shortsSmooth((f.crotchY-y)/(.07*s)));
  const own=leg*(1-medial*.55),other=leg*medial*.55;
  return side<0?[1-leg,own,other]:[1-leg,other,own];
 };
 for(const side of [-1,1]){
  const grid=[];
  for(let row=0;row<=UP+DOWN;row++){
   const y=row<=UP?f.waistY-(f.waistY-f.crotchY)*row/UP:f.crotchY-(f.crotchY-f.hemY)*(row-UP)/DOWN;
   const ring=[];for(let i=0;i<=N;i++){const u=i/N;let w=weights(side,u,y);if((i===0||i===N)&&row<=UP)w=[w[0],(1-w[0])/2,(1-w[0])/2];ring.push(add(point(side,u,y),u,(f.waistY-y)/s,w));}grid.push(ring);
  }
  for(let row=0;row<UP+DOWN;row++)for(let i=0;i<N;i++)quad(grid[row][i],grid[row][i+1],grid[row+1][i],grid[row+1][i+1],side<0);
  grids.push(grid);
 }
 const baseVertices=values.length,baseFaces=faces.length;
 // The top casing is part of the same connected boundary, folded over to the inside.
 const waistLoop=[...grids[1][0].slice(0,N),...grids[0][0].slice(0,N).reverse()];
 const uniqueLoop=loop=>{const a=[];for(const i of loop)if(a.at(-1)!==i)a.push(i);if(a[0]===a.at(-1))a.pop();return a;};
 const turnEdge=(loop,kind,down,sideCentre)=>{
  let prev=loop;
  for(const [inset,dy]of [[.001,down*.05],[.0035,down*.15],[.0035,down]]){
   const ring=loop.map(i=>{const a=values[i],dx=a.p[0]-sideCentre[0],dz=a.p[2]-sideCentre[1],l=Math.hypot(dx,dz)||1;return add([a.p[0]-dx/l*inset*s,a.p[1]+dy*s,a.p[2]-dz/l*inset*s],a.uv[0],a.uv[1],a.w,kind);});
   for(let k=0;k<loop.length;k++)quad(prev[k],prev[(k+1)%loop.length],ring[k],ring[(k+1)%loop.length],false);prev=ring;
  }
 };
 // Use actual ordered external boundary edges so folds cannot cross at the centre seam.
 const edges=new Map();for(let i=0;i<baseFaces;i+=3)for(const [a,b]of [[faces[i],faces[i+1]],[faces[i+1],faces[i+2]],[faces[i+2],faces[i]]]){const key=a<b?a+':'+b:b+':'+a;const old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});}
 const boundary=[...edges.values()].filter(e=>e.count===1),adj=new Map();for(const {a,b}of boundary){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
 const loops=[],seen=new Set();for(const start of adj.keys()){if(seen.has(start))continue;let prev=-1,at=start,loop=[];do{seen.add(at);loop.push(at);const next=adj.get(at)?.find(x=>x!==prev);prev=at;at=next;}while(at!==undefined&&at!==start&&!seen.has(at)&&loop.length<10000);loops.push(loop);}
 const badEdges=[...edges.values()].filter(e=>e.count>2).length;
 if(loops.length!==3||badEdges||[...adj.values()].some(a=>a.length!==2))throw Error('R5 拓扑拒绝 '+JSON.stringify({loops:loops.map(a=>a.length),badEdges,adj:[...adj].filter(a=>a[1].length!==2).slice(0,8).map(a=>[a,values[a[0]]])}));
 for(const loop of loops){const avgY=loop.reduce((n,i)=>n+values[i].p[1],0)/loop.length,avgX=loop.reduce((n,i)=>n+values[i].p[0],0)/loop.length;
  turnEdge(loop,avgY>cy?1:2,avgY>cy?-.029:.018,[avgY>cy?cx:avgX,avgY>cy?f.waist.cz:fit.hip[2]]);
 }
 const normals=values.map(()=>[0,0,0]);let degenerate=0;
 for(let i=0;i<faces.length;i+=3){const a=values[faces[i]].p,b=values[faces[i+1]].p,c=values[faces[i+2]].p,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...n)<1e-12)degenerate++;for(let k=0;k<3;k++)for(let q=0;q<3;q++)normals[faces[i+k]][q]+=n[q];}
 const packed=new Float32Array(values.length*12);
 values.forEach((v,i)=>{let n=normals[i],l=Math.hypot(...n)||1;n=n.map(x=>x/l);const outward=[v.p[0]-cx,0,v.p[2]-fit.hip[2]];if(n[0]*outward[0]+n[2]*outward[2]<0)n=n.map(x=>-x);packed.set([...v.p,...n,...v.uv,...v.w,v.kind],i*12);});
 return{packed,indices:new Uint16Array(faces),report:{vertices:values.length,triangles:faces.length/3,baseVertices,openings:3,nonManifoldEdges:badEdges,degenerateTriangles:degenerate,connectedCrotch:true,waistCasing:true,turnedHems:2},values};
}
const SHORTS_R5_VS=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;layout(location=1)in vec3 normal;layout(location=2)in vec2 uv;layout(location=3)in vec3 weights;layout(location=4)in float kind;
uniform mat4 viewProjection;uniform sampler2D compactPalette;uniform ivec3 shortsJoints;uniform vec4 thighEnds[4];uniform vec4 thighRadii[6];uniform float hipY,scale;
out vec3 P,N;out vec2 UV;out float K;
vec3 spin(vec4 q,vec3 p){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec3 clearLeg(vec3 p,int side,vec3 fallback){vec4 a=thighEnds[side*2],b=thighEnds[side*2+1];vec3 axis=b.xyz-a.xyz;float t=clamp(dot(p-a.xyz,axis)/max(dot(axis,axis),1e-9),0.,1.);float f=t*8.;int i=int(floor(f));int j=min(8,i+1);float r0=thighRadii[side*3+i/4][i%4],r1=thighRadii[side*3+j/4][j%4],r=mix(r0,r1,fract(f));vec3 c=a.xyz+t*axis,d=p-c;float len=length(d);return len<r?c+(len>1e-6?d/len:normalize(fallback))*r:p;}
void main(){vec4 qr=vec4(0),qd=vec4(0),reference=texelFetch(compactPalette,ivec2(0,shortsJoints.x),0);for(int i=0;i<3;i++){int id=shortsJoints[i];vec4 q=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);float w=weights[i]*(dot(reference,q)<0.?-1.:1.);qr+=w*q;qd+=w*d;}float l=length(qr);qr/=l;qd/=l;qd-=qr*dot(qr,qd);P=spin(qr,position)+2.*(qr.w*qd.xyz-qd.w*qr.xyz+cross(qr.xyz,qd.xyz));N=spin(qr,normal);
if(position.y<hipY-.018*scale){for(int k=0;k<2;k++){P=clearLeg(P,0,N);P=clearLeg(P,1,N);}}
UV=uv;K=kind;gl_Position=viewProjection*vec4(P,1.);}`;
const SHORTS_R5_FS=`#version 300 es
precision highp float;in vec3 P,N;in vec2 UV;in float K;uniform vec3 eye;uniform float waistbandHeight;out vec4 frag;
void main(){vec3 n=normalize(N);vec3 gn=normalize(cross(dFdx(P),dFdy(P)));if(dot(gn,n)<0.)gn=-gn;n=normalize(mix(n,gn,.25));vec3 view=normalize(eye-P);if(dot(n,view)<0.)n=-n;
float yarnA=sin(UV.x*900.),yarnB=sin(UV.y*1900.);float aa=clamp(1.-max(fwidth(UV.x)*450.,fwidth(UV.y)*950.),0.,1.);float weave=aa*(yarnA*yarnB*.026+.012*sin(UV.x*179.+UV.y*831.));
float light=.56+.44*max(0.,dot(n,normalize(vec3(-.45,.85,.65))));float ambient=.97+.03*n.y;vec3 colour=vec3(.72,.66,.54)*(1.+weave);
float sideSeam=1.-smoothstep(.0015,.005,abs(UV.x-.5));float centre=1.-smoothstep(.001,.003,min(UV.x,1.-UV.x));float waistStitch=1.-smoothstep(.0007,.0017,abs(UV.y-waistbandHeight));float hemStitch=0.;colour*=1.-.065*sideSeam-.055*centre-.055*waistStitch;
if(UV.y<waistbandHeight)colour*=.96+.018*sin(UV.y*1000.);
float spec=pow(max(0.,dot(reflect(-normalize(vec3(-.45,.85,.65)),n),view)),18.)*.018;frag=vec4(colour*light*ambient+spec,1.);}`;
class TailoredShortsR5{
 constructor(surface,meshes){this.surface=surface;this.gl=surface.gl;this.buffers=[];this.fit=shortsFitR5(surface,meshes);const mesh=shortsMeshR5(this.fit);this.card=this.fit.card;this.card.topology=mesh.report;this.report={generator:'tailored-shorts-r5',...mesh.report,cardDriven:true,clothDynamics:false};this.count=mesh.indices.length;this.geometryBytes=mesh.packed.byteLength+mesh.indices.byteLength;this.ends=new Float32Array(16);this.radii=new Float32Array(24);for(let side=0;side<2;side++)this.radii.set(this.fit.radii[side],side*12);
 const gl=this.gl;try{this.main=program(gl,SHORTS_R5_VS,SHORTS_R5_FS);this.depth=program(gl,SHORTS_R5_VS,'#version 300 es\nprecision highp float;void main(){}');for(const p of [this.main,this.depth])for(const name of ['compactPalette','shortsJoints','thighEnds[0]','thighRadii[0]','hipY','scale','waistbandHeight'])p.u[name]=gl.getUniformLocation(p.p,name);
 this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);for(const [target,data]of [[gl.ARRAY_BUFFER,mesh.packed],[gl.ELEMENT_ARRAY_BUFFER,mesh.indices]]){const b=gl.createBuffer();this.buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);}for(const [at,size,offset]of [[0,3,0],[1,3,3],[2,2,6],[3,3,8],[4,1,11]]){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,48,offset*4);}gl.bindVertexArray(null);
 }catch(e){this.dispose();throw e;}}
 draw(depth){const surface=this.surface;if(this.disposed||!surface.visible)return;const gl=this.gl,r=surface.renderer,p=depth?this.depth:this.main;gl.useProgram(p.p);gl.activeTexture(gl.TEXTURE0+COMPACT_PALETTE_UNIT);gl.bindTexture(gl.TEXTURE_2D,surface.texture);gl.uniform1i(p.u.compactPalette,COMPACT_PALETTE_UNIT);gl.uniformMatrix4fv(p.u.viewProjection,false,depth?r.lightVP:r.vp);gl.uniform3iv(p.u.shortsJoints,this.fit.jointIds);gl.uniform1f(p.u.hipY,this.fit.hip[1]);gl.uniform1f(p.u.scale,surface.statureScale);for(let side=0;side<2;side++)for(let end=0;end<2;end++)this.ends.set(surface.boundHuman.byId.get(['left','right'][side]+(end?'_tibia':'_femur')).world.p,(side*2+end)*4);gl.uniform4fv(p.u['thighEnds[0]'],this.ends);gl.uniform4fv(p.u['thighRadii[0]'],this.radii);if(!depth){gl.uniform3fv(p.u.eye,r.eye);gl.uniform1f(p.u.waistbandHeight,this.card.fit.waistbandHeight/this.card.fit.scale);}gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);if(depth)r.shadowDrawCalls++;else r.drawCalls++;gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);}
 dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.buffers)this.gl.deleteBuffer(b);if(this.vao)this.gl.deleteVertexArray(this.vao);for(const p of [this.main,this.depth])if(p)this.gl.deleteProgram(p.p);}
}
