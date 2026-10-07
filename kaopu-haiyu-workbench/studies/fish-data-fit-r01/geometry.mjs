// Authored low-dimensional anatomical schematic. No STL vertices are used here.
// Haiyu's existing transported-frame helper and axis function remain byte-identical.
import {axis,transportedFrames,add,sub,mul,dot,cross} from './frame-core.mjs';
const norm=v=>Math.hypot(...v),lerp=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const bezier=(a,b,c,d,t)=>a.map((v,i)=>v*(1-t)**3+3*b[i]*(1-t)**2*t+3*c[i]*(1-t)*t*t+d[i]*t**3);
function curve(a,b,c,d,n=6){return Array.from({length:n+1},(_,i)=>bezier(a,b,c,d,i/n))}
function axisLayout(data,bend){
 const dense=Array.from({length:401},(_,i)=>axis(i/400,0,bend)),arc=[0];for(let i=1;i<dense.length;i++)arc.push(arc[i-1]+norm(sub(dense[i],dense[i-1])));
 const at=s=>{const target=s*arc.at(-1);let i=1;while(i<arc.length-1&&arc[i]<target)i++;return mul(lerp(dense[i-1],dense[i],(target-arc[i-1])/(arc[i]-arc[i-1])),data.sample_span_mm/arc.at(-1))};
 const points=data.records.map(r=>at(r.s_in_sample)),tangents=data.records.map(r=>sub(at(Math.min(1,r.s_in_sample+.001)),at(Math.max(0,r.s_in_sample-.001))));return{points,frames:transportedFrames(tangents),design:true};
}
export function evaluate(data,options={}){
 const defaults={layout:'raw',fit:'measured',bend:1,width:1,spine:1,single:0},opt=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,options[k]??v]));
 if(!['raw','haiyu'].includes(opt.layout)||!['measured','sparse'].includes(opt.fit)||![0,8].includes(opt.single)||![opt.bend,opt.width,opt.spine].every(Number.isFinite)||opt.bend<0||opt.bend>4||opt.width<.7||opt.width>1.3||opt.spine<.7||opt.spine>1.3)throw Error('Invalid sample options');
 if(data.records.length!==11||data.unit!=='mm')throw Error('This candidate requires the verified 11-row mm sample');
 const rawCenter=data.records[5].center_mm,base=data.records[5].basis_XYZ;
 const rawWorld=p=>[0,1,2].map(i=>dot(sub(p,rawCenter),base.map(row=>row[i])));
 const layout=opt.layout==='haiyu'?axisLayout(data,opt.bend):null;
 const packet={schema:'haiyu.anatomical-mainform/1',options:opt,unit:'mm',scope:'Scomber japonicus SIO80-267 v2–v12 only',lines:[],meshes:[],points:[],ports:[],attachments:[],frames:[],axis:[],fitWarning:opt.fit==='sparse'?'4-knot fit is illustrative. Spine-tip errors are large; do not treat it as an accepted anatomical fit.':null};
 const visible=data.records.filter(r=>!opt.single||r.vertebra===opt.single);
 for(const r of visible){
  const i=r.vertebra-2,p={...(opt.fit==='sparse'?r.sparse_params:r.params)};p.half_width*=opt.width;p.arch_front_foot_y*=opt.width;p.arch_back_foot_y*=opt.width;p.side_attachment_y*=opt.width;
  const localToRaw=v=>add(r.center_mm,r.basis_XYZ.map(row=>dot(row,v)));
  const frame=layout?layout.frames[i]:{T:r.basis_XYZ.map(row=>row[0]),N:r.basis_XYZ.map(row=>row[1]),B:r.basis_XYZ.map(row=>row[2])};packet.frames.push(frame);
  const world=v=>opt.single?v:layout?add(layout.points[i],add(mul(frame.T,v[0]),add(mul(frame.N,v[1]),mul(frame.B,v[2])))):rawWorld(localToRaw(v));
  const line=(id,group,points,width=1,extra={})=>{const item={id:`v${r.vertebra}-${id}`,group,points:points.map(world),width,vertebra:r.vertebra,...extra};packet.lines.push(item);return item};
  const point=(id,group,v,label)=>packet.points.push({id:`v${r.vertebra}-${id}`,group,point:world(v),label,vertebra:r.vertebra});
  // Three ellipses and their closed low-poly loft. Waist DV radius comes from LM15;
  // waist width symmetry and ellipse section are our explicit shape approximation.
  const n=16,ring=(x,scale)=>Array.from({length:n},(_,j)=>[x,p.half_width*scale*Math.cos(2*Math.PI*j/n),p.height*.5*scale*Math.sin(2*Math.PI*j/n)]);
  const stations=[-p.length/2,p.arch_front_foot_x,0,p.arch_back_foot_x,p.length/2].sort((a,b)=>a-b),rings=stations.map(x=>ring(x,p.waist_ratio+(1-p.waist_ratio)*Math.min(1,Math.abs(2*x/p.length)))),verts=rings.flat(),faces=[];
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<n;j++){const a=k*n+j,b=k*n+(j+1)%n,c=(k+1)*n+j,d=(k+1)*n+(j+1)%n;faces.push([a,b,c],[b,d,c])}
  const firstCap=verts.length,lastRing=(rings.length-1)*n;verts.push([-p.length/2,0,0],[p.length/2,0,0]);for(let j=0;j<n;j++){faces.push([firstCap,(j+1)%n,j],[firstCap+1,lastRing+j,lastRing+(j+1)%n])}
  packet.meshes.push({id:`v${r.vertebra}-centrum`,group:'centrum',vertebra:r.vertebra,vertices:verts.map(world),faces});
  rings.forEach((q,k)=>{if(k===0||k===rings.length-1||stations[k]===0)line(`ring${k}`,'centrum-ring',[...q,q[0]],.6)});
  const frontFusion=[p.arch_front_x,0,p.arch_front_z],backFusion=[p.arch_back_x,0,p.arch_back_z],stemBase=lerp(frontFusion,backFusion,.5),tip=add(stemBase,mul(sub([p.spine_tip_x,0,p.spine_tip_z],stemBase),opt.spine));
  for(const side of [-1,1])for(const station of ['front','back']){
   const foot=[p[`arch_${station}_foot_x`],side*p[`arch_${station}_foot_y`],p[`arch_${station}_foot_z`]],fusion=station==='front'?frontFusion:backFusion;
   const a=lerp(foot,fusion,.28),b=lerp(foot,fusion,.78);a[2]+= .12;b[1]=side*Math.abs(foot[1])*.3;
   const ringIndex=stations.indexOf(foot[0]),ringVertices=rings[ringIndex],angularIndex=ringVertices.reduce((best,v,j)=>norm(sub(v,foot))<norm(sub(ringVertices[best],foot))?j:best,0),bodyVertex=ringIndex*n+angularIndex,bodyRoot=verts[bodyVertex];
   const l=line(`arch-${station}-${side}`,'arch',[bodyRoot,...curve(foot,a,b,fusion)],1.3,{side,sourceLandmarks:station==='front'?[6,7,2]:[8,11],mirrored:side===1,bridgeIsSchematic:true});
   point(`foot-${station}-${side}`,'attachment',foot);packet.attachments.push({id:l.id,parentLandmarks:l.sourceLandmarks,root:l.points[0],parentMesh:`v${r.vertebra}-centrum`,parentVertex:bodyVertex,measuredFoot:world(foot),sourceOrMirror:side===1?'assumed mirror':'measured-side proxy'});
  }
  line('fusion','arch',[frontFusion,backFusion],1.2);line('spine','spine',[stemBase,tip],1.6);point('tip','spine',tip);
  for(const side of[-1,1])point('side-port-'+side,'side-port',[p.side_attachment_x,side*p.side_attachment_y,p.side_attachment_z]);
  const ports=[[-p.length/2,0,0],[p.length/2,0,0]].map(world);packet.ports.push({vertebra:r.vertebra,anterior:ports[0],posterior:ports[1]});packet.axis.push(world([0,0,0]));
  // Original landmarks retained for evidence overlay, never used as mesh vertices.
  r.landmarks_local_mm.forEach((q,j)=>packet.points.push({id:`v${r.vertebra}-lm${j+1}`,group:'source',point:world(q),label:`${j+1}`,vertebra:r.vertebra}));
 }
 for(let i=0;i<packet.ports.length-1;i++)packet.lines.push({id:`joint-gap-${i}`,group:'gap',points:[packet.ports[i].posterior,packet.ports[i+1].anterior],width:.8,anatomy:'Endpoint gap visualization only; not inferred cartilage or joint mechanics'});
 return packet;
}
export function inspect(packet){
 const pts=[...packet.lines.flatMap(l=>l.points),...packet.meshes.flatMap(m=>m.vertices),...packet.points.map(p=>p.point)];let orthogonality=0,handednessError=0;
 for(const f of packet.frames){orthogonality=Math.max(orthogonality,Math.abs(dot(f.T,f.N)),Math.abs(dot(f.N,f.B)),Math.abs(dot(f.B,f.T)),Math.abs(norm(f.T)-1),Math.abs(norm(f.N)-1),Math.abs(norm(f.B)-1));handednessError=Math.max(handednessError,norm(sub(cross(f.T,f.N),f.B)))}
 return {allFinite:pts.every(p=>p.every(Number.isFinite)),vertices:packet.meshes.reduce((s,m)=>s+m.vertices.length,0),triangles:packet.meshes.reduce((s,m)=>s+m.faces.length,0),lineVertices:packet.lines.reduce((s,l)=>s+l.points.length,0),attachmentError:Math.max(0,...packet.attachments.map(a=>norm(sub(a.root,packet.meshes.find(m=>m.id===a.parentMesh).vertices[a.parentVertex])))),orthogonality,handednessError,sourceLandmarks:packet.points.filter(p=>p.group==='source').length};
}
export function project(v,view='orbit',az=-1.05,el=.30){if(view==='xz')return[v[0],-v[2],v[1]];if(view==='xy')return[v[0],-v[1],v[2]];if(view==='yz')return[v[1],-v[2],v[0]];const ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);return[-sa*v[0]+ca*v[1],se*ca*v[0]+se*sa*v[1]-ce*v[2],ce*ca*v[0]+ce*sa*v[1]+se*v[2]]}
