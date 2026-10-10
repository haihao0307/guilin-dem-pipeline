// Original, pure layout helpers. No scan data is generated or copied here.
export const ATLAS_LAYOUT=Object.freeze({width:1024,height:512,tile:256,columns:4,rows:2,layers:8,gutter:2,interior:252});
export function splitAtlasRGBA(rgba,width,height){
 const L=ATLAS_LAYOUT;
 if(width!==L.width||height!==L.height||rgba.length!==width*height*4)throw new RangeError('Expected the pinned ET12 1024 x 512 RGBA atlas');
 const out=new Uint8Array(rgba.length),stride=L.tile*4;
 for(let layer=0;layer<L.layers;layer++)for(let y=0;y<L.tile;y++){
  const x0=(layer%L.columns)*L.tile,y0=Math.floor(layer/L.columns)*L.tile;
  const source=((y0+y)*width+x0)*4,target=(layer*L.tile*L.tile+y*L.tile)*4;
  out.set(rgba.subarray(source,source+stride),target);
 }
 return out;
}
export function footprintLOD(mmPerPixel,spanMM){return Math.log2(Math.max(1e-12,Math.abs(mmPerPixel)*ATLAS_LAYOUT.interior/spanMM));}
export function wrappedDifferenceLOD(mm,mmPerPixel,spanMM){const fract=x=>x-Math.floor(x);return Math.log2(Math.max(1e-12,Math.abs(fract((mm+mmPerPixel)/spanMM)-fract(mm/spanMM))*ATLAS_LAYOUT.interior));}
