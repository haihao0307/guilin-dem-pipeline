/** Independent equal-location particle/MAC transfer example, version 0.1.0.
 * Trilinear weights and numeric blend are our implementation choices, not a
 * reconstruction of any proprietary transfer kernel. Positions m, mass kg.
 * This operator does not advect particles, generate a free surface or collide.
 */
import {makeMacGrid} from './pressure-projection.mjs';
const fields=['u','v','w'];
function validateParticles(g,particles){
 if(!Array.isArray(particles)||particles.length>500000)throw Error('Particle list/budget invalid');
 for(const p of particles){
  if(!p||!Array.isArray(p.position)||p.position.length!==3||!Array.isArray(p.velocity)||p.velocity.length!==3||!p.position.every(Number.isFinite)||!p.velocity.every(Number.isFinite)||!Number.isFinite(p.mass)||p.mass<=0)throw Error('Invalid particle');
  if(p.position.some((x,i)=>{const end=[g.nx,g.ny,g.nz][i]*g.spacing[i],eps=16*Number.EPSILON*Math.max(1,end);return x < -eps || x > end+eps;}))throw Error('Particle outside declared domain');
 }
}
function stencil(g,p,axis){
 const dims=[g.nx,g.ny,g.nz];dims[axis]++;
 const coordinates=p.map((x,i)=>Math.max(0,Math.min(x,[g.nx,g.ny,g.nz][i]*g.spacing[i]))/g.spacing[i]-(i===axis?0:.5)),base=coordinates.map(Math.floor),f=coordinates.map((x,i)=>x-base[i]),items=[];let sum=0;
 for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++){
  const cell=[base[0]+i,base[1]+j,base[2]+k];if(cell.some((v,q)=>v<0||v>=dims[q]))continue;
  const weight=(i?f[0]:1-f[0])*(j?f[1]:1-f[1])*(k?f[2]:1-f[2]);if(weight<=0)continue;
  items.push({index:(cell[2]*dims[1]+cell[1])*dims[0]+cell[0],weight});sum+=weight;
 }
 if(sum===0)throw Error('No supported MAC face');
 // Boundary truncation is explicitly renormalized. It is not a collision rule.
 for(const x of items)x.weight/=sum;return items;
}
export function particlesToMac(grid,particles){
 const g=makeMacGrid(grid.nx,grid.ny,grid.nz,grid.spacing);validateParticles(g,particles);
 const weights=Object.fromEntries(fields.map(k=>[k,new Float64Array(g[k].length)]));
 let totalParticleMassKg=0;
 for(const p of particles){totalParticleMassKg+=p.mass;for(let axis=0;axis<3;axis++){
  const field=fields[axis];for(const {index,weight}of stencil(g,p.position,axis)){weights[field][index]+=p.mass*weight;g[field][index]+=p.mass*weight*p.velocity[axis];}
 }}
 for(const k of fields)for(let i=0;i<g[k].length;i++)if(weights[k][i]>0)g[k][i]/=weights[k][i];
 return {u:g.u,v:g.v,w:g.w,weights,totalParticleMassKg,unpopulatedFaceValue:0,
  particleFluidMaskInferred:false,particleCount:particles.length};
}
export function macToParticles(grid,particles,oldVelocity,newVelocity,flipFraction){
 const g=makeMacGrid(grid.nx,grid.ny,grid.nz,grid.spacing);validateParticles(g,particles);
 if(!Number.isFinite(flipFraction)||flipFraction<0||flipFraction>1)throw Error('FLIP blend must be in [0,1]');
 for(const state of [oldVelocity,newVelocity])for(const k of fields){if(!(state?.[k] instanceof Float64Array)||state[k].length!==g[k].length||!state[k].every(Number.isFinite))throw Error('Velocity layout mismatch');}
 return particles.map(p=>{
  const velocity=fields.map((field,axis)=>{let pic=0,delta=0;
   for(const {index,weight}of stencil(g,p.position,axis)){pic+=weight*newVelocity[field][index];delta+=weight*(newVelocity[field][index]-oldVelocity[field][index]);}
   return (1-flipFraction)*pic+flipFraction*(p.velocity[axis]+delta);
  });
  return {...p,position:[...p.position],velocity};
 });
}
