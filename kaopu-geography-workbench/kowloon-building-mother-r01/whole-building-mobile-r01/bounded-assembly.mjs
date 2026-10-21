/** Preserve the frozen analytic solver's face, union, normal and identity rules.
 * Only pass a conservative current ray upper bound into its existing t pruning.
 * The caller retains the original final t+lo <= hi acceptance test. */
import {buildAssemblyGLSL} from '../r07/assemblies.mjs';
const SIGNATURE='bool caseTraceRay(vec3 ro,vec3 rd,out float t,out FieldHit h,out int visits)';
const INITIAL='t=1e20;bool found=false;';
export function buildBoundedAssemblyGLSL(spec,{pointBounds=true}={}){
 let source=buildAssemblyGLSL(spec);
 if(pointBounds){if(source.split(POINT_SCAN).length!==2)throw Error('Frozen point query contract changed');source=source.replace(POINT_SCAN,POINT_SCAN_BOUNDED);}
 for(const token of [SIGNATURE,INITIAL])if(source.split(token).length!==2)throw Error('Frozen analytic solver contract changed');
 return source.replace(SIGNATURE,'bool caseTraceRayBounded(vec3 ro,vec3 rd,float maxT,out float t,out FieldHit h,out int visits)').replace(INITIAL,'t=maxT;bool found=false;');
}

const POINT_SCAN='int count=int(assemblyRecord(1).y);for(int k=0;k<count;k++){AssemblyPrimitive r=assemblyLoad(k);float d=assemblyPrimitiveLocal(r,assemblyLocal(r,p));if(d<h.distance-1e-8)';
const POINT_SCAN_BOUNDED='int count=int(assemblyRecord(1).y);for(int k=0;k<count;k++){vec3 low=assemblyPrimitiveRecord(k,4).xyz,high=assemblyPrimitiveRecord(k,5).xyz;vec3 delta=max(low-p,p-high);float lower=length(max(delta,0.0))+min(max(delta.x,max(delta.y,delta.z)),0.0);float scale=1.0+max(abs(p.x),max(abs(p.y),abs(p.z)))+max(abs(low.x),max(abs(low.y),abs(low.z)))+max(abs(high.x),max(abs(high.y),abs(high.z)));if(lower>h.distance+32.0*1.1920929e-7*scale)continue;AssemblyPrimitive r=assemblyLoad(k);float d=assemblyPrimitiveLocal(r,assemblyLocal(r,p));if(d<h.distance-1e-8)';
/** Containing AABB signed distance is a lower bound for the exact signed prism.
 * Float32 numerical slack only retains extra candidates, never changes values. */
export function signedBoxLower(point,bounds){const d=point.map((v,i)=>Math.max(bounds.min[i]-v,v-bounds.max[i]));return Math.hypot(...d.map(v=>Math.max(v,0)))+Math.min(Math.max(...d),0);}
