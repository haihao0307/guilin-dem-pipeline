/** Native GNM hair reuse, with exact R07 skin attachment.
 * Short/buzz: original HairLayer at c89ebc4d; long/medium: the user's original
 * LongHairLayer at d689a5ee. Neither donor is represented as human accepted.
 * Original strand counts/segments, geometry and fibre light model remain.
 * The adapter transports every follicle's full barycentric CSR blend on GPU;
 * no second head, opaque scalp cap, hair card, or density LOD is introduced.
 */
import {THREE as T} from './NativeBinding.mjs';
import {HairLayer} from '../vendor/appearance/hair-short-adapted/HairLayer.js';
import {attachFiberMaterial, fiberMaterialDiagnostics} from '../vendor/appearance/hair-short-adapted/FiberMaterial.js';
import {attachLongHair} from '../vendor/appearance/hair-long-adapted/LongHairLayer.js';

const SHORT_SOURCE='guilin-dem-pipeline/c89ebc4da8d24ef3decfad85336c5dffb2c471c8/hair-r14-l03';
const LONG_SOURCE='guilin-dem-pipeline/d689a5ee8bc5d493d2b43e7b6ea10dbea1868b15/isolated-longhair-r01';
const pause=()=>new Promise(r=>setTimeout(r,0));
function texture(array,width=2048) {
  const height=Math.max(1,Math.ceil(array.length/4/width)),data=new Float32Array(width*height*4);data.set(array);
  const tex=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);tex.minFilter=tex.magFilter=T.NearestFilter;
  tex.generateMipmaps=false;tex.needsUpdate=true;return tex;
}
function mapNativeHead(actor) {
  const source=actor.nativeSource,g=source.gnm;if(!g?.template||!g?.triangles||!g?.numVertices)throw Error('Original GNM snapshot unavailable');
  const inverse=new Int32Array(g.numVertices).fill(-1);
  source.gnmRecipes.forEach(([a,b,t],i)=>{if(a===b&&t===0){if(inverse[a]>=0)throw Error('Ambiguous original GNM vertex');inverse[a]=source.bodyCount+i;}});
  const positions=g.template.slice(),normals=new Float32Array(positions.length),P=actor.mesh.geometry.attributes.position,N=actor.mesh.geometry.attributes.normal;
  for(let i=0;i<inverse.length;i++)if(inverse[i]>=0){const j=inverse[i];positions.set([P.getX(j),P.getY(j),P.getZ(j)],i*3);normals.set([N.getX(j),N.getY(j),N.getZ(j)],i*3);}
  return {g,inverse,positions,normals};
}

/** Strand root influences are small shared textures, never repeated per hair
 * vertex. Original source geometry/gl_VertexID identifies the full strand.
 * Joint-conditioned rest offsets are retained, not reduced to four weights.
 */
