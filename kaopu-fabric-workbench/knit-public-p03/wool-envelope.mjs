import * as THREE from 'three';

const TAU=Math.PI*2;
const PI=Math.PI;
const fract=x=>x-Math.floor(x);

const PHOTO_UNIFORMS=()=>({
  uKeyDir:{value:new THREE.Vector3()},uRimDir:{value:new THREE.Vector3()},
  uKey:{value:new THREE.Vector3()},uRim:{value:new THREE.Vector3()},
  uED:{value:Array.from({length:8},()=>new THREE.Vector3())},
  uEC:{value:Array.from({length:8},()=>new THREE.Vector3())}
});
const SHADOW_UNIFORMS=()=>({
  uKS:{value:null},uRS:{value:null},uKM:{value:new THREE.Matrix4()},uRM:{value:new THREE.Matrix4()},
  uShadowStep:{value:new THREE.Vector2(1/2048,1/2048)},uShadowReady:{value:0}
});
const SHADOW_GLSL=`
#include <packing>
uniform sampler2D uKS,uRS;uniform mat4 uKM,uRM;uniform vec2 uShadowStep;uniform float uShadowReady;
float woolShadow(sampler2D tex,mat4 matrix,vec3 worldPos){
 if(uShadowReady<.5)return 1.;vec4 h=matrix*vec4(worldPos,1.);vec3 q=h.xyz/h.w;
 if(q.x<0.||q.y<0.||q.x>1.||q.y>1.||q.z<0.||q.z>1.)return 1.;
 float z=q.z-.00009;vec2 d=uShadowStep*.65;
 return .25*(step(z,unpackRGBAToDepth(texture2D(tex,q.xy+vec2(d.x,d.y))))+step(z,unpackRGBAToDepth(texture2D(tex,q.xy+vec2(-d.x,d.y))))+step(z,unpackRGBAToDepth(texture2D(tex,q.xy+vec2(d.x,-d.y))))+step(z,unpackRGBAToDepth(texture2D(tex,q.xy-vec2(d.x,d.y)))));
}
`;
function attachShadows(mesh,material,lighting){
 mesh.onBeforeRender=()=>{
  const k=lighting.key.shadow,r=lighting.rim.shadow;
  material.uniforms.uShadowReady.value=k.map&&r.map?1:0;
  if(k.map&&r.map){
   material.uniforms.uKS.value=k.map.texture;material.uniforms.uRS.value=r.map.texture;
   material.uniforms.uKM.value.copy(k.matrix);material.uniforms.uRM.value.copy(r.matrix);
   material.uniforms.uShadowStep.value.set(1/k.mapSize.x,1/k.mapSize.y);
  }
  material.uniformsNeedUpdate=true;
 };
}
function syncPhoto(materials,store){
 const p=KAOPU_EB1.sampleProfile(store.get());
 for(const material of materials){
  material.uniforms.uKeyDir.value.fromArray(p.keyDirection);material.uniforms.uRimDir.value.fromArray(p.rimDirection);
  material.uniforms.uKey.value.fromArray(p.keyColor);material.uniforms.uRim.value.fromArray(p.rimColor);
  p.environment.forEach((e,i)=>{material.uniforms.uED.value[i].fromArray(e.direction);material.uniforms.uEC.value[i].fromArray(e.color);});
  material.uniformsNeedUpdate=true;
 }
}

