/** No surrogate equations: probes call the exact preserved R03e closure. */
export const GEOMETRY_PROBE=String.raw`
fn bureauProbePoint(i:u32)->vec3<f32>{let k=f32(i%32u);switch(i/32u){
 case 0u:{return vec3<f32>(-42.6+(k%4.)*.015,1.+floor(k/4.)*.65,-18.+(k%4.-1.5)*.7);}
 case 1u:{return vec3<f32>(-24.45+(k%4.)*.17,.3+floor(k/4.)*.83,-23.5+(k%3.-1.)*.86);}
 case 2u:{return vec3<f32>(.5+(k%4.-1.5)*.18,.45+floor(k/4.)*.19,9.75+(k%3.-1.)*.14);}
 case 3u:{return vec3<f32>(55.55+(k%4.)*.65,.5+floor(k/4.)*.56,45.45+(k%3.)*2.);}
 case 4u:{return vec3<f32>(61.+(k%4.-1.5)*1.18,.2+floor(k/4.)*4.35,55.);}
 default:{return vec3<f32>(-38.4+(k%4.)*2.2,.3+floor(k/4.)*.9,-.35+(k%3.)*.21);}
}}
@fragment fn geometryProbe(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let f=sceneField(bureauProbePoint(u32(pixel.x)));return vec4<f32>(f.d,f32(f.mat),f.seed,f.wet);}
`;
export const MATERIAL_PROBE=String.raw`
@fragment fn materialProbe(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let i=u32(pixel.x);let ids=array<u32,8>(2u,3u,4u,5u,7u,9u,14u,18u);let id=ids[i/8u];let k=f32(i%8u);
 let p=vec3<f32>(53.13+k*.139,1.23+k*.057,40.29+k*.173);let n=normalize(vec3<f32>(.2,.9,.3));let f=field(0.,id,p,71.+f32(id));
 let fp=select(.006,.021,i%2u==1u);let dx=vec3<f32>(fp,0.,0.);let dy=vec3<f32>(0.,0.,fp);let r=receiverResponse(f,p,n,fp,dx,dy);let mn=materialNormal(f,p,n,fp);let m=resolvedWeather(f,p,mn,r.surface);
 switch(u32(pixel.y)){case 0u:{return vec4<f32>(m.albedo,m.roughness);}case 1u:{return vec4<f32>(m.height,r.cavity,r.specularLevel,f32(id));}case 2u:{return vec4<f32>(r.clearcoat,r.clearcoatRoughness,r.macroHeightM,r.parallaxHeight01);}default:{return vec4<f32>(mn,f.wet);}}
}
`;
