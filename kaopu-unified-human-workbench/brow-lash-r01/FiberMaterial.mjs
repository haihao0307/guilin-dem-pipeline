import * as THREE from '../full/source/registration-vendor/three.module.js';
// A realtime anisotropic surface approximation, NOT Disney's production path-traced BSDF.
// Each strip represents ONE 3D tapered fiber, not an alpha picture of a whole eyebrow.
const declarations=`
attribute vec3 fiberTangent;
attribute float fiberRadius;
uniform vec2 blViewport;
uniform float blMinPixels;
varying vec3 blTangentView;
varying vec3 blCrossView;
varying vec2 blUV;
varying float blCoverage;
`;
const begin=`
vec4 blCenter = modelViewMatrix * vec4(position,1.0);
vec3 blT = normalize(mat3(modelViewMatrix) * fiberTangent);
vec3 blV = normalize(-blCenter.xyz);
vec3 blSide = cross(blT,blV);
if(dot(blSide,blSide)<0.00001) blSide = cross(blT,vec3(0.0,1.0,0.001));
blSide=normalize(blSide);
vec3 blLocalSide=normalize(vec3(dot(blSide,modelViewMatrix[0].xyz),dot(blSide,modelViewMatrix[1].xyz),dot(blSide,modelViewMatrix[2].xyz)));
float blScale=length(modelViewMatrix[0].xyz);
float blPixel=(isPerspectiveMatrix(projectionMatrix)?max(0.0001,-blCenter.z):1.0)*2.0/(projectionMatrix[1][1]*max(blViewport.y,1.0));
float blActual=max(0.00000001,fiberRadius*blScale);
float blRadius=max(blActual,blPixel*blMinPixels);
vec3 transformed=position+blLocalSide*(blRadius/max(blScale,0.0001))*(uv.x*2.0-1.0);
blCoverage=clamp(blActual/blRadius,0.0,1.0);
blTangentView=blT;
blCrossView=blSide;
blUV=uv;
`;
const fragmentDecl=`varying vec3 blTangentView;varying vec3 blCrossView;varying vec2 blUV;varying float blCoverage;`;
function replace(s,a,b){if(!s.includes(a))throw Error('Fiber shader anchor missing: '+a);return s.replace(a,b);}
function vertex(shader,viewport,minPixels){shader.uniforms.blViewport={value:viewport};shader.uniforms.blMinPixels={value:minPixels};shader.vertexShader=declarations+shader.vertexShader;shader.vertexShader=replace(shader.vertexShader,'#include <begin_vertex>',begin);}
export function makeFiberMaterial({roughness=.48,anisotropy=.8,aa=true}={}){
 const viewport=new THREE.Vector2(1200,900),m=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness,metalness:0,anisotropy,anisotropyRotation:0,specularIntensity:.55,specularColor:0xe2d9ce,side:THREE.DoubleSide,alphaTest:.012,alphaToCoverage:aa,transparent:!aa,depthWrite:aa});
 m.name='KAOPU individual keratin fiber approximation';m.userData.blViewport=viewport;
 m.onBeforeCompile=shader=>{vertex(shader,viewport,.43);shader.fragmentShader=fragmentDecl+shader.fragmentShader;shader.fragmentShader=replace(shader.fragmentShader,'#include <color_fragment>',`#include <color_fragment>\nfloat blEdge=1.0-smoothstep(0.68,1.0,abs(blUV.x*2.0-1.0));\ndiffuseColor.a*=blCoverage*blEdge;`);shader.fragmentShader=replace(shader.fragmentShader,'#include <normal_fragment_begin>',`#include <normal_fragment_begin>\nvec3 blTV=normalize(blTangentView);vec3 blVV=normalize(vViewPosition);vec3 blFacing=normalize(blVV-blTV*dot(blVV,blTV));float blH=clamp(blUV.x*2.0-1.0,-.98,.98);\nnormal=normalize(blFacing*sqrt(1.0-blH*blH)+normalize(blCrossView)*blH);`);m.userData.compiled=true;};
 m.customProgramCacheKey=()=> 'kaopu-bl-r01-fiber-v1-'+aa;
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});depth.onBeforeCompile=shader=>vertex(shader,new THREE.Vector2(2048,2048),0);depth.customProgramCacheKey=()=> 'kaopu-bl-r01-depth-v1';m.userData.depth=depth;return m;
}
export function makeFiberGeometry(strands){const count=strands.reduce((n,s)=>n+s.points.length*2,0),pos=new Float32Array(count*3),norm=new Float32Array(count*3),tan=new Float32Array(count*3),tangent=new Float32Array(count*4),radius=new Float32Array(count),colors=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];let offset=0;
 for(const strand of strands){strand.vertexOffset=offset;const n=strand.points.length;for(let i=0;i<n;i++){const t=i/(n-1),p=strand.points[i],a=strand.points[Math.max(0,i-1)],b=strand.points[Math.min(n-1,i+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])||1,dir=b.map((v,k)=>(v-a[k])/len),taper=(.92+.08*Math.sin(Math.PI*t))*Math.pow(Math.max(.003,1-Math.pow(t,1.7)),.62),c=new THREE.Color(strand.color);c.multiplyScalar((.72+.28*Math.pow(t,.3))*strand.pigment);
 for(let side=0;side<2;side++){const j=offset+i*2+side;pos.set(p,j*3);norm.set(strand.normal,j*3);tan.set(dir,j*3);tangent.set([...dir,1],j*4);radius[j]=strand.radius*taper;colors.set([c.r,c.g,c.b],j*3);uv.set([side,t],j*2);}if(i<n-1){const j=offset+i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}
 offset+=n*2;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('normal',new THREE.BufferAttribute(norm,3));g.setAttribute('fiberTangent',new THREE.BufferAttribute(tan,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('tangent',new THREE.BufferAttribute(tangent,4).setUsage(THREE.DynamicDrawUsage));g.setAttribute('fiberRadius',new THREE.BufferAttribute(radius,1));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingSphere();g.boundingSphere.radius+=.08;return g;}
export function writeStrand(g,strand,points){const p=g.attributes.position.array,tan=g.attributes.fiberTangent.array,tangent=g.attributes.tangent.array;for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=b.map((v,k)=>v-a[k]),l=Math.hypot(...d)||1;for(let side=0;side<2;side++){const j=strand.vertexOffset+i*2+side;p.set(points[i],j*3);tan.set(d.map(v=>v/l),j*3);tangent.set([...d.map(v=>v/l),1],j*4);}}}
export function commitGeometry(g){for(const name of['position','fiberTangent','tangent'])g.attributes[name].needsUpdate=true;}
export {THREE};