function attachRootSkin(actor,mesh,binding,head,segments) {
  const count=binding.count,ranges=new Float32Array(count*4),entries=[];let maxInfluences=0;
  const nativeBinding=actor.binding,skinRange=nativeBinding.displayRange,skinEntries=nativeBinding.displayPacked;
  if(!skinRange||!skinEntries)throw Error('Hair needs the complete displayed native head CSR');
  const perStrand=(segments+1)*2,geometry=mesh.geometry;
  if(geometry.attributes.position.count!==count*perStrand)throw Error('Original hair strand vertex layout changed');
  const indices=geometry.index.array,drawCount=Math.min(indices.length,geometry.drawRange.count);
  for(let k=0;k<drawCount;k+=3){const strand=Math.floor(indices[k]/perStrand);
    if(strand>=count||Math.floor(indices[k+1]/perStrand)!==strand||Math.floor(indices[k+2]/perStrand)!==strand)throw Error('Hair triangle crosses an indexed strand boundary');}
  const rootRest=new Float32Array(count*3),rootIndex=new Int32Array(count*3),rootBary=new Float32Array(count*3);
  for(let i=0;i<count;i++) {
    const t=binding.rootTriangles[i],b=binding.rootBarycentrics.subarray(i*3,i*3+3),ids=[0,1,2].map(k=>head.inverse[head.g.triangles[t*3+k]]);
    if(ids.some(j=>j<0))throw Error('Hair root is not supported by the original generated head');
    const root=[0,0,0];for(let k=0;k<3;k++){const id=head.g.triangles[t*3+k],p=head.positions;
      root[0]+=p[id*3]*b[k];root[1]-=p[id*3+2]*b[k];root[2]+=p[id*3+1]*b[k];}
    rootRest.set(root,i*3);rootIndex.set(ids,i*3);rootBary.set(b,i*3);
    const influences=new Map();
    for(let k=0;k<3;k++) {
      const id=ids[k],start=skinRange[id*4],n=skinRange[id*4+1],A=skinEntries;
      for(let j=0;j<n;j++) {
        const q=(start+j)*8,w=A[q+4]*b[k],bone=A[q+3];if(w<=0)continue;
        let a=influences.get(bone);if(!a){a={bone,w:0,p:[0,0,0]};influences.set(bone,a);}a.w+=w;
        for(let d=0;d<3;d++)a.p[d]+=A[q+d]*w;
      }
    }
    const sum=[...influences.values()].reduce((s,a)=>s+a.w,0);if(Math.abs(sum-1)>1e-4)throw Error('Hair root weights do not sum to one');
    ranges.set([entries.length/8,influences.size,0,0],i*4);maxInfluences=Math.max(maxInfluences,influences.size);
    for(const a of influences.values())entries.push(...a.p.map((v,k)=>v/a.w-root[k]),a.bone,a.w,0,0,0);
  }
  const entryData=Float32Array.from(entries),rangeTexture=texture(ranges),entryTexture=texture(entryData);
  const uniforms={npcHairRanges:{value:rangeTexture},npcHairEntries:{value:entryTexture},npcHairBones:{value:actor.binding.bones}};
  const prefix=`
uniform sampler2D npcHairRanges,npcHairEntries,npcHairBones;
vec4 npcHairRead(sampler2D t,int n){return texelFetch(t,ivec2(n%2048,n/2048),0);}
vec3 npcHairNative(vec3 p){return vec3(p.x,-p.z,p.y);}
vec3 npcHairDisplay(vec3 p){return vec3(p.x,p.z,-p.y);}
void npcHairSkin(vec3 p,vec3 tangent0,vec3 normal0,out vec3 pp,out vec3 tt,out vec3 nn){
 int strand=gl_VertexID/${(segments+1)*2};vec4 range=npcHairRead(npcHairRanges,strand);
 vec3 P=npcHairNative(p),T=npcHairNative(tangent0),N=npcHairNative(normal0),sumP=vec3(0.),sumT=vec3(0.),sumN=vec3(0.);
 for(int k=0;k<${maxInfluences};k++){if(k>=int(range.y))break;int e=(int(range.x)+k)*2;
  vec4 data=npcHairRead(npcHairEntries,e);float w=npcHairRead(npcHairEntries,e+1).x;int j=int(data.w);
  vec4 a=texelFetch(npcHairBones,ivec2(0,j),0),b=texelFetch(npcHairBones,ivec2(1,j),0),c=texelFetch(npcHairBones,ivec2(2,j),0);vec4 q=vec4(P+data.xyz,1.);
  sumP+=w*vec3(dot(a,q),dot(b,q),dot(c,q));sumT+=w*vec3(dot(a.xyz,T),dot(b.xyz,T),dot(c.xyz,T));sumN+=w*vec3(dot(a.xyz,N),dot(b.xyz,N),dot(c.xyz,N));
 }pp=npcHairDisplay(sumP);tt=npcHairDisplay(sumT);nn=npcHairDisplay(sumN);
}
`;
  function patch(material) {
    const source=material.vertexShader,at=source.indexOf('void main()');if(at<0)throw Error('Original fibre shader entry changed');
    const opening=source.indexOf('{',at),before=source.slice(0,opening+1),body=source.slice(opening+1)
      .replace(/\bposition\b/g,'npcPosition').replace(/\btangent\b/g,'npcTangent').replace(/\bscalpNormal\b/g,'npcNormal');
    material.vertexShader=prefix+before+'\nvec3 npcPosition,npcTangent,npcNormal;\nnpcHairSkin(position,tangent,scalpNormal,npcPosition,npcTangent,npcNormal);\n'+body;
    Object.assign(material.uniforms,uniforms);material.needsUpdate=true;
  }
  patch(mesh.material);if(mesh.customDepthMaterial)patch(mesh.customDepthMaterial);
  let currentReport={};
  function checkRoots(){let maxDifference=0,maxScalpGap=0;const data=entryData,geometry=mesh.geometry.attributes.position.array;
    for(let i=0;i<count;i+=Math.max(1,Math.floor(count/96))) {
      const expected=[0,0,0];for(let k=0;k<3;k++){const p=actor.binding.sampleVertex(rootIndex[i*3+k],true),w=rootBary[i*3+k];for(let d=0;d<3;d++)expected[d]+=p[d]*w;}
      const q=i*(segments+1)*6,p=[geometry[q],-geometry[q+2],geometry[q+1]],actual=[0,0,0],root=[0,0,0];
      for(let k=0;k<ranges[i*4+1];k++) {const e=(ranges[i*4]+k)*8,m=actor.rig.skinMatrices[data[e+3]],w=data[e+4];
        for(let d=0;d<3;d++){const o=d*4;actual[d]+=w*(m[o]*(p[0]+data[e])+m[o+1]*(p[1]+data[e+1])+m[o+2]*(p[2]+data[e+2])+m[o+3]);
          root[d]+=w*(m[o]*(rootRest[i*3]+data[e])+m[o+1]*(rootRest[i*3+1]+data[e+1])+m[o+2]*(rootRest[i*3+2]+data[e+2])+m[o+3]);}}
      maxDifference=Math.max(maxDifference,Math.hypot(...root.map((v,k)=>v-expected[k])));maxScalpGap=Math.max(maxScalpGap,Math.hypot(...actual.map((v,k)=>v-expected[k])));
    }
    currentReport={rootCount:count,maxInfluences,weightsTruncated:false,rootNativeSkinMaximumErrorM:maxDifference,
      sampledActualRootScalpGapM:maxScalpGap,allRootsSupportedByNativeTriangles:true,gpuRootTransport:true,
      originalIndexedStrandLayoutValidated:true,binding:'complete displayed native CSR; per-influence surface offsets retained'};return currentReport;
  }
  checkRoots();return {checkRoots,report:()=>currentReport,dispose(){rangeTexture.dispose();entryTexture.dispose();}};
}

