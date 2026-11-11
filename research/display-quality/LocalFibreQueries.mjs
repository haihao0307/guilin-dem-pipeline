// Execution-only point footprints. A point dispatches the original continuous
// curve query over its padded bounds; it is not the visible strand geometry.
export function localFibreQueryShaders(source,fibres,basis,fragmentInit,depthClip){
 const start=fibres.indexOf('vec4 weightedBounds='),end=fibres.indexOf('scattered+=light*optical;tau+=optical;'),utilityEnd=fibres.indexOf('vec3 fibreComposite(');
 if(start<0||end<start||utilityEnd<0)throw Error('Original fibre query boundary changed');
 const body=fibres.slice(start,end).replaceAll('continue;','discard;');
 return{vertex:`#version 300 es
 precision highp float;precision highp int;uniform sampler2D uFibreBounds;uniform vec2 uSize;uniform vec3 uEye,uTarget;uniform float uRootBudget;flat out uint queryFibreId;
 vec4 boundsWord(int at){return texelFetch(uFibreBounds,ivec2(at%1024,at/1024),0);}
 void main(){queryFibreId=uint(gl_VertexID);vec4 lowWord=boundsWord(gl_VertexID*2);gl_PointSize=1.;gl_Position=vec4(2.,2.,0.,1.);if(uRootBudget-lowWord.w<=0.)return;vec3 lo=lowWord.xyz,hi=boundsWord(gl_VertexID*2+1).xyz;${basis}
 vec3 corner=mix(lo,hi,greaterThanEqual(f,vec3(0.)));float farDepth=dot(corner-uEye,f),pad=max(0.,farDepth)*(uTanHalfFov*1.25)/uSize.y+max(.001,5.e-6*max(length(lo-uEye),length(hi-uEye)));lo-=pad;hi+=pad;
 vec2 low=vec2(1.e20),high=vec2(-1.e20);for(int i=0;i<8;i++){vec3 p=mix(lo,hi,bvec3((i&1)!=0,(i&2)!=0,(i&4)!=0)),q=p-uEye;float z=dot(q,f);vec2 screen=(vec2(dot(q,r),dot(q,up))/z/uTanHalfFov*vec2(uSize.y/uSize.x,1.)*.5+.5)*uSize;low=min(low,screen);high=max(high,screen);}low-=3.;high+=3.;if(high.x<0.||low.x>uSize.x||high.y<0.||low.y>uSize.y)return;
 low=max(low,vec2(0.));high=min(high,uSize);vec2 middle=(low+high)*.5,span=high-low;gl_PointSize=ceil(max(span.x,span.y))+2.;gl_Position=vec4(middle/uSize*2.-1.,0.,1.);}`,
 fragment:`#version 300 es
 precision highp float;precision highp int;uniform vec2 uSize;uniform vec3 uEye,uTarget;flat in uint queryFibreId;out vec4 outColor;
 ${source}
 ${fibres.slice(0,utilityEnd)}
 void main(){${basis}${fragmentInit}vec2 queryPixel=(gl_FragCoord.xy/uSize*2.-1.)*vec2(uSize.x/uSize.y,1.);vec3 rd=normalize(f+(r*queryPixel.x+up*queryPixel.y)*.34),ro=uEye;float opaqueDepth=texelFetch(uYarnDepth,ivec2(gl_FragCoord.xy),0).r;${depthClip?'ffMaximumFibreDepth=opaqueDepth+.001;':''}uint id=queryFibreId;${body}outColor=vec4(light*optical,optical);}`};
}