export function softenCarrierMaterial(material,{uniforms,version}){
 material.roughness=.97;material.metalness=0;material.sheen=.72;material.sheenRoughness=1;
 material.sheenColor.set('#e8ddc9');material.ior=1.36;material.specularIntensity=.18;material.color.setScalar(.80);
 material.onBeforeCompile=shader=>{
  shader.uniforms.uWoolDetail=uniforms.detail;shader.uniforms.uWoolFuzz=uniforms.fuzz;shader.uniforms.uWoolTwist=uniforms.twist;
  shader.vertexShader='varying vec2 vWoolUV;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvWoolUV=uv;');
  shader.fragmentShader=`varying vec2 vWoolUV;uniform float uWoolDetail,uWoolFuzz,uWoolTwist;
float woolHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float woolNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(woolHash(i),woolHash(i+vec2(1,0)),f.x),mix(woolHash(i+vec2(0,1)),woolHash(i+vec2(1,1)),f.x),f.y);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 wp=vec2(vWoolUV.x*5.7+vWoolUV.y*.91,vWoolUV.y*10.9-vWoolUV.x*.43);
    float coarse=woolNoise(wp*1.73+vec2(uWoolTwist*2.1,3.7));
    float fine=woolNoise(wp*7.91+coarse*4.3);
    float ridge=1.-abs(2.*woolNoise(wp*16.7+vec2(9.2,1.4))-1.);
    float signal=(coarse-.5)*.58+(fine-.5)*.29+(ridge-.5)*.13;
    vec3 woolAxis=normalize(dFdx(vViewPosition)*dFdy(vWoolUV.x)-dFdy(vViewPosition)*dFdx(vWoolUV.x));
    if(length(woolAxis)>.1)normal=normalize(normal+woolAxis*signal*.24*uWoolDetail*(.42+.58*clamp(uWoolFuzz,0.,1.35)));
    roughnessFactor=clamp(roughnessFactor+.07*uWoolDetail+.055*clamp(uWoolFuzz,0.,1.35),0.,1.);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 cp=vec2(vWoolUV.x*4.1+vWoolUV.y*.37,vWoolUV.y*8.3);
    float c0=woolNoise(cp*1.9),c1=woolNoise(cp*8.7+5.2);
    diffuseColor.rgb*=.72+.16*c0+.08*c1;
  `);
 };
 material.customProgramCacheKey=()=>version+'-aperiodic-wool-carrier-v1';
 material.needsUpdate=true;
}

function makeFrameTable({cols,rows,frame,hash}){
 const samples=97,count=cols*rows,data=new Float32Array(samples*count*3*4);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const id=r*cols+c,phase=hash(id*193+17)*TAU;
  for(let j=0;j<samples;j++){
   const f=frame(c,r,j/(samples-1));
   for(const [k,v] of [f.p,f.B,f.N].entries())data.set([v.x,v.y,v.z,phase],((id*3+k)*samples+j)*4);
  }
 }
 const texture=new THREE.DataTexture(data,samples,count*3,THREE.RGBAFormat,THREE.FloatType);
 texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 return {samples,count,data,texture};
}
function ribbonGeometry(steps){
 const geometry=new THREE.InstancedBufferGeometry(),positions=[],indices=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps;positions.push(t,-1,0,t,1,0);
  if(i<steps){const k=i*2;indices.push(k,k+2,k+1,k+2,k+3,k+1);}
 }
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);return geometry;
}
function woolLightGLSL(){return `
uniform vec3 uKeyDir,uRimDir,uKey,uRim,uED[8],uEC[8];
vec3 woolResponse(vec3 N,vec3 T,vec3 L,vec3 radiance){
 float nd=max(dot(N,L),0.);float cyl=sqrt(max(0.,1.-pow(dot(T,L),2.)));float back=max(dot(-N,L),0.);
 return radiance*(.68*nd+.27*cyl*(.58+.42*nd)+.05*back)/3.141592654;
}
`;}

