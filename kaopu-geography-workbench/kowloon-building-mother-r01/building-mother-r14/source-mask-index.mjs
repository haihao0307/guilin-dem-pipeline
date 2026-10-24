/** Per-source-face opening index. Field parameters only, no triangle buffers. */
export function packSourceMaskIndex(masks,source){
 const byId=new Map(source.patches.map((p,k)=>[p.sourcePatchId,{p,k,list:[]}])) ;
 for(const m of masks.filter(m=>m.enabled)){const e=byId.get(m.sourcePatchId);if(!e||e.p.objectId!==m.sourceObjectId)throw Error('Mask host identity mismatch');if(![m.width,m.height,m.depth].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid mask bounds');for(const a of ['origin','u','v','w'])if(!Array.isArray(m.frame?.[a])||m.frame[a].length!==3||!m.frame[a].every(Number.isFinite))throw Error('Invalid mask frame');e.list.push(m);}
 const count=[...byId.values()].reduce((n,e)=>n+e.list.length,0);if(count>2048)throw Error('Source mask budget exceeded');const records=Math.max(1,source.patches.length+4*count),width=Math.min(128,2**Math.ceil(Math.log2(Math.max(1,Math.sqrt(records))))),height=Math.ceil(records/width),data=new Float32Array(width*height*4);let next=source.patches.length;
 for(const {p,k,list} of byId.values()){data.set([next,list.length,p.objectId,0],4*k);for(const m of list){for(const row of [[...m.frame.origin,m.depth/2+.0001],[...m.frame.u,m.width/2],[...m.frame.v,m.height/2],[...m.frame.w,0]]){data.set(row,4*next++);}}}
 return{width,height,data,count,records,sourcePatchCount:source.patches.length};
}
export const SOURCE_MASK_GLSL=`uniform bool uMasksEnabled;uniform sampler2D uSourceMasks;
vec4 sourceMaskRecord(int i){int w=textureSize(uSourceMasks,0).x;return texelFetch(uSourceMasks,ivec2(i%w,i/w),0);}
bool floorAcceptSource(int k,vec3 p){if(!uMasksEnabled)return true;vec4 h=sourceMaskRecord(k);int start=int(h.x),count=int(h.y);for(int i=0;i<count;i++){int j=start+4*i;vec4 o=sourceMaskRecord(j),u=sourceMaskRecord(j+1),v=sourceMaskRecord(j+2),w=sourceMaskRecord(j+3);vec3 q=p-o.xyz;if(abs(dot(q,u.xyz))<u.w&&abs(dot(q,v.xyz))<v.w&&abs(dot(q,w.xyz))<o.w)return false;}return true;}`;
