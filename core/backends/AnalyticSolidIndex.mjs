// Rebuildable, shared GPU hierarchy for translated analytic boxes and
// ellipsoids. These records are transient acceleration, never world data.
const states=new WeakMap(),scratch=new Float32Array(1),bits=new Uint32Array(scratch.buffer);
const outward=(x,up)=>{scratch[0]=x;if((up&&scratch[0]<x)||(!up&&scratch[0]>x))bits[0]+=((scratch[0]>=0)===up)?1:-1;return scratch[0];};
export function buildManyAnalyticSolids(items){
 if(!Array.isArray(items)||items.length>1000)throw Error('The analytic solid index supports at most 1000 instances');
 const entries=items.map((item,ordinal)=>{if(!['box','ellipsoid'].includes(item.kind)||![item.position,item.extent,item.colour].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||item.extent.some(x=>x<=0)||![item.roughness,item.metalness].every(Number.isFinite))throw Error('Invalid analytic solid');
  const p=item.position.map(Math.fround),e=item.extent.map(Math.fround),bounds={low:p.map((v,k)=>outward(v-e[k],false)),high:p.map((v,k)=>outward(v+e[k],true))};return{item,ordinal,p,e,bounds};});
 const nodes=[],order=[],combine=a=>({low:[0,1,2].map(k=>Math.min(...a.map(x=>x.bounds.low[k]))),high:[0,1,2].map(k=>Math.max(...a.map(x=>x.bounds.high[k])))});
 const build=a=>{const index=nodes.length,bounds=combine(a);nodes.push(null);if(a.length<=4){const start=order.length;order.push(...a);nodes[index]={bounds,encoded:start*8+a.length,skip:nodes.length};return;}
  const extent=bounds.high.map((v,k)=>v-bounds.low[k]);let axis=0;if(extent[1]>extent[axis])axis=1;if(extent[2]>extent[axis])axis=2;a.sort((x,y)=>x.p[axis]-y.p[axis]||x.ordinal-y.ordinal);const m=Math.floor(a.length/2);build(a.slice(0,m));build(a.slice(m));nodes[index]={bounds,encoded:0,skip:nodes.length};};
 if(entries.length)build(entries);
 const records=new Float32Array(Math.max(1,order.length)*16),packedNodes=new Float32Array(Math.max(1,nodes.length)*8);
 for(let i=0;i<order.length;i++){const {item,ordinal,p,e}=order[i],at=i*16;records.set([...p,item.kind==='box'?1:0,...e,item.metalness,...item.colour,item.roughness,ordinal,0,0,0],at);}
 nodes.forEach((n,i)=>packedNodes.set([...n.bounds.low,n.encoded,...n.bounds.high,n.skip],i*8));
 return{records,nodes:packedNodes,recordCount:order.length,nodeCount:nodes.length,order:order.map(x=>x.ordinal)};
}

