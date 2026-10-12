// R3.12 soil/old mortar receiver surface-channel bridge. Original lighting is
// deliberately not copied: the scene's PBR receiver handles illumination.
// No new noise. pl_xi/pl_cell/pl_macroFast/pl_microFast are the same R3.12 algebra.
export const KP_MORTAR_WGSL=String.raw`
fn mo_coreMacro(p:vec3<f32>)->f32{let low=pl_macroFast(p);let broad=sin(p.x*3.1+.55*sin(p.y*1.7))*sin(p.y*3.8-.42*sin(p.x*1.4));return clamp(.84*low+.16*broad,-1.,1.);}
fn mo_coreMicro(p:vec3<f32>)->f32{let m=pl_microFast(p*vec3<f32>(2.75,2.62,3.55));let r=sin(p.x*43.-p.y*37.+p.z*53.+1.1)*sin(p.x*29.+p.y*31.-p.z*41.);return clamp(.76*m+.24*r,-1.,1.);}
fn mo_layerMacro(p:vec3<f32>,base:f32)->f32{let v=sin(p.x*2.25+p.y*1.62+p.z*3.10);return clamp(.87*base+.13*v,-1.,1.);}
fn mo_layerMicro(p:vec3<f32>,base:f32)->f32{let v=sin(p.x*41.-p.y*34.+p.z*49.);return clamp(.84*base+.16*v,-1.,1.);}
fn mo_observed(p:vec3<f32>,physicalFootprintM:f32)->f32{
 let phase=vec3<f32>(.7,-1.3,2.1);let xi=pl_xi(p,phase);let e=max(physicalFootprintM,1e-7);
 // New explicit footprint receiver, not a claim of exact screen-derivative parity.
 let fp=max(length(pl_xi(p+vec3<f32>(e,0.,0.),phase)-xi),max(length(pl_xi(p+vec3<f32>(0.,e,0.),phase)-xi),length(pl_xi(p+vec3<f32>(0.,0.,e),phase)-xi)));
 var sum=0.;var sc=1.;for(var i=0;i<17;i++){let gate=1.-smoothstep(.44,1.12,fp*sc);if(gate==0.){break;}sum+=gate*pl_cell(xi,sc)/sc;sc*=2.;}return tanh(.86*sum);
}
fn kpMortarOriginalSurface(p:vec3<f32>,physicalFootprintM:f32)->KpSurface{
 // Exact original createMortarReceiver defaults: #77736b, layer0, colorVariation0,
 // coreMicro0. Source shadeSoil still has its .00013m grain normal-height.
 let obs=mo_observed(p,physicalFootprintM);let macroTone=mo_layerMacro(p,mo_coreMacro(p));
 let grain=sin(p.x*67.-p.y*51.+p.z*83.);let height=.00013*grain;
 let base=pow(vec3<f32>(119.,115.,107.)/255.,vec3<f32>(2.2));
 let rough=clamp(.95+.035*(-obs)+.022*macroTone,.84,.996);
 return KpSurface(height,base,rough);
}
`;
