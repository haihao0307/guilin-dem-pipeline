import * as T from 'three';
export const GLSL_NOISE=`float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}float fieldNoise(vec2 p){return noise2(p)*.54+noise2(p*2.03+13.)*.28+noise2(p*4.11-7.)*.12+noise2(p*8.13)*.06;}`;
export function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function environment(renderer){
  const w=512,h=256,data=new Float32Array(w*h*4),sun=new T.Vector3(-.52,.66,.48).normalize(),broadDir=new T.Vector3(.8,.45,-.38).normalize();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=y/(h-1),u=x/(w-1),phi=v*Math.PI,theta=u*Math.PI*2;
    const d=new T.Vector3(-Math.cos(theta)*Math.sin(phi),Math.cos(phi),Math.sin(theta)*Math.sin(phi));
    const k=Math.pow(Math.max(0,d.y),.55),i=(y*w+x)*4;
    const c=d.y>=0?[.69*(1-k)+.10*k,.80*(1-k)+.27*k,.90*(1-k)+.50*k]:[.10,.13,.068];
    const s=Math.max(0,d.dot(sun)),glow=Math.pow(s,48)*3.5+Math.pow(s,1500)*80;
    const broad=Math.pow(Math.max(0,d.dot(broadDir)),8)*.55;
    data[i]=c[0]+glow*1.12+broad;data[i+1]=c[1]+glow*.98+broad;data[i+2]=c[2]+glow*.77+broad;data[i+3]=1;
  }
  const tex=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);tex.mapping=T.EquirectangularReflectionMapping;tex.needsUpdate=true;
  const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromEquirectangular(tex);tex.dispose();pmrem.dispose();return target.texture;
}
export class Airfield {
  constructor(scene,renderer){
    this.scene=scene;this.scene.environment=environment(renderer);
    this.sun=new T.DirectionalLight(0xffefd4,3.4);this.sun.position.set(-70,100,64);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:1,far:240});this.sun.shadow.bias=-.00008;this.sun.shadow.normalBias=.035;this.sun.shadow.radius=2;scene.add(this.sun,this.sun.target);
    scene.add(new T.HemisphereLight(0xd5e9ff,0x53602c,1.0));
    const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sun:{value:new T.Vector3(-.52,.66,.48).normalize()}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDir;uniform vec3 sun;void main(){vec3 d=normalize(vDir);float h=pow(max(d.y,0.),.47);vec3 col=mix(vec3(.69,.80,.84),vec3(.13,.33,.52),h);float s=max(dot(d,sun),0.);col+=vec3(1.,.72,.40)*pow(s,48.)*.2;col+=vec3(1.,.9,.68)*pow(s,2700.)*8.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
    this.sky=new T.Mesh(new T.SphereGeometry(22000,32,16),skyMat);this.sky.name='CLEAR_SKY_NO_CLOUDS';this.sky.frustumCulled=false;scene.add(this.sky);
    const groundMat=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0});
    groundMat.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vFieldWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFieldWorld=(modelMatrix*vec4(position,1.)).xyz;');
      shader.fragmentShader='varying vec3 vFieldWorld;\n'+GLSL_NOISE+'\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 w=vFieldWorld.xz;float broad=fieldNoise(w*.017);float patches=fieldNoise(w*.15);float fine=noise2(w*7.2);
        vec3 grass=mix(vec3(.065,.103,.028),vec3(.22,.285,.078),broad);grass*=.78+patches*.35+fine*.09;
        float edge=27.+(noise2(vec2(w.y*.035,4.))-.5)*3.;
        float strip=(1.-smoothstep(edge-2.,edge+3.,abs(w.x)))*(1.-smoothstep(700.,723.,abs(w.y)));
        vec3 mown=mix(vec3(.16,.20,.058),vec3(.30,.33,.125),broad*.7+patches*.3);
        float rut=exp(-pow((abs(w.x)-3.97)/.56,2.))*.42;float center=exp(-pow(w.x/.5,2.))*.13;
        float broken=smoothstep(.25,.66,noise2(vec2(w.x*1.2,w.y*.10)));
        vec3 dirt=vec3(.275,.218,.12);mown=mix(mown,dirt,(rut+center)*broken);
        float taxiStrip=(1.-smoothstep(10.,15.,abs(w.x-73.)))*(1.-smoothstep(675.,730.,abs(w.y)));
        diffuseColor.rgb=mix(grass,mown,max(strip,taxiStrip*.42));
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nfloat micro=noise2(vFieldWorld.xz*18.);normal=normalize(normal+vec3(dFdx(micro),dFdy(micro),0.)*.065);`);
    };groundMat.customProgramCacheKey=()=> 'flat-grass-airstrip-v1';
    this.ground=new T.Mesh(new T.PlaneGeometry(46000,46000),groundMat);this.ground.rotation.x=-Math.PI/2;this.ground.receiveShadow=true;this.ground.name='GRASS_AIRFIELD_SHARED_WORLD';scene.add(this.ground);
    // Stable seeded grass, no mountains or added scenery.
    const random=rng(6183),count=90000;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.022,0,0,.022,0,0,-.012,.1,.013,.012,.1,.013,0,.21,.035],3));g.setIndex([0,1,2,1,3,2,2,3,4]);g.computeVertexNormals();
    const mat=new T.MeshStandardMaterial({color:0x829746,roughness:1,metalness:0,side:T.DoubleSide,vertexColors:false});
    mat.onBeforeCompile=shader=>{shader.uniforms.fieldTime={value:0};this.grassShader=shader;shader.vertexShader='uniform float fieldTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvec4 root=instanceMatrix*vec4(0.,0.,0.,1.);float sway=sin(root.x*.2+root.z*.14+fieldTime*1.1)*.14;transformed.x+=sway*position.y*position.y*7.;`);};mat.customProgramCacheKey=()=> 'grass-blade-v1';
    this.grass=new T.InstancedMesh(g,mat,count);this.grass.name='AIRFIELD_GRASS_BLADES';const dummy=new T.Object3D(),color=new T.Color();
    for(let i=0;i<count;i++){
      let x,z;if(i<count*.55){x=(random()-.5)*200;z=-620+(random()-.5)*320;}else{x=(random()-.5)*650;z=(random()-.5)*1580;}
      const short=Math.abs(x)<26&&Math.abs(z)<720;dummy.position.set(x,.004,z);dummy.rotation.set(0,random()*Math.PI*2,0);const h=short?.22+random()*.38:.55+random()*1.1;dummy.scale.set(.7+random(),h,.7+random());dummy.updateMatrix();this.grass.setMatrixAt(i,dummy.matrix);
      color.setHSL(.20+random()*.055,.25+random()*.2,.19+random()*.13);this.grass.setColorAt(i,color);
    }
    this.grass.instanceMatrix.needsUpdate=true;this.grass.instanceColor.needsUpdate=true;this.grass.frustumCulled=false;scene.add(this.grass);
  }
  update(time,aircraft,camera){this.sky.position.copy(camera.position);if(this.grassShader)this.grassShader.uniforms.fieldTime.value=time;const p=aircraft.position;this.sun.position.set(p.x-70,p.y+100,p.z+64);this.sun.target.position.copy(p);this.sun.shadow.camera.updateProjectionMatrix();this.grass.visible=p.y<250&&Math.abs(p.x)<650;}
}
