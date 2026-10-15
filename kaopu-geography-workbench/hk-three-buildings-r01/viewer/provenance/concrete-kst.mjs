// KST1-surfaces-2 concrete (ST_FAMILY 8) source arithmetic, translated to WGSL.
// mt_kh/mt_kn are the same .1031/33.33 hash and trilinear cubic-noise closure
// used by original stHash/stNoise. No new noise family is introduced.
// Floor-domain maintenance and explicit metric footprint are station bindings.
export const KP_CONCRETE_WGSL=String.raw`
fn kpConcreteStation(p:vec3<f32>,age:f32,wetness:f32,repair:f32,footprint:f32)->KpSurface{
 let q=p+vec3<f32>(19.,19.*.71,19.*.37);let large=mt_kn(q*.63);let meso=mt_kn(q*3.7);var fine=.5;if(footprint<.021){fine=mix(mt_kn(q*127.),.5,smoothstep(.003,.021,footprint));}
 let moisturePatch=smoothstep(.43,.72,large)*smoothstep(.28,.62,meso);let fresh=repair;let damp=clamp(moisturePatch*(.42+large*.58)*(1.-fresh*.85),0.,1.);let wet=wetness*clamp(damp+smoothstep(.60,.81,large)*.38+.22,0.,1.);
 let base=vec3<f32>(.468,.451,.381);let gray=moisturePatch*age*.18*(1.-fresh);var color=mix(base,base*.69+vec3<f32>(.027,.030,.025),gray);let chip=smoothstep(.64,.81,mt_kn(q*23.))*smoothstep(.46,.76,meso)*age;
 color=mix(color,base*vec3<f32>(.59,.56,.49),chip*.42);color=mix(color,base*vec3<f32>(.50,.56,.50),damp*age*.72);color=mix(color,mix(base,vec3<f32>(.80,.78,.69),.17),fresh*.85);color*=1.-wet*.13;
 let height=(fine-.5)*.00042-chip*.0007;let rough=clamp(.87+(fine-.5)*.07-wet*.23,.23,1.);return KpSurface(height,color,rough);
}
`;
