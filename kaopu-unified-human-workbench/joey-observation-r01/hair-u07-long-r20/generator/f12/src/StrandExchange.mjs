import {DEPTH_RELATIONS,depthGroup} from './DepthRelations.mjs';
import {LENGTH_PROFILE} from './LayerLengths.mjs';
import {validateStyling,PRODUCTS} from './Styling.mjs';
// Compact lossless binary paths accompany the small guide/volume contract.
// Header length + UTF-8 header + ordered typed-array blocks (little endian).
export const DENSE_SCHEMA='kaopu/native-dense-hair@2';
export function denseHairBlob(parts,metadata){
 let offset=0;const blocks=[],rows=[];
 for(const p of parts){const row={id:p.id,referenceDepthGroup:depthGroup(p.id).id,patch:p.patch,parent:p.parent,count:p.count,samples:p.samples,sourceAreaCM2:p.sourceAreaCM2,blocks:{}};
  for(const key of ['positions','bindings','appearance','sourceCharts']){const a=p[key];if(!ArrayBuffer.isView(a))throw Error('密集发丝数组缺失');row.blocks[key]={offset,bytes:a.byteLength,type:a.constructor.name};offset+=a.byteLength;blocks.push(a);}
  rows.push(row);
 }
 const header={schema:DENSE_SCHEMA,referenceLengthProfile:LENGTH_PROFILE,referenceDepthRelations:DEPTH_RELATIONS,coordinates:'native-common-viewer-Yup',byteOrder:'little-endian',sourceChartCoordinates:'approved intrinsic scalp chart, not native or world positions',...metadata,count:rows.reduce((n,p)=>n+p.count,0),parts:rows,dataBytes:offset,strandIdentity:'part id + local strand index; stable root prefix at fixed recipe',diameterMicrometres:70,tipRadiusProfile:'1 - 0.92*smoothstep(0.88,1,u); render line width is screen-space only',finiteWidthCollisionCertified:false};
 const text=new TextEncoder().encode(JSON.stringify(header)),length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,text.length,true);
 return {header,blob:new Blob([length,text,...blocks],{type:'application/octet-stream'})};
}
export function readDenseHair(buffer){
 const bytes=new Uint8Array(buffer),length=new DataView(buffer).getUint32(0,true);if(length>1000000||length+4>bytes.length)throw Error('密集发丝头无效');const h=JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+length))),base=4+length;
 if(h.schema!==DENSE_SCHEMA||h.coordinates!=='native-common-viewer-Yup'||h.byteOrder!=='little-endian'||base+h.dataBytes!==bytes.length)throw Error('密集发丝契约或长度无效');
 if(h.motionProfile?.schema!=='kaopu/dense-motion-profile@1'||h.motionProfile.solverImplemented!==false)throw Error('缺少局部定型权重');validateStyling(h.motionProfile.styling);if(!Number.isFinite(h.motionProfile.freedom)||h.motionProfile.freedom<0||h.motionProfile.freedom>1||h.motionProfile.coefficientVersion!=='F12-local-styling@1'||typeof h.motionProfile.sourceCommit!=='string'||Object.entries(PRODUCTS).some(([id,values])=>Object.entries(values).some(([k,v])=>k!=='label'&&h.motionProfile.productProfiles?.[id]?.[k]!==v)))throw Error('定型系数或活动自由度无效');
 let total=0,end=0;for(const p of h.parts){if(!Number.isSafeInteger(p.count)||p.count<0||p.samples!==49)throw Error('密集发丝数量无效');for(const key of ['positions','bindings','appearance','sourceCharts']){const b=p.blocks[key],type=key==='bindings'?Float64Array:Float32Array,expected=p.count*(key==='positions'?p.samples*3:key==='sourceCharts'?3:4)*type.BYTES_PER_ELEMENT;if(b.offset!==end||b.bytes!==expected||b.type!==type.name)throw Error('密集发丝块无效');const copy=bytes.slice(base+b.offset,base+b.offset+b.bytes);p[key]=new type(copy.buffer);if(p[key].some(v=>!Number.isFinite(v)))throw Error('密集发丝坐标无效');end+=b.bytes;}for(let i=0;i<p.count;i++){const k=i*4,b=p.bindings.subarray(k+1,k+4);if(!Number.isInteger(p.bindings[k])||p.bindings[k]<0||p.bindings[k]>=50624||b.some(v=>v< -1e-8||v>1+1e-8)||Math.abs(b[0]+b[1]+b[2]-1)>1e-8)throw Error('密集发丝毛根绑定无效');}total+=p.count;}
 if(total!==h.count||end!==h.dataBytes)throw Error('密集发丝合计无效');return h;
}
