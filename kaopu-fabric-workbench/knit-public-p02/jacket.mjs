import * as THREE from 'three';

// Public P02: original procedural surface-fibre geometry. No private runtime,
// captured pixels, fog, bloom, emissive tint, or external material asset.
export function makeJacket({cols,rows,radius,frame,hash,colorAt,settings,uniforms,store}){
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
 vec3 surface(float t,out vec3 n){
  float x=(clamp(t,0.,1.)*(uTableSize.x-1.)+.5)/uTableSize.x;
  vec4 p=texture2D(uFrames,vec2(x,(fibreMeta.x*3.+.5)/uTableSize.y));
  vec3 B=normalize(texture2D(uFrames,vec2(x,(fibreMeta.x*3.+1.5)/uTableSize.y)).xyz);
  vec3 N=normalize(texture2D(uFrames,vec2(x,(fibreMeta.x*3.+2.5)/uTableSize.y)).xyz);
  float angle=fibreMeta.y*6.2831853-t*6.2831853*uTwist*1.6+.075*sin(t*57.+fibreMeta.z*27.);
  n=normalize(B*cos(angle)+N*sin(angle));
  float breathe=1.+.038*sin(t*21.+p.w)+.022*sin(t*49.+p.w*3.);
  float envelope=1.+.055*cos(3.*(angle+t*6.2831853*2.8*uTwist))+.022*sin(5.*angle+p.w+t*11.);
  float crimp=.000012*sin(t*145.+fibreMeta.z*47.)+.000007*sin(t*283.+fibreMeta.w*35.);
  return p.xyz+n*(uRadius*breathe*envelope+.000028+crimp);
 }
 void main(){
  float t=position.x;vec3 n,dummy;vec3 p=surface(t,n);
  vec3 T=normalize(surface(min(1.,t+.0007),dummy)-surface(max(0.,t-.0007),dummy));
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
  vec3 light=response(uKeyDir,uKey)+response(uRimDir,uRim);
  for(int i=0;i<8;i++)light+=response(uED[i],uEC[i]*3.141592654);
  gl_FragColor=vec4(vC*light,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=1;
 function light(){const f=KAOPU_EB1.sampleProfile(store.get());for(const [k,v]of [['uKeyDir',f.keyDirection],['uRimDir',f.rimDirection],['uKey',f.keyColor],['uRim',f.rimColor]])material.uniforms[k].value.fromArray(v);f.environment.forEach((e,i)=>{material.uniforms.uED.value[i].fromArray(e.direction);material.uniforms.uEC.value[i].fromArray(e.color);});}
 light();const stop=store.subscribe(light);
 return {mesh,report:()=>({fibres:instances,segmentsPerFibre:steps,triangles:instances*steps*2,frameTableBytes:data.byteLength,instanceBytes:meta.byteLength+colors.byteLength,source:'same public carrier envelope; stable dyed laid fibres; no private inputs',shadow:'native carrier shadows retained; no individual-fibre shadow solution'}),dispose(){stop();mesh.removeFromParent();geometry.dispose();material.dispose();table.dispose();}};
}
