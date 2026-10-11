import {normalizeRoomScore} from './room-recipe.mjs';
import {createR312Wall} from './r312-wall/r312-wall.mjs';
import {createTimberMember} from './native/timber/three-adapter.mjs';
// Composition only. No replacement wall/wood material implementation lives here.
export function buildDwellingUnit(input,{THREE}={}){
 const recipe=normalizeRoomScore(input);if(!THREE?.Group)throw Error('Existing host THREE required');
 const root=new THREE.Group();root.name='Original production room R02 — inspection in progress';
 const groups={walls:new THREE.Group(),front:new THREE.Group(),roof:new THREE.Group(),interior:new THREE.Group(),door:new THREE.Group()};for(const [k,g]of Object.entries(groups)){g.name='native-room-'+k;root.add(g)}
 const walls=[],timbers=[];let disposed=false,doorOpen=recipe.doorOpen,cutaway=false;
 const woodSettings={reliefMode:'auto',textureContrast:1.20,fineness:1.12,reliefStrength:1.10};
 function wood(id,length,height,depth,position,rotation=[0,0,0],parent=groups.interior,extra={}){
  const member=createTimberMember(THREE,{id,sourceId:extra.sourceId??id,seed:recipe.seed,length,height,depth,position,rotation,presetId:extra.presetId??recipe.presetId,settings:woodSettings,grainOffset:extra.grainOffset??[0,0,0],tessellation:{lengthSegments:Math.max(2,Math.min(24,Math.ceil(length/.18))),crossSegments:2,endSegments:2,sideClass:extra.weathered?'weathered':'longitudinal'}});
  parent.add(member.mesh);timbers.push(member);return member;
 }
 function wall(name,position,yaw,opening,parent=groups.walls){
  const w=createR312Wall({THREE,seed:(recipe.seed+walls.length*97)%65536,bindingMode:recipe.wallBindingMode,door:opening,plasterCenter:[0,1.48],plasterSize:[3.2,2.35],showPlaster:true});
  w.group.name=name;w.group.position.fromArray(position);w.group.rotation.y=yaw;parent.add(w.group);walls.push(w);return w;
 }
 // Original R3.12 has a fixed 4m-wide solid field. Rotations preserve its metre scale.
 wall('front-original-wall',[0,0,2],Math.PI,{x:.98,bottom:0,width:.98,height:2.10},groups.front);
 wall('rear-original-wall',[0,0,-2],0,null);
 wall('left-original-wall',[-2,0,0],Math.PI/2,null);
 wall('right-original-wall',[2,0,0],-Math.PI/2,{x:0,bottom:1.0,width:1.10,height:1.12});
 for(let i=0;i<15;i++){
  const z=-2.10+i*.30;
  wood('floor-plank-'+i,4.46,.12,.298,[0,-.06,z],[0,0,0],groups.interior,{sourceId:'floor-mother',grainOffset:[0,0,z],weathered:true});
  wood('roof-plank-'+i,4.50,.10,.300,[0,3.05,z],[0,0,0],groups.roof,{sourceId:'roof-mother',grainOffset:[0,0,z],weathered:true});
 }
 // Timber aperture returns and working leaf are built by the original timber generator.
 const dx=-.98,frontZ=2.31;
 for(const x of [dx-.49,dx+.49])wood('door-jamb-'+x,2.13,.080,.11,[x,1.065,frontZ],[0,0,Math.PI/2],groups.front);
 wood('door-lintel',1.08,.09,.11,[dx,2.10,frontZ],[0,0,0],groups.front);
 groups.door.position.set(dx-.44,0,frontZ+.02);
 for(let i=0;i<8;i++)wood('door-leaf-'+i,2.035,.108,.045,[.054+i*.108,1.025,0],[0,0,Math.PI/2],groups.door,{sourceId:'door-leaf-mother',grainOffset:[0,i*.108,0]});
 for(const y of [.25,1.72])wood('door-back-brace-'+y,.82,.07,.035,[.43,y,-.04],[0,0,0],groups.door);
 const windowFrame=new THREE.Group();windowFrame.position.set(2.32,0,0);windowFrame.rotation.y=-Math.PI/2;groups.walls.add(windowFrame);
 for(const x of [-.565,.565])wood('window-jamb-'+x,1.23,.065,.1,[x,1.56,0],[0,0,Math.PI/2],windowFrame);
 for(const y of [.99,2.13])wood('window-rail-'+y,1.19,.065,.1,[0,y,0],[0,0,0],windowFrame);
 // Simple wooden furnishings use the same source geometry/material with real dimensions.
 wood('table-top',.98,.065,.60,[.87,.76,.87]);
 for(const x of [.47,1.27])for(const z of [.64,1.10])wood('table-leg-'+x+'-'+z,.72,.055,.055,[x,.36,z],[0,0,Math.PI/2]);
 wood('shelf',1.1,.055,.26,[.6,1.65,-1.68]);
 const bx=-.96,bz=-.65;
 for(const x of [bx-.45,bx+.45])wood('bed-long-'+x,1.96,.07,.06,[x,.36,bz],[0,Math.PI/2,0]);
 for(const z of [bz-.95,bz+.95])wood('bed-end-'+z,.96,.07,.06,[bx,.36,z]);
 for(const x of [bx-.42,bx+.42])for(const z of [bz-.88,bz+.88])wood('bed-leg-'+x+'-'+z,.38,.055,.055,[x,.19,z],[0,0,Math.PI/2]);
 for(let i=0;i<8;i++)wood('bed-slat-'+i,.86,.035,.15,[bx,.415,bz-.84+i*.24]);
 const graph={nodes:[{id:'common-corridor',position:[dx,.01,2.8]},{id:'entry',position:[dx,.01,1.4]},{id:'inside',position:[0,.01,.1]}],edges:[{from:'common-corridor',to:'entry',width:.90,height:2.04,enabled:doorOpen},{from:'entry',to:'inside',width:.80,height:2.4,enabled:true}]};
 const proof={status:'inspection-in-progress',completeDwellingDelivery:false,recipe,originalWoodShader:true,originalWallField:true,imageTextures:0,importedMeshes:0,wallCount:walls.length,timberCount:timbers.length,sourceLightingPreserved:true,hostDynamicLightingIntegrated:false,legacyWallBindingRetained:recipe.wallBindingMode==='legacy',existingSources:['Library timber v3','Brick Mother R3.12'],omissions:['No approved hanging garment; original solver hanging trials failed','No mature no-image metal/cage bound yet','No mattress or substitute new cloth','External shared kitchen/toilet endpoints not connected','SDF wall physics collision/shadow-depth integration pending'],graph,doorOpen,cutaway,worldSeconds:0,declaredConservativeLocalBounds:{min:[-2.4,-.13,-2.4],max:[2.4,3.2,2.4]},boundsMeaning:'Conservative union of original SDF domains and generated timber; SDF proxies are not mesh surface bounds',sources:{wall:walls.map(w=>w.proof),wood:timbers.map(t=>t.proof)}};
 function setDoorOpen(value){doorOpen=!!value;groups.door.rotation.y=doorOpen?Math.PI/2:0;graph.edges[0].enabled=doorOpen;proof.doorOpen=doorOpen;return doorOpen}
 function setInspectionCutaway(value){cutaway=!!value;groups.roof.visible=!cutaway;groups.front.visible=!cutaway;groups.door.visible=!cutaway;proof.cutaway=cutaway}
 function update(seconds){if(!Number.isFinite(seconds))throw Error('Existing authoritative world time required');proof.worldSeconds=seconds;return seconds}
 function measure(){let triangles=0,geometryBytes=0,meshDrawCalls=0;root.traverse(o=>{if(!o.isMesh)return;meshDrawCalls++;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3*(g.instanceCount??1);for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;if(g.index)geometryBytes+=g.index.array.byteLength});return{triangles,geometryBytes,meshDrawCalls,meaning:'Proxy triangles exclude SDF tracing cost; no FPS implication'}}
 setDoorOpen(doorOpen);root.updateMatrixWorld(true);
 return{root,groups,proof,recipe,graph,measure,setDoorOpen,setInspectionCutaway,update,inspectionTarget:[0,1.35,0],dispose(){if(disposed)return;for(const w of walls)w.dispose();for(const t of timbers)t.dispose();root.removeFromParent();disposed=true;}};
}
