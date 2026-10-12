// Actual output attachment gate. This establishes finite, populated responses,
// not equality with standalone lighting or artistic material acceptance.
export function validateBureauReadback(raw){
 const {width:w,height:h,buffers}=raw;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)throw Error('Invalid readback dimensions');
 const names=['trace','transmission','position','geometricNormal','albedoRoughness','response','finish','materialNormal'];for(const key of names)if(!Array.isArray(buffers[key])||buffers[key].length!==w*h*4)throw Error('Wrong attachment length '+key);
 const ranges=Object.fromEntries(names.slice(2).map(n=>[n,Array.from({length:4},()=>[Infinity,-Infinity])]));let primaryHits=0,shadedHits=0,populated=0;
 for(let i=0;i<w*h;i++){const k=i*4;if(buffers.trace[k+3]!==1)continue;primaryHits++;if(buffers.transmission[k+3]!==1||buffers.position[k+3]<0)continue;shadedHits++;
  for(const name of names.slice(2))for(let c=0;c<4;c++){const v=buffers[name][k+c];if(!Number.isFinite(v))throw Error('Nonfinite '+name+' at '+i);ranges[name][c][0]=Math.min(ranges[name][c][0],v);ranges[name][c][1]=Math.max(ranges[name][c][1],v);}
  for(const name of ['geometricNormal','materialNormal']){const length=Math.hypot(...buffers[name].slice(k,k+3));if(Math.abs(length-1)>.02)throw Error('Nonunit '+name+' at '+i);}
  const unit=(name,c)=>{const v=buffers[name][k+c];if(v<-.0001||v>1.0001)throw Error('Response outside unit interval '+name+'.'+c+' at '+i);};unit('albedoRoughness',3);unit('response',0);unit('response',1);for(const c of [0,1])unit('finish',c);
  if(buffers.albedoRoughness.slice(k,k+3).some(v=>v<0))throw Error('Negative albedo at '+i);if(buffers.albedoRoughness.slice(k,k+3).some(v=>v>0))populated++;
 }
 if(primaryHits&&!shadedHits)throw Error('No shaded hits for visible bureau');if(shadedHits&&!populated)throw Error('All shaded albedo zero');
 return{width:w,height:h,primaryHits,shadedHits,populated,ranges:shadedHits?ranges:null,scope:'actual attachment finite/normal/range gate; not source-output equivalence, art or performance acceptance'};
}