function makeShells({geometry,uniforms,store,lighting}){
 const meshes=[],materials=[];const layers=[
  {offset:.000055,opacity:.30,order:1.05,scale:14500},
  {offset:.000135,opacity:.19,order:1.10,scale:10900}
 ];
 layers.forEach((layer,index)=>{
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:true,
   uniforms:{uOffset:{value:layer.offset},uOpacity:{value:layer.opacity},uLayer:{value:index+1},uNoiseScale:{value:layer.scale},uFuzz:uniforms.fuzz,...PHOTO_UNIFORMS(),...SHADOW_UNIFORMS()},
   vertexShader:`varying vec3 vWorld,vN,vC;varying vec2 vUvW;
uniform float uOffset;
void main(){vec3 p=position+normal*uOffset;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;vN=normalize(mat3(modelMatrix)*normal);vC=color;vUvW=uv;gl_Position=projectionMatrix*viewMatrix*world;}`,
   fragmentShader:SHADOW_GLSL+woolLightGLSL()+`
varying vec3 vWorld,vN,vC;varying vec2 vUvW;uniform float uOpacity,uLayer,uNoiseScale,uFuzz;
float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453123);}
void main(){vec3 N=normalize(vN),V=normalize(cameraPosition-vWorld);float grain=h31(floor(vWorld*uNoiseScale)+uLayer*17.0);
 float grazing=pow(1.-abs(dot(N,V)),.72);float density=clamp(uFuzz/1.35,0.,1.);
 float alpha=uOpacity*density*(.38+.62*grazing)*(.72+.28*grain);if(alpha<.004)discard;
 vec3 light=woolResponse(N,normalize(vec3(.31,.88,.35)),uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,normalize(vec3(.31,.88,.35)),uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);
 for(int i=0;i<8;i++)light+=woolResponse(N,normalize(vec3(.31,.88,.35)),uED[i],uEC[i]);
 gl_FragColor=vec4(vC*light,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=layer.order;attachShadows(mesh,material,lighting);meshes.push(mesh);materials.push(material);
 });
 return {meshes,materials,triangles:geometry.index.count/3*layers.length,dispose(){for(const m of materials)m.dispose();}};
}

function makeStaples({cols,rows,radius,frameTable,hash,colorAt,uniforms,lighting}){
 const perStitch=176,instances=cols*rows*perStitch,steps=12;
 const meta=new Float32Array(instances*4),rand=new Float32Array(instances*4),colors=new Float32Array(instances*3);let ii=0;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const id=r*cols+c,colBase=colorAt(c,r,id);
  for(let h=0;h<perStitch;h++){
   const clump=Math.floor(h/6),slot=h%6,g0=hash(id*11027+clump*97+11),g1=hash(id*17011+clump*131+23);
   const angle=(fract(clump*.61803398875+g0*.19)+(slot-2.5)*(.0035+.0045*hash(id*313+h*19+7)))*TAU;
   const span=.19+.31*Math.pow(hash(id*3301+h*67+17),.82),start=hash(id*2713+h*43+29)*(1-span);
   const lift=.000026+.000115*Math.pow(hash(id*1877+h*73+31),1.45),width=hash(id*1429+h*61+37),densityKey=hash(id*2029+h*89+41);
   meta.set([id,start,span,angle],ii*4);rand.set([g1,lift,width,densityKey],ii*4);
   const col=colBase.clone().multiplyScalar(.68+.44*hash(id*379+h*101+47));colors.set([col.r,col.g,col.b],ii*3);ii++;
  }
 }
 const geometry=ribbonGeometry(steps);geometry.setAttribute('fibreMeta',new THREE.InstancedBufferAttribute(meta,4));geometry.setAttribute('fibreRand',new THREE.InstancedBufferAttribute(rand,4));geometry.setAttribute('fibreDye',new THREE.InstancedBufferAttribute(colors,3));geometry.instanceCount=instances;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:true,
  uniforms:{uFrames:{value:frameTable.texture},uTableSize:{value:new THREE.Vector2(frameTable.samples,frameTable.count*3)},uRadius:{value:radius},uTwist:uniforms.twist,uDetail:uniforms.detail,uDensity:uniforms.fuzz,uLength:uniforms.len,uSize:uniforms.viewSize,...PHOTO_UNIFORMS(),...SHADOW_UNIFORMS()},
  vertexShader:`attribute vec4 fibreMeta,fibreRand;attribute vec3 fibreDye;
uniform sampler2D uFrames;uniform vec2 uTableSize,uSize;uniform float uRadius,uTwist,uDetail,uDensity,uLength;
varying vec3 vWorld,vN,vT,vC;varying float vEdge,vAlpha;
void getFrame(float t,out vec3 p,out vec3 B,out vec3 N,out float phase){float x=(clamp(t,0.,1.)*(uTableSize.x-1.)+.5)/uTableSize.x;vec4 q=texture2D(uFrames,vec2(x,(fibreMeta.x*3.+.5)/uTableSize.y));p=q.xyz;phase=q.w;B=normalize(texture2D(uFrames,vec2(x,(fibreMeta.x*3.+1.5)/uTableSize.y)).xyz);N=normalize(texture2D(uFrames,vec2(x,(fibreMeta.x*3.+2.5)/uTableSize.y)).xyz);}
void main(){float u=position.x,t=fibreMeta.y+u*fibreMeta.z;vec3 p,B,N;float phase;getFrame(t,p,B,N,phase);vec3 T=normalize(cross(B,N));
 float angle=fibreMeta.w+t*6.2831853*uTwist*1.34+.18*sin(t*41.+fibreRand.x*23.+phase);float ca=cos(angle),sa=sin(angle);
 float rb=uRadius*(.94+.055*sin(t*17.+phase)+.035*sin(t*39.+fibreRand.x*19.));float rn=uRadius*(.76+.060*cos(t*13.+phase*1.7)+.030*sin(t*31.+fibreRand.x*11.));
 vec3 surface=B*(ca*rb)+N*(sa*rn);vec3 n=normalize(B*(ca/max(rb,.000001))+N*(sa/max(rn,.000001)));vec3 side=normalize(cross(T,n));
 float endFade=smoothstep(0.,.11,u)*smoothstep(1.,.89,u);float arch=sin(3.141592654*u);float crimp=.000021*sin(u*6.2831853*(2.2+2.8*fibreRand.x)+phase*2.3)*arch;
 p+=surface+n*(.000038+fibreRand.y*uLength*arch)+side*crimp;
 vec3 tangent=normalize(T+side*(crimp*3200.)+n*(fibreRand.y*uLength*cos(3.141592654*u)*3.141592654/max(fibreMeta.z,.08)));
 vec4 world=modelMatrix*vec4(p,1.);vec4 mv=viewMatrix*world;vec4 cp=projectionMatrix*mv;vec3 tv=normalize(mat3(viewMatrix*modelMatrix)*tangent);vec2 across=normalize(vec2(-tv.y,tv.x));
 float actual=projectionMatrix[1][1]*(.000036+.000025*fibreRand.z)/max(-mv.z,.00001)*uSize.y*.5;float width=max(.82,actual)*(1.-.23*abs(2.*u-1.));cp.xy+=across*position.y*width/uSize*cp.w;gl_Position=cp;
 float d=clamp(uDensity/1.35,0.,1.);float keep=smoothstep(fibreRand.w-.18,fibreRand.w+.10,d);vAlpha=endFade*keep*clamp(uDetail,0.,1.4)*(.60+.26*fibreRand.z)*min(1.,actual/.82);
 vEdge=position.y;vWorld=world.xyz;vN=normalize(mat3(modelMatrix)*n);vT=normalize(mat3(modelMatrix)*tangent);vC=fibreDye;}`,
  fragmentShader:SHADOW_GLSL+woolLightGLSL()+`varying vec3 vWorld,vN,vT,vC;varying float vEdge,vAlpha;
void main(){float alpha=vAlpha*(1.-smoothstep(.46,1.,abs(vEdge)));if(alpha<.003)discard;vec3 N=normalize(vN),T=normalize(vT);
 vec3 light=woolResponse(N,T,uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,T,uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);
 for(int i=0;i<8;i++)light+=woolResponse(N,T,uED[i],uEC[i]);
 gl_FragColor=vec4(vC*light,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=2;attachShadows(mesh,material,lighting);
 return {mesh,material,instances,steps,triangles:instances*steps*2,bytes:meta.byteLength+rand.byteLength+colors.byteLength,dispose(){geometry.dispose();material.dispose();}};
}

function makeHalo({cols,rows,radius,frame,hash,colorAt,uniforms,lighting}){
 const perStitch=320,instances=cols*rows*perStitch,steps=4;
 const roots=new Float32Array(instances*3),strands=new Float32Array(instances*3),curves=new Float32Array(instances*3),identity=new Float32Array(instances*3),colors=new Float32Array(instances*3),normals=new Float32Array(instances*3);let ii=0;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const id=r*cols+c,colBase=colorAt(c,r,id),phase=hash(id*193+17)*TAU;
  for(let h=0;h<perStitch;h++){
   const hid=id*2003+h,tt=hash(hid*13+5),f=frame(c,r,tt),ang=hash(hid*17+7)*TAU,ca=Math.cos(ang),sa=Math.sin(ang);
   const rb=radius*(.94+.055*Math.sin(tt*17+phase)+.035*Math.sin(tt*39+hash(hid*19)*19));const rn=radius*(.76+.060*Math.cos(tt*13+phase*1.7)+.030*Math.sin(tt*31+hash(hid*23)*11));
   const n=f.B.clone().multiplyScalar(ca/Math.max(rb,1e-6)).addScaledVector(f.N,sa/Math.max(rn,1e-6)).normalize();
   const root=f.p.clone().addScaledVector(f.B,ca*rb).addScaledVector(f.N,sa*rn).addScaledVector(n,.000022);
   const q=hash(hid*29+9);let kind,len;if(q<.80){kind=0;len=.00026+.00062*Math.pow(hash(hid*31+11),1.75);}else if(q<.982){kind=.55;len=.00062+.00118*Math.pow(hash(hid*37+13),1.25);}else{kind=1;len=.00135+.00215*hash(hid*41+17);}
   const tangentBias=kind<.2?1.25:(kind<.8?.58:.30);const outward=kind<.2?.28:(kind<.8?.78:1.02);
   const dir=f.T.clone().multiplyScalar((hash(hid*43+19)-.5)*tangentBias).addScaledVector(n,outward+.25*hash(hid*47+23)).addScaledVector(f.B,(hash(hid*53+29)-.5)*.42).normalize().multiplyScalar(len);
   const curve=f.B.clone().multiplyScalar((hash(hid*59+31)-.5)*len*(kind<.2?.65:1.45)).addScaledVector(f.N,(hash(hid*61+37)-.48)*len*(kind<.2?.42:.95)).addScaledVector(n,-len*(.08+.18*hash(hid*67+41)));
   roots.set([root.x,root.y,root.z],ii*3);strands.set([dir.x,dir.y,dir.z],ii*3);curves.set([curve.x,curve.y,curve.z],ii*3);identity.set([hash(hid*71+43),kind,hash(hid*73+47)],ii*3);normals.set([n.x,n.y,n.z],ii*3);
   const col=colBase.clone().multiplyScalar(.67+.46*hash(hid*79+53));colors.set([col.r,col.g,col.b],ii*3);ii++;
  }
 }
 const geometry=ribbonGeometry(steps);for(const [name,data] of [['root',roots],['strand',strands],['curve',curves],['identity',identity],['fiberColor',colors],['fibreNormal',normals]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(data,3));geometry.instanceCount=instances;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:true,
  uniforms:{uLength:uniforms.len,uDensity:uniforms.fuzz,uSize:uniforms.viewSize,...PHOTO_UNIFORMS(),...SHADOW_UNIFORMS()},
  vertexShader:`attribute vec3 root,strand,curve,identity,fiberColor,fibreNormal;uniform float uLength,uDensity;uniform vec2 uSize;varying vec3 vWorld,vN,vT,vC;varying float vEdge,vAlpha;
void main(){float t=position.x;vec3 p=root+uLength*(strand*t+curve*t*t);vec3 tangent=normalize(strand+2.*curve*t);vec4 world=modelMatrix*vec4(p,1.);vec4 mv=viewMatrix*world;vec4 cp=projectionMatrix*mv;vec3 tv=normalize(mat3(viewMatrix*modelMatrix)*tangent);vec2 across=normalize(vec2(-tv.y,tv.x));
 float baseWidth=mix(.000033,.000060,identity.y);float actual=projectionMatrix[1][1]*(baseWidth+.000012*identity.z)/max(-mv.z,.00001)*uSize.y*.5;float width=max(.78,actual)*(1.-.70*t);cp.xy+=across*position.y*width/uSize*cp.w;gl_Position=cp;
 float d=clamp(uDensity/1.35,0.,1.);float keep=smoothstep(identity.x-.17,identity.x+.09,d);float kindBoost=mix(.78,1.08,identity.y);vAlpha=keep*kindBoost*(1.-t*.30)*min(1.,actual/.78);vEdge=position.y;vWorld=world.xyz;vN=normalize(mat3(modelMatrix)*fibreNormal);vT=normalize(mat3(modelMatrix)*tangent);vC=fiberColor;}`,
  fragmentShader:SHADOW_GLSL+woolLightGLSL()+`varying vec3 vWorld,vN,vT,vC;varying float vEdge,vAlpha;
void main(){float alpha=vAlpha*(1.-smoothstep(.45,1.,abs(vEdge)));if(alpha<.003)discard;vec3 N=normalize(vN),T=normalize(vT);
 vec3 light=woolResponse(N,T,uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,T,uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);
 for(int i=0;i<8;i++)light+=woolResponse(N,T,uED[i],uEC[i]);
 gl_FragColor=vec4(vC*light,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=3;attachShadows(mesh,material,lighting);
 return {mesh,material,instances,steps,triangles:instances*steps*2,bytes:roots.byteLength+strands.byteLength+curves.byteLength+identity.byteLength+colors.byteLength+normals.byteLength,dispose(){geometry.dispose();material.dispose();}};
}

export function makeWoolEnvelope({geometry,cols,rows,radius,frame,hash,colorAt,uniforms,store,lighting}){
 const group=new THREE.Group(),frameTable=makeFrameTable({cols,rows,frame,hash});
 const shells=makeShells({geometry,uniforms,store,lighting}),staples=makeStaples({cols,rows,radius,frameTable,hash,colorAt,uniforms,lighting}),halo=makeHalo({cols,rows,radius,frame,hash,colorAt,uniforms,lighting});
 for(const mesh of shells.meshes)group.add(mesh);group.add(staples.mesh,halo.mesh);
 const materials=[...shells.materials,staples.material,halo.material];syncPhoto(materials,store);const stop=store.subscribe(()=>syncPhoto(materials,store));
 return {
  group,setVisible(value){group.visible=!!value;},
  report(){return {shellLayers:shells.meshes.length,stapleFibres:staples.instances,haloFibres:halo.instances,stapleSegments:staples.steps,haloSegments:halo.steps,triangles:shells.triangles+staples.triangles+halo.triangles,frameTableBytes:frameTable.data.byteLength,instanceBytes:staples.bytes+halo.bytes,distribution:'finite overlapping staple fibres + down/halo/flyaway population; stable clumps, non-periodic phase',qualityTarget:'soft dense wool envelope; candidate only, not user accepted'};},
  dispose(){stop();group.removeFromParent();shells.dispose();staples.dispose();halo.dispose();frameTable.texture.dispose();}
 };
}
