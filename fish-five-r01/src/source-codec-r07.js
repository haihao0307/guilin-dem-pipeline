// Self-contained for short-lived workers. Metadata and Float64 chart/residual remain exact.
export function decodeSourceR07(raw, expectedFormat = '') {
  if(new Uint8Array(new Uint32Array([1]).buffer)[0]!==1)throw Error('FSP7 requires little-endian typed-array storage');
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if(expectedFormat==='FCP10_GZIP'){
    if(bytes.length<16||new TextDecoder().decode(bytes.subarray(0,4))!=='FCP1')throw Error('Compact product magic mismatch');
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=v.getUint32(8,true),start=Math.ceil((16+n)/8)*8;
    if(v.getUint32(4,true)!==1||start+v.getUint32(12,true)!==bytes.length)throw Error('Compact product length mismatch');
    const head=JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+n)));
    if(head.schema!=='FISH_COMPACT_PRODUCT_10'||head.score.schema!==head.schema)throw Error('Compact product schema mismatch');
    const types={Float32Array,Uint32Array},seen=new Set();let end=0;
    for(const b of head.blocks){const T=types[b.type],p=head.score.primitives[b.primitive],key=b.primitive+':'+b.field;
      if(!T||!p||seen.has(key)||!['positions','normals','uvs','indices','finId','finWeight','finGradient'].includes(b.field)||b.offset<end||b.offset<0||start+b.offset+b.bytes>bytes.length||b.bytes!==b.length*T.BYTES_PER_ELEMENT)throw Error('Compact product block invalid');
      p[b.field]=new T(bytes.buffer,bytes.byteOffset+start+b.offset,b.length);seen.add(key);end=b.offset+b.bytes;
    }
    for(const p of head.score.primitives){if(p.base||p.residual||p.paramAddress)throw Error('Source reconstruction data is forbidden in product');for(const k of ['positions','normals','uvs','indices','finId','finWeight','finGradient'])if(!ArrayBuffer.isView(p[k]))throw Error('Incomplete compact product');}
    const images=[];for(const i of head.images){if(!head.score.textures[i.texture]||i.offset<end||start+i.offset+i.length>bytes.length)throw Error('Compact image invalid');images.push({texture:i.texture,prefix:'data:'+i.mime+';base64,',encodedBytes:bytes.subarray(start+i.offset,start+i.offset+i.length)});end=i.offset+i.length;}
    return {score:head.score,images,format:expectedFormat};
  }
  const magic = bytes.length >= 4 && bytes[0]===70 && bytes[1]===83 && bytes[2]===80 && bytes[3]===55;
  const float=['positions','normals','uvs','finWeight','finGradient'],double=['base','paramAddress','residual'],integer=['indices','finId'];
  if(!magic){
    if(expectedFormat && !['JSON_GZIP','R06_JSON_GZIP'].includes(expectedFormat))throw Error('Source format disagrees with carrier: '+expectedFormat);
    const text=new TextDecoder().decode(bytes);
    if(!text.trimStart().startsWith('{'))throw Error('Unsupported source format');
    const score=JSON.parse(text);
    if(score.schema!=='FISH_SOURCE_CHART_RESIDUAL_1')throw Error('Unsupported R06 source schema');
    for(const p of score.primitives){
      for(const key of float)if(p[key])p[key]=Float32Array.from(p[key]);
      for(const key of double)if(p[key])p[key]=Float64Array.from(p[key]);
      for(const key of integer)if(p[key])p[key]=Uint32Array.from(p[key]);
    }
    return {score,format:'R06_JSON_GZIP'};
  }
  if(expectedFormat && expectedFormat!=='FSP7_GZIP')throw Error('Source format disagrees with carrier: '+expectedFormat);
  if(bytes.length<16)throw Error('Truncated FSP7 header');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(4,true)!==1)throw Error('Unsupported FSP7 version');
  const headerLength=view.getUint32(8,true),blockLength=view.getUint32(12,true),start=Math.ceil((16+headerLength)/8)*8;
  if(headerLength<2||start+blockLength!==bytes.length)throw Error('Invalid FSP7 length');
  const header=JSON.parse(new TextDecoder().decode(bytes.subarray(16,16+headerLength)));
  if(header.schema!=='FSP7_TYPED_SOURCE_1'||header.score.schema!=='FISH_SOURCE_CHART_RESIDUAL_1')throw Error('Invalid FSP7 schema');
  // Transfer numeric storage only, avoiding retention of the large UTF8 texture header.
  const storage=bytes.buffer.slice(bytes.byteOffset+start,bytes.byteOffset+start+blockLength);
  const constructors={f32:Float32Array,f64:Float64Array,u32:Uint32Array};
  let previousEnd=0;const seen=new Set();
  for(const b of header.blocks){
    const C=constructors[b.type],p=header.score.primitives[b.primitive],key=b.primitive+':'+b.field;
    if(!C||!p||seen.has(key)||!Number.isSafeInteger(b.length)||b.length<0||!Number.isSafeInteger(b.offset)||b.offset<previousEnd||b.offset%C.BYTES_PER_ELEMENT||b.offset+b.length*C.BYTES_PER_ELEMENT>storage.byteLength)throw Error('Invalid FSP7 block');
    const correct=float.includes(b.field)?'f32':double.includes(b.field)?'f64':integer.includes(b.field)?'u32':'';
    if(correct!==b.type)throw Error('Invalid FSP7 field type');
    p[b.field]=new C(storage,b.offset,b.length);previousEnd=b.offset+b.length*C.BYTES_PER_ELEMENT;seen.add(key);
  }
  for(const p of header.score.primitives)for(const key of ['positions','normals','uvs','indices','paramAddress','residual','finId','finWeight','finGradient'])if(!ArrayBuffer.isView(p[key]))throw Error('Missing FSP7 field: '+key);
  const images=[],seenImages=new Set();
  if(header.images && header.images.length!==header.score.textures.length)throw Error('Incomplete FSP7 image set');
  for(const b of header.images || []){
    const t=header.score.textures[b.texture];
    if(!t||seenImages.has(b.texture)||!Number.isSafeInteger(b.offset)||b.offset<previousEnd||!Number.isSafeInteger(b.length)||b.length<0||b.offset+b.length>storage.byteLength||!/^data:[^;,]+;base64,$/.test(b.prefix)||t.uri!==null)throw Error('Invalid FSP7 image');
    seenImages.add(b.texture);
    const encoded=new Uint8Array(storage,b.offset,b.length);previousEnd=b.offset+b.length;
    if(t.mimeType!==b.prefix.slice(5,-8))throw Error('FSP7 image MIME metadata mismatch');
    images.push({texture:b.texture,prefix:b.prefix,encodedBytes:encoded});
  }
  return {score:header.score,format:'FSP7_GZIP',images};
}

// Attach after worker transfer: structuredClone would otherwise eagerly expand URI getters.
export function restoreSourceTexturesR07(score,images=[]){
  for(const image of images){
    const t=score.textures[image.texture],encoded=image.encodedBytes,prefix=image.prefix;
    Object.defineProperty(t,'encodedBytes',{value:encoded,enumerable:false});
    Object.defineProperty(t,'uri',{enumerable:true,configurable:true,get(){
      let result=prefix;
      for(let start=0;start<encoded.length;start+=24576){let chunk='';for(let i=start;i<Math.min(start+24576,encoded.length);i++)chunk+=String.fromCharCode(encoded[i]);result+=btoa(chunk);}
      return result;
    }});
  }
  return score;
}
