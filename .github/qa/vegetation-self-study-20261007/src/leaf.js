import * as THREE from '../vendor/three.module.js';
import {makeLeafVeins,leafWidth} from './venation.js';
import {clamp,seeded,curve,sweep,mergeGeometryBatch} from './geometry.js';
import {buildReticulation} from './reticulation.js';
let source,closedSource;
export function reticulationSource(){return closedSource??=buildReticulation();}
export function veinSource(){return source??=makeLeafVeins();}
export function leafPoint(u,t,{length=4,curl=1.15,fold=.25,ripple=.028,width=.65}={}){
 const x=(u*2-1)*leafWidth(t)*length*width;
 const k=curl/length,theta=curl*t;
 const y=Math.abs(k)<1e-5?length*t:Math.sin(theta)/k;
 const z=(Math.abs(k)<1e-5?0:(1-Math.cos(theta))/k)+Math.abs(x)*fold+Math.sin(t*80+u*4)*ripple*Math.abs(u*2-1)**3*Math.sin(Math.PI*t)+Math.sin(t*Math.PI)*Math.sin(u*6.28)*.04;
 return [x,y,z];
}
export function leafGeometry(options={}){
 const nu=options.nu??48,nv=options.nv??140,positions=[],uv=[],indices=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,t=j/nv;positions.push(...leafPoint(u,t,options));uv.push(.5+(u*2-1)*leafWidth(t)*.64*1.5,t);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,b,c,b,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();g.userData={kind:'curved-lamina',options};return g;
}
export function createLeafTextures({size=2048,coffee=false}={}){
 const graph=reticulationSource(),width=size,height=Math.round(size*1.5),canvas=document.createElement('canvas'),thicknessCanvas=document.createElement('canvas');canvas.width=thicknessCanvas.width=width;canvas.height=thicknessCanvas.height=height;
 const c=canvas.getContext('2d'),d=thicknessCanvas.getContext('2d'),colorData=c.createImageData(width,height),densityData=d.createImageData(width,height),rand=seeded(817);
 const base=coffee?[65,99,33]:[116,166,72];for(let i=0;i<colorData.data.length;i+=4){const n=rand()-.5,v=.93+rand()*.14;for(let k=0;k<3;k++)colorData.data[i+k]=base[k]*v+n*7;colorData.data[i+3]=255;const density=coffee?26:8+Math.round(n*2);densityData.data.set([density,density,density,255],i);}c.putImageData(colorData,0,0);d.putImageData(densityData,0,0);
 d.save();d.scale(width/graph.width,height/graph.height);d.lineCap='round';d.lineJoin='round';d.globalCompositeOperation='lighten';
 for(const e of [...graph.edges].sort((a,b)=>a.radius-b.radius)){const a=graph.nodes[e.a],b=graph.nodes[e.b],mm=.04+2*e.radius*(e.order>=2?1.8:1),value=Math.min(255,Math.round(mm/1.4*255));d.strokeStyle=`rgb(${value},${value},${value})`;d.lineWidth=Math.max(.4,e.radius*15);d.beginPath();d.moveTo(a.x,a.y);d.lineTo(b.x,b.y);d.stroke();}d.restore();
 const color=new THREE.CanvasTexture(canvas);color.colorSpace=THREE.SRGBColorSpace;color.anisotropy=16;
 const thickness=new THREE.CanvasTexture(thicknessCanvas);thickness.anisotropy=16;
 return {color,thickness,graph,units:'thickness texture red * 1.4 millimetres',optics:{laminaMillimetres:.04,maxVeinMillimetres:1.22}};
}
export function thinLeafMaterial(textures,{transmission=.8}={}){
 const uniform={value:transmission};const m=new THREE.MeshStandardMaterial({map:textures.color,color:0xffffff,roughness:.79,metalness:0,side:THREE.DoubleSide,transparent:true,depthWrite:true,envMapIntensity:.03,bumpMap:textures.thickness,bumpScale:.034});
 m.onBeforeCompile=shader=>{m.userData.compiledUniforms=shader.uniforms;shader.uniforms.uLeafThickness={value:textures.thickness};shader.uniforms.uThinTransmission=uniform;shader.vertexShader='varying vec2 vLeafUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvLeafUv=uv;');shader.fragmentShader='uniform sampler2D uLeafThickness;uniform float uThinTransmission;varying vec2 vLeafUv;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float leafMM=texture2D(uLeafThickness,vLeafUv).r*1.4;
 vec3 absorptionPerMM=vec3(20.0,9.0,27.0);
 #if NUM_DIR_LIGHTS > 0
 float incidence=dot(normal,directionalLights[0].direction);
 vec3 opticalTransmittance=exp(-absorptionPerMM*leafMM/max(.20,abs(incidence)));
 outgoingLight+=directionalLights[0].color*opticalTransmittance*max(0.0,-incidence)*uThinTransmission*.42;
 #endif
 float viewCos=max(.18,abs(dot(normal,normalize(vViewPosition))));
 diffuseColor.a=mix(1.0,clamp(1.0-exp(-7.0*leafMM/viewCos),.25,1.0),clamp(uThinTransmission,0.0,1.0));
 #include <opaque_fragment>`);};m.customProgramCacheKey=()=> 'thin-leaf-thickness-beer-r03';Object.defineProperty(m,'thinTransmission',{get:()=>uniform.value,set:v=>uniform.value=v});m.userData.optics={model:'thin-wall diffuse BTDF approximation with Beer-Lambert absorption',absorptionPerMM:[20,9,27],thicknessSource:'generated field from explicitly assumed graph calibre; no black colour-map vein drawing',KarmaEquivalent:false};return m;
}
export function setLeafShape(leaf,options){const old=leaf.geometry;leaf.geometry=leafGeometry(options);old?.dispose();if(leaf.userData.veinObject){leaf.remove(leaf.userData.veinObject);leaf.userData.veinObject.traverse(o=>o.geometry?.dispose());}const group=new THREE.Group(),graph=reticulationSource(),material=leaf.userData.veinMaterial??=new THREE.MeshStandardMaterial({color:0x729441,roughness:.8,envMapIntensity:.03,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const parts=[];for(let pi=0;pi<graph.primaryPaths.length;pi++){
  const ids=graph.primaryPaths[pi],uvCurve=curve(ids.map(id=>[graph.nodes[id].x,graph.nodes[id].y,0])),radius=pi===0?.012:pi<23?.0035:.0015,tip=pi===0?.12:.28,count=pi===0?190:100,points=[];
  for(let k=0;k<=count;k++){const n=uvCurve.getPointAt(k/count),t=1-n.y/graph.height,hw=leafWidth(t)*graph.height*.64,u=Math.abs(hw)<1e-7?.5:.5+(n.x-400)/(2*hw),p=leafPoint(u,t,options),offset=radius*(Math.pow(1-k/count,.8)*(1-tip)+tip)*.9,eps=.0001,du=new THREE.Vector3(...leafPoint(Math.min(.99999,u+eps),t,options)).sub(new THREE.Vector3(...leafPoint(Math.max(.00001,u-eps),t,options))),dt=new THREE.Vector3(...leafPoint(u,Math.min(.99999,t+eps),options)).sub(new THREE.Vector3(...leafPoint(u,Math.max(.00001,t-eps),options))),normal=new THREE.Vector3().crossVectors(du,dt).normalize();p[0]+=normal.x*offset;p[1]+=normal.y*offset;p[2]+=normal.z*offset;points.push(p);}
  const path=curve(points),g=sweep(path,radius,{segments:count,sides:7,tip,lobes:0});parts.push(g);
 }
 const merged=mergeGeometryBatch(parts);parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);leaf.userData.veinObject=group;leaf.add(group);
}
export function leafMaterial(textures,{coffee=false,transmission=.58}={}){
 const m=new THREE.MeshPhysicalMaterial({map:textures.color,color:coffee?0x798f46:0xc7dda8,roughness:coffee?.40:.43,metalness:0,side:THREE.DoubleSide,transmission:coffee?.08:transmission,transmissionMap:textures.thickness,thickness:coffee?.03:.018,ior:1.32,attenuationDistance:1.2,attenuationColor:new THREE.Color(coffee?0x659b26:0x8dcc56),clearcoat:coffee?.18:.06,clearcoatRoughness:.38,bumpMap:textures.thickness,bumpScale:coffee?-.055:-.025});
 m.onBeforeCompile=shader=>{shader.uniforms.leafScatter={value:coffee?.16:.3};shader.fragmentShader='uniform float leafScatter;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight += diffuseColor.rgb * leafScatter * pow(1.0-abs(normal.z), 1.6);\n#include <opaque_fragment>');};m.customProgramCacheKey=()=>coffee?'leaf-coffee-r01':'leaf-thin-r01';return m;
}
export function createLeafStudy({textures,params}){
 const root=new THREE.Group(),material=thinLeafMaterial(textures,{transmission:params.transmission}),leaves=[];
 const transforms=[{position:[0,-1.2,0],rotation:[.05,.06,-.13],length:4,width:.65,curl:1,fold:.12},{position:[.27,-.87,.70],rotation:[.18,-.32,.25],length:4.2,width:.58,curl:.89,fold:.20},{position:[-.28,-1.43,-.61],rotation:[-.12,.29,-.38],length:3.72,width:.69,curl:1.12,fold:.085}];
 for(let i=0;i<3;i++){const shape=transforms[i],m=new THREE.Mesh(new THREE.BufferGeometry(),material);m.position.fromArray(shape.position);m.rotation.fromArray(shape.rotation);m.userData.shape=shape;setLeafShape(m,{curl:params.curl*shape.curl,fold:shape.fold,length:shape.length,width:shape.width,nu:52,nv:180,ripple:.007});m.castShadow=m.receiveShadow=true;root.add(m);leaves.push(m);}
 return {root,leaves,material,update(t){root.rotation.y=Math.sin(t*.12)*.07;leaves[0].rotation.z=-.13+Math.sin(t*.3)*.013;leaves[2].rotation.z=-.38+Math.sin(t*.23+1.8)*.018;},info:{geometry:'3 parametric laminae + raised primary/secondary vein geometry',venation:reticulationSource().nodes.length,network:reticulationSource().report,optics:material.userData.optics,teacher:'independent Runions closed-rule implementation; original tsoding baseline remains separate'}};
}
