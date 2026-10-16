import {smooth,clamp} from './approved/LegacyFoundation.mjs';
export const LENGTH_PROFILE=Object.freeze({schema:'kaopu/reference-layer-lengths@1',authority:'authored front-reference reconstruction; concealed root areas and back layers inferred',method:'continuous source-chart fields select graduated crown overlays, face framing and retained long perimeter; no common lowest-tip plane',shortEnds:'some crown overlays finish near ear or jaw height',longEnds:'overlapping long source populations preserve the photographed shoulder-length outline',actualPathsAuthoritative:true});
// Neighbouring follicles share broad, smoothly feathered layer assignments.
// These fields choose WHERE a complete hair ends, never cut a surface shell.
export function layerEndpoint(id,c,baseHem,r){
 if(id.startsWith('bang')||id==='nape')return {hem:baseHem,graduation:0,curlScale:1,layer:'fringe-or-long-underlay'};
 const crown=smooth((c[1]-.344)/.040),side=id.endsWith('left')?-.55:.4;
 const field=clamp(.5+.37*Math.sin(c[0]*94+c[2]*68+side)+.13*Math.sin(c[2]*137-c[0]*52),0,1);
 const middle=smooth((field-.30)/.42),ear=smooth((field-.76)/.22);
 const back=id.startsWith('back'),raised=crown*(middle*.073+ear*(back?.050:.080));
 const hem=Math.min(baseHem+raised,back?.269:.285);
 return {hem,graduation:hem-baseHem,curlScale:1-.65*smooth((hem-.17)/.10),layer:hem>.258?'ear-level-overlay':hem>.185?'jaw-level-transition':'long-perimeter',sourceWeight:crown,field,profile:LENGTH_PROFILE.schema};
}
