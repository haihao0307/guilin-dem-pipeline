import assert from 'node:assert/strict';
import {ATLAS_LAYOUT,splitAtlasRGBA,footprintLOD,wrappedDifferenceLOD} from '../AtlasLayout.mjs';
const L=ATLAS_LAYOUT,rgba=new Uint8Array(L.width*L.height*4);for(let y=0;y<L.height;y++)for(let x=0;x<L.width;x++){const i=(y*L.width+x)*4;rgba.set([x%256,y%256,Math.floor(x/256)+Math.floor(y/256)*4,255],i);}
const copy=rgba.slice(),layers=splitAtlasRGBA(rgba,L.width,L.height);assert.deepEqual(rgba,copy);
for(let layer=0;layer<8;layer++)for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(layer*256*256+y*256+x)*4;assert.deepEqual(Array.from(layers.subarray(i,i+4)),[x,y,layer,255]);}
assert.throws(()=>splitAtlasRGBA(new Uint8Array(4),1,1),RangeError);
const mm=13.99,step=.02,span=14,before=wrappedDifferenceLOD(mm,step,span),after=footprintLOD(step,span);assert(before-after>9);
for(const scale of [.01,.02,.05,.1,.5,1,4])for(const tileSpan of [8,10,12,14,18,20,25])assert(Number.isFinite(footprintLOD(scale,tileSpan)));
console.log(JSON.stringify({passed:true,exactPixels:L.width*L.height,sourceUnchanged:true,demonstration:{mm,step,span,implicitWrappedLOD:before,continuousLOD:after,spuriousMipLevels:before-after},scope:'CPU atlas identity and derivative math; browser pixels require the separate QA run'},null,2));
