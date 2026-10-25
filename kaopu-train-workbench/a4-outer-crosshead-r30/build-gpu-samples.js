/* Finite diagnostic inputs for the integrated whole-scene GPU program.
 * This writes data only; it does not create a separate viewer or run a browser.
 */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),load=require('./load-r29'),api=require('./outer-crosshead'),install=require('./outer-crosshead-adapter');
const {compileExpression,evaluator}=require('./test-expression-parity'),float=evaluator(true),F=Math.fround;
const c=load(),D=c.DYNAMIC,C=install(c.SCENE,D,api),inst=D.snapshot({mode:'candidate'}),samples=[];
const parsed=new Map(C.parts.map(part=>{const m=C.source.match(new RegExp('float '+part.glsl_function+'\\(vec3 p\\)\\{vec3 q=p-vec3\\(([^;]+)\\);return (.+);\\}'));return[part.id,compileExpression(m[2])];}));
const floatInverse=(world,m)=>[F(world[0]),F(F(F(m[0])*F(world[1]))+F(F(F(m[1])*F(world[2]))+F(m[2]))),F(F(F(m[3])*F(world[1]))+F(F(F(m[4])*F(world[2]))+F(m[5])))];
for(const theta of [.4,1.4,3.2,5.7])for(const part of C.parts){
 const f=D.valveFrame(part,theta,inst),bounds=api.bounds(part.ast);
 const localPoints=[{label:'analytic-support-centre',q:bounds[0].map((v,i)=>(v+bounds[1][i])/2)},
  {label:'off-centre-general',q:bounds[0].map((v,i)=>v+.37*(bounds[1][i]-v))},
  {label:'outside-support',q:bounds[1].map(v=>v+.003)}];
 if(part.frameKind!=='static')localPoints.push({label:'V-axis',q:[0,0,0]},{label:'socket-running-interface',q:[0,.0162,.046]},{label:'transverse-pin-running-interface',q:[.025,0,.01215]},{label:'finite-key-slot-centre',q:[.035,0,.049]});
 for(const {label,q}of localPoints){const reference=q.map((v,i)=>v+part.origin[i]),world=f?D.valvePoint(reference,f):reference;
  const inverse=f?.inverseYZ||[1,0,0,0,1,0],floatReference=part.frameKind==='static'?world.map(F):floatInverse(world,inverse),expectedFloat32=float.run(parsed.get(part.id),float.referencePoint(floatReference,part.origin));
  samples.push({id:part.id,glslFunction:part.glsl_function,theta,label,worldPoint:world,referencePoint:reference,valveInverseYZ:inverse,scalarArgument:D.argument(part),expectedCPU:C.worldScalar(part.id,world,theta,inst),expectedFloat32});
 }
}
const out={version:C.version,sourceSHA256:crypto.createHash('sha256').update(C.source).digest('hex'),source:'outsideJoint',installation:inst,expectedSamples:samples.length,readbackTolerance_m:4e-6,status:'INPUTS ONLY; integrated GPU execution pending',instructions:'Compile and evaluate the actual integrated outsideJoint source/program with its actual same-theta inverse uniforms. Compare readback scalars with expectedCPU. Do not call an emulated result a GPU pass.',samples};
fs.writeFileSync(path.join(__dirname,'GPU_PARITY_SAMPLES.json'),JSON.stringify(out,null,2));console.log(JSON.stringify({expectedSamples:samples.length,sourceSHA256:out.sourceSHA256,status:out.status}));
