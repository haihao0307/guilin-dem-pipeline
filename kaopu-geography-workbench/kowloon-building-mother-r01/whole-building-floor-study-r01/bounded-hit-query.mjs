/** Floor-only receiver optimization. Frozen authoritative solvers stay untouched.
 * Preserve the original ordered 1e-8 mapField reduction and final ray query.
 * The min(c,0) lower bound is intentionally weaker than positive cap distance:
 * its proof does not need an assumed error bound for length()/sqrt().
 */
import {buildBoundedAssemblyGLSL} from '../whole-building-ground-r01/bounded-assembly.mjs';
const OLD='FieldHit mapField(vec3 p){FieldHit h;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=p;int count=int(assemblyRecord(1).y);for(int k=0;k<count;k++){AssemblyPrimitive r=assemblyLoad(k);float d=assemblyPrimitiveLocal(r,assemblyLocal(r,p));if(d<h.distance-1e-8){h.distance=d;h.objectId=r.identity.x;h.materialRole=r.identity.y;h.local=p;}}return h;}';
const NEW='FieldHit mapField(vec3 p){FieldHit h;h.distance=1e20;h.objectId=0.0;h.materialRole=0.0;h.local=p;int count=int(assemblyRecord(1).y);for(int k=0;k<count;k++){AssemblyPrimitive r=assemblyLoad(k);vec3 q=assemblyLocal(r,p);float capDistance=abs(q.z-(r.range.x+r.range.y)*.5)-(r.range.y-r.range.x)*.5;if(uPruneHitQueries&&min(capDistance,0.0)>=h.distance-1e-8)continue;float d=assemblyPrimitiveLocal(r,q);if(d<h.distance-1e-8){h.distance=d;h.objectId=r.identity.x;h.materialRole=r.identity.y;h.local=p;}}return h;}';
export function buildHitQueryBoundedAssemblyGLSL(spec){const s=buildBoundedAssemblyGLSL(spec);if(s.split(OLD).length!==2)throw Error('Frozen mapField reduction contract changed');return 'uniform bool uPruneHitQueries;\n'+s.replace(OLD,NEW);}
export {OLD,NEW};
