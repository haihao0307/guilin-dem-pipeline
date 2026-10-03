// Adopted product reader. Source fitting and original residuals exist only in the offline compiler.

export function patchCompactLegacyR10(html){

 const start=html.indexOf('async function build(bytes,progress=()=>{}){'),end=html.indexOf('function measure(h)',start);
 if(start<0||end<0)throw Error('Compact legacy build ABI changed');
 const code=`async function build(bytes,progress=()=>{}){
 if(bytes instanceof ArrayBuffer)bytes=new Uint8Array(bytes);
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(new TextDecoder().decode(bytes.subarray(0,4))!=='FCP0'||v.getUint32(4,true)!==1)throw Error('Compact fish product ABI mismatch');
 const n=v.getUint32(8,true),o=Math.ceil((16+n)/8)*8;
 if(o+v.getUint32(12,true)!==bytes.length)throw Error('Compact fish product length mismatch');
 const head=JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+n)));
 if(head.schema!=='FISH_COMPACT_LEGACY_10')throw Error('Compact fish product schema mismatch');
 const meta=head.metadata,h={metadata:meta,binding:null,textures:{},disposed:false},types={Float32Array,Int16Array,Uint16Array,Uint8Array,Uint32Array};

 for(const b of head.blocks){const T=types[b.type],decoded=b.decodedBytes??b.bytes;if(!T||!['positions','normalOct','uv','weights','partInfo','partRoot','indices'].includes(b.field)||b.offset<0||o+b.offset+b.bytes>bytes.length||b.bytes!==decoded||b.length*T.BYTES_PER_ELEMENT!==decoded)throw Error('Compact fish block invalid');const src=bytes.subarray(o+b.offset,o+b.offset+b.bytes),raw=new Uint8Array(decoded);if(b.encoding==='BYTE_PLANE_DELTA_1'){const width=T.BYTES_PER_ELEMENT,L=b.length;for(let lane=0;lane<width;lane++){let sum=0;for(let i=0;i<L;i++){sum=(sum+src[lane*L+i])&255;raw[i*width+lane]=sum;}}}else if(!b.encoding||b.encoding==='RAW')raw.set(src);else throw Error('Unknown compact numeric encoding');h[b.field]=new T(raw.buffer);}
 for(const i of head.images){if(i.offset<0||o+i.offset+i.length>bytes.length)throw Error('Compact fish image invalid');h.textures[i.field]=bytes.subarray(o+i.offset,o+i.offset+i.length);}
 const N=meta.counts.vertices;if(h.positions.length!==N*3||h.weights.length!==N*12||h.partInfo.length!==N*2||h.partRoot.length!==N*3||h.indices.length!==meta.counts.triangles*3)throw Error('Compact field length mismatch');
 const tip=meta.continuum.axialGait.caudalTipVertex;
 h.dynamicTip={vertex:tip,position:h.positions.slice(tip*3,tip*3+3),normalOct:h.normalOct.slice(tip*2,tip*2+2),weights:h.weights.slice(tip*12,tip*12+12),partInfo:h.partInfo.slice(tip*2,tip*2+2),root:h.partRoot.slice(tip*3,tip*3+3)};
 reset(h);progress(1);return h;}
`;
 html=html.slice(0,start)+code+html.slice(end);
 const parseStart=html.indexOf('function copyTyped(buffer, byteOffset, length, Type)'),parseEnd=html.indexOf('function measureSurface(surface)',parseStart);
 if(parseStart<0||parseEnd<0)throw Error('Compact source parser removal ABI changed');
 html=html.slice(0,parseStart)+html.slice(parseEnd);
 html=html.replace('parseScore,build,reset','build,reset');
 // MIME describes disk encoding, not GPU channels. Preserve the original RGB
 // base/RM upload instead of expanding opaque WebP products to RGBA in VRAM.
 html=html.replace('async function texture(gl,b,mime){','async function texture(gl,b,mime,channels=4){').replace("const format=mime==='image/jpeg'?gl.RGB:gl.RGBA;",'const format=channels===3?gl.RGB:gl.RGBA;');
 html=html.replace("h.textures.base,'image/jpeg'","h.textures.base,h.metadata.package.baseMime,3").replace("h.textures.rm,'image/jpeg'","h.textures.rm,h.metadata.package.rmMime,3");
 return html;
}
