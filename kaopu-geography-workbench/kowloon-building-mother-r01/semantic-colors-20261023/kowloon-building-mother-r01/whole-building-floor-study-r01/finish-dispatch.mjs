/** Surface finish dispatch only. Never changes distance, hit t, owner, shape or
 * ray normals. The evidence outline uses range[0, thickness], w points inward.
 * External cap retains observed-type horizontal tile; the internal cap, crown
 * and reveals receive explicitly assumed interior paint, not measured finishes.
 */
export function floorFinishRole(role,localDepth,range){return role===11&&Math.abs(localDepth-range[0])>.0001?12:role;}
export function applyFloorFinishDispatch(glsl){
 const token='h.materialRole=r.identity.y;h.local=p;';
 if(glsl.split(token).length!==2)throw Error('One stable-owner finish assignment required');
 return glsl.replace(token,'h.materialRole=(r.identity.y==11.&&abs(assemblyLocal(r,p).z-r.range.x)>.0001)?12.:r.identity.y;h.local=p;');
}