export const analyticSolidGLSL=`
uniform int uSolidCount,uSolidNodeCount;uniform bool uSolidShadows;
uniform sampler2D uSolidRecords,uSolidNodes;
vec4 solidWord(int at){return texelFetch(uSolidRecords,ivec2(at%1024,at/1024),0);}
vec4 solidNode(int at){return texelFetch(uSolidNodes,ivec2(at%1024,at/1024),0);}
vec4 solidPosition(int i){return solidWord(i*4);}
vec4 solidExtent(int i){return solidWord(i*4+1);}
vec4 solidMaterial(int i){return solidWord(i*4+2);}
vec2 solidInterval(int i,vec3 o,vec3 d){
 vec4 pos=solidPosition(i),ext=solidExtent(i);vec3 q=o-pos.xyz,e=ext.xyz;
 if(pos.w<.5){vec3 a=q/e,b=d/e,perp=cross(a,b);float A=dot(b,b),closest=-dot(a,b)/A,h=1.-dot(perp,perp)/A;if(h<0.)return vec2(1.e20,-1.e20);float halfSpan=sqrt(h/A);return vec2(closest-halfSpan,closest+halfSpan);}
 float lo=-1.e20,hi=1.e20;for(int k=0;k<3;k++){if(abs(d[k])<1.e-12){if(abs(q[k])>e[k])return vec2(1.e20,-1.e20);}else{float a=(-e[k]-q[k])/d[k],b=(e[k]-q[k])/d[k];lo=max(lo,min(a,b));hi=min(hi,max(a,b));}}return vec2(lo,hi);
}
bool solidNodeHit(vec3 o,vec3 d,vec3 lo,vec3 hi){float pad=max(.001,5.e-6*length(max(abs(lo-o),abs(hi-o))));lo-=pad;hi+=pad;float nearT=0.,farT=1.e30;for(int k=0;k<3;k++){if(abs(d[k])<1.e-12){if(o[k]<lo[k]||o[k]>hi[k])return false;}else{float a=(lo[k]-o[k])/d[k],b=(hi[k]-o[k])/d[k];nearT=max(nearT,min(a,b));farT=min(farT,max(a,b));}}return farT>=nearT;}
int nearestSolid(vec3 o,vec3 d,float cameraNear,float cameraFar,out float best){
 best=1.e9;int chosen=-1;uint bestOrder=4294967295u,node=0u,cursor=0u,end=0u;
 while(node<uint(uSolidNodeCount)||cursor<end){uint id;if(cursor<end){id=cursor++;}else{vec4 lo=solidNode(int(node*2u)),hi=solidNode(int(node*2u+1u));if(!solidNodeHit(o,d,lo.xyz,hi.xyz)){node=uint(hi.w);continue;}uint code=uint(lo.w);if(code==0u){node++;continue;}cursor=code/8u;end=cursor+code%8u;node=uint(hi.w);continue;}vec2 span=solidInterval(int(id),o,d);float nearLimit=max(.0001,cameraNear),t=span.x>nearLimit?span.x:span.y;uint ordinal=uint(solidWord(int(id)*4+3).x);if(span.x<=span.y&&t>=nearLimit&&t<=cameraFar&&(t<best||(t==best&&ordinal<bestOrder))){best=t;bestOrder=ordinal;chosen=int(id);}}
 return chosen;
}
float solidVisibility(vec3 p,vec3 l){if(!uSolidShadows)return 1.;vec3 o=p+l*.05;uint node=0u,cursor=0u,end=0u;while(node<uint(uSolidNodeCount)||cursor<end){uint id;if(cursor<end){id=cursor++;}else{vec4 lo=solidNode(int(node*2u)),hi=solidNode(int(node*2u+1u));if(!solidNodeHit(o,l,lo.xyz,hi.xyz)){node=uint(hi.w);continue;}uint code=uint(lo.w);if(code==0u){node++;continue;}cursor=code/8u;end=cursor+code%8u;node=uint(hi.w);continue;}vec2 span=solidInterval(int(id),o,l);if(span.y>max(.05,span.x))return 0.;}return 1.;}
vec3 solidNormal(int i,vec3 p){vec4 pos=solidPosition(i);vec3 q=p-pos.xyz,e=solidExtent(i).xyz;if(pos.w<.5)return normalize(q/(e*e));vec3 a=abs(q/e);if(a.x>=a.y&&a.x>=a.z)return vec3(sign(q.x),0.,0.);if(a.y>=a.z)return vec3(0.,sign(q.y),0.);return vec3(0.,0.,sign(q.z));}
vec3 solidBRDF(vec3 base,float rough,float metal,vec3 n,vec3 v,vec3 l){float nl=max(dot(n,l),0.),nv=max(.0001,dot(n,v));if(nl<=0.)return vec3(0.);vec3 h=normalize(l+v);float nh=max(0.,dot(n,h)),vh=max(0.,dot(v,h)),a=rough*rough,a2=a*a,den=nh*nh*(a2-1.)+1.,D=a2/(3.141592654*den*den);float G=.5/max(.00001,nl*sqrt(nv*nv*(1.-a2)+a2)+nv*sqrt(nl*nl*(1.-a2)+a2));vec3 F=mix(vec3(.04),base,metal)+(1.-mix(vec3(.04),base,metal))*pow(1.-vh,5.);return ((1.-F)*(1.-metal)*base/3.141592654+D*G*F)*nl;}
`;

export function prepareAnalyticSolids(gl,items){
 let state=states.get(gl);if(!state){if(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)<13)throw Error('Indexed analytic display requires 13 fragment texture units');state={records:gl.createTexture(),nodes:gl.createTexture(),signature:null,builds:0,bytes:0};states.set(gl,state);}
 const signature=JSON.stringify(items);if(signature!==state.signature){const built=buildManyAnalyticSolids(items);let bytes=0;const upload=(texture,data,unit)=>{const height=Math.max(1,Math.ceil(data.length/4/1024)),padded=new Float32Array(height*1024*4);padded.set(data);bytes+=padded.byteLength;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1024,height,0,gl.RGBA,gl.FLOAT,padded);};upload(state.records,built.records,11);upload(state.nodes,built.nodes,12);state.signature=signature;state.count=built.recordCount;state.nodeCount=built.nodeCount;state.bytes=bytes;state.builds++;}state.preparedReference=items;return state;
}
export function uploadAnalyticSolids(gl,uniform,items){
 let state=states.get(gl);if(!state||state.preparedReference!==items)state=prepareAnalyticSolids(gl,items);
 gl.activeTexture(gl.TEXTURE11);gl.bindTexture(gl.TEXTURE_2D,state.records);gl.uniform1i(uniform('uSolidRecords'),11);gl.activeTexture(gl.TEXTURE12);gl.bindTexture(gl.TEXTURE_2D,state.nodes);gl.uniform1i(uniform('uSolidNodes'),12);gl.uniform1i(uniform('uSolidCount'),state.count);gl.uniform1i(uniform('uSolidNodeCount'),state.nodeCount);
}
export function analyticSolidIndexStats(gl){const state=states.get(gl);return state?{count:state.count,nodeCount:state.nodeCount,builds:state.builds,bytes:state.bytes}:{count:0,nodeCount:0,builds:0,bytes:0};}
export function disposeAnalyticSolids(gl){const state=states.get(gl);if(state){gl.deleteTexture(state.records);gl.deleteTexture(state.nodes);states.delete(gl);}}
export function adaptIndexedSolidFragment(source){
 const old='for(int i=0;i<16;i++){if(i>=uSolidCount)break;vec2 span=solidInterval(i,uEye,rd);float nearLimit=max(.0001,uCameraNear),t=span.x>nearLimit?span.x:span.y;if(span.x<=span.y&&t>=nearLimit&&t<=uCameraFar&&t<best){best=t;chosen=i;}}';
 if(source.split(old).length!==2)throw Error('Indexed solid query anchor changed');return source.replace(old,'chosen=nearestSolid(uEye,rd,uCameraNear,uCameraFar,best);').replaceAll('uSolidColourRough[chosen]','solidMaterial(chosen)').replaceAll('uSolidExtentMetal[chosen]','solidExtent(chosen)');
}
