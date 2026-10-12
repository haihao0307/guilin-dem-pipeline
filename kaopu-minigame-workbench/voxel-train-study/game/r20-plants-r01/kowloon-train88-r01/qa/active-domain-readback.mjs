// This validates actual terminal attachments, independently of the equality check.
export function validateActiveDomainReadback(comparison){
 const names=['shadow-trace','main-trace','q-seed','extent-source-seed','normal-base-distance','normal-validity','albedo-roughness','response','finish'];
 if(comparison.status!=='bit-identical'||comparison.records.length!==names.length)throw Error('Incomplete terminal comparison');
 const buffers={};for(const name of names){const r=comparison.records.find(x=>x.name===name);if(!r||r.mismatch||!r.checked||r.boundedBits.length!==r.width*r.height*4||r.unboundedBits.length!==r.boundedBits.length)throw Error('Invalid terminal attachment '+name);buffers[name]=new Float32Array(Uint32Array.from(r.boundedBits).buffer);}
 const tr=buffers['main-trace'];let hits=0,populated=0;const ranges=Object.fromEntries(names.slice(2).map(n=>[n,Array.from({length:4},()=>[Infinity,-Infinity])]));
 for(let i=0;i<tr.length;i+=4){if(tr[i+3]!==1)continue;hits++;for(const name of names.slice(2))for(let c=0;c<4;c++){const v=buffers[name][i+c];if(!Number.isFinite(v))throw Error('Nonfinite '+name+' at '+i);ranges[name][c][0]=Math.min(ranges[name][c][0],v);ranges[name][c][1]=Math.max(ranges[name][c][1],v);}
  if(Math.abs(Math.hypot(...buffers['normal-base-distance'].slice(i,i+3))-1)>.02)throw Error('Nonunit geometric normal');
  for(const [name,c]of[['albedo-roughness',3],['response',0],['response',1],['finish',0],['finish',1]])if(buffers[name][i+c]<-.0001||buffers[name][i+c]>1.0001)throw Error('Response outside unit range '+name+'.'+c);
  const a=buffers['albedo-roughness'].slice(i,i+3);if(a.some(x=>x<0))throw Error('Negative albedo');if(a.some(x=>x>0))populated++;
 }
 if(!hits||populated!==hits)throw Error('Missing populated material hits');return{hits,populated,ranges,scope:'actual terminal geometry/normal/material attachment identity and finite/range gate; no art or normal-resolution claim'};
}
