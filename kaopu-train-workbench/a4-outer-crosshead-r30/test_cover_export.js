'use strict';
const fs=require('fs'),assert=require('assert'),path=require('path'),vm=require('vm'),E=require('./middle_cover_export'),P=require('./topology-parameters');
const model=__dirname,c={};c.window=c;vm.createContext(c);
for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','topology-parameters.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(model,f),'utf8'),c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'middle-chest-fields.js'),'utf8'),c);
vm.runInContext(fs.readFileSync(path.join(model,'middle-chest-dynamic.js'),'utf8'),c);
const G=c.DYNAMIC.gresleySolver,pose=G.pose(.4),pack=E.pack(P,{qRef:pose.qMiddle,pinMRef:pose.pins.M}),find=id=>pack.parts.find(p=>p.id==='middle_topology/'+id);
assert.equal(pack.parts.length,49);assert.equal(pack.interfaces.length,12);assert.equal(pack.throughHoles.length,12);
let seed=29,checks=0,minCommon=Infinity,maxCPUGLSLError=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Evaluate exported GLSL call expressions independently of AST recursion.
const min=Math.min,max=Math.max,sin=Math.sin,cos=Math.cos,vec3=(...v)=>v,dot=(a,b)=>a.reduce((v,n,j)=>v+n*b[j],0),sub=(a,b)=>a.map((v,j)=>v-b[j]);
const mDisc=(p,c,a,r,h)=>Math.max(Math.hypot(...p.filter((_,j)=>j!==a).map((v,k)=>v-c.filter((_,j)=>j!==a)[k]))-r,Math.abs(p[a]-c[a])-h);
const mBoxInf=(p,c,h)=>Math.max(...p.map((v,j)=>Math.abs(v-c[j])-h[j]));
const mLocal=(p,s,c)=>[p[0],c*p[1]-s*p[2],s*p[1]+c*p[2]];
const mCylZ=(p,r,a,b)=>Math.max(Math.hypot(p[0],p[1])-r,a-p[2],p[2]-b);
const sourceFunctions={};for(const part of pack.parts){const expr=E.glsl(part.shape).replace(/p-vec3\(([^)]+)\)/g,'sub(p,vec3($1))');sourceFunctions[part.id]=(p,beta)=>{const middleInclination=beta,topologyWebOuter=p=>{const a=[0,1.016+Math.tan(beta)*p[2]],d=[P.middleX-a[0],P.planeY-a[1]],t=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]**2+d[1]**2))),az=Math.sin(beta)*(p[1]-1.016)+Math.cos(beta)*p[2];return Math.max(Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1])-.045,P.chest.rear+.002-p[2],p[2]-5,4.37-az,az-5.13);};return eval(expr);};}
for(const part of pack.parts)for(const beta of [.11,.126,.16])for(let i=0;i<2000;i++){const p=part.aabb_min.map((v,j)=>v-.002+rand()*(part.aabb_max[j]-v+.004)),a=E.scalar(part.shape,p,{beta}),b=sourceFunctions[part.id](p,beta);maxCPUGLSLError=Math.max(maxCPUGLSLError,Math.abs(a-b));assert(Math.abs(a-b)<2e-14);checks++;}
const pairAudit=[],staticParts=pack.parts.filter(p=>p.source==='installation');
for(let i=0;i<staticParts.length;i++)for(let j=i+1;j<staticParts.length;j++){
 const a=staticParts[i],b=staticParts[j];if(a.sameCastingWith===b.id.split('/').pop()||b.sameCastingWith===a.id.split('/').pop()){pairAudit.push({a:a.id,b:b.id,scope:'same fixed casting web/housing only; never removable cover'});continue;}
 const lo=a.aabb_min.map((v,k)=>Math.max(v,b.aabb_min[k])),hi=a.aabb_max.map((v,k)=>Math.min(v,b.aabb_max[k]));if(lo.some((v,k)=>v>hi[k]+1e-14))continue;
 let minD=Infinity;for(const beta of [.11,.126,.16])for(let n=0;n<3000;n++){const p=lo.map((v,k)=>v+rand()*(hi[k]-v)),d=Math.max(E.scalar(a.shape,p,{beta}),E.scalar(b.shape,p,{beta}));minD=Math.min(minD,d);assert(d>=-1e-12,JSON.stringify({a:a.id,b:b.id,p,beta,d}));checks++;}
 minCommon=Math.min(minCommon,minD);pairAudit.push({a:a.id,b:b.id,minimumSampledCommonField:minD,result:'no sampled positive-volume overlap; not continuous whole-train proof'});
}
// Explicit through holes are genuine voids, with separate finite stud occupancy.
for(const hole of pack.throughHoles){const end=hole.tag.split('_')[0],p=[...hole.center.slice(0,2),(hole.shape.range[0]+hole.shape.range[1])/2];assert(E.scalar(find(end+'_cover').shape,p)>0);assert(E.scalar(find('stud/'+hole.tag).shape,p)<0);}
for(const end of ['front','rear']){const p=find(end+'_cover'),z=(p.aabb_min[2]+p.aabb_max[2])/2;assert(E.scalar(p.shape,[.26199,P.planeY,z])>0);assert(E.scalar(p.shape,[.26201,P.planeY,z])<0);assert(E.scalar(p.shape,[P.middleX,P.planeY,z])>0);for(let i=0;i<1440;i++){const a=i*Math.PI/720,pt=[P.middleX+P.chest.boreRadius*Math.cos(a),P.planeY+P.chest.boreRadius*Math.sin(a),z];assert(E.scalar(p.shape,pt)<0);}}
// A hex nut's outside is not a disguised circular cylinder.
const nut=find('nut/front_0'),ctr=pack.interfaces.find(i=>i.tag==='front_0').centerXY,nz=(nut.aabb_min[2]+nut.aabb_max[2])/2;assert(E.scalar(nut.shape,[ctr[0]+.008,ctr[1],nz])>0);assert(E.scalar(nut.shape,[ctr[0]+.008*Math.cos(Math.PI/6),ctr[1]+.008*Math.sin(Math.PI/6),nz])<0);
let maxMotionError=0,minEyeGuide=Infinity;for(let k=0;k<=1440;k++){const theta=k*2*Math.PI/1440,po=G.pose(theta),delta=po.qMiddle-pose.qMiddle;minEyeGuide=Math.min(minEyeGuide,po.pins.M[2]-.033-P.chest.guideEnd);for(const p of c.MIDDLE_CHEST.movingParts){const ref=p.aabb_min.map((v,j)=>(v+p.aabb_max[j])/2),frame=c.DYNAMIC.gresleyFrame(p,theta,{mode:'candidate',beta:.126}),world=G.transformPoint(ref,frame);maxMotionError=Math.max(maxMotionError,Math.abs(world[2]-ref[2]-delta));}}
assert(maxMotionError<1e-12);assert(minEyeGuide>.005);assert.equal(c.SCENE.parts.filter(p=>c.DYNAMIC.visible(p,{mode:'baseline',beta:.11})).length,519);
const report={pass:true,scope:'cover topology, finite fasteners, CPU/GLSL expressions, local static interfaces and same-Time motion only',parts:pack.parts.length,staticParts:staticParts.length,movingParts:4,studCountPerCover:6,studPatternInferred:true,checks,maxCPUGLSLError,minSampledCommonField:minCommon,maxMotionError,minEyeGuide,minimumAnalyticMargins:pack.minimumAnalyticMargins,webRearZ:find('common_casting_web').aabb_min[2],baselineVisible:519,wholeTrainAcceptance:false,pressureVesselCertification:'not requested or claimed',strength:'unknown',sourceImagesIncluded:false,pairAudit};
fs.writeFileSync(path.join(__dirname,'COVER_EXPORT_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,pairAudit:undefined},null,2));
