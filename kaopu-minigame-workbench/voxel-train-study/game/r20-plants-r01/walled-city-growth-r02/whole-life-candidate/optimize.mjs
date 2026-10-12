import {optimizeScalarSource} from '../spatial-compile-candidate/optimize.mjs';
// The frozen coalescer matches the old call spelling. Its scheduling transform
// is unchanged; restore the reviewed clear-height expression on EVERY output call.
export function optimizeWholeLifeSource(source){
 if(!source.includes('by,fh-slab,'))throw Error('missing wall/slab interface correction');
 const result=optimizeScalarSource(source.replaceAll('by,fh-slab,','by,fh,')).replaceAll('by,fh,','by,fh-slab,');
 if(result.includes('by,fh,'))throw Error('wall clear height lost');return result;
}
