import {buildAperturesGLSL,packApertureDescriptors} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {withBoundedGlassEndpointVerification} from './kowloon-building-mother-r01/whole-building-facade-r01/glass-endpoint-roundoff.mjs';
import {aperturePackedBounds} from './kowloon-building-mother-r01/whole-building-floor-study-r01/primary-aperture-index.mjs';
export function packHostWall(h){const count=h.windows.length,stride=5,width=32,height=Math.max(1,Math.ceil(count*stride/width)),data=new Float32Array(width*height*4),apertures=packApertureDescriptors(h.windows.map(w=>w.infill)),supports=aperturePackedBounds(apertures,apertures.primitiveCount);let start=0;h.windows.forEach((w,i)=>{const ps=w.infill.primitives,boxes=ps.map((_,k)=>supports?.[start+k]),unknown=boxes.some(b=>!b),lo=unknown?[-1e30,-1e30,-1e30]:[0,1,2].map(k=>Math.min(...boxes.map(b=>b.min[k]))),hi=unknown?[1e30,1e30,1e30]:[0,1,2].map(k=>Math.max(...boxes.map(b=>b.max[k])));data.set(w.hole,i*20);data.set(w.maskRect,i*20+4);data.set([start,start+ps.length,w.revealObjectId,0],i*20+8);data.set([...lo,0],i*20+12);data.set([...hi,0],i*20+16);start+=ps.length;});return{width,height,data,count,apertures};}
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
// Reverse union coverage is required too: a wall plane inside a frame/sill is
// not an exposed boundary. Closed window supports are merely an early guard;
// the same exact part intervals and apertureEPS decide positive occupancy.
bool hostInfillCovers(vec3 point,vec3 normal){for(int i=0;i<uHostWindowCount;i++){vec3 low=hostRecord(i*5+3).xyz,high=hostRecord(i*5+4).xyz;if(any(lessThan(point,low-vec3(apertureEPS)))||any(greaterThan(point,high+vec3(apertureEPS))))continue;vec4 range=hostRecord(i*5+2);for(int k=int(range.x);k<int(range.y);k++){if(aperturePositiveNeighbour(apertureIntervals(apertureLoad(k),point,normal)))return true;}}return false;}
`;
}
export const HOST_WALL_MAIN=`
void hostPlane(vec3 ro,vec3 rd,vec3 o,vec3 d,int axis,float value,vec3 normal,vec4 domain,bool cap,float id){
 if(d[axis]==0.)return;float t=(value-o[axis])/d[axis];if(t<0.||t>outHit.x)return;vec3 q=o+d*t;
 if(cap){if(!hostRectContains(q.xy,uHostRect)||hostHoleStrict(q.xy))return;for(int i=0;i<uHostWindowCount;i++)if(hostRectContains(q.xy,hostRecord(i*5+1))){id=hostRecord(i*5+2).z;break;}}
 else if(q.z<uHostDepth.x||q.z>uHostDepth.y||!hostRectContains(q.xy,domain))return;
 vec3 p=ro+rd*t;if(uSlice&&(p.y<uSliceY.x||p.y>uSliceY.y))return;if(uClip&&dot(uClipNormal,p)<uClipOffset)return;
 vec3 n=normalize(uHostU*normal.x+uHostV*normal.y+uHostN*normal.z);if(hostInfillCovers(p,n))return;FieldHit hit;hit.distance=0.;hit.objectId=id;hit.materialRole=2.;hit.local=p;accept(t,hit,n,-3.);
}
void main(){previous();if(!rayActive())return;vec3 ro=uEye,rd=rayDirection(),o=hostLocal(ro),d=vec3(dot(rd,uHostU),dot(rd,uHostV),dot(rd,uHostN));
 // One dynamic boundary dispatch avoids duplicating the infill-union program
 // at ten lexical call sites. All original analytic planes remain candidates.
 for(int face=0;face<6+4*uHostWindowCount;face++){
  int axis;float value,id=uHostObjectId;vec3 normal=vec3(0);vec4 domain=uHostRect;bool cap=face<2;
  if(face<2){axis=2;value=face==0?uHostDepth.x:uHostDepth.y;normal.z=face==0?-1.:1.;}
  else if(face<6){int j=face-2;axis=j<2?0:1;value=j==0?uHostRect.x:j==1?uHostRect.z:j==2?uHostRect.y:uHostRect.w;normal[axis]=(j==0||j==2)?-1.:1.;}
  else{int i=(face-6)/4,j=(face-6)%4;domain=hostRecord(i*5);id=hostRecord(i*5+2).z;axis=j<2?0:1;value=j==0?domain.x:j==1?domain.z:j==2?domain.y:domain.w;normal[axis]=(j==0||j==2)?1.:-1.;}
  hostPlane(ro,rd,o,d,axis,value,normal,domain,cap,id);
 }
 float clipLo=0.,clipHi=outHit.x;if(!clipInterval(ro,rd,clipLo,clipHi))return;
 for(int i=0;i<uHostWindowCount;i++){vec2 support=hostBoxInterval(ro,rd,hostRecord(i*5+3).xyz,hostRecord(i*5+4).xyz);if(!apertureValid(support)||support.y<0.||support.x>outHit.x)continue;vec4 identity=hostRecord(i*5+2);hostPrimitiveStart=int(identity.x);hostPrimitiveEnd=int(identity.y);float t;FieldHit h;int visits;
 if(apertureTraceRayFiltered(ro+rd*clipLo,rd,false,0.,t,h,visits)&&t+clipLo<=clipHi)accept(t+clipLo,h,fieldRayNormal,-3.);}
}
`;
