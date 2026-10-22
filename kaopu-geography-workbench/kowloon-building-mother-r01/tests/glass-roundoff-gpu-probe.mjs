import {buildAperturesGLSL,packApertureDescriptors,intersectAperturesRay} from '../r07/apertures.mjs';
import {withBoundedGlassEndpointVerification} from '../whole-building-facade-r01/glass-endpoint-roundoff.mjs';
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,s)=>a.map(x=>x*s),unit=a=>mul(a,1/Math.hypot(...a));
export function glassEndpointProbeCases(original){
 const p=structuredClone(original.primitives.find(p=>p.objectId===5611)),spec={...structuredClone(original),primitives:[p]},cases=[];
 const addCase=(name,ro,rd,specs=[spec],strict=true)=>cases.push({name,ro,rd,specs,strict});
  for(const sign of [-1,1])for(const [distance,cos] of [[.01,1],[.5,1],[17,1],[80,1],[17,.2],[.5,.02]]){const d=unit(add(mul(p.w,-sign*cos),mul(p.u,Math.sqrt(1-cos*cos)))),target=add(p.origin,mul(p.w,sign*p.halfDepth));addCase('outside-'+sign+'-'+distance+'-'+cos,add(target,mul(d,-distance)),d);}
  for(const sign of [-1,1])addCase('inside-'+sign,p.origin,mul(p.w,sign));
  for(const x of [p.outer.half[0]-.00001,p.outer.half[0]+.00001]){const point=add(p.origin,mul(p.u,x));addCase('edge-'+x,add(point,mul(p.w,.5)),mul(p.w,-1));}
  const duplicate=structuredClone(spec);duplicate.instanceId+=1;duplicate.primitives[0].objectId+=8;duplicate.primitives[0].instanceId+=1;addCase('coplanar-same-shape-lowest-id',add(p.origin,mul(p.w,17)),mul(p.w,-1),[duplicate,spec]);
  const joined=structuredClone(spec),jp=joined.primitives[0],shift=mul(p.w,p.halfDepth*2);joined.instanceId+=2;jp.objectId+=16;jp.instanceId+=2;jp.origin=add(jp.origin,shift);jp.bounds.min=add(jp.bounds.min,shift);jp.bounds.max=add(jp.bounds.max,shift);
  for(const sign of [-1,1])addCase('touching-neighbour-'+sign,add(p.origin,mul(p.w,sign*.5)),mul(p.w,-sign),[spec,joined]);
  for(const sign of [-1,1])addCase('inside-touching-seam-'+sign,add(p.origin,mul(p.w,p.halfDepth)),mul(p.w,sign),[spec,joined]);
  addCase('near-parallel-fallback',add(p.origin,mul(p.w,.006)),unit(add(p.u,mul(p.w,-.000001))),[spec],false);
 for(const c of cases)packApertureDescriptors(c.specs);
 return cases;
}
export async function runGlassEndpointProbe(s){
 await s.pause();const r=s.renderer,g=r.gl,original=s.getIntegration().facade.components.find(c=>c.primitives.some(p=>p.objectId===5611));
 const p=structuredClone(original.primitives.find(p=>p.objectId===5611)),spec={...structuredClone(original),primitives:[p]};
 const head='#version 300 es\nprecision highp float;precision highp int;\nint qaRecoveryAccepted=0;int qaIsolationRejected=0;\n';
 const tail='\nuniform vec3 qaOrigin;uniform vec3 qaDirection;layout(location=0) out vec4 result;layout(location=1) out vec4 normal;layout(location=2) out vec4 counters;void main(){float t;FieldHit h;int visits;bool found=apertureTraceRayFiltered(qaOrigin,normalize(qaDirection),false,0.0,t,h,visits);result=vec4(t,h.objectId,h.materialRole,found?1.:0.);normal=vec4(fieldRayNormal,0.);counters=vec4(float(qaRecoveryAccepted),float(qaIsolationRejected),0.,1.);}\n';
 const base=buildAperturesGLSL([spec]),fixedSource=withBoundedGlassEndpointVerification(base).replace('if(!apertureGlassRecoveryIsolated(own,point,error,skipObjectId))return false;\n return true;','if(!apertureGlassRecoveryIsolated(own,point,error,skipObjectId)){qaIsolationRejected++;return false;}\n qaRecoveryAccepted++;return true;'),programs=[r.compile('qa-original-cap',head+base+tail),r.compile('qa-bounded-cap',head+fixedSource+tail),r.compile('qa-unguarded-recovery',head+withBoundedGlassEndpointVerification(base).replace(' if(!apertureGlassRecoveryIsolated(own,point,error,skipObjectId))return false;\n','')+tail)];
 const fbo=g.createFramebuffer(),textures=[];g.bindFramebuffer(g.FRAMEBUFFER,fbo);
 for(let i=0;i<3;i++){const tex=g.createTexture();textures.push(tex);g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA32F,1,1,0,g.RGBA,g.FLOAT,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0+i,g.TEXTURE_2D,tex,0);}g.drawBuffers([g.COLOR_ATTACHMENT0,g.COLOR_ATTACHMENT1,g.COLOR_ATTACHMENT2]);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Probe float FBO unsupported');
 const rows=[];let descriptor=null;
 async function run(name,ro,rd,specs=[spec],strict=true){
  if(descriptor){g.deleteTexture(descriptor);r.textures=r.textures.filter(t=>t!==descriptor);}descriptor=r.texture(packApertureDescriptors(specs));
  const outputs=[];g.bindFramebuffer(g.FRAMEBUFFER,fbo);g.viewport(0,0,1,1);g.disable(g.SCISSOR_TEST);
  for(const program of programs){g.useProgram(program);r.bindTexture(program,'uApertureDescriptors',0,descriptor);g.uniform3fv(g.getUniformLocation(program,'qaOrigin'),ro);g.uniform3fv(g.getUniformLocation(program,'qaDirection'),rd);g.drawArrays(g.TRIANGLES,0,3);const h=new Float32Array(4),n=new Float32Array(4),c=new Float32Array(4);g.readBuffer(g.COLOR_ATTACHMENT0);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,h);g.readBuffer(g.COLOR_ATTACHMENT1);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,n);g.readBuffer(g.COLOR_ATTACHMENT2);g.readPixels(0,0,1,1,g.RGBA,g.FLOAT,c);outputs.push({hit:[...h],normal:[...n],counts:[...c]});}
  const cpu=intersectAperturesRay(specs,ro.map(Math.fround),unit(rd.map(Math.fround))),fixed=outputs[1],row={name,ro,rd,cpu,baseline:outputs[0],unisolated:outputs[2],fixed,strict};rows.push(row);
  row.passed=strict?(Boolean(fixed.hit[3])===cpu.hit&&(!cpu.hit||(Math.abs(fixed.hit[0]-cpu.t)<=.001&&fixed.hit[1]===cpu.objectId&&fixed.normal.slice(0,3).reduce((a,x,i)=>a+x*cpu.normal[i],0)>=.999))):JSON.stringify(outputs[0])===JSON.stringify(outputs[1]);
 }
 try{
  const coverage=await fetch('./tests/glass-coverage-edge-witness.json').then(r=>r.json());for(const c of [...glassEndpointProbeCases(original),coverage])await run(c.name,c.ro,c.rd,c.specs,c.strict);
  if(g.getError()!==0)throw Error('Probe WebGL error');return{passed:rows.every(r=>r.passed),rows,limitations:'Synthetic exact-interval probe, not a complete renderer proof. One near-parallel case checks unchanged fallback only; all others check CPU event/normal/ID.'};
 }finally{g.bindFramebuffer(g.FRAMEBUFFER,null);textures.forEach(t=>g.deleteTexture(t));g.deleteFramebuffer(fbo);if(descriptor){g.deleteTexture(descriptor);r.textures=r.textures.filter(t=>t!==descriptor);}programs.forEach(p=>{g.deleteProgram(p);r.programs=r.programs.filter(q=>q!==p);});}
}
