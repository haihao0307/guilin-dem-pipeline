import * as THREE from '../vendor/three.module.js';
import {makeLeafVeins,leafWidth} from './venation.js';
import {clamp,seeded} from './geometry.js';
let source;
export function veinSource(){return source??=makeLeafVeins();}
export function leafPoint(u,t,{length=4,curl=1.15,fold=.25,ripple=.028,width=.65}={}){
 const x=(u*2-1)*leafWidth(t)*length*width;
 const k=curl/length,theta=curl*t;
 const y=Math.abs(k)<1e-5?length*t:Math.sin(theta)/k;
 const z=(Math.abs(k)<1e-5?0:(1-Math.cos(theta))/k)+Math.abs(x)*fold+Math.sin(t*80+u*4)*ripple*Math.abs(u*2-1)**3+Math.sin(t*Math.PI)*Math.sin(u*6.28)*.04;
 return [x,y,z];
}
export function leafGeometry(options={}){
 const nu=options.nu??48,nv=options.nv??140,positions=[],uv=[],indices=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu,t=j/nv;positions.push(...leafPoint(u,t,options));uv.push(.5+(u*2-1)*leafWidth(t)*.68*1.5,t);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,b,c,b,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();g.userData={kind:'curved-lamina',options};return g;
}
export function createLeafTextures({size=2048,coffee=false}={}){
 const data=veinSource(),canvas=document.createElement('canvas');canvas.width=size;canvas.height=size*1.5;const c=canvas.getContext('2d');c.fillStyle=coffee?'rgb(79,104,26)':'rgb(114,161,73)';c.fillRect(0,0,canvas.width,canvas.height);
 const rand=seeded(817);const pixels=c.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4){const n=(rand()-.5)*17;pixels.data[i]+=n;pixels.data[i+1]+=n*.7;pixels.data[i+2]+=n*.45;}c.putImageData(pixels,0,0);
 c.save();c.scale(canvas.width/data.width,canvas.height/data.height);
 // Explicit application addition: fine areole texture; not present in the baseline C example.
 c.strokeStyle=coffee?'rgba(28,47,10,.15)':'rgba(66,102,31,.2)';c.lineWidth=.42;
 for(let y=10;y<1200;y+=14)for(let x=10;x<800;x+=12){const xx=x+(rand()-.5)*11,yy=y+(rand()-.5)*13;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+8+rand()*8,yy+6);c.lineTo(xx+8,yy+17);c.stroke();}
 for(let i=1;i<data.veins.length;i++){const v=data.veins[i],p=data.veins[v.parent],weight=Math.min(8,Math.pow(data.weights[i],.4)*.75);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(v.x,v.y);c.strokeStyle=coffee?'rgba(43,59,13,.68)':'rgba(31,72,17,.88)';c.lineWidth=weight;c.lineCap='round';c.stroke();if(weight>2){c.strokeStyle=coffee?'rgba(149,159,49,.75)':'rgba(74,114,29,.6)';c.lineWidth=weight*.27;c.stroke();}}
 c.restore();const color=new THREE.CanvasTexture(canvas);color.colorSpace=THREE.SRGBColorSpace;color.anisotropy=8;
 const depth=document.createElement('canvas');depth.width=canvas.width;depth.height=canvas.height;const d=depth.getContext('2d');d.fillStyle='#eeeeee';d.fillRect(0,0,depth.width,depth.height);d.scale(depth.width/data.width,depth.height/data.height);d.lineCap='round';for(let i=1;i<data.veins.length;i++){const v=data.veins[i],p=data.veins[v.parent];d.strokeStyle='#282828';d.lineWidth=Math.min(8,Math.pow(data.weights[i],.4)*.75);d.beginPath();d.moveTo(p.x,p.y);d.lineTo(v.x,v.y);d.stroke();}const thickness=new THREE.CanvasTexture(depth);thickness.anisotropy=8;return {color,thickness};
}
export function leafMaterial(textures,{coffee=false,transmission=.58}={}){
 const m=new THREE.MeshPhysicalMaterial({map:textures.color,color:coffee?0x798f46:0xc7dda8,roughness:coffee?.40:.43,metalness:0,side:THREE.DoubleSide,transmission:coffee?.08:transmission,transmissionMap:textures.thickness,thickness:coffee?.03:.018,ior:1.32,attenuationDistance:1.2,attenuationColor:new THREE.Color(coffee?0x659b26:0x8dcc56),clearcoat:coffee?.18:.06,clearcoatRoughness:.38,bumpMap:textures.thickness,bumpScale:coffee?-.055:-.025});
 m.onBeforeCompile=shader=>{shader.uniforms.leafScatter={value:coffee?.16:.3};shader.fragmentShader='uniform float leafScatter;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight += diffuseColor.rgb * leafScatter * pow(1.0-abs(normal.z), 1.6);\n#include <opaque_fragment>');};m.customProgramCacheKey=()=>coffee?'leaf-coffee-r01':'leaf-thin-r01';return m;
}
export function createLeafStudy({textures,params}){
 const root=new THREE.Group();const material=leafMaterial(textures,{transmission:params.transmission});const leaves=[];
 for(let i=0;i<3;i++){const geo=leafGeometry({curl:params.curl+(i-1)*.35,fold:.14+i*.06,length:4,width:.65,nu:52,nv:180}),m=new THREE.Mesh(geo,material);m.position.set((i-1)*.2,-1.2,(i-1)*.5);m.rotation.set(.15*(i-1),.15*(i-1),.13*(i-1));m.castShadow=m.receiveShadow=true;root.add(m);leaves.push(m);}
 return {root,leaves,material,update(t){root.rotation.y=Math.sin(t*.12)*.10;leaves[0].rotation.z=-.13+Math.sin(t*.3)*.025;leaves[2].rotation.z=.13+Math.sin(t*.3+.8)*.025;},info:{geometry:'3 parametric 3D laminae',venation:veinSource().veins.length,teacher:'tsoding kernel + clearly separated leaf-domain adaptation'}};
}
