/** Preserve the frozen analytic solver's face, union, normal and identity rules.
 * Only pass a conservative current ray upper bound into its existing t pruning.
 * The caller retains the original final t+lo <= hi acceptance test. */
import {buildAssemblyGLSL} from '../r07/assemblies.mjs';
const SIGNATURE='bool caseTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits)';
const INITIAL='t=1e20;bool found=false;';
export function buildBoundedAssemblyGLSL(spec){
 const source=buildAssemblyGLSL(spec);
 for(const token of [SIGNATURE,INITIAL])if(source.split(token).length!==2)throw Error('Frozen analytic solver contract changed');
 return source.replace(SIGNATURE,'bool caseTraceRayBounded(vec3 ro,vec3 rd,float maxT,out float t,out FieldHit h,out int visits)').replace(INITIAL,'t=maxT;bool found=false;');
}
