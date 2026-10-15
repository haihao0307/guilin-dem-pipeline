// Alternative to the fixed-.15 patch plan. Apply directly to the SAME pinned original inputs.
// Never apply this after static patches; SHA guards intentionally reject that sequence.
import {PATCH_PLAN,sha256,countExact} from './patch-plan.mjs';
const uniform={from:'uniform vec3 camera,fw,right,up;',to:'uniform float clipNear,clipFar;uniform vec3 camera,fw,right,up;',count:1};
const depth={from:'near=.15,far=60000.',to:'near=clipNear,far=clipFar',count:1};
const wrapper="function cameraData(){return mapCamera()}const hkUnclippedCameraData=cameraData;cameraData=()=>{const c=window.HKSharedProjection.frame(hkUnclippedCameraData(),{mode:window.HKTrain88?.getState?.().mode||'map',distance:mapState.distance});qa.clipProjection={near:c.clipNear,far:c.clipFar,mode:c.clipMode};return c;};";
const spatial={from:'return z+r>.15&&z-r<60000',to:'return z+r>c.clipNear&&z-r<c.clipFar',count:1};
const specs={
 r03:[{...depth,count:4},{...uniform,count:3},{from:'uniform vec3 camera,fw,right,up,flatForward;',to:'uniform float clipNear,clipFar;uniform vec3 camera,fw,right,up,flatForward;',count:3},{from:"v3(p,'camera',c.cam);",to:"f(p,'clipNear',c.clipNear);f(p,'clipFar',c.clipFar);v3(p,'camera',c.cam);",count:1},PATCH_PLAN.r03.patches[1],{from:'function cameraData(){return mapCamera()}',to:wrapper,count:1}],
 three:[PATCH_PLAN.three.patches[0],{from:'p.aspect=t.width/t.height,p.position.set(...G.cam)',to:'p.near=G.clipNear,p.far=G.clipFar,p.aspect=t.width/t.height,p.position.set(...G.cam)',count:1},{from:'cameraMode:k,cameraPosition:G.cam',to:'cameraMode:k,clipNear:p.near,clipFar:p.far,clipProjectionMatrix:p.projectionMatrix.elements.slice(),cameraPosition:G.cam',count:1}],
 airport:[depth,uniform,...PATCH_PLAN.airport.patches.slice(1,4),{from:"gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);",to:"gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);gl.uniform1f(gl.getUniformLocation(program,'tanFov'),Math.tan(55*Math.PI/360));gl.uniform1f(gl.getUniformLocation(program,'clipNear'),c.clipNear);gl.uniform1f(gl.getUniformLocation(program,'clipFar'),c.clipFar);",count:1}],
 city:[depth,uniform,{from:"['camera','fw','right','up','aspect','tanFov'",to:"['camera','fw','right','up','clipNear','clipFar','aspect','tanFov'",count:1},{from:'gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);',to:'gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);gl.uniform1f(uniforms.clipNear,c.clipNear);gl.uniform1f(uniforms.clipFar,c.clipFar);',count:1}],
 citySpatial:[spatial],
 outer:[depth,uniform,{from:"['camera','fw','right','up','aspect','tanFov'",to:"['camera','fw','right','up','clipNear','clipFar','aspect','tanFov'",count:1},{from:'gl.uniform1f(u.aspect,canvas.width/canvas.height);',to:'gl.uniform1f(u.aspect,canvas.width/canvas.height);gl.uniform1f(u.clipNear,c.clipNear);gl.uniform1f(u.clipFar,c.clipFar);',count:1},{from:'farPlaneM:60000',to:"farPlaneM:150000,nearPlanePolicy:'shared-c-cameraData'",count:1}],
 outerSpatial:[spatial]
};
export const DYNAMIC_PATCH_PLAN=Object.freeze(Object.fromEntries(Object.entries(PATCH_PLAN).map(([key,p])=>[key,{...p,patches:specs[key]}])));
export async function patchDynamicVerified(key,bytes){
 const p=DYNAMIC_PATCH_PLAN[key];if(!p)throw Error('Unknown dynamic projection input: '+key);
 const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes,inputSha256=await sha256(data);if(inputSha256!==p.sha256)throw Error(`${key}: SHA mismatch; expected ${p.sha256}; received ${inputSha256}`);
 let text=new TextDecoder('utf-8',{fatal:true}).decode(data),replacements=[];
 for(const r of p.patches){const found=countExact(text,r.from);if(found!==r.count)throw Error(`${key}: expected exactly ${r.count} occurrences of ${r.from}; found ${found}`);text=text.split(r.from).join(r.to);replacements.push({...r,count:found});}
 let restored=text;for(const r of [...p.patches].reverse())restored=restored.split(r.to).join(r.from);
 if(await sha256(new TextEncoder().encode(restored))!==inputSha256)throw Error(key+': inverse replay failed');
 return {text,inputSha256,outputSha256:await sha256(new TextEncoder().encode(text)),replacements};
}
