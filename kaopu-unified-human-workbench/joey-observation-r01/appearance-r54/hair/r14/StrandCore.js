/** Uniform triangle barycentric sampler excerpt from R14.2 StrandCore.js.
 * No Perm curve/filter algorithms, Digital Salon spring topology, or detail layer are included. */
export function sampleTriangle(rng){const u=Math.sqrt(rng()),v=rng();return [1-u,u*(1-v),u*v]}
