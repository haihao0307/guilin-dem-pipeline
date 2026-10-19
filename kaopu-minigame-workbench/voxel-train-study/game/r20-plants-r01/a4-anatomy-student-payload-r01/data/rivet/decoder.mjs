/** Original-slot POSITION decoder. Runtime has no source/teacher import, fetch or dependency. */
const RECORD_BYTES=32,PLACEMENT_BYTES=96;
function bytes(value,name){if(value instanceof Uint8Array)return value;if(value instanceof ArrayBuffer)return new Uint8Array(value);throw Error('Missing byte packet: '+name);}
function view(value,name){const b=bytes(value,name);return new DataView(b.buffer,b.byteOffset,b.byteLength);}
function requireRange(offset,length,total,name){if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>total)throw Error('Invalid '+name+' range');}
function context(pack,node){
 const m=pack.manifest;if(m?.schema!=='kaopu.a4.original-slot-rivet-position/1'||m.recordBytes!==RECORD_BYTES||m.placementRecordBytes!==PLACEMENT_BYTES)throw Error('Unsupported rivet packet schema');
 const row=m.nodes.find(r=>r.node===node);if(!row)throw Error('Unknown rivet node '+node);
 for(const name of ['placements','addresses','slots','components','residual'])if(bytes(pack[name],name).byteLength!==m.packets[name].byteLength)throw Error('Packet length mismatch: '+name);
 requireRange(row.componentStart*RECORD_BYTES,row.componentCount*RECORD_BYTES,bytes(pack.components,'components').byteLength,'components');return row;
}
export function decodeRivetPosition(node,pack){
 const row=context(pack,node),out=new Float32Array(row.vertexCount*3),visited=new Uint8Array(row.vertexCount),components=view(pack.components,'components'),placements=view(pack.placements,'placements'),slots=view(pack.slots,'slots'),addresses=bytes(pack.addresses,'addresses'),residual=view(pack.residual,'residual');
 for(let r=0;r<row.componentCount;r++){
  const b=(row.componentStart+r)*RECORD_BYTES,kind=components.getUint8(b),lon=components.getUint8(b+1),lat=components.getUint8(b+2),flags=components.getUint8(b+3),count=components.getUint32(b+4,true),slot=components.getUint32(b+8,true),addressOffset=components.getUint32(b+12,true),placement=components.getUint32(b+16,true)*PLACEMENT_BYTES,residualOffset=components.getUint32(b+20,true),recordNode=components.getUint32(b+24,true);
  if(recordNode!==node||flags>1||(kind!==0&&kind!==1))throw Error('Invalid component identity');
  if(flags&1)requireRange(slot,count,row.vertexCount,'source vertex slots');else requireRange(slot*2,count*2,slots.byteLength,'source slot table');
  let M;
  if(kind===1){if(!((lon===12&&lat===6)||(lon===16&&lat===8)))throw Error('Unsupported sphere family');requireRange(addressOffset,count,addresses.length,'sphere addresses');requireRange(placement,PLACEMENT_BYTES,placements.byteLength,'placement');M=Array.from({length:12},(_,j)=>placements.getFloat64(placement+j*8,true));if(!M.every(Number.isFinite))throw Error('Nonfinite placement');}
  else requireRange(residualOffset,count*12,residual.byteLength,'fallback positions');
  for(let j=0;j<count;j++){
   const dst=flags&1?slot+j:slots.getUint16((slot+j)*2,true);if(dst>=row.vertexCount||visited[dst])throw Error('Duplicate or invalid source vertex slot');visited[dst]=1;
   if(kind===0){for(let a=0;a<3;a++)out[dst*3+a]=residual.getFloat32(residualOffset+j*12+a*4,true);continue;}
   const address=addresses[addressOffset+j],k=Math.floor(address/lon),l=address%lon;if(k>lat||((k===0||k===lat)&&l!==0))throw Error('Invalid logical sphere address');
   let x,y,z;if(k===0){x=0;y=0;z=1;}else if(k===lat){x=0;y=0;z=-1;}else{const theta=k*Math.PI/lat,phi=l*2*Math.PI/lon,sin=Math.sin(theta);x=sin*Math.cos(phi);y=sin*Math.sin(phi);z=Math.cos(theta);}
   for(let a=0;a<3;a++)out[dst*3+a]=x*M[a]+y*M[3+a]+z*M[6+a]+M[9+a];
  }
 }
 if(visited.some(v=>v!==1)||out.some(v=>!Number.isFinite(v)))throw Error('Incomplete or nonfinite decoded positions');return out;
}
/** Optional CPU/demo helper. A larger student reader may supply these exact fields itself. */
export function readRetainedRivetAttribute(node,name,pack){
 const row=pack.manifest.nodes.find(r=>r.node===node),f=row?.retainedAttributes?.[name];if(!f)throw Error('Unknown retained attribute '+name);const b=bytes(pack.retained,'retained');requireRange(f.byteOffset,f.byteLength,b.length,'retained attribute');const copy=b.slice(f.byteOffset,f.byteOffset+f.byteLength);return f.definition.componentType===5126?new Float32Array(copy.buffer):new Uint32Array(copy.buffer);
}
export async function validateRivetPacketHashes(pack,cryptoProvider=globalThis.crypto){
 if(!cryptoProvider?.subtle)throw Error('SHA256 provider unavailable');for(const name of ['placements','addresses','slots','components','residual']){const b=bytes(pack[name],name),hash=new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',b)),hex=Array.from(hash,x=>x.toString(16).padStart(2,'0')).join('');if(hex!==pack.manifest.packets[name].sha256)throw Error('Packet SHA256 mismatch: '+name);}return true;
}
