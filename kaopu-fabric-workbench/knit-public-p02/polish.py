from pathlib import Path
import json,hashlib,subprocess
R=Path(__file__).resolve().parent
s=(R/'jacket.mjs').read_text()
def replace(text,a,b):
 assert text.count(a)==1,(a[:80],text.count(a));return text.replace(a,b)
s=replace(s,'surface(float t,out vec3 n)','surface(float t,out vec3 n,out vec3 tang)')
s=replace(s,'n=normalize(B*cos(angle)+N*sin(angle));','n=normalize(B*cos(angle)+N*sin(angle));\n  float da=-6.2831853*uTwist*1.6+4.275*cos(t*57.+fibreMeta.z*27.);\n  tang=normalize(cross(N,B)+(-B*sin(angle)+N*cos(angle))*(uRadius*da/.025));')
s=replace(s,'+.000028+crimp','+.000095+crimp')
s=replace(s,'float t=position.x;vec3 n,dummy;vec3 p=surface(t,n);\n  vec3 T=normalize(surface(min(1.,t+.0007),dummy)-surface(max(0.,t-.0007),dummy));','float t=position.x;vec3 n,T;vec3 p=surface(t,n,T);')
s=replace(s,'settings,uniforms,store})','settings,uniforms,store,lighting})')
s=replace(s,'response(uKeyDir,uKey)+response(uRimDir,uRim)','response(uKeyDir,uKey)*coatShadow(uKS,uKM)+response(uRimDir,uRim)*coatShadow(uRS,uRM)')
s=replace(s,'light();const stop=store.subscribe(light);','light();const stop=store.subscribe(light);installShadows(mesh,lighting);')
s=replace(s,"shadow:'native carrier shadows retained; no individual-fibre shadow solution'","shadow:'both EB1 carrier-depth maps sampled by surface fibres; not individual-fibre self shadows',clearanceMetres:.000095,frameTextureReadsPerVertex:3")
s+='''
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
 m.vertexShader='varying vec3 vShadowWorld;\\n'+m.vertexShader;
 if(!m.vertexShader.includes('gl_Position=cp;'))throw Error('Shadow anchor missing');
 m.vertexShader=m.vertexShader.replace('gl_Position=cp;','vShadowWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=cp;');
 m.fragmentShader=shadowGLSL+'\\n'+m.fragmentShader;
 mesh.onBeforeRender=()=>{const k=lighting.key.shadow,r=lighting.rim.shadow;m.uniforms.uShadowReady.value=k.map&&r.map?1:0;if(k.map&&r.map){m.uniforms.uKS.value=k.map.texture;m.uniforms.uRS.value=r.map.texture;m.uniforms.uKM.value.copy(k.matrix);m.uniforms.uRM.value.copy(r.matrix);m.uniforms.uShadowStep.value.set(1/k.mapSize.x,1/k.mapSize.y);}m.uniformsNeedUpdate=true;};
 m.needsUpdate=true;
}
export function shadeFlyaways(mesh,normals,store,lighting){
 const m=mesh.material;
 mesh.geometry.setAttribute('fibreNormal',new THREE.InstancedBufferAttribute(normals,3));
 m.vertexShader='attribute vec3 fibreNormal;varying vec3 vRootNormal;\\n'+m.vertexShader;
 m.vertexShader=m.vertexShader.replace('vC=fiberColor;','vC=fiberColor;vRootNormal=normalize(mat3(modelMatrix)*fibreNormal);');
 m.fragmentShader='varying vec3 vRootNormal;uniform vec3 uED[8],uEC[8];\\n'+m.fragmentShader;
 const a='vec3 light=vec3(.30*uEnv)+(uKey*a+uRim*b)/3.14159265;';
 if(!m.fragmentShader.includes(a))throw Error('Flyaway lighting anchor missing');
 m.fragmentShader=m.fragmentShader.replace(a,`vec3 N=normalize(vRootNormal);float nl=dot(N,uKeyDir),nr=dot(N,uRimDir);
 vec3 light=(uKey*(.55*max(nl,0.)+.45*a*clamp(.55+.55*nl,0.,1.))*coatShadow(uKS,uKM)+uRim*(.55*max(nr,0.)+.45*b*clamp(.55+.55*nr,0.,1.))*coatShadow(uRS,uRM))/3.14159265;
 for(int i=0;i<8;i++){float nd=dot(N,uED[i]),cyl=sqrt(max(0.,1.-pow(dot(T,uED[i]),2.)));light+=uEC[i]*(.55*max(nd,0.)+.45*cyl*clamp(.55+.55*nd,0.,1.));}`);
 m.uniforms.uED={value:Array.from({length:8},()=>new THREE.Vector3())};m.uniforms.uEC={value:Array.from({length:8},()=>new THREE.Vector3())};
 installShadows(mesh,lighting);const prior=mesh.onBeforeRender;let seen=null;
 mesh.onBeforeRender=()=>{prior();if(seen!==store.get()){seen=store.get();KAOPU_EB1.sampleProfile(seen).environment.forEach((e,i)=>{m.uniforms.uED.value[i].fromArray(e.direction);m.uniforms.uEC.value[i].fromArray(e.color);});}m.uniformsNeedUpdate=true;};
}
'''
(R/'jacket-refined.mjs').write_text(s)
s=(R/'main.mjs').read_text()
s=replace(s,"import {makeJacket} from './jacket.mjs';","import {makeJacket,shadeFlyaways} from './jacket-refined.mjs';")
s=replace(s,'const roots=[],dirs=[],bends=[],seeds=[],hcolors=[];','const roots=[],dirs=[],bends=[],seeds=[],hcolors=[],hNormals=[];')
s=replace(s,'hcolors.push(col.r,col.g,col.b);','hcolors.push(col.r,col.g,col.b);hNormals.push(n.x,n.y,n.z);')
s=replace(s,'uniforms,store});group.add(jacket.mesh);','uniforms,store,lighting});group.add(jacket.mesh);')
s=replace(s,'fur.renderOrder=2;group.add(fur);','fur.renderOrder=2;group.add(fur);shadeFlyaways(fur,new Float32Array(hNormals),store,lighting);')
s=replace(s,'let shaders=[],jacket=null;','let shaders=[],jacket=null,activeView="whole";')
s=replace(s,'function view(name){const views={whole:','''function view(name){activeView=name;if(name==='whole'){
 const v=new THREE.Vector3(.81,.22,.54).normalize(),right=new THREE.Vector3(v.z,0,-v.x).normalize(),up=new THREE.Vector3().crossVectors(v,right).normalize();
 const extent=a=>.049*Math.abs(a.x)+.035*Math.abs(a.y)+.006*Math.abs(a.z);
 const d=1.08*(Math.max(extent(right)/(Math.tan(camera.fov*Math.PI/360)*camera.aspect),extent(up)/Math.tan(camera.fov*Math.PI/360))+extent(v));
 camera.position.copy(v).multiplyScalar(d);controls.target.set(0,0,.002);controls.update();dirty=true;return name;}
 const views={frontal:''')
