'use strict';
const A=require('./shoreline_gpu_adapter.cjs');
const BEGIN='// SMI_WAKE_BAY_GPU_ADAPTER_BEGIN';
const END='// SMI_WAKE_BAY_GPU_ADAPTER_END';
const WAVE='float waveSurface(vec2 p,out float breaker){';
const LEGACY=/float\s+bed\s*=\s*bedH\(p\)\s*,\s*level\s*=\s*uSeaLevel/;
const PATCHED='float bed=smiAuthoritativeBedG(p),level=uSeaLevel';
function occurrences(haystack,needle){let n=0,i=0;while((i=haystack.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;}
function patchCommon(source){
 if(typeof source!=='string'||!source)throw new TypeError('GLSL common source required');
 if(source.includes(BEGIN)||source.includes('float smiAuthoritativeBedG(vec2 p)'))throw new Error('Adapter already present or ambiguous');
 if(occurrences(source,WAVE)!==1)throw new Error('Expected exactly one waveSurface anchor');
 const matches=source.match(new RegExp(LEGACY.source,'g'))||[];if(matches.length!==1)throw new Error(`Expected exactly one legacy wave bed read; found ${matches.length}`);
 const block=`${BEGIN}\n${A.glslSource()}${END}\n`;
 let out=source.replace(WAVE,block+WAVE);out=out.replace(LEGACY,PATCHED);
 return {source:out,changes:2,profileId:A.PROFILE_ID,oldBedRead:'bedH(p)',newBedRead:'smiAuthoritativeBedG(p)'};
}
function unpatchCommon(source){
 if(typeof source!=='string'||!source)throw new TypeError('GLSL common source required');
 const a=source.indexOf(BEGIN),b=source.indexOf(END);if(a<0||b<a)throw new Error('Adapter markers missing');
 if(occurrences(source,PATCHED)!==1)throw new Error('Expected exactly one patched wave bed read');
 const after=b+END.length;let out=source.slice(0,a)+source.slice(after);if(out.startsWith('\n',a))out=out.slice(0,a)+out.slice(a+1);out=out.replace(PATCHED,'float bed=bedH(p),level=uSeaLevel');return out;
}
module.exports={BEGIN,END,WAVE,patchCommon,unpatchCommon};
