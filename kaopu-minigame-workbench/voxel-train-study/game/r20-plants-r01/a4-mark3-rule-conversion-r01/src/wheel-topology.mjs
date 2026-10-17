/** WT01 rotational triangle templates; WRP1 position order supplies source split-copy addresses. */
function positionTokens(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength),magic=String.fromCharCode(...b.subarray(0,4));
 if(magic==='WCC1'){const pl=v.getUint32(16,true);if(b.length<48+pl)throw new Error('Bad circular completion header');return positionTokens(b.subarray(48,48+pl));}
 if(magic==='WSC1'){
  const vc=v.getUint32(12,true),rc=v.getUint32(16,true),rl=v.getUint32(28,true),pl=v.getUint32(32,true),ml=v.getUint32(36,true),subset=positionTokens(b.subarray(48,48+rl)),mapAt=48+rl+pl,tokens=[];let j=0;
  if(ml!==vc*2)throw new Error('Bad spoke address map');for(let i=0;i<vc;i++)tokens.push(v.getUint16(mapAt+i*2,true)===0?subset[j++]:null);
  if(j!==rc||j!==subset.length)throw new Error('Bad spoke radial association');return tokens;
 }
 if(magic==='WRH1'){
  const vc=v.getUint32(12,true),gc=v.getUint32(16,true),ml=v.getUint32(20,true),il=v.getUint32(24,true),mask=b.subarray(32,32+ml),subset=positionTokens(b.subarray(32+ml,32+ml+il)),tokens=[];let j=0;
  for(let i=0;i<vc;i++)tokens.push(mask[i>>3]&(1<<(i&7))?subset[j++]:null);
  if(j!==gc)throw new Error('Bad hybrid position association');return tokens;
 }
 if(magic!=='WRP1')throw new Error('Topology requires a radial or hybrid position rule');
 const vc=v.getUint32(12,true),pc=v.getUint32(16,true),grid=[];let at=32;
 for(let p=0;p<pc;p++,at+=20){const n=v.getUint8(at+16),sides=v.getUint8(at+17),phase=v.getUint16(at+18,true);for(let s=0;s<sides;s++)for(let k=0;k<n;k++)grid.push((p*2+s)*64+(n===1?0:phase+64/n*k));}
 return Array.from({length:vc},(_,i)=>grid[v.getUint16(at+i*2,true)]);
}
export function positionAddressMap(input){const tokens=positionTokens(input),reps=new Map();tokens.forEach((t,i)=>{if(t!==null&&!reps.has(t))reps.set(t,i);});return reps;}

export function decodeRaw(input,positionRaw){
 const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<32||String.fromCharCode(...b.subarray(0,4))!=='WT01')throw new Error('Not WT01');
 const mesh=v.getUint32(4,true),field=v.getUint32(8,true),triangleCount=v.getUint32(12,true),pc=v.getUint32(16,true),cb=v.getUint32(20,true),rb=v.getUint32(24,true),ub=v.getUint32(28,true);
 if(cb!==triangleCount*2)throw new Error('Invalid triangle map');const reps=positionAddressMap(positionRaw),templates=[];let at=32;
 for(let i=0;i<pc;i++,at+=6)templates.push([[b[at],b[at+1]],[b[at+2],b[at+3]],[b[at+4],b[at+5]]]);
 const codeAt=at;at+=cb;const end=at+rb;let rawAt=end;if(end+ub!==b.length)throw new Error('Bad topology length');const indices=new Uint32Array(triangleCount*3);
 for(let i=0;i<triangleCount;i++){
  const code=v.getUint16(codeAt+i*2,true);if(code===65535){for(let j=0;j<3;j++)indices[i*3+j]=v.getUint32(rawAt+j*4,true);rawAt+=12;continue;}
  const template=templates[Math.floor(code/64)],anchor=code%64;if(!template)throw new Error('Unknown triangle template');
  for(let j=0;j<3;j++){const [ring,offset]=template[j],predicted=reps.get(ring*64+(anchor+offset)%64);if(predicted===undefined)throw new Error('Missing radial point');let zig=0,m=1,c;do{if(at>=end||m>2**35)throw new Error('Bad corner residual');c=b[at++];zig+=(c&127)*m;m*=128;}while(c>=128);indices[i*3+j]=predicted+(zig%2===0?zig/2:-(zig+1)/2);}
 }
 if(at!==end||rawAt!==b.length)throw new Error('Bad topology tail');return {mesh,field,triangleCount,indexCount:triangleCount*3,indices};
}
async function inflate(input){return new Uint8Array(await new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
export async function decodeGzip(input,positionInput){return decodeRaw(await inflate(input),await inflate(positionInput));}
