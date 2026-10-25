import {buildAperturesGLSL,packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {withBoundedGlassEndpointVerification} from './kowloon-building-mother-r01/whole-building-facade-r01/glass-endpoint-roundoff.mjs';
const outward=(v,upper)=>{const d=new DataView(new ArrayBuffer(4));let f=Math.fround(v);if(upper?f>=v:f<=v)return f;if(f===0)return upper?2**-149:-(2**-149);d.setFloat32(0,f);let b=d.getUint32(0);b+=(f>0)===upper?1:-1;d.setUint32(0,b);return d.getFloat32(0)};
export function packHostWall(h){const count=h.windows.length,stride=5,width=32,height=Math.max(1,Math.ceil(count*stride/width)),data=new Float32Array(width*height*4);let start=0;h.windows.forEach((w,i)=>{const ps=w.infill.primitives,lo=[0,1,2].map(k=>Math.min(...ps.map(p=>p.bounds.min[k]))),hi=[0,1,2].map(k=>Math.max(...ps.map(p=>p.bounds.max[k])));data.set(w.hole,i*20);data.set(w.maskRect,i*20+4);data.set([start,start+ps.length,w.revealObjectId,0],i*20+8);data.set([...lo.map(v=>outward(v,false)),0],i*20+12);data.set([...hi.map(v=>outward(v,true)),0],i*20+16);start+=ps.length;});return{width,height,data,count,apertures:packApertureDescriptors(h.windows.map(w=>w.infill))};}
const DOMAIN=`
uniform sampler2D uHostWindows,uHostRecoveryDescriptors;uniform int uHostWindowCount;uniform vec3 uHostOrigin,uHostU,uHostV,uHostN;uniform vec4 uHostRect;uniform vec2 uHostDepth;uniform float uHostObjectId;
int hostPrimitiveStart=0,hostPrimitiveEnd=0;
vec4 hostRecord(int i){int w=textureSize(uHostWindows,0).x;return texelFetch(uHostWindows,ivec2(i%w,i/w),0);}
vec3 hostLocal(vec3 p){vec3 q=p-uHostOrigin;return vec3(dot(q,uHostU),dot(q,uHostV),dot(q,uHostN));}
bool hostRectContains(vec2 q,vec4 r){return q.x>=r.x&&q.x<=r.z&&q.y>=r.y&&q.y<=r.w;}
bool hostHole(vec2 q){for(int i=0;i<uHostWindowCount;i++)if(hostRectContains(q,hostRecord(i*5)))return true;return false;}
bool hostHoleStrict(vec2 q){for(int i=0;i<uHostWindowCount;i++){vec4 r=hostRecord(i*5);if(q.x>r.x&&q.x<r.z&&q.y>r.y&&q.y<r.w)return true;}return false;}
bool hostWallCovers(vec3 point,vec3 normal);

`;
export function buildHostWallGLSL(h){
 let lib=withBoundedGlassEndpointVerification(buildAperturesGLSL(h.windows.map(w=>w.infill)));
 // Each selected window's original 4 infill parts are an independent union.
 // Its former reveal is now the host wall's own opening boundary, retaining ID.
 lib=lib.replaceAll('for(int k=0;k<count;k++)','for(int k=hostPrimitiveStart;k<hostPrimitiveEnd;k++)');
 const load=lib.match(/AperturePart apertureLoad\(int k\)\{[^\n]+/)[0];
 const recoveryLoader='vec4 hostRecoveryRecord(int i){int w=textureSize(uHostRecoveryDescriptors,0).x;return texelFetch(uHostRecoveryDescriptors,ivec2(i%w,i/w),0);}'+'\n'+load.replace('apertureLoad(int k)','hostRecoveryLoad(int k)').replaceAll('apertureRecord(','hostRecoveryRecord(');
 const a=lib.indexOf('bool apertureGlassRecoveryIsolated('),b=lib.indexOf('bool apertureOwnEndpointVerified(',a);
 let recovery=lib.slice(a,b).replace('int count=int(apertureRecord(0).x);','int count=int(hostRecoveryRecord(0).x);float ownId=apertureLoad(own).objectId;').replace('for(int k=hostPrimitiveStart;k<hostPrimitiveEnd;k++)','for(int k=0;k<count;k++)').replace('if(k==own)continue;AperturePart other=apertureLoad(k);if(other.objectId==skipObjectId)continue;','AperturePart other=hostRecoveryLoad(k);if(other.objectId==skipObjectId||other.objectId==ownId)continue;');
 lib=lib.slice(0,a)+recoveryLoader+'\n'+recovery+lib.slice(b);

 const tie='if(found&&abs(candidate-t)<apertureEPS&&p.objectId>h.objectId)continue;';if(lib.split(tie).length!==2)throw Error('Frozen aperture winner contract changed');lib=lib.replace(tie,'if(hostWallCovers(point,n))continue;'+tie);
 return DOMAIN+lib+`
vec2 hostBoxInterval(vec3 o,vec3 d,vec3 lo,vec3 hi){return apertureIntersect(apertureIntersect(apertureSlab(o.x,d.x,lo.x,hi.x),apertureSlab(o.y,d.y,lo.y,hi.y)),apertureSlab(o.z,d.z,lo.z,hi.z));}
bool hostWallCovers(vec3 point,vec3 normal){vec3 q=hostLocal(point),d=vec3(dot(normal,uHostU),dot(normal,uHostV),dot(normal,uHostN));vec2 a=hostBoxInterval(q,d,vec3(uHostRect.xy,uHostDepth.x),vec3(uHostRect.zw,uHostDepth.y));if(!apertureValid(a)||a.x>apertureEPS||a.y<=apertureEPS)return false;for(int i=0;i<uHostWindowCount;i++){vec4 h=hostRecord(i*5);vec2 v=hostBoxInterval(q,d,vec3(h.xy,uHostDepth.x),vec3(h.zw,uHostDepth.y));if(apertureValid(v)&&v.x<=apertureEPS&&v.y>apertureEPS)return false;}return true;}
`;
}
export const HOST_WALL_MAIN=`
void hostPlane(vec3 ro,vec3 rd,vec3 o,vec3 d,int axis,float value,vec3 normal,vec4 domain,bool cap,float id){
 if(abs(d[axis])<1e-12)return;float t=(value-o[axis])/d[axis];if(t<0.||t>outHit.x)return;vec3 q=o+d*t;
 if(cap){if(!hostRectContains(q.xy,uHostRect)||hostHoleStrict(q.xy))return;for(int i=0;i<uHostWindowCount;i++)if(hostRectContains(q.xy,hostRecord(i*5+1))){id=hostRecord(i*5+2).z;break;}}
 else if(q.z<uHostDepth.x||q.z>uHostDepth.y||!hostRectContains(q.xy,domain))return;
 vec3 p=ro+rd*t;if(uSlice&&(p.y<uSliceY.x||p.y>uSliceY.y))return;if(uClip&&dot(uClipNormal,p)<uClipOffset)return;
 FieldHit hit;hit.distance=0.;hit.objectId=id;hit.materialRole=2.;hit.local=p;accept(t,hit,normalize(uHostU*normal.x+uHostV*normal.y+uHostN*normal.z),-3.);
}
void main(){previous();if(!rayActive())return;vec3 ro=uEye,rd=rayDirection(),o=hostLocal(ro),d=vec3(dot(rd,uHostU),dot(rd,uHostV),dot(rd,uHostN));
 hostPlane(ro,rd,o,d,2,uHostDepth.x,vec3(0,0,-1),uHostRect,true,uHostObjectId);hostPlane(ro,rd,o,d,2,uHostDepth.y,vec3(0,0,1),uHostRect,true,uHostObjectId);
 hostPlane(ro,rd,o,d,0,uHostRect.x,vec3(-1,0,0),uHostRect,false,uHostObjectId);hostPlane(ro,rd,o,d,0,uHostRect.z,vec3(1,0,0),uHostRect,false,uHostObjectId);hostPlane(ro,rd,o,d,1,uHostRect.y,vec3(0,-1,0),uHostRect,false,uHostObjectId);hostPlane(ro,rd,o,d,1,uHostRect.w,vec3(0,1,0),uHostRect,false,uHostObjectId);
 for(int i=0;i<uHostWindowCount;i++){vec4 r=hostRecord(i*5),identity=hostRecord(i*5+2);hostPlane(ro,rd,o,d,0,r.x,vec3(1,0,0),r,false,identity.z);hostPlane(ro,rd,o,d,0,r.z,vec3(-1,0,0),r,false,identity.z);hostPlane(ro,rd,o,d,1,r.y,vec3(0,1,0),r,false,identity.z);hostPlane(ro,rd,o,d,1,r.w,vec3(0,-1,0),r,false,identity.z);}
 float clipLo=0.,clipHi=outHit.x;if(!clipInterval(ro,rd,clipLo,clipHi))return;
 for(int i=0;i<uHostWindowCount;i++){float lo,hi;if(!interval(hostRecord(i*5+3).xyz,hostRecord(i*5+4).xyz,ro,rd,outHit.x,lo,hi))continue;vec4 identity=hostRecord(i*5+2);hostPrimitiveStart=int(identity.x);hostPrimitiveEnd=int(identity.y);float t;FieldHit h;int visits;
 if(apertureTraceRayFiltered(ro+rd*clipLo,rd,false,0.,t,h,visits)&&t+clipLo<=clipHi)accept(t+clipLo,h,fieldRayNormal,-3.);}
}
`;
