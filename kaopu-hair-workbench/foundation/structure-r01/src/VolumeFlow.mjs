import {PROFILE,unit,add,sub,mul,mix,dot,smooth} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// Project-owned screened harmonic vector field. Style-curve tangents are soft
// constraints; this is not the paper's bi-Laplacian/incremental Cholesky solver.
export function volumeProfile(profile=PROFILE){return {revision:'volume-flow-09',source:'silhouette-framing',dividingCurve:structuredClone(profile.PartingCurves[0]),whorls:structuredClone(profile.WhorlField),step:.0012,gridStep:.008,iterations:240,priorWeight:.15,curveWeight:30,curveRadius:.011,clearance:.0015,rootBlendArc:.009,launchLift:.12,earLaunchLift:.24,earStrength:.60,curveStrength:1,bounds:{min:[-.144,.128,-.136],max:[.144,.432,.152]},authoring:{centerY:.303,centerZ:.012,width:.084,height:.112,depth:.096},limits:'Static current P01 authoring. No dense strands, finite-radius self contact or dynamics.'};}
export function assertVolumeField(f){
 if(f?.revision!=='volume-flow-09'||f.source!=='silhouette-framing')throw Error('Invalid volume source');
 for(const k of ['step','gridStep','iterations','priorWeight','curveWeight','curveRadius','clearance','rootBlendArc','launchLift','earLaunchLift','earStrength','curveStrength'])if(!Number.isFinite(f[k]))throw Error('Non-finite volume control '+k);
 if(f.step<.0005||f.step>.002||f.gridStep<.006||f.gridStep>.012||!Number.isInteger(f.iterations)||f.iterations<40||f.iterations>300||f.priorWeight<=0||f.curveWeight<=0||f.curveRadius<.006||f.curveRadius>.02||f.clearance<.0005||f.clearance>.004||f.rootBlendArc<.004||f.rootBlendArc>.02||f.launchLift<0||f.launchLift>.5||f.earLaunchLift<0||f.earLaunchLift>.5||f.earStrength<0||f.earStrength>1||f.curveStrength<0||f.curveStrength>1)throw Error('Volume controls outside current authoring bounds');
 if(!f.dividingCurve?.points||f.dividingCurve.points.length<2||f.dividingCurve.points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v)))||!Array.isArray(f.whorls)||f.whorls.some(w=>!Array.isArray(w.center)||w.center.length!==3||w.center.some(v=>!Number.isFinite(v))||!Number.isFinite(w.radius)||w.radius<=0||!Number.isFinite(w.strength)||w.strength<0||w.strength>1))throw Error('Invalid part/whorl constraints');
 if(!f.bounds||!f.authoring)throw Error('Missing volume coordinates');
 for(const key of ['min','max'])if(!Array.isArray(f.bounds[key])||f.bounds[key].length!==3||f.bounds[key].some(v=>!Number.isFinite(v)))throw Error('Invalid volume bounds');
 for(const k of ['centerY','centerZ','width','height','depth'])if(!Number.isFinite(f.authoring[k]))throw Error('Invalid style-curve shape');
 if(f.bounds.min.some((v,k)=>v>=f.bounds.max[k])||f.authoring.width<.075||f.authoring.width>.11||f.authoring.height<.09||f.authoring.height>.14||f.authoring.depth<.08||f.authoring.depth>.12)throw Error('Invalid style volume');return true;
}
export function styleCurves(f){
 const curves=[],q=f.authoring;
 for(const side of [-1,1])for(const angle of [1.02,1.38,1.78,2.18,2.62,3.08]){
  const points=[];for(let n=0;n<=32;n++){const t=.12+(Math.PI/2-.12)*n/32;points.push([side*Math.sin(angle)*q.width*Math.sin(t),q.centerY+q.height*Math.cos(t),q.centerZ+Math.cos(angle)*q.depth*Math.sin(t)]);}
  for(let n=1;n<=20;n++){const y=q.centerY+(.140-q.centerY)*n/20,e=smooth((.24-y)/.10);points.push([side*Math.sin(angle)*(q.width+.008*e),y,q.centerZ+Math.cos(angle)*(q.depth+.006*e)]);}
  curves.push({id:`stream/${side}/${angle}`,side,angle,points});
 }return curves;
}
function partAt(z,f){const c=f.dividingCurve.points;let j=0;while(j<c.length-2&&z<c[j+1][2])j++;const a=c[j],b=c[j+1],t=Math.max(0,Math.min(1,(z-a[2])/(b[2]-a[2])));return (a[0]+(b[0]-a[0])*t)*smooth((z+.060)/.030);}
function baseVector(p,hit,f){
 const side=p[0]<partAt(p[2],f)?-1:1;
 // A dividing boundary gives opposite escape directions near the crown.
 const crown=smooth((p[1]-.345)/.052),ear=smooth((Math.abs(p[0])-.050)/.025)*(1-smooth((p[1]-.320)/.035))*smooth((p[1]-.220)/.030),front=Math.tanh((p[2]-.014)/.018);
 let v=unit([side*(.18*crown+.08*ear),-1,front*ear*f.earStrength]);
 for(const w of f.whorls){const dx=p[0]-w.center[0],dz=p[2]-w.center[2],r=Math.hypot(dx,dz),weight=(1-smooth(r/w.radius))*(1-smooth(Math.abs(p[1]-w.center[1])/w.radius))*w.strength*.35,spin=unit([dx*.8+dz*(w.clockwise?1:-1),-.15,dz*.8-dx*(w.clockwise?1:-1)]);v=unit(mix(v,spin,weight));}
 const proximity=1-smooth((hit.signed-.004)/.022);
 if(proximity>0){const inward=Math.min(0,dot(v,hit.n));v=sub(v,mul(hit.n,inward*proximity));v=add(v,mul(hit.n,.08*proximity));}
 return unit(v);
}
function earAvoid(p,v){
 const side=p[0]<0?-1:1,w=smooth((Math.abs(p[0])-.050)/.022)*(1-smooth((p[1]-.325)/.035))*smooth((p[1]-.235)/.045)*(1-smooth(Math.abs(p[2]-.014)/.055))*(1-smooth((Math.abs(p[0])-.085)/.018));
 return unit(add(v,[side*.95*w,0,0]));
}

