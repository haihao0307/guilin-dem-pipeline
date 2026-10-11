// NEW receiver-only quadrature. Source yarn / cotton equations are unchanged.
// This estimates conditional colour on already hit ID8 pixels. It is not a
// pixel-visibility solver: centre-ray pores and grazing visibility remain explicit.
export const COVERAGE_DOMAIN_WGSL=String.raw`
fn clothProjectedCoverage(f:RoomField,p:vec3<f32>,rd:vec3<f32>)->KpFabricCoverageSample{
 let phase=f.q.y*5.+f.q.x*3.;let slopeX=.36*cos(f.q.x*8.)+.054*cos(phase);let slopeY=.09*cos(phase);let n=normalize(vec3<f32>(-slopeX,-slopeY,1.));let nr=dot(n,rd);
 if(abs(nr)<1e-5){return KpFabricCoverageSample(0.,1.,vec3<f32>(0.),.95);}
 let rayLength=1./max(dot(rd,u.fw),1e-7);let angular=.96/u.resolution.y/rayLength;let dRx=(u.rt-rd*dot(rd,u.rt))*angular;let dRy=-(u.up-rd*dot(rd,u.up))*angular;let t=length(p-u.ro);
 let dx=(t*(dRx-rd*dot(n,dRx)/nr)).xy;let dy=(t*(dRy-rd*dot(n,dRy)/nr)).xy;let footprint=max(length(dx),length(dy));let exact=clothNative(f.q);
 if(footprint<.00021){return KpFabricCoverageSample(1.,0.,exact.albedo,exact.roughness);}
 var hitSum=0.;var unresolvedSum=0.;var colourSum=vec3<f32>(0.);var roughSum=0.;
 for(var i=0u;i<32u;i++){let xy=vec2<f32>((f32(i)+.5)/32.,kpFabricQuadratureV(i))-vec2<f32>(.5);let uv=f.q.xy+dx*xy.x+dy*xy.y;if(abs(uv.x)>.46||abs(uv.y)>.67){continue;}let sample=kpFabricCoverageColumn(uv,-nr);hitSum+=sample.hit;unresolvedSum+=sample.unresolved;colourSum+=sample.albedo*sample.hit;roughSum+=sample.roughness*sample.hit;}
 let count=max(hitSum,1.);let blend=smoothstep(.00021,.00168,footprint);return KpFabricCoverageSample(mix(1.,hitSum/32.,blend),unresolvedSum/32.,mix(exact.albedo,colourSum/count,blend),mix(exact.roughness,roughSum/count,blend));
}
`;
