// Immutable input contract. No writes, fetches, imports, publication or host mutation here.
export const PROJECTION = Object.freeze({near:0.15,far:150000,fov:55,tanFov:Math.tan(55*Math.PI/360)});
const shader = {from:'near=.15,far=60000.',to:'near=.15,far=150000.',count:1};
export const PATCH_PLAN = Object.freeze({
 r03:{source:'hong-kong-map-sea-r03/publish-final/index.html',sha256:'54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117',output:'r03-projection.html',patches:[{...shader,count:4},{from:'mapState.distance=clamp(mapState.distance*Math.exp(e.deltaY*.001),180,60000)',to:'mapState.distance=clamp(mapState.distance*Math.exp(e.deltaY*.001),180,150000)',count:1}]},
 three:{source:'hong-kong-main-city-r01/integration-aligned.js',sha256:'137b21db65659b43658d51958a7ac2e4d05a4a2068765bd3af894a9b8ac3c286',output:'integration-aligned-150km.mjs',patches:[{from:'new Mt(55,1,.15,6e4)',to:'new Mt(55,1,.15,15e4)',count:1}]},
 airport:{source:'hong-kong-main-city-r01/airport.mjs',sha256:'69498383ede98b4fee61259b0c0bf64aa4ae045e8d472d3837dabf7e8a9131df',output:'airport.mjs',patches:[shader,{from:'uniform float aspect;out vec3 col;',to:'uniform float aspect,tanFov;out vec3 col;',count:1},{from:'dot(v,right)/(.520567*aspect),dot(v,up)/.520567',to:'dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov',count:1},{from:'z*.520567',to:'z*Math.tan(55*Math.PI/360)',count:2},{from:"gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);",to:"gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);gl.uniform1f(gl.getUniformLocation(program,'tanFov'),Math.tan(55*Math.PI/360));",count:1}]},
 city:{source:'hong-kong-main-city-r01/city-buildings/runtime.mjs',sha256:'bc3b6fed8e91cd1d34d7d7e5c8f0cba07cd41cdd121148f951e5b55e01966fad',output:'city-buildings/runtime.mjs',patches:[shader]},
 citySpatial:{source:'hong-kong-main-city-r01/city-buildings/spatial.mjs',sha256:'db55edaf8ba8c8fa2b6641d3c857e1da575a33650da7fd001b0b19dbb1140cb9',output:'city-buildings/spatial.mjs',patches:[{from:'z-r<60000',to:'z-r<150000',count:1}]},
 outer:{source:'research/hk-main-map-next-r02/outer-terrain/renderer.mjs',sha256:'c3d05707e5e4db92921d77b2544693ac961fd6cfcd30277e09fa847b95c25a18',output:'outer-terrain/renderer.mjs',patches:[shader,{from:'farPlaneM:60000',to:'farPlaneM:150000',count:1}]},
 outerSpatial:{source:'research/hk-main-map-next-r02/outer-terrain/spatial.mjs',sha256:'db55edaf8ba8c8fa2b6641d3c857e1da575a33650da7fd001b0b19dbb1140cb9',output:'outer-terrain/spatial.mjs',patches:[{from:'z-r<60000',to:'z-r<150000',count:1}]}
});
export const countExact=(text,token)=>text.split(token).length-1;
export async function sha256(bytes){return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function patchVerified(key,bytes){
 const p=PATCH_PLAN[key];if(!p)throw Error('Unknown projection input: '+key);
 const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;
 const inputSha256=await sha256(data);if(inputSha256!==p.sha256)throw Error(`${key}: SHA mismatch; expected ${p.sha256}; received ${inputSha256}`);
 let text=new TextDecoder('utf-8',{fatal:true}).decode(data),replacements=[];
 for(const rule of p.patches){const found=countExact(text,rule.from);if(found!==rule.count)throw Error(`${key}: expected exactly ${rule.count} occurrences of ${rule.from}; found ${found}`);text=text.split(rule.from).join(rule.to);replacements.push({from:rule.from,to:rule.to,count:found});}
 // A reverse replay must reconstruct every original byte, guarding unrelated changes.
 let restored=text;for(const r of [...p.patches].reverse())restored=restored.split(r.to).join(r.from);
 if(await sha256(new TextEncoder().encode(restored))!==inputSha256)throw Error(key+': inverse replay did not restore original bytes');
 return {text,inputSha256,outputSha256:await sha256(new TextEncoder().encode(text)),replacements};
}