export function solveVolume(f,near){
 assertVolumeField(f);const curves=styleCurves(f),h=f.gridStep,min=f.bounds.min,shape=min.map((v,k)=>Math.ceil((f.bounds.max[k]-v)/h)+1),[nx,ny,nz]=shape,N=nx*ny*nz,index=(x,y,z)=>x+nx*(y+ny*z),base=new Float64Array(N*3),weights=new Float64Array(N),target=new Float64Array(N*3),curveNodes=new Set();
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=index(x,y,z),p=[min[0]+x*h,min[1]+y*h,min[2]+z*h],v=baseVector(p,near(p),f);weights[i]=f.priorWeight;for(let k=0;k<3;k++)base[i*3+k]=v[k],target[i*3+k]=v[k]*f.priorWeight;}
 for(const curve of curves)for(let n=1;n<curve.points.length-1;n++){
  const p=curve.points[n],v=unit(sub(curve.points[n+1],curve.points[n-1])),c=p.map((v,k)=>Math.round((v-min[k])/h)),r=Math.ceil(f.curveRadius/h);
  for(let z=Math.max(0,c[2]-r);z<=Math.min(nz-1,c[2]+r);z++)for(let y=Math.max(0,c[1]-r);y<=Math.min(ny-1,c[1]+r);y++)for(let x=Math.max(0,c[0]-r);x<=Math.min(nx-1,c[0]+r);x++){
   const q=[min[0]+x*h,min[1]+y*h,min[2]+z*h],d=Math.hypot(...sub(q,p));if(d>=f.curveRadius||Math.sign(q[0]-partAt(q[2],f))!==curve.side)continue;
   const i=index(x,y,z),w=f.curveWeight*f.curveStrength*(1-d/f.curveRadius)**2;weights[i]+=w;for(let k=0;k<3;k++)target[i*3+k]+=v[k]*w;if(w>0)curveNodes.add(i);
  }
 }
 let a=base.slice(),b=new Float64Array(N*3),residual=Infinity;
 for(let iteration=0;iteration<f.iterations;iteration++){residual=0;for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=index(x,y,z),px=min[0]+x*h,pz=min[2]+z*h,side=Math.sign(px-partAt(pz,f)),neighbours=[];
  for(const [xx,yy,zz]of [[x-1,y,z],[x+1,y,z],[x,y-1,z],[x,y+1,z],[x,y,z-1],[x,y,z+1]])if(xx>=0&&xx<nx&&yy>=0&&yy<ny&&zz>=0&&zz<nz){const qx=min[0]+xx*h,qz=min[2]+zz*h;/* Keep opposite crown directions from averaging across the part. */if(min[1]+y*h>.355&&side!==Math.sign(qx-partAt(qz,f)))continue;neighbours.push(index(xx,yy,zz));}
  for(let k=0;k<3;k++){let sum=target[i*3+k];for(const j of neighbours)sum+=a[j*3+k];const value=sum/(weights[i]+neighbours.length);b[i*3+k]=value;residual=Math.max(residual,Math.abs(value-a[i*3+k]));}
 }[a,b]=[b,a];}
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=index(x,y,z),p=[min[0]+x*h,min[1]+y*h,min[2]+z*h],v=earAvoid(p,unit(Array.from(a.subarray(i*3,i*3+3))));for(let k=0;k<3;k++)a[i*3+k]=v[k];}
 return {revision:f.revision,min,shape,step:h,vectors:Array.from(a),styleCurves:curves,report:{nodes:N,curveConstrainedNodes:curveNodes.size,iterations:f.iterations,maxLastIterationChange:residual,method:'screened harmonic interpolation of three vector components; part-aware grid neighbours',obstacleProjection:'bounded smooth ear-outlet correction baked once into final grid',baseWeight:f.priorWeight,curveWeight:f.curveWeight,curveStrength:f.curveStrength}};
}
export function sampleVolume(field,p){
 const [nx,ny,nz]=field.shape,c=p.map((v,k)=>(v-field.min[k])/field.step),lo=c.map((v,k)=>Math.max(0,Math.min(field.shape[k]-2,Math.floor(v)))),t=c.map((v,k)=>Math.max(0,Math.min(1,v-lo[k]))),v=[0,0,0];
 for(let z=0;z<=1;z++)for(let y=0;y<=1;y++)for(let x=0;x<=1;x++){const w=(x?t[0]:1-t[0])*(y?t[1]:1-t[1])*(z?t[2]:1-t[2]),i=(lo[0]+x+nx*(lo[1]+y+ny*(lo[2]+z)))*3;for(let k=0;k<3;k++)v[k]+=w*field.vectors[i+k];}return unit(v);
}
export function assertVolumeGrid(field,f){
 assertVolumeField(f);
 const expected=f.bounds.min.map((v,k)=>Math.ceil((f.bounds.max[k]-v)/f.gridStep)+1);
 if(field?.revision!==f.revision||JSON.stringify(field.shape)!==JSON.stringify(expected)||JSON.stringify(field.min)!==JSON.stringify(f.bounds.min)||field.step!==f.gridStep||field.vectors?.length!==expected.reduce((a,b)=>a*b,1)*3)throw Error('Volume grid layout mismatch');
 for(let i=0;i<field.vectors.length;i+=3){const p=field.vectors.slice(i,i+3),length=Math.hypot(...p);if(p.some(v=>!Number.isFinite(v))||Math.abs(length-1)>1e-7)throw Error('Invalid volume grid direction');}
 const curves=styleCurves(f);if(field.styleCurves?.length!==curves.length)throw Error('Missing style-curve constraints');
 for(let i=0;i<curves.length;i++){const a=curves[i],b=field.styleCurves[i];if(a.id!==b.id||b.points?.length!==a.points.length||a.points.some((p,n)=>p.some((v,k)=>Math.abs(v-b.points[n][k])>1e-8)))throw Error('Style curves differ from active profile');}
 return true;
}
function samplePolyline(points,count){
 const arcs=[0];for(let i=1;i<points.length;i++)arcs.push(arcs.at(-1)+Math.hypot(...sub(points[i],points[i-1])));let j=0;return Array.from({length:count},(_,i)=>{const s=arcs.at(-1)*i/(count-1);while(j<arcs.length-2&&arcs[j+1]<s)j++;return mix(points[j],points[j+1],(s-arcs[j])/(arcs[j+1]-arcs[j]));});
}
export function launchDirection(field,p,near,f){const hit=near(p);let v=sampleVolume(field,p);v=sub(v,mul(hit.n,dot(v,hit.n)));const ear=smooth((Math.abs(p[0])-.055)/.020)*(1-smooth((p[1]-.325)/.035))*smooth((p[1]-.235)/.045)*(1-smooth(Math.abs(p[2]-.014)/.055)),lift=f.launchLift+(f.earLaunchLift-f.launchLift)*ear;return unit(add(unit(v),mul(hit.n,lift)));}