s=replace(s,'camera.aspect=w/h;camera.updateProjectionMatrix();','camera.aspect=w/h;camera.updateProjectionMatrix();if(activeView==="whole")view("whole");')
(R/'main.mjs').write_text(s)
# The fixed-angle comparison remains meaningful after adding responsive framing.
q=(R/'qa.py').read_text()
q=replace(q,"page.set_viewport_size({'width':855,'height':866});page.goto(P01","page.set_viewport_size({'width':855,'height':866});shot('P02-frontal-for-P01','frontal');page.goto(P01")
q=replace(q,"report['oldVsNew']=delta('user-scale-fibre.png','P01-same-scale.png')","report['oldVsNew']=delta('P02-frontal-for-P01.png','P01-same-scale.png')")
(R/'qa-refined.py').write_text(q)
subprocess.run(['node','--check','jacket-refined.mjs'],cwd=R,check=True)
subprocess.run([str(R/'node_modules/.bin/esbuild'),'main.mjs','--bundle','--minify','--format=iife','--target=es2022','--legal-comments=inline','--outfile=bundle.js'],cwd=R,check=True)
(R/'index.html').write_text((R/'template.html').read_text().replace('/*__BUNDLE__*/',(R/'bundle.js').read_text().replace('</script','<\\/script')))
m=json.loads((R/'BUILD_MANIFEST.json').read_text());m.update({'revision':'C2','htmlSHA256':hashlib.sha256((R/'index.html').read_bytes()).hexdigest(),'htmlBytes':(R/'index.html').stat().st_size,'firstCandidateVisualRejected':'Bright segmented strands and overlit inter-yarn flyaways','shadowReception':'both unchanged EB1 carrier maps','newLighting':False,'frameTextureFetchesPerVertex':3,'defaultWholeFit':'camera aspect and projected bounds','visualReviewed':False});(R/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
