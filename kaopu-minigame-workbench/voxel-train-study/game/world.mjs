import * as THREE from '../vendor/three.module.js';
import {Blocks,buildEnvironment,bridge} from './heritage.mjs';
import {createGameTrain} from './train-model.mjs';
import {createPassengers} from './characters.mjs';
import {FRONT_X} from './session.mjs';
export const WORLD=Object.freeze({halfRun:18,radius:3.8,width:12.2,nearEdge:7.6,farEdge:-4.6,centerX:-8});
export const BELT_LENGTH=4*WORLD.halfRun+2*Math.PI*WORLD.radius;
export function pathFrame(worldX,elevation=0,z=0){
  const a=WORLD.halfRun,r=WORLD.radius,l=2*a,c=Math.PI*r;let s=((worldX-WORLD.centerX+a)%BELT_LENGTH+BELT_LENGTH)%BELT_LENGTH,x,y,tx,ty;
  if(s<l){x=s-a;y=0;tx=1;ty=0;}else if(s<l+c){const t=(s-l)/r;x=a+r*Math.sin(t);y=-r+r*Math.cos(t);tx=Math.cos(t);ty=-Math.sin(t);}else if(s<2*l+c){x=a-(s-l-c);y=-2*r;tx=-1;ty=0;}else{const t=(s-2*l-c)/r;x=-a-r*Math.sin(t);y=-r-r*Math.cos(t);tx=-Math.cos(t);ty=Math.sin(t);}
  return{position:[WORLD.centerX+x-elevation*ty,y+elevation*tx,z],tangent:[tx,ty,0],normal:[-ty,tx,0]};
}
const BEND=[
'uniform float beltPhase;',
'varying float vBeltInterior;',
'#ifdef DRIVER_FLORA',
'attribute vec2 floraRoot;',
'#endif',
'vec4 driverFrame(float u){',
'float a=18.0,r=3.8,l=36.0,c=3.141592653589793*r,total=4.0*a+2.0*c;',
'float s=mod(u+beltPhase+a,total);',
'if(s<l)return vec4(s-a,0.0,1.0,0.0);',
'if(s<l+c){float t=(s-l)/r;return vec4(a+r*sin(t),-r+r*cos(t),cos(t),-sin(t));}',
'if(s<2.0*l+c)return vec4(a-(s-l-c),-2.0*r,-1.0,0.0);',
'float t=(s-2.0*l-c)/r;return vec4(-a-r*sin(t),-r-r*cos(t),-cos(t),sin(t));}',
'vec3 driverPosition(vec3 p){',
'#ifdef DRIVER_FLORA',
'if(floraRoot.x>-999.0){float growth=smoothstep(-2.1,-0.15,driverFrame(floraRoot.x).y);p.xz=mix(floraRoot,p.xz,growth);p.y*=growth;}',
'#endif',
'vec4 f=driverFrame(p.x);return vec3(f.x-p.y*f.w,f.y+p.y*f.z,p.z);}',
'vec3 driverNormal(vec3 p,vec3 n){vec4 f=driverFrame(p.x);return vec3(n.x*f.z-n.y*f.w,n.x*f.w+n.y*f.z,n.z);}'
].join('\n');
function bendMaterial(material,phase){material.onBeforeCompile=shader=>{shader.uniforms.beltPhase=phase;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+BEND).replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal = driverNormal(position, objectNormal);').replace('#include <begin_vertex>','vBeltInterior=(position.y < -0.03 && normal.y < -0.9)?1.0:0.0; vec3 transformed=driverPosition(position);');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBeltInterior;').replace('#include <opaque_fragment>','outgoingLight=max(outgoingLight,vBeltInterior*vec3(0.023,0.024,0.030));\n#include <opaque_fragment>');};material.customProgramCacheKey=()=> 'train-driver-bend-v1';return material;}
function bentMesh(blocks,phase,{localCoordinates=false,material=null}={}){const geometry=blocks.geometry();if(localCoordinates){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)-WORLD.centerX);p.needsUpdate=true;}const m=new THREE.Mesh(geometry,bendMaterial(material||new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.04}),phase));m.position.x=WORLD.centerX;m.frustumCulled=false;m.castShadow=m.receiveShadow=true;m.customDepthMaterial=bendMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),phase);if(blocks.floraRanges?.length){const roots=new Float32Array(geometry.attributes.position.count*2);for(let i=0;i<roots.length;i+=2)roots[i]=-10000;for(const plant of blocks.floraRanges)for(let i=plant.first;i<plant.first+plant.count;i++){roots[i*2]=plant.x;roots[i*2+1]=plant.z;}geometry.setAttribute('floraRoot',new THREE.BufferAttribute(roots,2));m.material.defines={...m.material.defines,DRIVER_FLORA:1};m.customDepthMaterial.defines={...m.customDepthMaterial.defines,DRIVER_FLORA:1};}return m;}
function signTexture(text){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=144;const ctx=canvas.getContext('2d');ctx.fillStyle='#e5d8ac';ctx.fillRect(0,0,512,144);ctx.fillStyle='#344e46';ctx.fillRect(10,10,492,124);ctx.fillStyle='#eee4bc';ctx.font='bold 60px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,72);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;}
function stationModel(plan){
  const group=new THREE.Group(),phase={value:0},b=new Blocks();
  for(let x=-26;x<-2;x+=.3){b.box(x+.15,.40,3.82,.303,.8,3.52,0x8e9180);b.box(x+.15,.82,2.13,.30,.065,.12,0xd9b856);b.box(x+.15,.813,5.54,.30,.05,.13,0xc0c0a8);}
  for(let x=-25.75;x<-2;x+=.52)for(let z=2.5;z<5.5;z+=.49)b.box(x,.81,z,.49,.045,.465,(Math.floor(x*3)+Math.floor(z*5))%3===0?0xb5b49b:0xa2a58d);
  for(const x of [-23.8,-19.2,-15.4,-10.8,-6.0]){b.box(x,1.04,5.55,.11,.42,.11,0x5a6753);b.box(x,1.31,5.55,3.8,.065,.065,0xb0b69d);}
  for(const x of [-22,-10.7]){b.box(x,1.2,4.78,2.1,.12,.6,0x807250);b.box(x,1.53,5.07,2.1,.54,.10,0x847b55);for(const dx of [-.72,.72])b.box(x+dx,1.0,4.79,.12,.42,.44,0x47554b);}
  for(const x of [-17,-13])for(const z of [3.55,5.28])b.box(x,1.96,z,.13,2.28,.13,0x496456);
  for(let x=-17.35;x<-12.6;x+=.18)b.box(x,3.22,4.41,.182,.14,2.21,0x3f5b52);
  for(const x of [-17.4,-12.55])b.box(x,3.12,4.4,.15,.16,2.31,0xbaa878);
  b.box(-14.6,2.39,5.37,2.8,.78,.1,0x3c5449);
  for(const x of [-18.1,-11.1]){b.box(x,.64,5.7,1.55,.3,.42,0x929782);b.box(x,.36,6.0,1.55,.26,.40,0x939982);b.box(x,.17,6.27,1.55,.14,.29,0x929782);}
  const platform=bentMesh(b,phase,{localCoordinates:true});group.add(platform);
  const zone=new Blocks();for(const z of [-1.22,1.22])zone.box(5,.38,z,plan.radius*2,.08,.065,0xffffff);for(const x of [5-plan.radius,5+plan.radius])zone.box(x,.38,0,.065,.08,2.5,0xffffff);zone.box(5,1.02,1.85,.10,1.65,.10,0xffffff);zone.box(5,1.96,1.85,.53,.42,.12,0xffffff);
  const zoneMaterial=new THREE.MeshStandardMaterial({color:0xcfb96d,roughness:.7,emissive:0x242012}),stopZone=bentMesh(zone,phase,{localCoordinates:true,material:zoneMaterial});group.add(stopZone);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.58,.72),new THREE.MeshBasicMaterial({map:signTexture(plan.name),side:THREE.DoubleSide}));group.add(sign);
  return{group,phase,zoneMaterial,sign,update(view,station){const offset=station.target-view.distance;phase.value=offset;const f=pathFrame(-14.6+offset,2.39,5.438);sign.position.set(...f.position);sign.rotation.z=Math.atan2(f.tangent[1],f.tangent[0]);const current=station.index===view.station.index,green=current&&view.station.canOpen;zoneMaterial.color.setHex(green?0x8db65b:station.missed?0xc77646:0xcfb96d);group.visible=Math.abs(offset)<60;},dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}o.customDepthMaterial?.dispose();});}};
}
export function partitionTerrain(blocks){
  const source=blocks.geometry(),positions=source.attributes.position.array,normals=source.attributes.normal.array,colors=source.attributes.color.array,indices=source.index.array,tags=new Int8Array(source.attributes.position.count).fill(-1),lookup=new Int32Array(source.attributes.position.count).fill(-1);
  const ranges=blocks.floraRanges||[],buckets=Array.from({length:ranges.length+2},()=>({p:[],n:[],c:[],i:[]}));for(let k=0;k<ranges.length;k++)tags.fill(k,ranges[k].first,ranges[k].first+ranges[k].count);for(let i=0;i<tags.length;i++)if(tags[i]<0&&positions[i*3+1]<-.03&&normals[i*3+1]<-.9)tags[i]=ranges.length;
  for(let t=0;t<indices.length;t+=3){const tag=tags[indices[t]],bucket=buckets[tag+1],origin=tag<0||tag===ranges.length?{x:0,z:0}:ranges[tag];for(let j=0;j<3;j++){const sourceIndex=indices[t+j];if(tags[sourceIndex]!==tag)throw new Error('Terrain face crossed a plant boundary');let mapped=lookup[sourceIndex];if(mapped<0){mapped=bucket.p.length/3;lookup[sourceIndex]=mapped;const k=sourceIndex*3;bucket.p.push(positions[k]-origin.x,positions[k+1],positions[k+2]-origin.z);bucket.n.push(normals[k],normals[k+1],normals[k+2]);bucket.c.push(colors[k],colors[k+1],colors[k+2]);}bucket.i.push(mapped);}}
  const geometries=buckets.map(v=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(v.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(v.c,3));g.setIndex(v.i);g.computeBoundingSphere();return g;});
  let maxPositionDeviation=0;for(let i=0;i<tags.length;i++){if(lookup[i]<0)continue;const tag=tags[i],g=geometries[tag+1],j=lookup[i],origin=tag<0||tag===ranges.length?{x:0,z:0}:ranges[tag];maxPositionDeviation=Math.max(maxPositionDeviation,Math.abs(g.attributes.position.getX(j)+origin.x-positions[i*3]),Math.abs(g.attributes.position.getY(j)-positions[i*3+1]),Math.abs(g.attributes.position.getZ(j)+origin.z-positions[i*3+2]));}
  const proof={originalTriangles:indices.length/3,partitionedTriangles:geometries.reduce((n,g)=>n+g.index.count/3,0),floraObjects:ranges.length,maxPositionDeviation};source.dispose();return{ground:geometries[0],interior:geometries[ranges.length+1],plants:ranges.map((range,i)=>({...range,geometry:geometries[i+1]})),proof};
}
export function createGameWorld(){
  const root=new THREE.Group(),terrainPhase={value:0},parts=partitionTerrain(buildEnvironment(WORLD,{platformCorridor:true,includeBridge:false,optimizeGeometry:true})),terrain=new THREE.Group();terrain.name='Preserved terrain surfaces with rigid moving flora';terrain.userData.proof=parts.proof;const ground=bentMesh({geometry:()=>parts.ground},terrainPhase),interior=bentMesh({geometry:()=>parts.interior},terrainPhase,{material:new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(.023,.024,.030)})});terrain.add(ground,interior);const plantMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.04}),plants=parts.plants.map(plant=>{const mesh=new THREE.Mesh(plant.geometry,plantMaterial);mesh.castShadow=mesh.receiveShadow=true;terrain.add(mesh);return{...plant,mesh};});root.add(terrain);const train=createGameTrain();root.add(train.root);
  const people=createPassengers(pathFrame);root.add(people.mesh);const stations=new Map(),bridges=new Map();
  const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.092,0),new THREE.MeshStandardMaterial({color:0xb5b5a2,roughness:.93}),80);stones.castShadow=true;stones.frustumCulled=false;root.add(stones);
  const impacts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xebc55c}),180);impacts.frustumCulled=false;root.add(impacts);let lastEvent=0,effects=[];
  const rain=new THREE.InstancedMesh(new THREE.BoxGeometry(.012,.65,.012),new THREE.MeshBasicMaterial({color:0xb3c4c9,transparent:true,opacity:.32,depthWrite:false}),110);rain.frustumCulled=false;root.add(rain);const pose=new THREE.Object3D();
  return{root,train,terrain,people,pathFrame,update(view,route,{interior=false}={}){
    terrainPhase.value=-view.distance;for(const plant of plants){const frame=pathFrame(WORLD.centerX+plant.x-view.distance,0,plant.z),growth=THREE.MathUtils.smoothstep(frame.position[1],-2.1,-.15);plant.mesh.visible=growth>.0001;plant.mesh.position.set(...frame.position);plant.mesh.rotation.z=Math.atan2(frame.tangent[1],frame.tangent[0]);plant.mesh.scale.setScalar(growth);}train.update(view,{interior});people.update(view);
    const visible=new Set();for(const plan of view.nearbyStations){visible.add(plan.index);if(!stations.has(plan.index))stations.set(plan.index,stationModel(plan));const m=stations.get(plan.index);if(!m.group.parent)root.add(m.group);m.update(view,plan);}for(const [id,m]of stations)if(!visible.has(id)){root.remove(m.group);m.dispose();stations.delete(id);}
    const activeBridges=new Set();for(let i=Math.max(1,view.station.index-1);i<Math.min(route.length,view.station.index+2);i++){const at=(route[i-1].target+route[i].target)/2,offset=at-view.distance+FRONT_X-WORLD.centerX;if(Math.abs(at-view.distance)>57)continue;activeBridges.add(i);if(!bridges.has(i)){const b=new Blocks();bridge(b,0);const phase={value:offset},m=bentMesh(b,phase);bridges.set(i,{mesh:m,phase});root.add(m);}bridges.get(i).phase.value=offset;}for(const[id,b]of bridges)if(!activeBridges.has(id)){root.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();b.mesh.customDepthMaterial.dispose();bridges.delete(id);}
    let count=0;for(const rock of view.rocks){if(rock.hit)continue;pose.position.set(rock.position[0]-view.distance+FRONT_X,rock.position[1],rock.position[2]);pose.rotation.set(rock.age*7,rock.age*5,rock.age*3);pose.scale.setScalar(rock.landed?Math.max(.1,1-rock.age):1);pose.updateMatrix();stones.setMatrixAt(count++,pose.matrix);}stones.count=count;stones.instanceMatrix.needsUpdate=true;
    for(const e of view.events)if(e.id>lastEvent&&e.type==='stone-hit')effects.push({tick:e.tick,point:e.point,id:e.id});if(view.events.length)lastEvent=view.events.at(-1).id;effects=effects.filter(e=>(view.tick-e.tick)/30<.65);count=0;
    for(const e of effects){const age=(view.tick-e.tick)/30;for(let j=0;j<8;j++){const a=j*Math.PI/4+e.id;pose.position.set(e.point[0]+Math.cos(a)*age*.85,e.point[1]+Math.sin(a)*age*.8+.15,e.point[2]+age*.6);pose.rotation.set(0,0,a+age*2);pose.scale.set(.065*(1-age),.065*(1-age),.065*(1-age));pose.updateMatrix();impacts.setMatrixAt(count++,pose.matrix);}}impacts.count=count;impacts.instanceMatrix.needsUpdate=true;
    rain.visible=view.station.wet;if(rain.visible){for(let i=0;i<110;i++){const x=((i*13.37)%38)-26,z=((i*7.17)%11)-3.5,y=7-((view.elapsed*8+i*.173)%7);pose.position.set(x,y,z);pose.rotation.set(0,0,-.13);pose.scale.set(1,1,1);pose.updateMatrix();rain.setMatrixAt(i,pose.matrix);}rain.instanceMatrix.needsUpdate=true;}
  },resetEffects(){lastEvent=0;effects=[];}};
}
