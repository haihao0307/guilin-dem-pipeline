/* Exact flat-region reconstruction. This is not a raster-to-vector authoring recovery. */
export function generateTexturePixels(manifest,residualBytes){
  if(manifest.schema!=='kaopu.exact-flat-texture-regions/1')throw Error('Unsupported texture schema');
  const {width:w,height:h,channels:c}=manifest,out=new Uint8Array(w*h*c),covered=new Uint8Array(w*h);
  for(const rule of manifest.rules){
    if(rule.fn!=='constant_rectangle')throw Error('Unsupported texture rule');
    const [x,y,rw,rh,color]=rule.args;
    if(!(0<=x&&x<x+rw&&x+rw<=w&&0<=y&&y<y+rh&&y+rh<=h&&color.length===c))throw Error('Invalid rectangle');
    for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++){
      const p=yy*w+xx;if(covered[p])throw Error('Overlapping texture rules');
      covered[p]=1;out.set(color,p*c);
    }
  }
  let at=0;
  for(let p=0;p<w*h;p++)if(!covered[p]){if(at+c>residualBytes.length)throw Error('Missing raster residual');out.set(residualBytes.subarray(at,at+c),p*c);at+=c;}
  if(at!==residualBytes.length)throw Error('Extra raster residual');
  return out;
}

/** Browser-ready, unpremultiplied RGBA8 payload. No DOM/Canvas/color conversion. */
export function makeRgbaPayload(manifest,residualBytes){
  const src=generateTexturePixels(manifest,residualBytes),n=manifest.width*manifest.height;
  if(![3,4].includes(manifest.channels))throw Error('Unsupported source channels');
  let rgba;
  if(manifest.channels===4)rgba=src;
  else {rgba=new Uint8Array(n*4);for(let p=0;p<n;p++){rgba.set(src.subarray(p*3,p*3+3),p*4);rgba[p*4+3]=255;}}
  return {data:rgba,width:manifest.width,height:manifest.height,channels:4,sourceChannels:manifest.channels,unpremultiplied:true,rgbTransfer:'sRGB for source baseColor use; set by material role',alphaTransfer:'linear',rowOrder:'original source top-to-bottom; glTF flipY=false',decoder:structuredClone(manifest.source.decoder),verifiedDomain:'Pillow source decode only; browser comparison is a separate required gate'};
}

/** Compare identical-domain bytes; callers must supply and report their decode path. */
export function comparePixelBytes(reference,candidate,channels=4){
  if(reference.length!==candidate.length)throw Error('Pixel byte length mismatch');
  if(!Number.isInteger(channels)||channels<1||reference.length%channels)throw Error('Invalid channel count');
  let mismatchChannels=0,mismatchPixels=0,maximumChannelDifference=0,sumAbsoluteDifference=0;
  for(let p=0;p<reference.length;p+=channels){let bad=false;for(let c=0;c<channels;c++){const d=Math.abs(reference[p+c]-candidate[p+c]);if(d){mismatchChannels++;bad=true;}maximumChannelDifference=Math.max(maximumChannelDifference,d);sumAbsoluteDifference+=d;}if(bad)mismatchPixels++;}
  return {exact:mismatchChannels===0,comparedPixels:reference.length/channels,comparedChannels:reference.length,mismatchPixels,mismatchChannels,maximumChannelDifference,sumAbsoluteDifference};
}
