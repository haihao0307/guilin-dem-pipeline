import * as THREE from '../../vendor/three.module.js';
import {Blocks,buildEnvironment,bridge} from './heritage.mjs';
import {createGameTrain} from './train-model.mjs';
import {createPassengers} from './characters.mjs';
import {FRONT_X} from './session.mjs';
import {FLAT_WORLD,flatFrame,flatActor,stationOffset,createFlatTerrain} from './flat-terrain.mjs';
export const WORLD=Object.freeze({halfRun:18,radius:3.8,width:12.2,nearEdge:7.6,farEdge:-4.6,centerX:-8,flat:true});
// Compatibility export: this is now only the length of the original scenery data.
export const BELT_LENGTH=FLAT_WORLD.period;
export const pathFrame=flatFrame;
function flatMesh(blocks,{material=null}={}){const mesh=new THREE.Mesh(blocks.geometry(),material||new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.04}));mesh.castShadow=mesh.receiveShadow=true;return mesh;}
function signTexture(plan){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;const ctx=canvas.getContext('2d');ctx.fillStyle='#ddd0a0';ctx.fillRect(0,0,1024,320);ctx.fillStyle='#242e25';ctx.fillRect(10,10,1004,300);ctx.fillStyle='#f5e8be';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 112px serif';ctx.fillText(plan.name,512,111);ctx.font='52px Georgia,serif';ctx.fillText(plan.english||'',512,237);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;}
function stationModel(plan){
  const group=new THREE.Group(),b=new Blocks();group.name="Flat station platform: "+plan.name;
  for(let x=-26;x<4.6;x+=.25){b.box(x+.12,.755,3.82,.237,.13,3.52,Math.floor(x*4)%3===0?0x7e6646:0x947751);b.box(x+.12,.824,2.13,.235,.025,.12,0xd0c098);}for(let x=-25.7;x<4.6;x+=1.4){for(const z of [2.45,5.16])b.box(x,.39,z,.17,.74,.18,0x54452f);b.box(x,.59,3.8,.16,.16,3.45,0x614c33);b.beam(x,.1,2.45,x+.6,.65,2.45,.08,0x806644);}
  
  for(const x of [-23.8,-19.2,-15.4,-10.8,-6.0]){b.box(x,1.04,5.55,.11,.42,.11,0x5a6753);b.box(x,1.31,5.55,3.8,.065,.065,0xb0b69d);}
  for(const x of [-22,-10.7]){b.box(x,1.2,4.78,2.1,.12,.6,0x807250);b.box(x,1.53,5.07,2.1,.54,.10,0x847b55);for(const dx of [-.72,.72])b.box(x+dx,1.0,4.79,.12,.42,.44,0x47554b);}
  for(const x of [-17,-13])for(const z of [3.55,5.28])b.box(x,1.96,z,.13,2.28,.13,0x496456);
  for(let x=-17.35;x<-12.6;x+=.18)b.box(x,3.22,4.41,.182,.14,2.21,0x3f5b52);
  for(const x of [-17.4,-12.55])b.box(x,3.12,4.4,.15,.16,2.31,0xbaa878);
  b.box(-14.6,2.39,5.37,2.8,.78,.1,0x3c5449);
  for(const x of [-18.1,-11.1]){b.box(x,.64,5.7,1.55,.3,.42,0x929782);b.box(x,.36,6.0,1.55,.26,.40,0x939982);b.box(x,.17,6.27,1.55,.14,.29,0x929782);}
  // Period station furniture and small warm oil-style lamps, all original geometry.
  for(const x of [-24,-18,-9,-3.6,3.2]){b.box(x,1.82,5.29,.085,2.03,.085,0x313c32);b.box(x,2.91,5.29,.37,.065,.36,0x27332d);b.box(x,2.74,5.29,.25,.27,.25,0xc6a260);b.box(x,2.57,5.29,.34,.055,.33,0x343a2d);for(const dx of [-.13,.13])for(const dz of [-.13,.13])b.box(x+dx,2.75,5.29+dz,.025,.29,.025,0x302e22);b.box(x,3.0,5.29,.22,.13,.22,0x3f4336);}
  // Station attendant: cap, waistcoat and a small departure flag.
  const sx=-4.8;b.box(sx,1.34,4.8,.29,.43,.21,0x40564d);b.box(sx,1.68,4.8,.23,.24,.22,0xc5a480);b.box(sx,1.83,4.8,.29,.08,.28,0x262d27);for(const z of [4.71,4.89])b.box(sx,.99,z,.1,.38,.1,0x383b32);b.box(sx+.18,1.33,4.8,.09,.37,.09,0x657668);b.box(sx+.22,1.43,4.8,.04,.51,.04,0x90764a);b.box(sx+.39,1.62,4.8,.3,.19,.025,0xc5b66e);
  const platform=flatMesh(b);group.add(platform);
  const zone=new Blocks();for(const z of [-1.22,1.22])zone.box(5,.38,z,plan.radius*2,.08,.065,0xffffff);for(const x of [5-plan.radius,5+plan.radius])zone.box(x,.38,0,.065,.08,2.5,0xffffff);zone.box(5,1.02,1.85,.10,1.65,.10,0xffffff);zone.box(5,1.96,1.85,.53,.42,.12,0xffffff);
  const zoneMaterial=new THREE.MeshStandardMaterial({color:0xcfb96d,roughness:.7,emissive:0x242012}),stopZone=flatMesh(zone,{material:zoneMaterial});group.add(stopZone);
  const lamps=new THREE.Group();group.add(lamps);for(const x of [-24,-18,-9,-3.6,3.2]){const glow=new THREE.Mesh(new THREE.SphereGeometry(.125,8,6),new THREE.MeshBasicMaterial({color:0xffd88e}));glow.userData.localX=x;lamps.add(glow);}const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.7,1.16),new THREE.MeshBasicMaterial({map:signTexture(plan),side:THREE.DoubleSide}));group.add(sign);
  for(const light of lamps.children)light.position.set(light.userData.localX,2.75,5.29);sign.position.set(-14.6,2.39,5.438);
  return{group,zoneMaterial,sign,update(view,station){const offset=stationOffset(station.target,view.distance);group.position.x=offset;const current=station.index===view.station.index,green=current&&view.station.canOpen;zoneMaterial.color.setHex(green?0x8db65b:station.missed?0xc77646:0xcfb96d);group.visible=offset+4.8>WORLD.centerX-FLAT_WORLD.terrainRadius&&offset-26<WORLD.centerX+FLAT_WORLD.terrainRadius;},dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});}};
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
  const root=new THREE.Group(),parts=partitionTerrain(buildEnvironment(WORLD,{platformCorridor:true,includeBridge:false,optimizeGeometry:true})),flatTerrain=createFlatTerrain(parts),terrain=flatTerrain.root;root.add(terrain);const train=createGameTrain();root.add(train.root);
  const people=createPassengers(pathFrame);root.add(people.mesh);const stations=new Map(),bridges=new Map();
  const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.092,0),new THREE.MeshStandardMaterial({color:0xb5b5a2,roughness:.93}),80);stones.castShadow=true;stones.frustumCulled=false;root.add(stones);
  const impacts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xebc55c}),180);impacts.frustumCulled=false;root.add(impacts);let lastEvent=0,effects=[];
  const rain=new THREE.InstancedMesh(new THREE.BoxGeometry(.012,.65,.012),new THREE.MeshBasicMaterial({color:0xb3c4c9,transparent:true,opacity:.32,depthWrite:false}),110);rain.frustumCulled=false;root.add(rain);const pose=new THREE.Object3D();
  return{root,train,terrain,people,pathFrame,update(view,route,{interior=false}={}){
    flatTerrain.update(view.distance);train.update(view,{interior});
    // Convert world actors once at the renderer boundary, keeping the original
    // farmer/passenger geometry and Session paths while removing the old belt cull.
    people.update({...view,actors:view.actors.map(actor=>flatActor(actor,view.distance,FRONT_X)).filter(actor=>Math.abs(actor.position[0]-WORLD.centerX)<FLAT_WORLD.terrainRadius)});
    const visible=new Set(),nearby=new Map(view.nearbyStations.map(plan=>[plan.index,plan]));
    for(const source of route){const offset=stationOffset(source.target,view.distance);if(offset+5<WORLD.centerX-FLAT_WORLD.terrainRadius||offset-27>WORLD.centerX+FLAT_WORLD.terrainRadius)continue;const plan=nearby.get(source.index)||source;visible.add(plan.index);if(!stations.has(plan.index))stations.set(plan.index,stationModel(plan));const m=stations.get(plan.index);if(!m.group.parent)root.add(m.group);m.update(view,plan);}for(const [id,m]of stations)if(!visible.has(id)){root.remove(m.group);m.dispose();stations.delete(id);}
    const activeBridges=new Set();for(let i=1;i<route.length;i++){const at=(route[i-1].target+route[i].target)/2,offset=at-view.distance+FRONT_X;if(Math.abs(offset-WORLD.centerX)>FLAT_WORLD.terrainRadius+8)continue;activeBridges.add(i);if(!bridges.has(i)){const b=new Blocks();bridge(b,0);const mesh=flatMesh(b);mesh.name='Straight railway truss bridge';bridges.set(i,{mesh});root.add(mesh);}bridges.get(i).mesh.position.x=offset;}for(const[id,b]of bridges)if(!activeBridges.has(id)){root.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();bridges.delete(id);}
    let count=0;for(const rock of view.rocks){if(rock.hit)continue;pose.position.set(rock.position[0]-view.distance+FRONT_X,rock.position[1],rock.position[2]);pose.rotation.set(rock.age*7,rock.age*5,rock.age*3);pose.scale.setScalar(rock.landed?Math.max(.1,1-rock.age):1);pose.updateMatrix();stones.setMatrixAt(count++,pose.matrix);}stones.count=count;stones.instanceMatrix.needsUpdate=true;
    for(const e of view.events)if(e.id>lastEvent&&e.type==='stone-hit')effects.push({tick:e.tick,point:e.point,id:e.id});if(view.events.length)lastEvent=view.events.at(-1).id;effects=effects.filter(e=>(view.tick-e.tick)/30<.65);count=0;
    for(const e of effects){const age=(view.tick-e.tick)/30;for(let j=0;j<8;j++){const a=j*Math.PI/4+e.id;pose.position.set(e.point[0]+Math.cos(a)*age*.85,e.point[1]+Math.sin(a)*age*.8+.15,e.point[2]+age*.6);pose.rotation.set(0,0,a+age*2);pose.scale.set(.065*(1-age),.065*(1-age),.065*(1-age));pose.updateMatrix();impacts.setMatrixAt(count++,pose.matrix);}}impacts.count=count;impacts.instanceMatrix.needsUpdate=true;
    rain.visible=view.station.wet;if(rain.visible){for(let i=0;i<110;i++){const x=((i*13.37)%38)-26,z=((i*7.17)%11)-3.5,y=7-((view.elapsed*8+i*.173)%7);pose.position.set(x,y,z);pose.rotation.set(0,0,-.13);pose.scale.set(1,1,1);pose.updateMatrix();rain.setMatrixAt(i,pose.matrix);}rain.instanceMatrix.needsUpdate=true;}
  },resetEffects(){lastEvent=0;effects=[];}};
}

