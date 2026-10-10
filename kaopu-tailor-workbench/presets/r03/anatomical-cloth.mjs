import {refineClothSurface} from './surface-refine.mjs';
/** Connected anatomical garment scaffolds with exact edge clipping and fit envelopes.
 * Static style preview, not a cloth solver. No mannequin masking or scaling.
 */
import {T,PI,TAU,BODY,V,clamp,mix,smooth,num,get,cloth,plain,patch,line,trace,hem,band,fitProfile,bodyRing} from './surface-kernel.mjs';
let cache=null;
function basis(){
 if(cache?.source===BODY)return cache;
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(BODY.positions,3));g.setIndex(BODY.indices);g.computeVertexNormals();
 const ps=BODY.positions,ns=g.attributes.normal.array,arcs={};
 for(const side of[-1,1]){const a=BODY.anchors[side>0?'armL':'armR'].map(p=>V(...p)),dist=[0];for(let j=1;j<a.length;j++)dist.push(dist[j-1]+a[j].distanceTo(a[j-1]));arcs[side]={a,dist,total:dist.at(-1)}}
 const points=[];
 for(let i=0;i<ps.length;i+=3){const p=V(ps[i],ps[i+1],ps[i+2]),s=p.x>=0?1:-1,A=arcs[s];let best=Infinity,t=0;
  for(let k=0;k<A.a.length-1;k++){const d=A.a[k+1].clone().sub(A.a[k]),u=p.clone().sub(A.a[k]).dot(d)/d.lengthSq(),q=A.a[k].clone().addScaledVector(d,clamp(u));const dist=q.distanceToSquared(p);if(dist<best){best=dist;t=(A.dist[k]+(k===0?Math.min(1,u):k===A.a.length-2?Math.max(0,u):clamp(u))*d.length())/A.total}}
  const aw=BODY.armWeights[(i/3)*2+(s>0?0:1)];points.push({p,n:V(ns[i],ns[i+1],ns[i+2]),s,t,aw});
 }
 g.dispose();cache={source:BODY,points,arcs};return cache;
}
function curveAt(side,t){const A=basis().arcs[side],d=clamp(t)*A.total;let j=0;while(j<A.a.length-2&&A.dist[j+1]<d)j++;const v=A.a[j+1].clone().sub(A.a[j]);return {c:A.a[j].clone().addScaledVector(v,(d-A.dist[j])/v.length()),d:v.normalize()};}
function outer(point,row,kind,onePiece=false){
 const {p,n,aw,s}=point,wy=BODY.anchors.waistY,fitted=get(row,'meta.upper',row.style)==='FittedShirt'||row.style==='Strapless';
 const width=num(row,kind==='top'?'shirt.width':'pants.width',1),flare=num(row,kind==='top'?'shirt.flare':'pants.flare',1);
 const ease=kind==='top'?(fitted?.013:.022):.022,q=p.clone().addScaledVector(n,ease);
 if(kind==='top'){
  const torsoWeight=(1-smooth(.08,.75,aw))*smooth(1.565,1.44,p.y);
  if(torsoWeight>0){const a=Math.atan2(q.x,q.z-.02),f=fitProfile(q.y,a),r=Math.hypot(q.x,q.z-f.cz);let target=f.r+ease+.006;
   if(!fitted){const base=fitProfile(wy+.17,a).r;target=Math.max(target,base+ease+(width-1)*.075)*(1+(flare-1)*.35*smooth(wy+.17,wy-.25,q.y));}
   // R03.3 static tailoring: suspend cloth between bust and waist rather than reproducing the under-bust indentation.
   const bust=Math.max(...[1.32,1.36,1.40].map(y=>fitProfile(y,a).r)),wr=fitProfile(wy,a).r,tension=mix(wr,bust,smooth(wy,1.365,q.y))+ease+.007;
   target=Math.max(target,mix(f.r+ease+.006,tension,1-smooth(1.34,1.465,q.y)));
   if(onePiece)target=mix(target,f.r+.021,smooth(wy+.14,wy+.015,q.y));
   else target+=.022*smooth(wy+.12,wy+.025,q.y);
   target=Math.max(r,target);q.x=mix(q.x,target*Math.sin(a),torsoWeight);q.z=mix(q.z,f.cz+target*Math.cos(a),torsoWeight);
   if(onePiece){const k=smooth(wy+.055,wy+.01,q.y)*torsoWeight;q.x=mix(q.x,(f.r+.022)*Math.sin(a),k);q.z=mix(q.z,f.cz+(f.r+.022)*Math.cos(a),k);}
   const low=(1-smooth(wy+.08,1.43,q.y))*torsoWeight,fold=.0025*Math.sin(a*9+q.y*3)*low;q.x+=Math.sin(a)*fold;q.z+=Math.cos(a)*fold;
  }
  if(aw>.15){const prefix=get(row,'left.enable_asym',false)&&s>0?'left.':'',end=num(row,prefix+'sleeve.end_width',1),u=clamp(point.t),c=curveAt(s,u).c,rad=q.clone().sub(c),grow=Math.max(0,(width-1)*.035)+(end-1)*.045*smooth(.12,.8,u);q.addScaledVector(rad.clone().normalize(),grow*smooth(.15,.8,aw));}
 }else{
  const a=Math.atan2(q.x,q.z-.02),f=fitProfile(q.y,a),r=Math.hypot(q.x,q.z-f.cz),target=Math.max(r,f.r+ease+(width-1)*.025),upper=V(target*Math.sin(a),q.y,f.cz+target*Math.cos(a));
  const c0=fitProfile(q.y,0,'leg'),cx=s*c0.cx,cz=c0.cz,theta=Math.atan2((q.x-cx)*s,q.z-cz),fp=fitProfile(q.y,theta,'leg'),low=smooth(.89,.15,p.y);
  const rmin=(.086+(width-1)*.075)*mix(1,clamp(flare,.55,1.7),low),ell=Math.sqrt(Math.sin(theta)**2+.72*Math.cos(theta)**2),radius=Math.max(fp.r+ease+(width-1)*.045,rmin*ell);
  const leg=V(cx+s*radius*Math.sin(theta),q.y,cz+radius*Math.cos(theta));if(p.y<.86&&Math.abs(p.x)>.001)leg.x=s*Math.max(.006,s*leg.x);
  q.lerp(upper,smooth(.76,.99,p.y));q.lerp(leg,1-smooth(.77,.99,p.y));if(p.y<.86)q.z+=.0016*Math.sin(p.y*24+theta*4)*Math.sin(theta)**2;
 }
 return q;
}
function shell(group,row,color,kind,onePiece=false){
 const B=basis(),wy=BODY.anchors.waistY,hemY=kind==='top'?(onePiece?wy+.005:wy-.08-(num(row,'shirt.length',1)-1)*.18):Math.max(.09,wy-(.13+clamp(num(row,'pants.length',.85),.2,1)*1.02));
 const collar=get(row,'collar.component.style',null),strapless=!!get(row,'shirt.strapless',false)||row.style==='Strapless',asym=!!get(row,'left.enable_asym',false),neck=num(row,'collar.width',.2),nx=.079+neck*.058;
 const neckline=get(row,'collar.f_collar','CircleNeckHalf'),deep=.045+num(row,'collar.fc_depth',.4)*.135;
 const mapped=B.points.map(v=>{
  const {p,s,aw,t}=v;let fields;
  if(kind==='top'){
   const prefix=asym&&s>0?'left.':'',sl=strapless||get(row,prefix+'sleeve.sleeveless',true),cut=sl?-.10:clamp(num(row,prefix+'sleeve.length',.3),.1,1.05);
   let neckY=1.605;const ratio=clamp(Math.abs(p.x)/nx),facing=smooth(-.025,.055,p.z);let shape=1-ratio*ratio;
   if(neckline==='VNeckHalf'||collar==='SimpleLapel')shape=1-ratio;
   else if(neckline==='SquareNeckHalf')shape=1-ratio**12;
   else if(neckline==='TrapezoidNeckHalf')shape=clamp((1-ratio)*3);
   else if(neckline==='Bezier2NeckHalf')shape=(1-ratio)**(.7+num(row,'collar.f_bezier_x',.3)*1.8)*(1+num(row,'collar.f_bezier_y',.55)*.2*Math.sin(ratio*PI));
   if(collar==='Turtle')neckY=1.585+clamp(num(row,'collar.component.depth',5)*.01,.025,.070);else neckY-=mix(.019,collar==='SimpleLapel'?.19:deep,facing)*shape;
   if(strapless)neckY=1.455+.008*Math.cos(p.x*17);else if(asym&&get(row,'left.shirt.strapless',false))neckY=mix(neckY,1.445+.008*Math.cos(p.x*17),smooth(-.025,.055,p.x));
   const angled=get(row,'sleeve.armhole_shape','ArmholeCurve')==='ArmholeAngle'?.025:0;
   fields=[p.y-hemY+aw*1.8,neckY-p.y,cut-t+Math.min(5,(1-aw)*.15/(aw+.015))-angled,1.67-p.y];
  }else fields=[wy-p.y,p.y-hemY,.20-aw];
  return {p:outer(v,row,kind,onePiece),f:fields};
 });
 let pos=[],idx=[];const ids=new Map();
 function vertex(v){const p=v.p,k=[p.x,p.y,p.z].map(x=>Math.round(x*1e6)).join(',');let id=ids.get(k);if(id===undefined){id=pos.length/3;ids.set(k,id);pos.push(p.x,p.y,p.z)}return id;}
 function interpolate(a,b,t){return{p:a.p.clone().lerp(b.p,t),f:a.f.map((v,k)=>mix(v,b.f[k],t))};}
 for(let k=0;k<BODY.indices.length;k+=3){let poly=[mapped[BODY.indices[k]],mapped[BODY.indices[k+1]],mapped[BODY.indices[k+2]]];if(poly.some(v=>!Number.isFinite(v.p.x)))throw Error('Invalid anatomical shell');
  for(let f=0;f<poly[0].f.length;f++){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a.f[f],db=b.f[f];if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(interpolate(a,b,da/(da-db)))}poly=out;if(poly.length<3)break;}
  if(poly.length>=3){const a=vertex(poly[0]);for(let i=1;i<poly.length-1;i++)idx.push(a,vertex(poly[i]),vertex(poly[i+1]));}
 }
 const refined=refineClothSurface(pos,idx);pos=refined.positions;idx=refined.indices;
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 const mat=cloth(color),mesh=new T.Mesh(g,mat);mesh.name=kind+'-continuous-clipped-shell';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 const edges=new Map();for(let i=0;i<idx.length;i+=3)for(const[a,b]of[[idx[i],idx[i+1]],[idx[i+1],idx[i+2]],[idx[i+2],idx[i]]]){const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 const boundary=[...edges.values()],adj=new Map();for(const[a,b]of boundary)for(const[x,y]of[[a,b],[b,a]]){if(!adj.has(x))adj.set(x,[]);adj.get(x).push(y)}
 const normals=g.attributes.normal.array,ep=[],ei=[];
 for(const[a,b]of boundary){const k=ep.length/3;for(const[id,d]of[[a,0],[b,0],[a,.002],[b,.002]])for(let q=0;q<3;q++)ep.push(pos[id*3+q]-normals[id*3+q]*d);ei.push(k,k+1,k+2,k+1,k+3,k+2)}
 const eg=new T.BufferGeometry();eg.setAttribute('position',new T.Float32BufferAttribute(ep,3));eg.setIndex(ei);eg.computeVertexNormals();const em=new T.Mesh(eg,plain(new T.Color(color).multiplyScalar(.84)));em.name='actual-cut-edge-thickness';group.add(em);
 const visited=new Set(),loops=[];
 for(const start of adj.keys()){if(visited.has(start))continue;let prev=-1,cur=start,list=[];for(let i=0;i<2000;i++){if(visited.has(cur))break;visited.add(cur);list.push(V(...pos.slice(cur*3,cur*3+3)));const next=adj.get(cur)?.find(x=>x!==prev);if(next===undefined)break;prev=cur;cur=next;}if(list.length>8){const c=list.reduce((s,p)=>s.add(p),V(0,0,0)).multiplyScalar(1/list.length);loops.push({points:list,c})}}
 group.userData.connectedShells=(group.userData.connectedShells||0)+1;return{mesh,mat,loops,hemY};
}
function cuff(group,row,color,loop,prefix='',pants=false){
 const type=get(row,prefix+(pants?'pants':'sleeve')+'.cuff.type',null);if(!type)return;
 const base=prefix+(pants?'pants':'sleeve')+'.cuff.',len=clamp(num(row,base+'cuff_len',.1)*.48,.025,.13),fl=num(row,base+'skirt_flare',1.35),frill=type!=='CuffBand';
 const c=loop.c,side=c.x>0?1:-1,d=pants?V(0,-1,0):curveAt(side,num(row,prefix+'sleeve.length',.9)).d;
 const curve=new T.CatmullRomCurve3(loop.points,true),mat=cloth(color),fn=(u,v)=>{const q=curve.getPoint(u),k=frill?smooth(type==='CuffBandSkirt'?.36:0,1,v):0,rad=q.clone().sub(c),scale=1+(fl-1)*k+Math.sin(u*TAU*12)*.045*k;return c.clone().addScaledVector(rad,scale).addScaledVector(d,v*len-.002).toArray()};
 patch(group,(pants?'pants-':'sleeve-')+type+'-attached-cuff',fn,80,18,mat);hem(group,u=>fn(u,1),mat,.0018,'cuff-folded-return');
}
function front(x,y,ease=.02){let a=0,z=PI/2;for(let k=0;k<14;k++){const mid=(a+z)/2,q=bodyRing(y,mid,ease);if(q[0]<Math.abs(x))a=mid;else z=mid}const p=bodyRing(y,(a+z)/2,ease);return[x,y,p[2]];}
export function anatomicalTop(group,row,color,onePiece=false){
 const g=shell(group,row,color,'top',onePiece);g.mesh.geometry.computeBoundingBox();group.userData.topLowestY=g.mesh.geometry.boundingBox.min.y;const mat=g.mat,edge=plain(new T.Color(color).multiplyScalar(.81));
 for(const loop of g.loops){const{c}=loop;if(Math.abs(c.x)>.20&&c.y<1.47){const prefix=get(row,'left.enable_asym',false)&&c.x>0?'left.':'';cuff(group,row,color,loop,prefix)}else if(c.y<1.18)line(group,[...loop.points,loop.points[0]],edge,.00075,'sewn-shirt-hem');}
 const collar=get(row,'collar.component.style',null),strapless=!!get(row,'shirt.strapless',false)||row.style==='Strapless';
 if(collar==='SimpleLapel'&&!strapless){
  for(const s of[-1,1])patch(group,'shaped-folded-lapel',(u,v)=>{const xi=mix(.067,.015,v),xo=mix(.137,.052,v),x=s*mix(xi,xo,u),y=mix(mix(1.580,1.544,u),mix(1.488,1.440,u),v),p=front(x,y,.049);p[2]+=.009*Math.sin(u*PI);return p},26,30,mat,s<0);
  line(group,trace(t=>front(0,mix(g.hemY+.025,1.43,t),.026)),edge,.0012,'button-placket');for(let i=0;i<4;i++){const p=front(0,mix(g.hemY+.045,1.412,i/3),.029),b=new T.Mesh(new T.CylinderGeometry(.0045,.0045,.002,12),plain('#d1c5b6'));b.rotation.x=PI/2;b.position.set(...p);b.name='sewn-fastening';group.add(b)}
 }
 if(collar==='Hood2Panels'&&!strapless){const l=num(row,'collar.component.hood_length',1),dep=num(row,'collar.component.hood_depth',1),fn=(u,v)=>{const a=mix(PI*.1,PI*1.9,u),r=mix(.071,.139*dep,v);return[r*Math.sin(a),1.576+.045*Math.sin(v*PI)-.17*v*l,-.018-r*Math.cos(a)-.11*v]};patch(group,'hollow-two-panel-hood',fn,70,35,mat);hem(group,u=>fn(u,1),mat,.002,'hood-open-facing');line(group,trace(v=>fn(.5,v)),edge,.001,'hood-centre-seam');}
 return g.hemY;
}
export function anatomicalPants(group,row,color,topY){
 const g=shell(group,row,color,'pants');band(group,row,color,(topY??BODY.anchors.waistY)+.005);
 for(const loop of g.loops)if(loop.c.y<g.hemY+.03&&Math.abs(loop.c.x)>.04)cuff(group,row,color,loop,'',true);
}
