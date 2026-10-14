/** Fit the whole motion, including jump apex and extended fingers, rather than
 * framing just the first standing pose. Root travel is followed independently.
 */
export function measureClipFraming(clip,sampler,height,floorOffset){
 let low=-floorOffset,high=-Infinity,radius=0;
 const root=sampler.rig.parents.findIndex(x=>x<0),step=Math.max(1,Math.floor((clip.frames.length-1)/30));
 for(let i=0;i<clip.frames.length;i+=step){sampler.apply(clip.frames[i]);const p=sampler.world[root].elements;
  for(let j=0;j<sampler.count;j++){const m=sampler.world[j].elements;low=Math.min(low,m[14]-height*.045);high=Math.max(high,m[14]+height*(sampler.rig.names[j]==='head'?.10:.035));radius=Math.max(radius,Math.hypot(m[12]-p[12],m[13]-p[13])+height*.045);}
 }
 return{low,high,radius};
}
