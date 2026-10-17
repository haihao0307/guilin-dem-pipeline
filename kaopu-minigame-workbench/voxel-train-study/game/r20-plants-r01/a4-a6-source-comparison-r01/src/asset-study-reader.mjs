/** Versioned source-residual reader, not a claim of pure function/spectrum conversion. */
export const READER_CONTRACT='kaopu.asset-study/0.2-draft/runtime-1';
export function rebuildDisplayDefinition(content,binaryURI){
 if(!content?.displaySkeleton||!Array.isArray(content.fields)||!content.fieldPayload)throw Error('INVALID_ASSET_STUDY');
 const g=structuredClone(content.displaySkeleton);
 for(const [i,n]of g.nodes.entries())for(const c of n.children||[])if(!Number.isInteger(c)||c<0||c>=g.nodes.length)throw Error('INVALID_NODE_RELATION '+i);
 const bytes=content.fieldPayload.bytes??content.fieldPayload.byteLength;
 for(const [i,f]of content.fields.entries())if(f.byteOffset<0||f.byteLength<0||f.byteOffset+f.byteLength>bytes)throw Error('FIELD_OUT_OF_RANGE '+i);
 g.buffers=[{byteLength:bytes,uri:binaryURI}];g.bufferViews=content.fields.map(f=>({buffer:0,byteOffset:f.byteOffset,byteLength:f.byteLength}));g.accessors=content.fields.map((f,i)=>({...f.definition,bufferView:i,byteOffset:0}));g.images=(content.images||[]).map(img=>({...img.definition,uri:img.payload}));return g;
}
export function describeExpression(content){return{contract:READER_CONTRACT,nodes:content.displaySkeleton.nodes.length,fieldCount:content.fields.length,geometry:'exact typed source residuals',hierarchy:'source object identity and parent-child graph',materials:'original glTF PBR definitions and actual image fields',animation:'original channel targets, interpolation and typed time/value fields',nativeParametricMother:false,physicalCalibration:false};}
