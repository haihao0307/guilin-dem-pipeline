/**
 * Original guided tissue-accretion reconstruction, JavaScript revision 4.1.
 * Not the video author's HIP, a biological simulation, or a union solver.
 * Coordinates: Y up. Geometry units are arbitrary. No third-party assets.
 * Recipe and material coordinates are immutable with respect to stage time.
 */
export const MODEL_VERSION = 'guided-tissue-accretion-js-r4.1';
export const DEFAULTS = Object.freeze({seed:17,density:1,fold:1});
export const QUALITY = Object.freeze({preview:{steps:14,cols:28,tube:24,pad:24},mobilePreview:{steps:7,cols:14,tube:24,pad:24,normalSteps:14,normalCols:28,foldFeatures:true},export:{steps:30,cols:64,tube:40,pad:40}});
const TAU=Math.PI*2, EPS=1e-9;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const finite=(x,d)=>Number.isFinite(Number(x))?Number(x):d;
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const scale=(a,b)=>a.map(x=>x*b);
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const norm=a=>Math.hypot(...a);
const unit=a=>scale(a,1/Math.max(EPS,norm(a)));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const progress=(time,birth,duration)=>clamp((finite(time,0)-birth)/Math.max(EPS,duration));
/** FNV-1a seed hashing and Mulberry32; deliberately not NumPy PCG64. */
export function randomFor(seed,label=''){
 let s=2166136261;for(const c of `${seed}:${label}`){s^=c.charCodeAt(0);s=Math.imul(s,16777619);}
 return ()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
function tubeFrames(path){
 return path.map((p,i)=>{const d=unit(sub(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)]));const side=unit(cross(d,Math.abs(d[2])<.9?[0,0,1]:[1,0,0]));return {side,other:cross(d,side)};});
}
export function createRecipe(options={}){
 const params={seed:String(options.seed??DEFAULTS.seed).slice(0,64),density:clamp(finite(options.density,1),.45,1.6),fold:clamp(finite(options.fold,1),.2,1.5)};
 const records=[];const push=r=>{records.push(r);return r;};
 const tube=r=>push({...r,type:r.type??'branch',frames:tubeFrames(r.path)});
 const pad=(id,origin,axes,parent)=>push({id,type:'base',parent,birth:0,duration:0,parentArrival:0,origin,axes});
 const mantle=(id,parent,origin,radius,angle,span,tilt,phase,rise,curlRadians,birth,parentArrival,attachmentMaterialT,duration=.085)=>push({id,type:'mantle',parent,origin,radius,angle,span,tilt,phase,rise,curlRadians:curlRadians*params.fold,thickness:.021,birth,duration,parentArrival,attachmentMaterialT});
 const seeds=[[-.59,.02,1.62,.14,3],[.15,-.61,1.96,.15,3],[.75,.17,1.31,.13,2],[-.67,.8,.42,.115,2],[.43,.84,.56,.1,2],[-.82,-.78,.57,.095,1],[.82,-.77,.30,.09,1]];
 pad('base',[0,.053,0],[1.03,.057,.85],null);
 seeds.forEach(([x,z],i)=>pad(`base/pad-${i}`,[x,.052,z],[.34+.04*(i%3),.055,.32+.05*(i%2)],'base'));
 seeds.forEach(([x,z,height,radius,nTips],si)=>{
  const rng=randomFor(params.seed,`stem-${si}`),ph=rng()*TAU,lean=[Math.cos(ph)*.18,0,Math.sin(ph)*.18],side=[-Math.sin(ph),0,Math.cos(ph)];
  const path=[],radii=[];
  for(let i=0;i<36;i++){const u=i/35;path.push(add(add([x,.06+height*u,z],scale(lean,u*u)),scale(side,.085*Math.sin(Math.PI*u))));radii.push(radius*(1-.13*u)+.18*u**3);}
  const birth=.025+si*.006,duration=height>1?.42+.022*(si%3):.27+.018*(si%2),full=birth+duration;
  const stem=tube({id:`stem-${si}`,type:'stem',parent:`base/pad-${si}`,parentArrival:0,attachmentMaterialT:1,birth,duration,path,radii,fluting:.25,phase:ph,root:path[0],tip:path.at(-1),seedIndex:si});
  for(let tip=0;tip<nTips;tip++){
   const id=`${stem.id}/fork-${tip}`,rng=randomFor(params.seed,id),a=ph+tip*2.39996,reach=height>1?.20+.06*rng():.12;
   const origin=add(path.at(-1),[Math.cos(a)*reach,.09+rng()*.14,Math.sin(a)*reach]);
   const rootIndex=height>1?25:28,root=path[rootIndex],branchPath=Array.from({length:14},(_,i)=>add(mix(root,origin,i/13),scale(side,.035*Math.sin(Math.PI*i/13))));
   const branchBirth=birth+duration*rootIndex/35,branchDuration=full-branchBirth+.08+tip*.008,branchFull=branchBirth+branchDuration;
   tube({id,type:'branch',parent:stem.id,parentArrival:branchBirth,attachmentMaterialT:rootIndex/35,birth:branchBirth,duration:branchDuration,path:branchPath,radii:Array.from({length:14},(_,i)=>radius*.82+(.065-radius*.82)*i/13),fluting:.15,phase:ph+tip});
   const events=Math.max(6,Math.round((height>1?26:18)*params.density));
   const gapRng=randomFor(params.seed,`${id}/gaps`),levels=[];let total=0;
   for(let j=0;j<events;j++){total+=.45+1.1*gapRng();levels.push(total);}
   const lo=levels[0],range=levels.at(-1)-lo,heightRange=height>1?.42:.30;
   for(let j=0;j<events;j++)levels[j]=(levels[j]-lo)/range*heightRange;
   const crownStart=branchFull+.012,supportDuration=.26,supportLength=levels.at(-1)+.02;
   const support=tube({id:`${id}/crown`,type:'support',parent:id,parentArrival:branchFull,attachmentMaterialT:1,birth:crownStart,duration:supportDuration,path:[origin,add(origin,[0,supportLength,0])],radii:[.066,.039],fluting:.09,phase:ph});
   for(let j=0;j<events;j++){
    const rng=randomFor(params.seed,`${id}/level-${j}`),t=j/(events-1),choice=rng(),sector=choice<.47?0:choice<.80?1:2;
    const ang=a+sector*2.06+.36*Math.sin(j*.42+ph)+(rng()*2-1)*.13,count=j%3===1?2:1;
    for(let fan=0;fan<count;fan++){
     const orient=ang+fan*1.8,R=(height>1?.70:.47)*(.88-.30*t+.10*Math.sin(j*.43+ph))*(.88+.27*rng());
     const pos=add(origin,[.027*Math.cos(orient),levels[j],.027*Math.sin(orient)]),arrival=crownStart+levels[j]/supportLength*supportDuration;
     const eventBirth=crownStart+levels[j]/heightRange*supportDuration+.004*fan;
     mantle(`${id}/mantle-${j}-${fan}`,support.id,pos,R,orient,1.75+.95*rng(),-.13+.28*rng(),ph+j*.61+fan,.012,1.75+.55*rng(),eventBirth,arrival,levels[j]/supportLength);
    }
   }
  }
  if(height>1)for(let j=0;j<4;j++){
   const t=.46+j*.115,ii=Math.min(35,Math.floor(t*35));
   mantle(`${stem.id}/side-mantle-${j}`,stem.id,path[ii],.36+.065*j,ph+j*2.1,2.18,-.035,ph+j,.012,1.85,birth+duration*t+.02,birth+duration*ii/35,ii/35,.14);
  }
 });
 return {model:MODEL_VERSION,implementation:'Independent guided skeleton + appended lamella fronts; not recovered HIP.',rng:'FNV-1a / Mulberry32, labelled streams; not NumPy-identical',params,records,endTime:Math.max(...records.map(r=>r.birth+r.duration)),union:false};
}
export function materialSamples(g,steps){
 if(g<=EPS)return [];
 const values=[];for(let i=0;i<=steps;i++){const u=i/steps;if(u<g-EPS)values.push(u);else break;}
 values.push(g);return values;
}
/** A point in the immutable lamella material chart. Mature tissue never scales. */
export function sampleMantleMid(r,u,v){
 let rr,yy;if(u<.86){rr=r.radius*u;yy=r.rise*u*u;}else{const curl=(u-.86)/.14*r.curlRadians;rr=r.radius*(.86+.095*Math.sin(curl));yy=r.rise*.86**2+r.radius*.095*(1-Math.cos(curl));}
 const a=r.angle+r.span*(v-.5),edge=Math.max(0,Math.sin(Math.PI*v))**.26;
 const lobes=1+.065*Math.sin(a*7+r.phase)+.033*Math.sin(a*17-r.phase)+.010*Math.sin(a*29+r.phase*2);
 const rad=rr*(.65+.35*edge)*lobes,wave=r.radius*(.040*Math.sin(a*6+r.phase)+.016*Math.sin(a*15-r.phase))*u*u;
 return add(r.origin,[rad*Math.cos(a),yy+r.tilt*rad*Math.cos(a-r.angle)+wave,rad*Math.sin(a)]);
}
const mantleNormalFields=new WeakMap();
/** Fixed full-material mesh normals: shell thickness follows fold normals, not Y. */
function mantleNormalField(r,q){
 let fields=mantleNormalFields.get(r);if(!fields){fields=new Map();mantleNormalFields.set(r,fields);}
 const key=`${q.steps}/${q.cols}`;if(fields.has(key))return fields.get(key);
 const nc=q.cols+1,points=[...r.origin],grid=[],faces=[];
 for(let j=0;j<=q.steps;j++)for(let k=0;k<nc;k++){
  if(j===0)grid.push(0);else{grid.push(points.length/3);points.push(...sampleMantleMid(r,j/q.steps,k/q.cols));}
 }
 for(let j=0;j<q.steps;j++)for(let k=0;k<q.cols;k++){
  const a=grid[j*nc+k],b=grid[j*nc+k+1],c=grid[(j+1)*nc+k],d=grid[(j+1)*nc+k+1];
  if(a!==b)faces.push(a,b,c);faces.push(b,d,c);
 }
 const normals=computeVertexNormals(new Float32Array(points),new Uint32Array(faces));
 const result={grid,normals,nc};fields.set(key,result);return result;
}
export function sampleMantle(r,u,v,side=1,quality=QUALITY.preview){
 const normalQuality=quality.normalSteps?{steps:quality.normalSteps,cols:quality.normalCols}:quality;
 const {grid,normals,nc}=mantleNormalField(r,normalQuality),z=clamp(u)*normalQuality.steps,j=Math.min(normalQuality.steps-1,Math.floor(z)),f=z-j;
 const col=clamp(v)*normalQuality.cols,k=Math.min(normalQuality.cols-1,Math.floor(col)),w=col-k;
 const get=(row,c)=>Array.from(normals.subarray(grid[row*nc+c]*3,grid[row*nc+c]*3+3));
 const n=unit(mix(mix(get(j,k),get(j,k+1),w),mix(get(j+1,k),get(j+1,k+1),w),f));
 return add(sampleMantleMid(r,u,v),scale(n,side*r.thickness*.5));
}
export function computeVertexNormals(positions,indices){
 const normals=new Float32Array(positions.length);
 for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ax=positions[b]-positions[a],ay=positions[b+1]-positions[a+1],az=positions[b+2]-positions[a+2],bx=positions[c]-positions[a],by=positions[c+1]-positions[a+1],bz=positions[c+2]-positions[a+2];
  const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx;
  for(const j of [a,b,c]){normals[j]+=x;normals[j+1]+=y;normals[j+2]+=z;}
 }
 for(let i=0;i<normals.length;i+=3){const n=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;normals[i]/=n;normals[i+1]/=n;normals[i+2]/=n;}
 return normals;
}
/** Fixed full-path frames keep old cross sections unchanged as tips advance. */
export function sampleTube(r,u,v){
 const z=clamp(u)*(r.path.length-1),i=Math.min(r.path.length-2,Math.floor(z)),t=z-i;
 const c=mix(r.path[i],r.path[i+1],t),rad=r.radii[i]+(r.radii[i+1]-r.radii[i])*t;
 const side=unit(mix(r.frames[i].side,r.frames[i+1].side,t)),other=unit(mix(r.frames[i].other,r.frames[i+1].other,t)),a=v*TAU;
 const w=1+r.fluting*(.65+.35*u)*(.7*Math.cos(3*a+r.phase)+.3*Math.cos(5*a-r.phase*.3));
 return add(c,scale(add(scale(side,Math.cos(a)),scale(other,(.84+.12*u)*Math.sin(a))),rad*w));
}
function finishMesh(id,vertices,triangles,weld=false){
 let points=vertices,faces=triangles;
 if(weld){
  const map=new Map(),remap=[],out=[];
  for(let i=0;i<vertices.length;i+=3){const key=`${Math.round(vertices[i]*1e9)},${Math.round(vertices[i+1]*1e9)},${Math.round(vertices[i+2]*1e9)}`;let j=map.get(key);if(j===undefined){j=out.length/3;map.set(key,j);out.push(...vertices.slice(i,i+3));}remap.push(j);}
  points=out;faces=[];
  for(let i=0;i<triangles.length;i+=3){const a=remap[triangles[i]],b=remap[triangles[i+1]],c=remap[triangles[i+2]];if(a!==b&&b!==c&&a!==c)faces.push(a,b,c);}
 }
 // Drop zero-area faces and normalize the orientation of the closed shell.
 const valid=[];let volume6=0;
 for(let i=0;i<faces.length;i+=3){const a=faces[i]*3,b=faces[i+1]*3,c=faces[i+2]*3,ab=[points[b]-points[a],points[b+1]-points[a+1],points[b+2]-points[a+2]],ac=[points[c]-points[a],points[c+1]-points[a+1],points[c+2]-points[a+2]],n=cross(ab,ac);if(norm(n)<1e-14)continue;valid.push(faces[i],faces[i+1],faces[i+2]);volume6+=points[a]*n[0]+points[a+1]*n[1]+points[a+2]*n[2];}
 if(volume6<0)for(let i=0;i<valid.length;i+=3)[valid[i+1],valid[i+2]]=[valid[i+2],valid[i+1]];
 return {id,positions:new Float32Array(points),indices:new Uint32Array(valid)};
}
/** Render-only LOD retains fixed fold landmarks, independent of stage time. */
export function mantleMaterialSamples(record,g,quality=QUALITY.preview){
 if(!quality.foldFeatures)return materialSamples(g,quality.steps);
 if(g<=EPS)return [];
 const fixed=Array.from({length:quality.steps+1},(_,i)=>i/quality.steps);
 // Preserve the curl onset, a shared desktop curl sample, and true radial / rise extrema.
 fixed.push(.86,13/14);
 for(const angle of [Math.PI/2,Math.PI]){const u=.86+.14*angle/record.curlRadians;if(u>.86&&u<1)fixed.push(u);}
 const prefix=[...new Set(fixed)].sort((a,b)=>a-b).filter(u=>u<g-EPS);prefix.push(g);return prefix;
}
function makeMantle(r,g,q){
 const us=mantleMaterialSamples(r,g,q),nr=us.length,nc=q.cols+1,vertices=[],faces=[];
 for(const side of [1,-1])for(const u of us)for(let k=0;k<nc;k++)vertices.push(...sampleMantle(r,u,k/q.cols,side,q));
 const size=nr*nc;
 for(let side=0;side<2;side++)for(let j=0;j<nr-1;j++)for(let k=0;k<q.cols;k++){
  const a=side*size+j*nc+k,b=a+1,c=a+nc,d=c+1;
  faces.push(...(side===0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
 }
 const bd=[...Array(nc).keys()];for(let j=1;j<nr;j++)bd.push(j*nc+q.cols);for(let k=q.cols-1;k>=0;k--)bd.push((nr-1)*nc+k);for(let j=nr-2;j>0;j--)bd.push(j*nc);
 for(let i=0;i<bd.length;i++){const a=bd[i],b=bd[(i+1)%bd.length];faces.push(a,a+size,b,b,a+size,b+size);}
 return finishMesh(r.id,vertices,faces,true);
}
function makeTube(r,g,q){
 const ns=r.type==='stem'?q.tube:Math.max(12,Math.round(q.tube*.65)),us=materialSamples(g,r.path.length-1),vertices=[],faces=[];
 for(const u of us)for(let k=0;k<ns;k++)vertices.push(...sampleTube(r,u,k/ns));
 for(let j=1;j<us.length;j++)for(let k=0;k<ns;k++){const a=(j-1)*ns+k,b=(j-1)*ns+(k+1)%ns,c=j*ns+k,d=j*ns+(k+1)%ns;faces.push(a,b,c,b,d,c);}
 const bot=vertices.length/3;vertices.push(...r.path[0]);const z=g*(r.path.length-1),i=Math.min(r.path.length-2,Math.floor(z)),top=vertices.length/3;vertices.push(...mix(r.path[i],r.path[i+1],z-i));
 for(let k=0;k<ns;k++)faces.push(bot,(k+1)%ns,k,top,(us.length-1)*ns+k,(us.length-1)*ns+(k+1)%ns);
 return finishMesh(r.id,vertices,faces);
}
function makePad(r,q){
 const vertices=[],faces=[],nx=q.pad,ny=Math.max(8,Math.floor(q.pad/2));
 for(let j=0;j<=ny;j++){const t=j/ny*Math.PI;for(let k=0;k<nx;k++){const a=k/nx*TAU;vertices.push(...add(r.origin,[r.axes[0]*Math.sin(t)*Math.cos(a),r.axes[1]*Math.cos(t),r.axes[2]*Math.sin(t)*Math.sin(a)]));}}
 for(let j=0;j<ny;j++)for(let k=0;k<nx;k++){const a=j*nx+k,b=j*nx+(k+1)%nx,c=a+nx,d=b+nx;faces.push(a,b,c,b,d,c);}
 return finishMesh(r.id,vertices,faces,true);
}
export function evaluatePart(record,time,quality=QUALITY.preview){
 const g=record.type==='base'?1:progress(time,record.birth,record.duration);
 if(g<=.00001)return null;
 if(record.type==='base')return makePad(record,quality);
 if(record.type==='mantle')return makeMantle(record,g,quality);
 return makeTube(record,g,quality);
}
/** Full parts are memoized, while only new tips / mantle frontier strips change. */
export function createEvaluator(recipe,quality=QUALITY.preview){
 const complete=new Map();
 return time=>{
  const stage=clamp(finite(time,0)),parts=[],lineage=[];
  for(const r of recipe.records){const front=r.type==='base'?1:progress(stage,r.birth,r.duration);let mesh=null;
   if(front>.00001){mesh=front===1?complete.get(r.id):null;if(!mesh){mesh=evaluatePart(r,stage,quality);if(front===1)complete.set(r.id,mesh);}if(mesh)parts.push(mesh);}
   lineage.push({id:r.id,type:r.type,parent:r.parent,birth:r.birth,duration:r.duration,parentArrival:r.parentArrival,attachmentMaterialT:r.attachmentMaterialT??null,front,active:!!mesh});
  }
  return {model:recipe.model,time:stage,params:recipe.params,parts,lineage,union:false};
 };
}
export const evaluateStage=(recipe,time,quality=QUALITY.preview)=>createEvaluator(recipe,quality)(time);
export function mergeParts(parts){
 let nv=0,ni=0;for(const p of parts){nv+=p.positions.length;ni+=p.indices.length;}
 const positions=new Float32Array(nv),indices=new Uint32Array(ni),ranges=[];let vo=0,io=0;
 for(const p of parts){positions.set(p.positions,vo);for(let k=0;k<p.indices.length;k++)indices[io+k]=p.indices[k]+vo/3;ranges.push({id:p.id,vertexStart:vo/3,vertexCount:p.positions.length/3,faceStart:io/3,faceCount:p.indices.length/3});vo+=p.positions.length;io+=p.indices.length;}
 return {positions,indices,ranges};
}
export function stageToOBJ(stage){
 const lines=[`# ${MODEL_VERSION}`,`# t=${stage.time}; seed=${stage.params.seed}; density=${stage.params.density}; fold=${stage.params.fold}`,'# Raw overlapping individually closed tissue parts, NOT a watertight unified union.','# Units arbitrary; Y up; no water, sand, source geometry or source video.'];let offset=1;
 for(const p of stage.parts){lines.push(`o ${p.id.replaceAll('/','__')}`);for(let i=0;i<p.positions.length;i+=3)lines.push(`v ${p.positions[i].toFixed(6)} ${p.positions[i+1].toFixed(6)} ${p.positions[i+2].toFixed(6)}`);for(let i=0;i<p.indices.length;i+=3)lines.push(`f ${p.indices[i]+offset} ${p.indices[i+1]+offset} ${p.indices[i+2]+offset}`);offset+=p.positions.length/3;}
 return `${lines.join('\n')}\n`;
}
