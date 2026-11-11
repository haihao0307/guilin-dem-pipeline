// Same four original rays, each complete query/shade invocation in its own
// fragment. Resolve keeps the original i=0..3 addition order and nearest depth.
export function parallelAAShader(source,basis){return`#version 300 es
precision highp float;precision highp int;uniform vec2 uSize;uniform vec3 uEye,uTarget;uniform int uSampleCount;uniform float uAABlend;layout(location=0)out vec4 outColor;layout(location=1)out vec4 outDepth;
${source}
void main(){${basis}ivec2 at=ivec2(gl_FragCoord.xy);int i=(at.x&1)|((at.y&1)<<1);vec2 pixel=floor(gl_FragCoord.xy*.5)+.5;vec2 off=uSampleCount==1?vec2(.5):vec2(float(i&1),float(i>>1))*.5+.25;off=mix(vec2(.5),off,uAABlend);vec2 q=((pixel+off-.5)/uSize*2.-1.)*vec2(uSize.x/uSize.y,1.);vec3 d=normalize(f+(r*q.x+up*q.y)*.34);surfaceDepth=1.e9;outColor=vec4(sampleWorld(uEye,d),1.);outDepth=vec4(surfaceDepth);}`;}
export const parallelAAResolve=`#version 300 es
precision highp float;precision highp int;uniform highp sampler2D uQueryColour,uQueryDepth;layout(location=0)out vec4 outColor;layout(location=1)out vec4 outDepth;
void main(){ivec2 pixel=ivec2(gl_FragCoord.xy)*2;vec3 sum=vec3(0.);float depth=1.e9;for(int i=0;i<4;i++){ivec2 at=pixel+ivec2(i&1,i>>1);sum+=texelFetch(uQueryColour,at,0).rgb/4.;depth=min(depth,texelFetch(uQueryDepth,at,0).r);}if(depth>=1.e8)discard;gl_FragDepth=clamp(depth/uCameraFar,0.,1.);outColor=vec4(sum,1.);outDepth=vec4(depth);}`;
