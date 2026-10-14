/** Same R02 optics / R03 continuous coverage. No fur-colour substitution.
 * Optical-node decimation is optional interpolation, not fewer geometry nodes or hairs.
 */
import {positionFragment} from '../fiber-r02/shaders.mjs';
import {nodeRadianceFragment,stableVertex} from '../fiber-r03/stability.mjs';
function replaceOnce(s,a,b){if(!s.includes(a))throw Error('Pinned shader anchor missing');return s.replace(a,b);}
const bindingGLSL=`
uniform sampler2D guideMotion;
vec3 readGuide(ivec2 ij){return texelFetch(guideMotion,ij,0).xyz;}
vec3 guideOffset(vec2 root){
 vec2 v=clamp(vec2((root.x+.031)/.062*16.,(root.y+.006)/.012*4.),vec2(0.),vec2(16.,4.));
 ivec2 a=min(ivec2(floor(v)),ivec2(15,3));vec2 f=v-vec2(a);
 return mix(mix(readGuide(a),readGuide(a+ivec2(1,0)),f.x),mix(readGuide(a+ivec2(0,1)),readGuide(a+ivec2(1,1)),f.x),f.y);
}
`;
export const movingPositionFragment=replaceOnce(
 replaceOnce(positionFragment,'uniform sampler2D rootMap,traitMap;','uniform sampler2D rootMap,traitMap;\n'+bindingGLSL),
 'gl_FragColor=vec4(curve(float(node)/80.0),1.0);',
 'float t=float(node)/80.;gl_FragColor=vec4(curve(t)+guideOffset(rootData.xy)*t*t,1.0);');
let rad=replaceOnce(nodeRadianceFragment,'uniform float diameter;','uniform float diameter;\nuniform int shadeCount;uniform float shadeStride;');
rad=replaceOnce(rad,'int root=id/81,node=id%81;','int root=id/shadeCount,node=int(float(id%shadeCount)*shadeStride+.5);');
rad=replaceOnce(rad,'wPos=atNode(id);','wPos=atNode(root*81+node);');
export const fastNodeRadianceFragment=rad;
let vert=replaceOnce(stableVertex,'uniform float eyeDistance;','uniform float eyeDistance;\nuniform int shadeCount;uniform float shadeStride;');
vert=replaceOnce(vert,`int id=gl_InstanceID*81+node;ivec2 at=ivec2(id%1024,id/1024);
 color0=texelFetch(radiance0,at,0).rgb;color1=texelFetch(radiance1,at,0).rgb;
 color2=texelFetch(radiance2,at,0).rgb;color3=texelFetch(radiance3,at,0).rgb;`,
`float fnode=float(node)/shadeStride;int lo=int(floor(fnode));float blend=fract(fnode);
 int id=gl_InstanceID*shadeCount+lo,id2=gl_InstanceID*shadeCount+min(shadeCount-1,lo+1);
 ivec2 at=ivec2(id%1024,id/1024),bt=ivec2(id2%1024,id2/1024);
 color0=mix(texelFetch(radiance0,at,0).rgb,texelFetch(radiance0,bt,0).rgb,blend);
 color1=mix(texelFetch(radiance1,at,0).rgb,texelFetch(radiance1,bt,0).rgb,blend);
 color2=mix(texelFetch(radiance2,at,0).rgb,texelFetch(radiance2,bt,0).rgb,blend);
 color3=mix(texelFetch(radiance3,at,0).rgb,texelFetch(radiance3,bt,0).rgb,blend);`);
export const fastStableVertex=vert;