export function traceVolume(source,field,f,near){
 assertVolumeField(f);const changes=[];
 const guides=source.map(old=>{
  if(old.zone<=1){changes.push({id:old.id,edited:false});return structuredClone(old);}
  const root=old.points.slice(0,3),initial=launchDirection(field,root,near,f),first=add(root,mul(initial,f.step)),path=[root,first];let p=first.slice(),arc=Math.hypot(...sub(first,root)),projections=0;
  const initialArc=arc; // Fixed root transition length, independent of tracing history.
  function vector(q,s){let v=sampleVolume(field,q);v=unit(mix(initial,v,smooth((s-initialArc)/f.rootBlendArc)));const hit=near(q),w=1-smooth((hit.signed-f.clearance)/.007);if(dot(v,hit.n)<0)v=sub(v,mul(hit.n,dot(v,hit.n)*w));return unit(add(v,mul(hit.n,.10*w)));}
  let stopped=false;
  for(let n=0;n<700;n++){
   const a=vector(p,arc),mid=add(p,mul(a,f.step*.5)),v=vector(mid,arc+f.step*.5);let q=add(p,mul(v,f.step));
   for(let j=0;j<6;j++){const hit=near(q),clear=f.clearance*smooth((arc-initialArc)/.010);if(hit.signed>=clear)break;q=add(q,mul(hit.n,Math.min(.003,clear-hit.signed)));projections++;}
   if(q[1]<=old.cut.hem){q=mix(p,q,(p[1]-old.cut.hem)/(p[1]-q[1]));q[1]=old.cut.hem;path.push(q);stopped=true;break;}
   arc+=Math.hypot(...sub(q,p));path.push(q);p=q;
  }
  if(!stopped)throw Error('Volume trace failed to reach regional cut: '+old.id+' '+JSON.stringify(p));
  const g=structuredClone(old),tail=samplePolyline(path.slice(1),96);g.points=[...root,...tail.flat()];g.sourceRoute=old.route;g.route=volumeRoute(g);g.sourceRouteAngle=old.routeAngle;g.routeAngle=Math.atan2(Math.abs(g.points.at(-3)),g.points.at(-1)-f.authoring.centerZ);g.cut={...old.cut,endpoint:g.points.slice(-3),operation:'shared-volume-rk2-streamline',sourceStudy:'silhouette-framing'};rebuildGuide(g);
  changes.push({id:g.id,edited:true,sourceLength:old.length,finalLength:g.length,nativeRootPoints:1,tracedNodes:path.length,collisionProjections:projections});return g;
 });return {guides,report:{revision:f.revision,editedGuides:changes.filter(c=>c.edited).length,changes,method:'RK2 tracing through shared trilinear 3D field, native root launch and regional cut stop'}};
}
export function volumeRoute(g){
 if(g.zone<=1)return 'fringe';if(g.zone>=8)return 'back';
 const points=Array.from({length:g.points.length/3},(_,n)=>g.points.slice(n*3,n*3+3));let p=points[0];for(let n=1;n<points.length;n++)if(points[n][1]<=.29){p=points[n-1][1]>.29?mix(points[n-1],points[n],(points[n-1][1]-.29)/(points[n-1][1]-points[n][1])):points[n];break;}
 return p[2]>.032?'ear-front':p[2]<-.018?'back':'ear-over';
}
export function assertVolumePreserved(source,output){
 assertVolumeIdentity(source,output);
 if(source.length!==output.length)throw Error('Volume lost guides');let edited=0;
 for(let i=0;i<source.length;i++){const a=source[i],b=output[i];for(const k of ['id','rootId','zone','macro','root'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Volume changed native identity/semantic route');if(a.points.slice(0,3).some((v,k)=>Math.abs(v-b.points[k])>1e-9))throw Error('Volume moved native root');if(a.cut.hem!==b.cut.hem)throw Error('Volume changed regional cut');if(a.zone<=1){for(const k of ['points','frames','arcLengths','length'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Volume changed fringe/temple');}else edited++;}
 return {guides:output.length,editedGuides:edited,nativeRootPoints:1};
}
export function assertVolumeIdentity(source,output){
 if(source.length!==output.length)throw Error('Volume lost guides');
 for(let i=0;i<source.length;i++){const a=source[i],b=output[i];for(const k of ['id','rootId','zone','macro','root'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Volume changed native identity/semantic route');if(a.points.slice(0,3).some((v,k)=>Math.abs(v-b.points[k])>1e-9))throw Error('Volume moved native root');if(a.zone<=1)for(const k of ['points','frames','arcLengths','length'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Volume changed fringe/temple');}return true;
}
