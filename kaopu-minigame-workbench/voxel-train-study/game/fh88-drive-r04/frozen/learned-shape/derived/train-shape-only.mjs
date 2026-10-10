// Own rule generators. Inputs are dimensions, boundary controls and relations,
// never teacher position/normal/index/UV buffers. Three buffers are transient.
import * as T from '../vendor/three.module.mjs';
import {ParametricGeometry} from '../vendor/ParametricGeometry.mjs';
export const RULE_VERSION='RAIL_FUNCTION_RULES_R01';
const tau=Math.PI*2;
export const slider=(a,r,L)=>{if(L<=r)throw Error('连杆长度必须大于曲柄半径');return r*Math.cos(a)+Math.sqrt(L*L-r*r*Math.sin(a)**2)};
const noiseGLSL=`
varying vec3 vKP;
varying vec3 vKN;
float kh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float kn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(kh(i),kh(i+vec3(1,0,0)),f.x),mix(kh(i+vec3(0,1,0)),kh(i+vec3(1,1,0)),f.x),f.y),mix(mix(kh(i+vec3(0,0,1)),kh(i+vec3(1,0,1)),f.x),mix(kh(i+vec3(0,1,1)),kh(i+vec3(1,1,1)),f.x),f.y),f.z);}
float kfb(vec3 p){return .57*kn(p)+.28*kn(p*2.13)+.15*kn(p*4.17);}
`;
export function material(role,color,seed=1){
 const metal={steel:.86,brass:.78,iron:.6,paint:0,wall:0,brick:0,wood:0,glass:.12,coal:.05,light:.05};
 const rough={steel:.29,brass:.31,iron:.53,paint:.34,wall:.85,brick:.81,wood:.78,glass:.12,coal:.92,light:.2};
 const m=new T.MeshStandardMaterial({color,metalness:metal[role]??0,roughness:rough[role]??.75});m.name=role;
 if(role==='glass'){m.transparent=true;m.opacity=.42;m.depthWrite=false}
 if(role==='light'){m.emissive.set(color);m.emissiveIntensity=2.2}
 m.onBeforeCompile=s=>{
  s.uniforms.kpDomain={value:new T.Matrix4()};s.uniforms.kpUseDomain={value:m.userData.domainRoot?1:0};m.userData.shader=s;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 kpDomain;\nuniform float kpUseDomain;\nvarying vec3 vKP;\nvarying vec3 vKN;').replace('#include <begin_vertex>',`#include <begin_vertex>\nvec4 kpos=vec4(position,1.);vec3 knorm=normal;\n#ifdef USE_INSTANCING\nkpos=instanceMatrix*kpos;knorm=mat3(instanceMatrix)*knorm;\n#endif\nvKP=mix(position,(kpDomain*modelMatrix*kpos).xyz,kpUseDomain);vKN=mix(normal,mat3(kpDomain*modelMatrix)*knorm,kpUseDomain);`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+noiseGLSL);
  let pattern='';
  if(role==='brick')pattern=`vec2 chart=abs(vKN.y)>.7?vec2(vKP.x,vKP.z):abs(vKN.x)>abs(vKN.z)?vec2(vKP.z,vKP.y):vec2(vKP.x,vKP.y);vec2 b=vec2(chart.x*5.5+step(.5,fract(chart.y*7.))*0.5,chart.y*7.);vec2 f=fract(b);vec2 fw=max(fwidth(b),vec2(.001));float joint=max(1.-smoothstep(.04,.04+fw.x,f.x),1.-smoothstep(.045,.045+fw.y,f.y));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.49,.46,.4),joint*.7);`;
  if(role==='wall')pattern=`float stain=smoothstep(.43,.72,kfb(vec3(vKP.x*.8,vKP.y*.24,vKP.z*.8)+${seed.toFixed(2)}));diffuseColor.rgb*=1.-stain*.29;`;
  if(role==='wood')pattern=`float grain=sin(vKP.z*58.+kn(vKP*vec3(3,2,.4))*12.);diffuseColor.rgb*=.92+.08*grain*(1.-smoothstep(.4,2.,length(fwidth(vKP))*58.));`;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nvec3 kq=vKP+vec3(${seed.toFixed(2)});float kp=kfb(kq*3.1);diffuseColor.rgb*=.94+.09*kp;${pattern}`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(kn(kq*9.)-.5)*.12,.08,.99);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nfloat footprint=length(fwidth(kq))*65.;float h=(kn(kq*65.)-.5)*${role==='wall'||role==='brick'?'.004':'.00025'}*(1.-smoothstep(.4,1.6,footprint));vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);vec3 aa=cross(dy,normal),bb=cross(normal,dx);float det=dot(dx,aa);normal=normalize(max(abs(det),1.e-8)*normal-sign(det)*(dFdx(h)*aa+dFdy(h)*bb));`);
 };m.customProgramCacheKey=()=>RULE_VERSION+role+seed;return m;
}
function kit(spec){
 const root=new T.Group();root.name=spec.identity.name;const parts=[],updates=[],connections=[],checks=[];
 const C={body:spec.parameters.bodyColor||'#214c38',gear:spec.parameters.gearColor||'#272e2d',trim:spec.parameters.trimColor||'#baad6a'};
 const mats={paint:material('paint',C.body),gear:material('paint',C.gear),iron:material('iron','#272c2d'),steel:material('steel','#a7aaa4'),brass:material('brass','#b39a5e'),glass:material('glass','#76989c'),wall:material('wall','#b8b3a0'),brick:material('brick','#945743'),wood:material('wood','#665345'),coal:material('coal','#16191b'),red:material('light','#dd3923'),amber:material('light','#eea547'),white:material('paint','#e8e4cf'),black:material('paint','#1b2528')};
 const geometryCache=new Map();
 function geo(key,make){if(!geometryCache.has(key))geometryCache.set(key,make());return geometryCache.get(key)}
 function part(name,parent=root,at=[0,0,0]){const g=new T.Group();g.name=name;let h=2166136261;for(const c of name)h=Math.imul(h^c.codePointAt(0),16777619)>>>0;const key=h.toString(36);parent.userData.names??={};const n=parent.userData.names[key]||0;parent.userData.names[key]=n+1;g.userData.path=(parent===root?'':parent.userData.path+'/')+key+'n'+n.toString(36);g.userData.functionName=name;g.position.set(...at);parent.add(g);parts.push(g);return g}
 function shape(p,g,m,at=[0,0,0],rot=[0,0,0]){const o=new T.Mesh(g,m);o.position.set(...at);o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;o.onBeforeRender=(_r,_s,_c,_g,mat)=>{if(mat.userData.shader&&mat.userData.domainRoot)mat.userData.shader.uniforms.kpDomain.value.copy(mat.userData.domainRoot.matrixWorld).invert()};p.add(o);return o}
 const box=(p,m,at,size)=>shape(p,geo('box:'+size,()=>new T.BoxGeometry(...size)),m,at);
 const cylinder=(p,m,at,r,h,axis='y',r2=r,open=false)=>shape(p,geo(`cyl:${r},${r2},${h},${open}`,()=>new T.CylinderGeometry(r2,r,h,32,1,open)),m,at,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0]);
 const sphere=(p,m,at,r,scale=[1,1,1])=>{const o=shape(p,geo('sphere:'+r,()=>new T.SphereGeometry(r,24,12)),m,at);o.scale.set(...scale);return o};
 const ring=(p,m,at,r,t,axis='z')=>shape(p,geo('ring:'+r+','+t,()=>new T.TorusGeometry(r,t,8,48)),m,at,axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0]);
 function shell(p,m,at,r,h,thickness=.035){const profile=[new T.Vector2(r-thickness,-h/2),new T.Vector2(r,-h/2),new T.Vector2(r,h/2),new T.Vector2(r-thickness,h/2),new T.Vector2(r-thickness,-h/2)];return shape(p,new T.LatheGeometry(profile,48),m,at,[Math.PI/2,0,0])}
 function bar(p,m,a,b,r=.025){const A=new T.Vector3(...a),B=new T.Vector3(...b);const o=cylinder(p,m,A.clone().add(B).multiplyScalar(.5).toArray(),r,A.distanceTo(B));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),B.sub(A).normalize());return o}
 function pipe(p,m,controls,r=.02){const path=new T.CatmullRomCurve3(controls.map(c=>new T.Vector3(...c)));return shape(p,new T.TubeGeometry(path,Math.max(16,controls.length*8),r,8,false),m)}
 function repeat(p,g,m,count,pose){const o=new T.InstancedMesh(g,m,count),dummy=new T.Object3D();for(let i=0;i<count;i++){const q=pose(i);dummy.position.set(...q.at);dummy.rotation.set(...(q.rot||[0,0,0]));dummy.scale.set(...(q.scale||[1,1,1]));dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)}o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 function boltRing(p,r,z,n=20){repeat(p,geo('bolt',()=>new T.CylinderGeometry(.016,.016,.026,6)),mats.steel,n,i=>({at:[r*Math.cos(i*tau/n),r*Math.sin(i*tau/n),z],rot:[Math.PI/2,0,0]}))}
 function digits(p,text,at,scale=.18,m=mats.brass){const segs=[[[-.4,.8],[.4,.8]],[[.45,.75],[.45,.05]],[[.45,-.05],[.45,-.75]],[[-.4,-.8],[.4,-.8]],[[-.45,-.75],[-.45,-.05]],[[-.45,.05],[-.45,.75]],[[-.4,0],[.4,0]]],codes=['012345','12','01643','01263','1256','05263','054263','012','0123456','012563'];const g=part('函数编号 '+text,p,at);g.scale.setScalar(scale);for(let j=0;j<text.length;j++){const code=codes[+text[j]]||'';for(const s of code){const [a,b]=segs[+s];bar(g,m,[a[0]+j*1.3,a[1],0],[b[0]+j*1.3,b[1],0],.075)}}return g}
 function finish(){
  root.updateMatrixWorld(true);const rest=parts.map(p=>({p:p.position.clone(),q:p.quaternion.clone()})),batches=[];
  const update=t=>{parts.forEach((p,i)=>{p.position.copy(rest[i].p);p.quaternion.copy(rest[i].q)});for(const f of updates)f(t);root.updateMatrixWorld(true)};
  const nodes=new Map([['object',root],...parts.map(p=>[p.userData.path,p])]);
  const anchorErrors=()=>connections.filter(c=>c.anchorA&&c.anchorB).map(c=>new T.Vector3(...c.anchorA).applyMatrix4(nodes.get(c.from).matrixWorld).distanceTo(new T.Vector3(...c.anchorB).applyMatrix4(nodes.get(c.to).matrixWorld)));
  const collapsed=new T.Matrix4().makeScale(0,0,0),inverse=new T.Matrix4(),pose=new T.Matrix4();
  const syncDisplay=()=>{inverse.copy(root.matrixWorld).invert();for(const b of batches){b.mesh.visible=b.sources.some(n=>n.userData.functionVisible!==false);b.sources.forEach((n,i)=>{b.mesh.setMatrixAt(i,n.userData.functionVisible===false?collapsed:pose.copy(inverse).multiply(n.matrixWorld))});b.mesh.instanceMatrix.needsUpdate=true}};
  const enableBatching=()=>{const groups=new Map();root.traverse(n=>{if(n.isMesh&&!n.isInstancedMesh&&!n.material.transparent){const key=n.geometry.uuid+':'+n.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n)}});for(const sources of groups.values()){if(sources.length<4)continue;const first=sources[0],mesh=new T.InstancedMesh(first.geometry,first.material,sources.length);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.userData.displayBatch=true;mesh.onBeforeRender=first.onBeforeRender;root.add(mesh);for(const n of sources){n.visible=false;n.userData.batched=true;n.userData.functionVisible=true}batches.push({mesh,sources})}root.updateMatrixWorld(true);syncDisplay()};
  update(0);return{root,parts,update,checks,connections,anchorErrors,enableBatching,syncDisplay,batches,materials:mats,rest,spec};
 }
 return{root,parts,updates,connections,checks,mats,C,geo,part,shape,box,cylinder,shell,sphere,ring,bar,pipe,repeat,boltRing,digits,finish};
}
function wheel(k,parent,r,width,spokes=14){
 const {mats:m,part,cylinder,ring,bar}=k,g=part('轮圈 / 轮毂 / 辐条',parent);
 cylinder(g,m.steel,[0,0,0],r,width,'x');cylinder(g,m.gear,[0,0,0],r*.91,width+.018,'x');
 // Functional annular rim plus open spokes: discard the solid web above.
 g.remove(g.children[1]);g.remove(g.children[0]);ring(g,m.steel,[0,0,0],r-width*.65,width*.65,'x');ring(g,m.gear,[0,0,0],r*.88,width*.38,'x');
 cylinder(g,m.gear,[0,0,0],r*.18,width*1.5,'x');cylinder(g,m.brass,[width*.9,0,0],r*.085,width*.2,'x');
 for(let j=0;j<spokes;j++){const a=j*tau/spokes;bar(g,m.gear,[0,r*.14*Math.sin(a),r*.14*Math.cos(a)],[0,r*.86*Math.sin(a),r*.86*Math.cos(a)],r*.035)}return g;
}
function axle(k,parent,z,r,{driver=false,phase=0,spokes=14}={}){
 const {part,cylinder,box,mats:m,updates}=k,g=part(driver?'动轮轴总成':'承载轮轴总成',parent,[0,r+.08,z]);cylinder(g,m.steel,[0,0,0],.08,2.02,'x');const sides=[];
 for(const s of [-1,1]){const w=wheel(k,g,r,.09,spokes);w.position.x=s*.94;sides.push(w);const bearing=part('轴箱与承载弹簧',g,[s*.72,0,0]);box(bearing,m.iron,[0,0,0],[.22,.22,.26]);for(let j=0;j<5;j++)box(bearing,m.iron,[0,.18+j*.02,0],[.17,.019,.72-j*.075]);}
 sides.forEach(w=>k.connections.push({kind:'axle-bearing',from:g.userData.path,to:w.userData.path,anchorA:[w.position.x,0,0],anchorB:[0,0,0],axis:'X',dof:'revolute',basis:'own demonstrator design'}));
 updates.push(t=>sides.forEach(w=>w.rotation.x=t*(k.travelSpeed/r)+phase));return{g,sides,z,r};
}
function train(spec){
 const k=kit(spec),{part,box,cylinder,sphere,ring,bar,pipe,repeat,geo,shape,digits,updates,mats:m}=k,p=spec.parameters;
 k.angularSpeed=p.angularSpeed||1.3;k.travelSpeed=k.angularSpeed*(p.driverRadius||.88);const L=p.boilerLength||7.8,R=p.boilerRadius||.83,Y=p.boilerY||2.78,front=L*.5;
 const body=part('锅炉、烟箱与主承载走台');
 k.shell(body,m.paint,[0,Y,-.5],R,L);k.shell(body,m.iron,[0,Y,front-.3],R,1.5);
 const door=part('烟箱门、铰链与锁紧',body,[0,Y,front+.46]);cylinder(door,m.iron,[0,0,0],R*.94,.06,'z');ring(door,m.steel,[0,0,.04],R*.96,.025);k.boltRing(door,R*.88,.08);bar(door,m.brass,[-.27,0,.09],[.27,0,.09],.03);cylinder(door,m.brass,[0,0,.1],.07,.1,'z');
 for(const z of [-3,-1.6,.1,1.5])ring(body,m.paint,[0,Y,z],R+.01,.026);
 const fittings=part('锅炉检修盖、阀门与安全阀',body);for(const z of [-2.1,.7]){cylinder(fittings,m.brass,[0,Y+R+.07,z],.075,.18);ring(fittings,m.brass,[0,Y+R+.19,z],.11,.014,'y');}for(const s of [-1,1]){for(const z of [-3,-1,1,3]){const g=part('检修盖与紧固',fittings,[s*(R*.83),Y-.42,z]);cylinder(g,m.paint,[0,0,0],.11,.045,'x');bar(g,m.brass,[-.04,0,0],[.04,0,0],.018)}}
 for(const s of [-1,1]){box(body,m.iron,[s*1.02,1.88,0],[.38,.07,L+2]);box(body,m.gear,[s*.66,1.2,-.6],[.13,.28,L+1]);bar(body,m.iron,[s*.92,Y+.35,-3.8],[s*.92,Y+.35,front],.021);pipe(body,m.brass,[[s*R,Y+.15,front-.4],[s*(R+.07),Y+.03,1.7],[s*(R+.08),Y-.48,1.4],[s*(R+.08),Y-.48,-3.8]],.023);}
 const chimney=part('烟囱与蒸汽出口',body,[0,Y+R,front-.8]);cylinder(chimney,m.iron,[0,.3,0],.18,.6);cylinder(chimney,m.iron,[0,.59,0],.23,.09);
 cylinder(body,m.paint,[0,Y+R-.04,-1.15],.31,.35);sphere(body,m.paint,[0,Y+R+.1,-1.15],.32,[1,.55,1]);
 const cab=part('驾驶室 / 窗框 / 炉门',k.root,[0,0,-L*.5-.5]);
 box(cab,m.paint,[0,1.85,-.25],[2.3,.2,1.9]);box(cab,m.paint,[0,2.6,-1.15],[2.3,1.5,.12]);
 for(const s of [-1,1]){box(cab,m.paint,[s*1.1,2.14,-.2],[.1,.7,1.8]);box(cab,m.paint,[s*1.1,3.35,-.2],[.1,.17,1.8]);for(const z of [-1,.0,.68])box(cab,m.paint,[s*1.1,2.9,z],[.1,.75,.1]);box(cab,m.glass,[s*1.095,2.95,-.6],[.05,.61,.67]);for(let j=0;j<3;j++)box(cab,m.iron,[s*1.16,1.5-j*.23,-.75],[.3,.04,.48]);const num=digits(cab,String(p.number||28),[s*1.16,2.22,.35],.2);num.rotation.y=s*Math.PI/2;}
 const roof=shape(cab,new ParametricGeometry((u,v,out)=>{const x=(u-.5)*2.58;out.set(x,3.5+.2*(1-(x/1.29)**2),(v-.5)*2.2-.22)},24,8),m.iron);roof.material.side=T.DoubleSide;
 const fire=part('炉口与仪表',cab,[0,2.1,.53]);cylinder(fire,m.iron,[0,.15,0],.37,.16,'z');for(const x of [-.65,0,.65]){cylinder(fire,m.brass,[x,1,.0],.14,.07,'z');cylinder(fire,m.white,[x,1,.045],.118,.014,'z');bar(fire,m.iron,[x,1,.06],[x+.06,1.065,.06],.008);ring(fire,m.brass,[x,1.28,0],.12,.018)}
 const chassis=part('轮轴、联动、制动与轴箱');const zs=p.driverZ||[1.45,-.35,-2.15],r=p.driverRadius||.88,drivers=[];
 for(const z of zs)drivers.push(axle(k,chassis,z,r,{driver:true,spokes:p.spokes||16}));
 for(const z of p.frontAxles||[front+.2,front+1.15])axle(k,chassis,z,p.smallRadius||.41);
 for(const z of p.rearAxles||[-L*.5-1.05])axle(k,chassis,z,p.smallRadius||.41);
 for(const s of [-1,1]){
  const motion=part('曲柄、联杆、主连杆和十字头',chassis);const phase=s===1?0:Math.PI/2,cr=p.crankRadius||r*.31,rodLength=p.rodLength||2.45;
  const pins=zs.map(z=>{const g=part('曲柄销',motion);cylinder(g,m.brass,[0,0,0],.075,.2,'x');return g});
  const rods=zs.slice(1).map(()=>box(motion,m.steel,[0,0,0],[.08,.1,zs[0]-zs[1]]));
  const main=bar(motion,m.steel,[s*1.12,r+.08,zs[0]],[s*1.12,r+.08,zs[0]+rodLength],.055);
  const cross=part('受导轨约束的十字头',motion);box(cross,m.steel,[0,0,0],[.18,.18,.25]);
  cylinder(motion,m.iron,[s*.96,r+.08,zs[0]+rodLength+.16],.26,.84,'z');bar(motion,m.steel,[s*1.12,r+.2,zs[0]+.8],[s*1.12,r+.2,zs[0]+rodLength+.5],.018);
  updates.push(t=>{const a=t*k.angularSpeed+phase;const cy=r+.08+cr*Math.sin(a),cz=cr*Math.cos(a);pins.forEach((g,i)=>g.position.set(s*1.12,cy,zs[i]+cz));rods.forEach((o,i)=>o.position.set(s*1.12,cy,(zs[i]+zs[i+1])*.5+cz));const A=new T.Vector3(s*1.12,cy,zs[0]+cz),B=new T.Vector3(s*1.12,r+.08,zs[0]+slider(a,cr,rodLength));main.position.copy(A).add(B).multiplyScalar(.5);main.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),B.clone().sub(A).normalize());cross.position.copy(B)});
  k.checks.push(t=>Math.abs(Math.hypot(cr*Math.sin(t*k.angularSpeed+phase),slider(t*k.angularSpeed+phase,cr,rodLength)-cr*Math.cos(t*k.angularSpeed+phase))-rodLength));
  for(const z of zs){const brake=part('轮面制动靴与吊杆',chassis);bar(brake,m.iron,[s*1.0,1.9,z+r*.8],[s*1.0,r+.1,z+r+.075],.025);box(brake,m.iron,[s*1.0,r+.1,z+r+.075],[.12,.3,.08]);}
 }
 const buffers=part('前端缓冲、车钩与排障',k.root,[0,0,front+1.53]);box(buffers,m.gear,[0,1.0,0],[2.5,.22,.19]);for(const s of [-1,1]){cylinder(buffers,m.iron,[s*.83,1,.17],.1,.38,'z');cylinder(buffers,m.iron,[s*.83,1,.38],.2,.04,'z')}box(buffers,m.iron,[0,.86,.27],[.18,.17,.32]);
 if(p.cowcatcher)for(let j=-6;j<=6;j++)bar(buffers,m.iron,[j*.15,.85,.06],[j*.19,.2,.48],.019);
 for(let j=0;j<(p.tenders||1);j++){
  const tg=part(j?'附加煤水车':'煤水车 / 水箱 / 悬挂',k.root,[0,0,-L*.5-3.7-j*4.35]);box(tg,m.iron,[0,.95,0],[2.2,.24,3.9]);box(tg,m.paint,[0,1.9,0],[2.2,1.75,3.6]);box(tg,m.iron,[0,2.77,0],[2.06,.06,3.4]);
  for(const s of [-1,1])box(tg,m.paint,[s*1.04,2.94,.55],[.1,.4,2.4]);box(tg,m.paint,[0,2.95,1.7],[2.12,.4,.12]);
  const coal=part('函数煤粒堆',tg);repeat(coal,geo('coalpiece',()=>new T.IcosahedronGeometry(.09,0)),m.coal,96,i=>({at:[Math.sin(i*9.7)*.91,2.86+.18*Math.sin(i*.77)**2,Math.cos(i*3.1)*1.01+.48],scale:[1+.6*Math.sin(i)**2,1,1]}));
  for(const z of [-1.2,-.4,.4,1.2])axle(k,tg,z,.34,{spokes:10});for(const s of [-1,1]){const n=digits(tg,String(p.number||28),[s*1.12,2.02,.3],.23);n.rotation.y=s*Math.PI/2;}
  const previous=j?k.parts.find(g=>g.name==='煤水车 / 水箱 / 悬挂'):cab;const rear=j?1.8:1.2,A=previous.position.z-rear,B=tg.position.z+1.8;const join=part('车钩固定连接',k.root,[0,1.1,(A+B)/2]);bar(join,m.iron,[0,0,(A-B)/2],[0,0,(B-A)/2],.065);
  k.connections.push({kind:'coupler',from:previous.userData.path,to:join.userData.path,anchorA:[0,1.1,-rear],anchorB:[0,0,(A-B)/2],axis:'Z',dof:'fixed'});k.connections.push({kind:'coupler',from:tg.userData.path,to:join.userData.path,anchorA:[0,1.1,1.8],anchorB:[0,0,(B-A)/2],axis:'Z',dof:'fixed'});
 }
 if(p.streamlined){const shell=part('函数流线罩壳',k.root);const skin=new ParametricGeometry((u,v,out)=>{const z=-L*.5-1.2+u*(L+2.25);const a=v*Math.PI*1.7-.35*Math.PI;const tip=1-Math.pow(Math.max(0,(u-.68)/.32),2.2)*.78;out.set(Math.sin(a)*(R+.24)*tip,Y+Math.cos(a)*(R+.22)*tip,z)},48,32);shape(shell,skin,m.paint);for(const s of [-1,1])box(shell,m.paint,[s*1.08,1.94,.1],[.09,.4,L+1]);}
 const smoke=part('函数蒸汽',k.root);const puffs=[];const fog=new T.MeshBasicMaterial({color:'#bfc7bd',transparent:true,opacity:.1,depthWrite:false});for(let j=0;j<12;j++)puffs.push(sphere(smoke,fog.clone(),[0,0,0],.24));updates.push(t=>{for(let j=0;j<puffs.length;j++){const q=((t*.15+j/12)%1+1)%1;puffs[j].position.set(Math.sin(j*7+t*.7)*q*.35,Y+R+.6+q*2.8,front-.8-q*1.8);puffs[j].scale.setScalar(.7+q*3.4);puffs[j].material.opacity=.12*(1-q)**1.7}});
 return k.finish();
}

export function generate(spec){if(spec.generator!=='steam_train')throw Error('TRAIN_ONLY');return train(spec);}