export function createNativeHairSystem({renderer,onProgress=()=>{}}={}) {
  if(!renderer)throw Error('Native hair requires the existing renderer');const wearers=new Set();
  async function attach(actor,{style=actor.profile?.hair||actor.identity?.hair}={}) {
    const female=(actor.profile?.sex||actor.identity?.sex)==='female';
    if(!style)style=female?'medium':'short';if(female&&!['long','medium'].includes(style))throw Error('Female native hair must be long or medium');
    onProgress({actor:actor.id,style,phase:'original scalp binding'});await pause();
    const head=mapNativeHead(actor);let mesh,engine,fiber=null,reportSource,segments,binding;
    if(female) {
      // Run the original complete-person adapter against this immutable native
      // wearer snapshot. Its true surface routing and original static body
      // clearance operate once; runtime root skinning is added separately.
      const model={gnm:head.g,bodyCount:actor.nativeSource.bodyCount,
        canonical:{gnmRecipes:actor.nativeSource.gnmRecipes},faces:actor.nativeSource.faces,revision:0};
      const scene=new T.Group(),viewer={renderer,geometry:actor.mesh.geometry,mesh:actor.mesh,scene,render(){}};
      const facade={motion:()=>({controller:{model},viewer})};
      engine=attachLongHair(facade,{length:style==='long'?.43:.26});mesh=engine.mesh;binding=engine.binding;segments=40;
      mesh.removeFromParent();mesh.matrixAutoUpdate=true;mesh.matrix.identity();mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
      reportSource=LONG_SOURCE;
    }else {
      // These are the source's own three scalp styles and parameter bounds.
      // Density/count/segment defaults are retained for both short and buzz.
      engine=new HairLayer(head.g,head.positions,head.normals,{style:style==='buzz'?'short-crop':'side-sweep',
        length:style==='buzz'?.020:.065,volume:style==='buzz'?.001:.0035,
        color:actor.id==='B'?'#342c25':'#21170f'});
      mesh=engine.mesh;binding=engine.binding;segments=engine.options.segments;
      const old=mesh.material,along=mesh.geometry.attributes.along,random=mesh.geometry.attributes.strandRandom,radii=new Float32Array(along.count);
      for(let i=0;i<radii.length;i++)radii[i]=engine.material.uniforms.radius.value*(.72+.55*random.array[i])*(1-.87*Math.pow(along.array[i],4));
      mesh.geometry.setAttribute('strandRadius',new T.BufferAttribute(radii,1));
      fiber=attachFiberMaterial(mesh,{renderer,color:engine.options.color,roughness:engine.options.roughness,
        specular:.095,coverageResolve:'auto'});old.dispose();reportSource=SHORT_SOURCE;
    }
    mesh.name=`${actor.id}/original-${style}-hair`;mesh.frustumCulled=false;actor.root.add(mesh);
    const skin=attachRootSkin(actor,mesh,binding,head,segments);let updates=0;
    const hair={actor,mesh,style,source:reportSource,
      update(){updates++;if(updates%90===0)skin.checkRoots();},
      report(){return {actor:actor.id,style,source:reportSource,sourceHumanAccepted:false,
        originalCount:binding.count,originalSegments:segments,vertices:mesh.geometry.attributes.position.count,
        triangles:mesh.geometry.drawRange.count/3,geometryBytes:Object.values(mesh.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+mesh.geometry.index.array.byteLength,
        rootSkin:skin.report(),bodyGeometryChanged:false,scalpCoverMesh:false,renderDensityLOD:false,visualVerified:false,
        physics:false,limitations:['Long hanging sections retain their original authored static shape; dynamic shoulder and garment collision is not certified.'],
        sourceReport:female?engine.report():engine.diagnostics(),fiber:fiber?fiberMaterialDiagnostics(fiber.material):undefined};},
      dispose(){mesh.removeFromParent();skin.dispose();if(fiber){fiber.dispose();engine.geometry.dispose();engine.binding.guideCache.clear();}else engine.dispose();wearers.delete(hair);}};
    actor.hairSystem=hair;wearers.add(hair);onProgress({actor:actor.id,style,phase:'complete',fraction:1});return hair;
  }
  return {attach,update(){for(const h of wearers)h.update();},report(){return [...wearers].map(h=>h.report());},dispose(){for(const h of [...wearers])h.dispose();}};
}
export async function attachNativeHair(actor,options={}){const system=createNativeHairSystem(options),hair=await system.attach(actor,options);hair.system=system;return hair;}
