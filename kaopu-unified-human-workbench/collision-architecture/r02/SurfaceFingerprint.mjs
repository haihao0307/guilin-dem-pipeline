const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const bytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
/** Cache identity is the actual rendered geometry, topology, complete CSR and
 * rig. A recipe state alone is insufficient for additive shape layers. */
export async function surfaceFingerprint(human){
 const encode=x=>new TextEncoder().encode(JSON.stringify(x)),data={schema:'actual-CSR-surface/2',geometrySHA256:await digest(bytes(human.positions)),topologySHA256:await digest(bytes(human.faces)),weightsSHA256:await digest(bytes(human.packed)),rangesSHA256:await digest(bytes(human.range)),restFingerprint:await digest(encode({names:human.names,parents:Array.from(human.rig.parents),rest:human.rig.restMatrices.map(m=>Array.from(m))})),vertices:human.N,triangles:human.faces.length/3};return {...data,surfaceFingerprint:await digest(encode(data))};
}
