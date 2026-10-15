import * as THREE from 'three';

// Public P02: original procedural surface-fibre geometry. No private runtime,
// captured pixels, fog, bloom, emissive tint, or external material asset.
export function makeJacket({cols,rows,radius,frame,hash,colorAt,settings,uniforms,store,lighting}){
 const samples=97,instances=cols*rows*96;
 const data=new Float32Array(samples*cols*rows*3*4);
 const meta=new Float32Array(instances*4),colors=new Float32Array(instances*3);
 let ii=0;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const id=r*cols+c,phase=hash(id)*Math.PI*2;
  for(let j=0;j<samples;j++){
   const f=frame(c,r,j/(samples-1));
   for(const [k,v]of [f.p,f.B,f.N].entries())data.set([v.x,v.y,v.z,phase],((id*3+k)*samples+j)*4);
  }
  for(let h=0;h<96;h++){
   const rand=hash(id*997+h*37+9),col=colorAt(c,r,id);
   meta.set([id,(h+rand*.55)/96,rand,hash(id*491+h*29+19)],ii*4);
   // Stable dyed-fibre variation, not screen-space noise.
   col.multiplyScalar(.72+.47*hash(id*41+h*67+1));colors.set([col.r,col.g,col.b],ii*3);ii++;
  }
 }
 const table=new THREE.DataTexture(data,samples,cols*rows*3,THREE.RGBAFormat,THREE.FloatType);
 table.minFilter=table.magFilter=THREE.LinearFilter;table.needsUpdate=true;
 const geometry=new THREE.InstancedBufferGeometry(),p=[],ind=[];
 const steps=64;
 for(let j=0;j<=steps;j++){p.push(j/steps,-1,0,j/steps,1,0);if(j<steps){const a=j*2;ind.push(a,a+2,a+1,a+2,a+3,a+1);}}
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setIndex(ind);
 geometry.setAttribute('fibreMeta',new THREE.InstancedBufferAttribute(meta,4));
 geometry.setAttribute('fibreDye',new THREE.InstancedBufferAttribute(colors,3));geometry.instanceCount=instances;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
 uniforms:{uFrames:{value:table},uTableSize:{value:new THREE.Vector2(samples,cols*rows*3)},uRadius:{value:radius},uTwist:uniforms.twist,uDetail:uniforms.detail,uSize:uniforms.viewSize,uKeyDir:{value:new THREE.Vector3()},uRimDir:{value:new THREE.Vector3()},uKey:{value:new THREE.Vector3()},uRim:{value:new THREE.Vector3()},uED:{value:Array.from({length:8},()=>new THREE.Vector3())},uEC:{value:Array.from({length:8},()=>new THREE.Vector3())}},
 vertexShader:`
 attribute vec4 fibreMeta;attribute vec3 fibreDye;
 uniform sampler2D uFrames;uniform vec2 uTableSize,uSize;uniform float uRadius,uTwist,uDetail;
 varying vec3 vT,vN,vC;varying float vEdge,vCoverage;
 vec3 surface(float t,out vec3 n,out vec3 tang){
  float x=(clamp(t,0.,1.)*(uTableSize.x-1.)+.5)/uTableSize.x;
  vec4 p=texture2D(uFrames,vec2(x,(fibreMeta.x*3.+.5)/uTableSize.y));
  vec3 B=normalize(texture2D(uFrames,vec2(x,(fibreMeta.x*3.+1.5)/uTableSize.y)).xyz);
  vec3 N=normalize(texture2D(uFrames,vec2(x,(fibreMeta.x*3.+2.5)/uTableSize.y)).xyz);
  float angle=fibreMeta.y*6.2831853-t*6.2831853*uTwist*1.6+.075*sin(t*57.+fibreMeta.z*27.);
  n=normalize(B*cos(angle)+N*sin(angle));
  float da=-6.2831853*uTwist*1.6+4.275*cos(t*57.+fibreMeta.z*27.);
  tang=normalize(cross(N,B)+(-B*sin(angle)+N*cos(angle))*(uRadius*da/.025));
  float breathe=1.+.038*sin(t*21.+p.w)+.022*sin(t*49.+p.w*3.);
  float envelope=1.+.055*cos(3.*(angle+t*6.2831853*2.8*uTwist))+.022*sin(5.*angle+p.w+t*11.);
  float crimp=.000012*sin(t*145.+fibreMeta.z*47.)+.000007*sin(t*283.+fibreMeta.w*35.);
  return p.xyz+n*(uRadius*breathe*envelope+.000095+crimp);
 }
 void main(){
  float t=position.x;vec3 n,T;vec3 p=surface(t,n,T);
  vec4 mv=modelViewMatrix*vec4(p,1.);vec4 cp=projectionMatrix*mv;
  vec3 tv=normalize(mat3(modelViewMatrix)*T);vec2 across=vec2(-tv.y,tv.x);across/=max(length(across),.00001);
  float actual=projectionMatrix[1][1]*(.000030+.000008*fibreMeta.w)/max(-mv.z,.00001)*uSize.y*.5;
  float width=max(.8,actual);cp.xy+=across*position.y*width/uSize*cp.w;
  gl_Position=cp;vEdge=position.y;
  vCoverage=min(1.,actual/.8)*uDetail*.96;
  vT=normalize(mat3(modelMatrix)*T);vN=normalize(mat3(modelMatrix)*n);vC=fibreDye;
 }
 `,
 fragmentShader:`
 uniform vec3 uKeyDir,uRimDir,uKey,uRim,uED[8],uEC[8];
 varying vec3 vT,vN,vC;varying float vEdge,vCoverage;
 vec3 response(vec3 L,vec3 radiance){
  float nd=dot(normalize(vN),L),cylinder=sqrt(max(0.,1.-pow(dot(normalize(vT),L),2.)));
  return radiance*(.64*max(nd,0.)+.36*cylinder*clamp(.55+.55*nd,0.,1.))/3.141592654;
 }
 void main(){
  float alpha=clamp(vCoverage*(1.-smoothstep(.45,1.,abs(vEdge))),0.,.96);if(alpha<.002)discard;
  vec3 light=response(uKeyDir,uKey)*coatShadow(uKS,uKM)+response(uRimDir,uRim)*coatShadow(uRS,uRM);
  for(int i=0;i<8;i++)light+=response(uED[i],uEC[i]*3.141592654);
  gl_FragColor=vec4(vC*light,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=1;
 function light(){const f=KAOPU_EB1.sampleProfile(store.get());for(const [k,v]of [['uKeyDir',f.keyDirection],['uRimDir',f.rimDirection],['uKey',f.keyColor],['uRim',f.rimColor]])material.uniforms[k].value.fromArray(v);f.environment.forEach((e,i)=>{material.uniforms.uED.value[i].fromArray(e.direction);material.uniforms.uEC.value[i].fromArray(e.color);});}
 light();const stop=store.subscribe(light);installShadows(mesh,lighting);
 return {mesh,report:()=>({fibres:instances,segmentsPerFibre:steps,triangles:instances*steps*2,frameTableBytes:data.byteLength,instanceBytes:meta.byteLength+colors.byteLength,source:'same public carrier envelope; stable dyed laid fibres; no private inputs',shadow:'both EB1 carrier-depth maps sampled by surface fibres; not individual-fibre self shadows',clearanceMetres:.000095,frameTextureReadsPerVertex:3}),dispose(){stop();mesh.removeFromParent();geometry.dispose();material.dispose();table.dispose();}};
}

const shadowGLSL=`
#include <packing>
uniform sampler2D uKS,uRS;uniform mat4 uKM,uRM;uniform vec2 uShadowStep;uniform float uShadowReady;varying vec3 vShadowWorld;
float coatShadow(sampler2D tex,mat4 matrix){
 if(uShadowReady<.5)return 1.;vec4 h=matrix*vec4(vShadowWorld,1.);vec3 q=h.xyz/h.w;
 if(q.x<0.||q.y<0.||q.x>1.||q.y>1.||q.z<0.||q.z>1.)return 1.;
 float z=q.z-.000075;vec2 d=uShadowStep*.6;
 return .25*(step(z,unpackRGBAToDepth(texture2D(tex,q.xy+vec2(d.x,d.y))))+step(z,unpackRGBAToDepth(texture2D(tex,q.xy+vec2(-d.x,d.y))))+step(z,unpackRGBAToDepth(texture2D(tex,q.xy+vec2(d.x,-d.y))))+step(z,unpackRGBAToDepth(texture2D(tex,q.xy-vec2(d.x,d.y)))));
}
`;
function installShadows(mesh,lighting){
 const m=mesh.material;
 m.uniforms.uKS={value:null};m.uniforms.uRS={value:null};m.uniforms.uKM={value:new THREE.Matrix4()};m.uniforms.uRM={value:new THREE.Matrix4()};m.uniforms.uShadowStep={value:new THREE.Vector2(1/2048,1/2048)};m.uniforms.uShadowReady={value:0};
 m.vertexShader='varying vec3 vShadowWorld;\n'+m.vertexShader;
 if(!m.vertexShader.includes('gl_Position=cp;'))throw Error('Shadow anchor missing');
 m.vertexShader=m.vertexShader.replace('gl_Position=cp;','vShadowWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=cp;');
 m.fragmentShader=shadowGLSL+'\n'+m.fragmentShader;
 mesh.onBeforeRender=()=>{const k=lighting.key.shadow,r=lighting.rim.shadow;m.uniforms.uShadowReady.value=k.map&&r.map?1:0;if(k.map&&r.map){m.uniforms.uKS.value=k.map.texture;m.uniforms.uRS.value=r.map.texture;m.uniforms.uKM.value.copy(k.matrix);m.uniforms.uRM.value.copy(r.matrix);m.uniforms.uShadowStep.value.set(1/k.mapSize.x,1/k.mapSize.y);}m.uniformsNeedUpdate=true;};
 m.needsUpdate=true;
}
export function shadeFlyaways(mesh,normals,store,lighting){
 const m=mesh.material;
 mesh.geometry.setAttribute('fibreNormal',new THREE.InstancedBufferAttribute(normals,3));
 m.vertexShader='attribute vec3 fibreNormal;varying vec3 vRootNormal;\n'+m.vertexShader;
 m.vertexShader=m.vertexShader.replace('vC=fiberColor;','vC=fiberColor;vRootNormal=normalize(mat3(modelMatrix)*fibreNormal);');
 m.fragmentShader='varying vec3 vRootNormal;uniform vec3 uED[8],uEC[8];\n'+m.fragmentShader;
 const a='vec3 light=vec3(.30*uEnv)+(uKey*a+uRim*b)/3.14159265;';
 if(!m.fragmentShader.includes(a))throw Error('Flyaway lighting anchor missing');
 m.fragmentShader=m.fragmentShader.replace(a,`vec3 N=normalize(vRootNormal);float nl=dot(N,uKeyDir),nr=dot(N,uRimDir);
 vec3 light=(uKey*(.55*max(nl,0.)+.45*a*clamp(.55+.55*nl,0.,1.))*coatShadow(uKS,uKM)+uRim*(.55*max(nr,0.)+.45*b*clamp(.55+.55*nr,0.,1.))*coatShadow(uRS,uRM))/3.14159265;
 for(int i=0;i<8;i++){float nd=dot(N,uED[i]),cyl=sqrt(max(0.,1.-pow(dot(T,uED[i]),2.)));light+=uEC[i]*(.55*max(nd,0.)+.45*cyl*clamp(.55+.55*nd,0.,1.));}`);
 m.uniforms.uED={value:Array.from({length:8},()=>new THREE.Vector3())};m.uniforms.uEC={value:Array.from({length:8},()=>new THREE.Vector3())};
 installShadows(mesh,lighting);const prior=mesh.onBeforeRender;let seen=null;
 mesh.onBeforeRender=()=>{prior();if(seen!==store.get()){seen=store.get();KAOPU_EB1.sampleProfile(seen).environment.forEach((e,i)=>{m.uniforms.uED.value[i].fromArray(e.direction);m.uniforms.uEC.value[i].fromArray(e.color);});}m.uniformsNeedUpdate=true;};
}
