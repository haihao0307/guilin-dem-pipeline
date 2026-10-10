import {PLATFORM_LAYOUT,COACH_DIMENSIONS,COACH_LAYOUT,TRACK} from './metre-scale.mjs';
import {createStreetDistrict,streetExclusion} from './street-district.mjs';
import * as THREE from '../../vendor/three.module.js';
import {Blocks,buildEnvironment,bridge} from './heritage.mjs';
import {createGameTrain} from './train-model.mjs';
import {createStationPlatform} from './station-platform.mjs';
import {createStationRoom} from './station-room.mjs';
import {createPassengers} from './characters.mjs';
import {FRONT_X} from './session.mjs';
import {FLAT_WORLD,flatFrame,flatActor,stationOffset,createFlatTerrain} from './flat-terrain.mjs';
export const WORLD=Object.freeze({halfRun:18,radius:3.8,width:12.2,nearEdge:7.6,farEdge:-4.6,centerX:-8,flat:true});
// Compatibility export: this is now only the length of the original scenery data.
export const BELT_LENGTH=FLAT_WORLD.period;
export const pathFrame=flatFrame;
function flatMesh(blocks,{material=null}={}){const mesh=new THREE.Mesh(blocks.geometry(),material||new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.04}));mesh.castShadow=mesh.receiveShadow=true;return mesh;}
function stationModel(plan){
  const model=createStationPlatform(plan),{group,zoneMaterial}=model,room=createStationRoom(plan);room.group.position.y+=PLATFORM_LAYOUT.top-.82;group.add(room.group);
  return {...model,proof:{...model.proof,room:room.proof},dispose(){group.remove(room.group);room.dispose();model.dispose();},update(view,station){
    const offset=stationOffset(station.target,view.distance);group.position.x=offset;model.updateClock?.(view.timetable?.minutes);model.updateCrew?.(view,station.index===view.station.index);
    const current=station.index===view.station.index,green=current&&view.station.canOpen;
    zoneMaterial.color.setHex(green?0x8db65b:station.missed?0xc77646:0xcfb96d);
    group.visible=offset+4.8>WORLD.centerX-FLAT_WORLD.terrainRadius&&offset+PLATFORM_LAYOUT.minX<WORLD.centerX+FLAT_WORLD.terrainRadius;
  }};
}
export function partitionTerrain(blocks){
  const source=blocks.geometry(),positions=source.attributes.position.array,normals=source.attributes.normal.array,colors=source.attributes.color.array,indices=source.index.array,tags=new Int8Array(source.attributes.position.count).fill(-1),lookup=new Int32Array(source.attributes.position.count).fill(-1);
  const ranges=blocks.floraRanges||[],buckets=Array.from({length:ranges.length+2},()=>({p:[],n:[],c:[],i:[]}));for(let k=0;k<ranges.length;k++)tags.fill(k,ranges[k].first,ranges[k].first+ranges[k].count);for(let i=0;i<tags.length;i++)if(tags[i]<0&&positions[i*3+1]<-.03&&normals[i*3+1]<-.9)tags[i]=ranges.length;
  for(let t=0;t<indices.length;t+=3){const tag=tags[indices[t]],bucket=buckets[tag+1],origin=tag<0||tag===ranges.length?{x:0,z:0}:ranges[tag];for(let j=0;j<3;j++){const sourceIndex=indices[t+j];if(tags[sourceIndex]!==tag)throw new Error('Terrain face crossed a plant boundary');let mapped=lookup[sourceIndex];if(mapped<0){mapped=bucket.p.length/3;lookup[sourceIndex]=mapped;const k=sourceIndex*3;bucket.p.push(positions[k]-origin.x,positions[k+1],positions[k+2]-origin.z);bucket.n.push(normals[k],normals[k+1],normals[k+2]);bucket.c.push(colors[k],colors[k+1],colors[k+2]);}bucket.i.push(mapped);}}
  const geometries=buckets.map(v=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(v.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(v.c,3));g.setIndex(v.i);g.computeBoundingSphere();return g;});
  let maxPositionDeviation=0;for(let i=0;i<tags.length;i++){if(lookup[i]<0)continue;const tag=tags[i],g=geometries[tag+1],j=lookup[i],origin=tag<0||tag===ranges.length?{x:0,z:0}:ranges[tag];maxPositionDeviation=Math.max(maxPositionDeviation,Math.abs(g.attributes.position.getX(j)+origin.x-positions[i*3]),Math.abs(g.attributes.position.getY(j)-positions[i*3+1]),Math.abs(g.attributes.position.getZ(j)+origin.z-positions[i*3+2]));}
  const proof={originalTriangles:indices.length/3,partitionedTriangles:geometries.reduce((n,g)=>n+g.index.count/3,0),floraObjects:ranges.length,maxPositionDeviation};source.dispose();return{ground:geometries[0],interior:geometries[ranges.length+1],plants:ranges.map((range,i)=>({...range,geometry:geometries[i+1]})),proof};
}
export function createGameWorld({street=true,onChange=()=>{}}={}){
  const root=new THREE.Group(),parts=partitionTerrain(buildEnvironment(WORLD,{platformCorridor:true,includeBridge:false,optimizeGeometry:true})),flatTerrain=createFlatTerrain(parts),terrain=flatTerrain.root;root.add(terrain);const train=createGameTrain();root.add(train.root);
  const streetDistrict=street?createStreetDistrict({onChange}):null;if(streetDistrict)root.add(streetDistrict.root);
  const people=createPassengers(pathFrame,{seatGeometry:(actor,position)=>({floorY:position[1],seatSurfaceY:position[1]+COACH_DIMENSIONS.seatHeight,ceilingY:position[1]+COACH_DIMENSIONS.interiorHeight})});root.add(people.mesh);const stations=new Map(),bridges=new Map();
  const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.092,0),new THREE.MeshStandardMaterial({color:0xb5b5a2,roughness:.93}),80);stones.castShadow=true;stones.frustumCulled=false;root.add(stones);
  const impacts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xebc55c}),180);impacts.frustumCulled=false;root.add(impacts);let lastEvent=0,effects=[];
  const rain=new THREE.InstancedMesh(new THREE.BoxGeometry(.012,.65,.012),new THREE.MeshBasicMaterial({color:0xb3c4c9,transparent:true,opacity:.32,depthWrite:false}),110);rain.frustumCulled=false;root.add(rain);const pose=new THREE.Object3D();
  const sockets=train.steam.emitters;
  const soundPoints={wheelFront:[train.steam.wheels.find(w=>w.userData.kind==='driver').position.x,TRACK.railHead+train.proof.driverRadius,0],wheelRear:[COACH_LAYOUT.at(-1).x,TRACK.railHead+COACH_DIMENSIONS.wheelRadius,0],cylinderLeft:sockets.cylinderLeft,cylinderRight:sockets.cylinderRight,whistle:sockets.whistle};
  const soundVector=new THREE.Vector3();
  function fillAudioSources(output,view){
    train.root.updateWorldMatrix(true,false);
    for(const [name,point] of Object.entries(soundPoints)){const local=name==='whistle'&&train.steam?.transformBodyPoint?train.steam.transformBodyPoint(point):point;soundVector.fromArray(local).applyMatrix4(train.root.matrixWorld).toArray(output[name]);}
    // The nearest rendered station stays behind when next-station activates.
    // Its guard/crowd must not jump to the next stop with the HUD.
    let station=null,distance=Infinity;
    for(const model of stations.values()){const d=Math.abs(model.group.position.x);if(d<distance){station=model;distance=d;}}
    const localGuard=station?.proof?.attendant?.position||[-1.6,.82,2.65];
    const points={guard:station?.crewAnchor||[localGuard[0],localGuard[1]+.87,localGuard[2]-.17],crowdFront:[COACH_LAYOUT[0].frontDoor,PLATFORM_LAYOUT.top+1.45,3.9],crowdRear:[COACH_LAYOUT[1].frontDoor,PLATFORM_LAYOUT.top+1.45,4]};
    if(station)station.group.updateWorldMatrix(true,false);
    for(const [name,point] of Object.entries(points)){
      if(station)soundVector.fromArray(point).applyMatrix4(station.group.matrixWorld).toArray(output[name]);
      else{output[name][0]=10000;output[name][1]=0;output[name][2]=0;}
    }
    for(let i=0;i<4;i++){const entry=output['impact'+i];if(!entry)continue;const point=entry.position||entry;point[0]=10000;point[1]=0;point[2]=0;if(entry.position){entry.enabled=false;entry.eventId=null;}}
    for(const event of view?.events||[]){
      if(event.type!=='stone-hit'||!event.point?.every(Number.isFinite)||(view.tick-event.tick)/30>1.2)continue;
      const role='impact'+(event.id%4),entry=output[role];if(entry){soundVector.fromArray(event.point).applyMatrix4(train.root.matrixWorld).toArray(entry.position||entry);if(entry.position){entry.enabled=true;entry.eventId=event.id;}}
    }
    return output;
  }
  function fillSteamEmitters(output){
    train.root.updateWorldMatrix(true,false);
    train.steam.fillSteamEmitters(output);
    for(const name of ['chimney','cylinderLeft','cylinderRight'])soundVector.fromArray(output[name]).applyMatrix4(train.root.matrixWorld).toArray(output[name]);
    return output;
  }
  return{root,train,terrain,people,streetDistrict,pathFrame,fillAudioSources,fillSteamEmitters,stationProof:()=>[...stations].map(([index,m])=>({index,...m.proof,offset:m.group.position.x})),update(view,route,{interior=false}={}){
    flatTerrain.update(view.distance,streetDistrict?[streetExclusion(view.distance,route[0].target)]:[]);train.update(view,{interior});streetDistrict?.update(view,route);
    // Convert world actors once at the renderer boundary, keeping the original
    // farmer/passenger geometry and Session paths while removing the old belt cull.
    people.update({...view,actors:view.actors.map(actor=>{const rendered=flatActor(actor,view.distance,FRONT_X);if(actor.frame==='train'&&train.transformPassengerPoint)rendered.position=train.transformPassengerPoint(rendered.position);return rendered;}).filter(actor=>Math.abs(actor.position[0]-WORLD.centerX)<FLAT_WORLD.terrainRadius)});
    const visible=new Set(),nearby=new Map(view.nearbyStations.map(plan=>[plan.index,plan]));
    for(const source of route){const offset=stationOffset(source.target,view.distance);if(offset+5<WORLD.centerX-FLAT_WORLD.terrainRadius||offset+PLATFORM_LAYOUT.minX>WORLD.centerX+FLAT_WORLD.terrainRadius)continue;const plan=nearby.get(source.index)||source;visible.add(plan.index);if(!stations.has(plan.index))stations.set(plan.index,stationModel(plan));const m=stations.get(plan.index);if(!m.group.parent)root.add(m.group);m.update(view,plan);}for(const [id,m]of stations)if(!visible.has(id)){root.remove(m.group);m.dispose();stations.delete(id);}
    const activeBridges=new Set();for(let i=1;i<route.length;i++){const at=(route[i-1].target+route[i].target)/2,offset=at-view.distance+FRONT_X;if(Math.abs(offset-WORLD.centerX)>FLAT_WORLD.terrainRadius+8)continue;activeBridges.add(i);if(!bridges.has(i)){const b=new Blocks();bridge(b,0);const mesh=flatMesh(b);mesh.name='Straight railway truss bridge';bridges.set(i,{mesh});root.add(mesh);}bridges.get(i).mesh.position.x=offset;}for(const[id,b]of bridges)if(!activeBridges.has(id)){root.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();bridges.delete(id);}
    let count=0;for(const rock of view.rocks){if(rock.hit)continue;pose.position.set(rock.position[0]-view.distance+FRONT_X,rock.position[1],rock.position[2]);pose.rotation.set(rock.age*7,rock.age*5,rock.age*3);pose.scale.setScalar(rock.landed?Math.max(.1,1-rock.age):1);pose.updateMatrix();stones.setMatrixAt(count++,pose.matrix);}stones.count=count;stones.instanceMatrix.needsUpdate=true;
    for(const e of view.events)if(e.id>lastEvent&&e.type==='stone-hit')effects.push({tick:e.tick,point:e.point,id:e.id});if(view.events.length)lastEvent=view.events.at(-1).id;effects=effects.filter(e=>(view.tick-e.tick)/30<.65);count=0;
    for(const e of effects){const age=(view.tick-e.tick)/30;for(let j=0;j<8;j++){const a=j*Math.PI/4+e.id;pose.position.set(e.point[0]+Math.cos(a)*age*.85,e.point[1]+Math.sin(a)*age*.8+.15,e.point[2]+age*.6);pose.rotation.set(0,0,a+age*2);pose.scale.set(.065*(1-age),.065*(1-age),.065*(1-age));pose.updateMatrix();impacts.setMatrixAt(count++,pose.matrix);}}impacts.count=count;impacts.instanceMatrix.needsUpdate=true;
    rain.visible=view.station.wet;if(rain.visible){for(let i=0;i<110;i++){const x=((i*13.37)%38)-26,z=((i*7.17)%11)-3.5,y=7-((view.elapsed*8+i*.173)%7);pose.position.set(x,y,z);pose.rotation.set(0,0,-.13);pose.scale.set(1,1,1);pose.updateMatrix();rain.setMatrixAt(i,pose.matrix);}rain.instanceMatrix.needsUpdate=true;}
  },resetEffects(){lastEvent=0;effects=[];train.resetBodyMotion?.();}};
}

