/**
 * Simple everyday garment shells for the complete canonical R07 body.
 *
 * This is a visual clothing layer driven by the existing 104-bone CSR skinning.
 * It is not a cloth simulation. The underlying person's geometry, material,
 * index buffers, skeleton and full influence list remain unchanged.
 */
export function dressActor(actor, THREE, options = {}) {
  if (!actor?.mesh?.geometry?.index || !actor.binding?.U || !actor.rig?.restP)
    throw Error('Native garments require an intact R07 actor and its native CSR binding');
  if (actor.garments) throw Error('This actor already has a garment layer');
  const source=actor.mesh.geometry, binding=actor.binding, rig=actor.rig;
  const P=source.attributes.position,N=source.attributes.normal,I=source.index.array;
  const D=P.count,H=binding.height,floor=binding.floorOffset;
  if(!N||D!==binding.displayRange.length/4)throw Error('Garment/CSR display vertex counts differ');
  const group=new THREE.Group();group.name='Native daily garments '+actor.id;
  const meshes=[],materials=[],geometries=[];
  const palette=actor.id==='B'?{shirt:0xa96d54,trousers:0x4c4239}:{shirt:0xded7be,trousers:0x344b40};
  const shirtColor=options.shirtColor??palette.shirt,trouserColor=options.trouserColor??palette.trousers;
  const point=name=>{
    const id=rig.index.get(name);if(id===undefined)return null;
    const p=rig.restP[id];return [p[0],p[2],-p[1]];
  };
  const hipL=point('upperleg01.L'),hipR=point('upperleg01.R'),neck=point('neck01')||point('neck02');
  const shoulderL=point('upperarm01.L'),shoulderR=point('upperarm01.R');
  const footL=point('foot.L'),footR=point('foot.R');
  if(!hipL||!hipR||!neck||!shoulderL||!shoulderR||!footL||!footR)
    throw Error('Canonical anatomical landmarks are missing for garments');
  const hipY=(hipL[1]+hipR[1])*.5,shoulderY=(shoulderL[1]+shoulderR[1])*.5;
  const hemY=hipY+.019*H,pantTopY=hipY+.068*H;
  const neckY=neck[1]+.008*H,ankleY=Math.max(footL[1],footR[1])+.010*H;
  const torsoCenterZ=(hipL[2]+hipR[2]+shoulderL[2]+shoulderR[2])*.25;
  const sleeveEnd=.86;
  const regions=new Uint8Array(D),armScore=new Float32Array(D),handScore=new Float32Array(D);
  const shirtOffsets=new Float32Array(D*3),pantOffsets=new Float32Array(D*3);
  const armProjection=new Float32Array(D);armProjection.fill(-1);
  const arms={};
  for(const side of ['L','R']) {
    const elbow=point('lowerarm01.'+side),wrist=point('wrist.'+side);
    if(!elbow||!wrist)throw Error('Canonical forearm landmarks are unavailable');
    const v=wrist.map((x,k)=>x-elbow[k]);arms[side]={elbow,wrist,v,length2:v.reduce((s,x)=>s+x*x,0)};
  }
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const classifyJoint=rig.names.map(name=>({
    arm:/^(upperarm|lowerarm|clavicle|scapula|shoulder)/.test(name),
    hand:/^(wrist|finger|metacarpal)/.test(name),
    foot:/^(foot|toe)/.test(name),
    head:/^(head|jaw|eye|face|tongue)/.test(name),
    side:name.endsWith('.L')?'L':name.endsWith('.R')?'R':null
  }));
  const jointWeight=(vertex,predicate)=>{
    const start=binding.displayRange[vertex*4],count=binding.displayRange[vertex*4+1];let total=0;
    for(let k=0;k<count;k++) {
      const n=(start+k)*8,j=binding.displayPacked[n+3];
      if(predicate(classifyJoint[j]))total+=binding.displayPacked[n+4];
    }
    return total;
  };
  // A garment vertex keeps its original display index. No CSR row is discarded
  // or remapped, even when only a subset of the body's triangles is rendered.
  for(let i=0;i<D;i++) {
    const p=[P.getX(i),P.getY(i),P.getZ(i)],normal=[N.getX(i),N.getY(i),N.getZ(i)];
    let arm=0,hand=0,foot=0,head=0,left=0,right=0;
    const start=binding.displayRange[i*4],count=binding.displayRange[i*4+1];
    for(let k=0;k<count;k++) {
      const at=(start+k)*8,j=binding.displayPacked[at+3],w=binding.displayPacked[at+4],c=classifyJoint[j];
      if(c.arm){arm+=w;if(c.side==='L')left+=w;else if(c.side==='R')right+=w;}
      if(c.hand)hand+=w;if(c.foot)foot+=w;if(c.head)head+=w;
    }
    armScore[i]=arm;handScore[i]=hand;
    const forearm=arms[left>=right?'L':'R'];
    const along=forearm.v.reduce((s,x,k)=>s+(p[k]-forearm.elbow[k])*x,0)/forearm.length2;
    armProjection[i]=arm>.12?along:-1;
    const belowNeck=p[1]<=neckY-(p[2]>torsoCenterZ?.023*H*(1-smooth(0,.065*H,Math.abs(p[0]))):0);
    const torso=p[1]>=hemY&&belowNeck&&head<.08&&hand<.20&&foot<.15;
    const sleeve=arm>.20&&along<=sleeveEnd&&hand<.20&&head<.08;
    const pants=p[1]>=ankleY&&p[1]<=pantTopY&&hand<.08&&arm<.10&&head<.04&&foot<.88;
    regions[i]=(torso||sleeve?1:0)|(pants?2:0);
    const taper=1-smooth(shoulderY-.035*H,neckY,p[1]);
    const torsoLooseness=(1-smooth(.10,.35,arm))*taper;
    const hemFold=.0024*H*Math.sin((p[1]-hemY)*45/H+Math.atan2(p[0],p[2]-torsoCenterZ)*5);
    const shirtOffset=(.0066*H+.0080*H*torsoLooseness+hemFold*taper);
    for(let k=0;k<3;k++)shirtOffsets[i*3+k]=normal[k]*shirtOffset;
    // A little additional front/back ease prevents a painted-on abdominal look.
    shirtOffsets[i*3+2]+=.0075*H*normal[2]*torsoLooseness;
    const trouserEase=.0072*H+.0040*H*(1-smooth(hipY-.21*H,pantTopY,p[1]));
    for(let k=0;k<3;k++)pantOffsets[i*3+k]=normal[k]*trouserEase;
    // Keep the lower edge above the original floor; there is no new footwear mesh.
    if(p[1]+floor<.05*H)pantOffsets[i*3+1]=Math.max(0,pantOffsets[i*3+1]);
  }
  const shirtIndices=[],pantIndices=[];
  let shirtBoundaryTriangles=0,pantBoundaryTriangles=0;
  for(let at=0;at<I.length;at+=3) {
    const ids=[I[at],I[at+1],I[at+2]];
    const shirt=ids.reduce((s,id)=>s+((regions[id]&1)?1:0),0);
    const pants=ids.reduce((s,id)=>s+((regions[id]&2)?1:0),0);
    // Majority coverage avoids pinholes at dense anatomical boundary loops.
    // Adjacent triangles use the same classification and offset field.
    if(shirt>=2){shirtIndices.push(...ids);if(shirt!==3)shirtBoundaryTriangles++;}
    if(pants>=2){pantIndices.push(...ids);if(pants!==3)pantBoundaryTriangles++;}
  }
  if(shirtIndices.length<300||pantIndices.length<300)
    throw Error('Native clothing segmentation produced too little actual body coverage');
  const maxInfluences=binding.report.maxInfluences;
  const declarations=`
uniform sampler2D mrRanges,mrEntries,mrBones;
uniform float mrActive;
attribute vec3 ngOffset;
varying vec3 ngRest;
vec4 ngRead(sampler2D t,int k){return texelFetch(t,ivec2(k%2048,k/2048),0);}
vec3 ngP=vec3(0.);mat3 ngR=mat3(1.);
vec3 ngNative(vec3 p){return vec3(p.x,-p.z,p.y);}
vec3 ngDisplay(vec3 p){return vec3(p.x,p.z,-p.y);}
void ngEvaluate(){
 vec4 range=ngRead(mrRanges,gl_VertexID);ngP=vec3(0.);ngR=mat3(0.);
 for(int k=0;k<${maxInfluences};k++){
  if(k>=int(range.y))break;int s=(int(range.x)+k)*2;
  vec4 p=ngRead(mrEntries,s);float w=ngRead(mrEntries,s+1).x;int j=int(p.w);
  vec4 a=texelFetch(mrBones,ivec2(0,j),0),b=texelFetch(mrBones,ivec2(1,j),0),c=texelFetch(mrBones,ivec2(2,j),0);
  ngP+=w*vec3(dot(a,vec4(p.xyz,1.)),dot(b,vec4(p.xyz,1.)),dot(c,vec4(p.xyz,1.)));
  ngR+=w*transpose(mat3(a.xyz,b.xyz,c.xyz));
 }
}
`;
  function makeMaterial(kind,hex) {
    const material=new THREE.MeshStandardMaterial({color:hex,roughness:kind==='shirt'?.91:.87,metalness:0,side:THREE.DoubleSide});
    material.name='native-garment/'+actor.id+'/'+kind;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,binding.U);
      shader.uniforms.ngHem={value:hemY};shader.uniforms.ngNeck={value:neckY};
      shader.uniforms.ngFront={value:torsoCenterZ};shader.uniforms.ngHeight={value:H};
      shader.vertexShader=declarations+shader.vertexShader;
      for(const a of ['#include <beginnormal_vertex>','#include <defaultnormal_vertex>','#include <begin_vertex>','#include <project_vertex>'])
        if(!shader.vertexShader.includes(a))throw Error('Native garment shader anchor drift: '+a);
      shader.vertexShader=shader.vertexShader
        .replace('#include <beginnormal_vertex>','if(mrActive>.5)ngEvaluate();\n#include <beginnormal_vertex>')
        .replace('#include <defaultnormal_vertex>','if(mrActive>.5)objectNormal=ngDisplay(ngR*ngNative(objectNormal));\n#include <defaultnormal_vertex>')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nngRest=position;transformed+=ngOffset;')
        .replace('#include <project_vertex>','if(mrActive>.5)transformed=ngDisplay(ngP+ngR*ngNative(transformed-position));\n#include <project_vertex>');
      shader.fragmentShader='varying vec3 ngRest;uniform float ngHem,ngNeck,ngFront,ngHeight;\n'+shader.fragmentShader;
      const detail=kind==='shirt'?`
 float frontPanel=step(ngFront,ngRest.z);
 float placket=(1.-smoothstep(.010,.015,abs(ngRest.x)/ngHeight))*frontPanel;
 float inside=step(ngHem+.018*ngHeight,ngRest.y)*step(ngRest.y,ngNeck-.012*ngHeight);
 diffuseColor.rgb*=1.-.075*placket*inside;
 float buttonY=abs(fract((ngRest.y-ngHem)/(.062*ngHeight))-.5)*.062;
 float dotDist=length(vec2(ngRest.x/ngHeight,buttonY));
 float button=(1.-smoothstep(.0024,.0040,dotDist))*frontPanel*inside;
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.73+vec3(.10),button*.75);
 `:'';
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 // Low-contrast, derivative-filtered fibre shading. It adds no geometry or physics.
 vec2 weave=ngRest.xy*(1550./ngHeight);
 float pixelFootprint=max(fwidth(weave.x),fwidth(weave.y));
 float weaveVisibility=1.-smoothstep(.35,1.8,pixelFootprint);
 diffuseColor.rgb*=1.+.016*sin(weave.x)*sin(weave.y)*weaveVisibility;
 ${detail}`);
      material.userData.nativeGarmentShader=shader;
    };
    material.customProgramCacheKey=()=>`kaopu-native-garment-r01/${kind}/csr-${maxInfluences}`;
    materials.push(material);return material;
  }
  function makeLayer(kind,indices,offsets,hex) {
    const geometry=new THREE.BufferGeometry();
    // Shared immutable attributes retain the exact original gl_VertexID namespace.
    for(const key of ['position','normal','uv'])if(source.attributes[key])geometry.setAttribute(key,source.attributes[key]);
    geometry.setAttribute('ngOffset',new THREE.Float32BufferAttribute(offsets,3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices),1));
    geometry.boundingBox=source.boundingBox?.clone()||null;geometry.boundingSphere=source.boundingSphere?.clone()||null;
    const mesh=new THREE.Mesh(geometry,makeMaterial(kind,hex));
    mesh.name='R07-'+actor.id+'-'+kind+'-native-skinned-shell';mesh.frustumCulled=false;
    mesh.receiveShadow=true;
    // The host chooses its grounding shadow policy. A rest-pose default depth
    // shader on this shell would cast an incorrect T-pose, so do not add it.
    mesh.castShadow=false;mesh.renderOrder=1;
    group.add(mesh);meshes.push(mesh);geometries.push(geometry);
    return mesh;
  }
  makeLayer('trousers',pantIndices,pantOffsets,trouserColor);
  makeLayer('shirt',shirtIndices,shirtOffsets,shirtColor);
  actor.root.add(group);
  const indexHash=()=>{let h=2166136261;for(let i=0;i<I.length;i++)h=Math.imul(h^I[i],16777619);return(h>>>0).toString(16);};
  const report={
    version:'NATIVE-DAILY-GARMENTS-R01',actorId:actor.id,
    source:actor.identity.source,kind:'native-skinned surface shells; no cloth physics',
    originalBodyRetained:true,originalBodyIndexHash:indexHash(),originalBodyVertices:D,
    originalBodyTriangles:I.length/3,originalBodyMeshVisible:actor.mesh.visible,
    fullNativeCSR:true,weightsTruncated:false,boneTextureShared:true,nativeBones:rig.count,
    fullVertexIndexNamespaceRetained:geometries.every(g=>g.attributes.position===P&&g.attributes.position.count===D),
    nativeShaderSource:'same full CSR evaluation and display/native coordinate mapping as NativeBinding',
    layers:[{kind:'shirt',triangles:shirtIndices.length/3,boundaryTriangles:shirtBoundaryTriangles,color:shirtColor},
      {kind:'trousers',triangles:pantIndices.length/3,boundaryTriangles:pantBoundaryTriangles,color:trouserColor}],
    landmarks:{heightM:H,hemYLocal:hemY,trouserWaistYLocal:pantTopY,neckYLocal:neckY,cuffYLocal:ankleY,
      shirtTrouserOverlapM:pantTopY-hemY,sleeveEndAlongForearm:sleeveEnd},
    drawCalls:2,addedOffsetBytes:shirtOffsets.byteLength+pantOffsets.byteLength,
    clothPhysics:false,footwear:false,
    limitations:['Fitted skinned garment shells, not sewn patterns or cloth dynamics',
      'No self-collision or independent cloth folds; extreme joint compression requires visual checking',
      'Feet and hands remain the original bare native anatomy',
      'Closure buttons are material detail; no separate button meshes',
      'Host uses soft ground-contact shadows; garment shell casts no incorrect rest-pose shadow']
  };
  function verify() {
    if(actor.mesh.geometry!==source||source.attributes.position!==P||source.index.array!==I||indexHash()!==report.originalBodyIndexHash)
      throw Error('Original native body was modified after garment attachment');
    if(group.parent!==actor.root)throw Error('Garments are not attached to their original actor');
    return {bodyPreserved:true,fullVertexIndexNamespaceRetained:report.fullVertexIndexNamespaceRetained,
      shaderUniformObjectsShared:materials.every(m=>!m.userData.nativeGarmentShader||m.userData.nativeGarmentShader.uniforms.mrBones===binding.U.mrBones)};
  }
  const result={group,meshes,materials,report,update(){return null;},verify,dispose(){
    group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();delete actor.garments;
  }};
  actor.garments=result;verify();return result;
}
