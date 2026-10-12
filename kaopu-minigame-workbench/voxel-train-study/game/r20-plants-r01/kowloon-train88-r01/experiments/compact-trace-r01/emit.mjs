import fs from'node:fs';import crypto from'node:crypto';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),dir=new URL('../spatial-query-r01/generated/',import.meta.url),reference=fs.readFileSync(new URL('reference.wgsl',dir),'utf8'),manifest=fs.readFileSync(new URL('manifest.json',dir)),start=reference.indexOf('@group(1)@binding(0)var probePoints:');if(start<0)throw Error('Original probe entry missing');
const entry=`@group(1)@binding(0)var probePoints:texture_2d<f32>;
@fragment fn compactTraceProbe(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let p=textureLoad(probePoints,vec2<i32>(pixel.xy),0).xyz;
 let h=stationDomain(p,u.debug==1.,u.debug==2.);
 let invalid=!all(abs(vec4<f32>(h.d,f32(h.id),h.baseD,h.seed))<vec4<f32>(1e30));
 return vec4<f32>(h.d,f32(h.id),f32(stationRawCandidateCount),select(0.,1.,stationCandidateOverflow)+select(0.,2.,invalid));
}
`;
const code=reference.slice(0,start)+entry;fs.writeFileSync(new URL('compact-trace.wgsl',dir),code);fs.writeFileSync(new URL('compact-manifest.json',dir),JSON.stringify({variant:'compact-trace',entry:'compactTraceProbe',sha256:sha(code),originalManifestSHA256:sha(manifest),originalFunctionPrefixSHA256:sha(reference.slice(0,start)),bytes:code.length,attachments:1,output:['physicalDistance','materialId','rawCount','flags: bit0 overflow, bit1 old-A-invalid'],originalPhysicalFunctionsUnchanged:true,storageSlots:96},null,2)+'\n');
