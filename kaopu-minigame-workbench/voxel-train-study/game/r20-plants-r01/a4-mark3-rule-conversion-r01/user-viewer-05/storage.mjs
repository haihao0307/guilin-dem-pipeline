import {sha256} from '../src/exact-decoder.mjs';
import {unpack} from './transport.mjs';
/** Transport segmentation only. It does not count as learned geometry or compression. */
export async function loadResidualParts(storage,get){
 if(storage.version!==1||storage.residual.encoding!=='gzip'||!storage.residual.parts.length)throw Error('Invalid residual transport manifest');
 const spec=storage.residual,out=new Uint8Array(spec.bytes);let offset=0;
 for(const part of spec.parts){if(part.offset!==offset)throw Error('Residual part offset mismatch');const bytes=await get(part.path);if(bytes.byteLength!==part.bytes||await sha256(bytes)!==part.sha256)throw Error('Residual part integrity mismatch '+part.path);if(offset+bytes.length>out.length)throw Error('Residual parts overflow');out.set(bytes,offset);offset+=bytes.length;}
 if(offset!==spec.bytes||await sha256(out)!==spec.sha256)throw Error('Reassembled gzip integrity mismatch');
 const raw=await unpack(out);if(raw.length!==spec.rawBytes||await sha256(raw)!==spec.rawSHA256)throw Error('Residual raw integrity mismatch');return raw;
}
