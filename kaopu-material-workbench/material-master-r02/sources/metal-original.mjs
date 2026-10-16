// FH88 RAIL_FUNCTION_RULES_R01 kh/kn/kfb and colour/rough/height expressions.
// WGSL syntax, explicit field footprint and contact/corrosion coupling are new.
export const KP_METAL_WGSL=String.raw`
fn mt_kh(pIn:vec3<f32>)->f32{var p=fract(pIn*.1031);p+=vec3<f32>(dot(p,p.yzx+vec3<f32>(33.33)));return fract((p.x+p.y)*p.z);}
fn mt_kn(p:vec3<f32>)->f32{let i=floor(p);var f=fract(p);f=f*f*(vec3<f32>(3.)-2.*f);return mix(mix(mix(mt_kh(i),mt_kh(i+vec3<f32>(1,0,0)),f.x),mix(mt_kh(i+vec3<f32>(0,1,0)),mt_kh(i+vec3<f32>(1,1,0)),f.x),f.y),mix(mix(mt_kh(i+vec3<f32>(0,0,1)),mt_kh(i+vec3<f32>(1,0,1)),f.x),mix(mt_kh(i+vec3<f32>(0,1,1)),mt_kh(i+vec3<f32>(1,1,1)),f.x),f.y),f.z);}
fn mt_kfb(p:vec3<f32>)->f32{return .57*mt_kn(p)+.28*mt_kn(p*2.13)+.15*mt_kn(p*4.17);}
fn kpMetalCorrosion(p:vec3<f32>,age:f32,wet:f32,repair:f32)->f32{let contact=(1.-smoothstep(.02,.07,abs(p.y-1.07)))*.7;let joint=(1.-smoothstep(.06,.18,p.y))+(1.-smoothstep(.01,.08,abs(p.y-.98)))*.28;return clamp(age*(1.-repair)*(wet*.7+joint*.55)*(1.-contact),0.,1.);}
fn kpMetalSurface(p:vec3<f32>,age:f32,wet:f32,repair:f32,footprintM:f32)->KpSurface{
 let kq=p+vec3<f32>(19.);let kp=mt_kfb(kq*3.1);let contact=(1.-smoothstep(.02,.07,abs(p.y-1.07)))*.7;let joint=(1.-smoothstep(.06,.18,p.y))+(1.-smoothstep(.01,.08,abs(p.y-.98)))*.28;let retained=age*(1.-repair);let corrosion=kpMetalCorrosion(p,age,wet,repair);
 var color=vec3<f32>(.17,.235,.20)*(.94+.09*kp);color=mix(color,vec3<f32>(.21,.082,.025),corrosion*.80);color*=1.-wet*.18;
 let rough=clamp(.53+(mt_kn(kq*9.)-.5)*.12+corrosion*.22-contact*.22-wet*.12,.12,.97);
 let originalHeight=(mt_kn(kq*65.)-.5)*.00025*(1.-smoothstep(.4,1.6,footprintM*65.));
 return KpSurface(originalHeight-corrosion*.0008,color,rough);
}
fn kpCableSurface(p:vec3<f32>,footprintM:f32)->KpSurface{let q=p+vec3<f32>(19.);return KpSurface((mt_kn(q*65.)-.5)*.00025*(1.-smoothstep(.4,1.6,footprintM*65.)),vec3<f32>(.014,.018,.019)*(.94+.09*mt_kfb(q*3.1)),clamp(.34+(mt_kn(q*9.)-.5)*.12,.08,.99));}
`;
export const METAL_SOURCE={module:'native/metal-original.mjs',revision:'RAIL_FUNCTION_RULES_R01',originalFunctions:['kh','kn','kfb'],newBridges:['explicit metre footprint','located corrosion section loss and PBR','contact polish'],dedicatedCableRubberMother:false,cableBinding:'original paint closure, dark polymer-like finish; not recovered rubber mother'};
