import {makeNeighbourhoodRecipe,wallCells,wallRegions,reachable} from './plan.mjs';
import {createTimberMember} from './native/timber-adapter.mjs';
import {bindOriginalTrainMaterials} from './native/metal-original.mjs';
import {createBrickNativeCache,createBrickNativeBatch} from './brick-native/brick-native.mjs';
import {createMortarReceiver} from './brick-native/mortar-receiver.mjs';
const TUPLES=[312,77,909,1627,483,2003,551,88].map((seed,i)=>({seed,variant:i%4,variation:.82,materialFamily:0,rockType:0,spacing:.06}));
export function buildNeighbourhood({THREE,renderer,recipe=makeNeighbourhoodRecipe()}={}){
 if(!THREE?.Group||!renderer?.getContext)throw Error('Existing host THREE and renderer required');
 const root=new THREE.Group();root.name='城寨最小相邻住户组 · 材质与可达性候选';
 const cache=createBrickNativeCache({THREE,renderer,capacity:8}),entries=cache.prepareMany(TUPLES),resources=[],batches=[],groups=new Map(),doors=new Map(),geometries=new Set();
 const nativeMetal=bindOriginalTrainMaterials(THREE),metals=new Map(),mortars=new Map();
 const group=id=>{if(!groups.has(id)){const g=new THREE.Group();g.name=id;groups.set(id,g);root.add(g);}return groups.get(id);};
 const proof={recipeSchema:recipe.schema,brickTemplates:entries.map(e=>e.proof),sourceMaterialBindings:[],brickInstances:0,woodObjects:0,metalObjects:0,geometricDoorOpenings:true,doorCapShaders:false,placeholderMaterials:false,visualAcceptance:false,interactiveAcceptance:false,omissions:recipe.declaredOmissions};
 function wood(o,parent=group(o.group||'wood')){const [length,height,depth]=o.size;const made=createTimberMember(THREE,{id:o.id,seed:o.seed??recipe.seed,length,height,depth,position:o.position,rotation:o.rotation||[0,0,0],presetId:o.presetId||'yunnan_light_weathered_v2',tessellation:{lengthSegments:8,crossSegments:2,endSegments:2}});parent.add(made.mesh);resources.push(made);proof.woodObjects++;return made.mesh;}
 function mortar(key,color='#8b877c'){if(!mortars.has(key)){const r=createMortarReceiver({THREE,color,colorVariation:.18,micro:.0003});mortars.set(key,r);resources.push(r);}return mortars.get(key);}
 function box(id,size,position,receiver,parent){const g=new THREE.BoxGeometry(...size);geometries.add(g);const m=new THREE.Mesh(g,receiver.material);m.name=id;m.position.fromArray(position);m.onBeforeRender=(_r,_s,c)=>receiver.updateCamera(c);parent.add(m);return m;}
 const wallMortar=mortar('wall','#8a887c'),groundMortar=mortar('ground','#6c6c63');
 for(const w of recipe.walls){const parent=group(w.group),cells=wallCells(w,recipe.seed);for(let i=0;i<8;i++){const placements=cells.filter(c=>c.template===i);if(!placements.length)continue;const batch=createBrickNativeBatch({THREE,entry:entries[i],placements});parent.add(batch.mesh);batches.push(batch);proof.brickInstances+=placements.length;}
  for(const [i,r]of wallRegions(w).entries()){const width=r.u1-r.u0,height=r.y1-r.y0,mid=(r.u0+r.u1)/2;box(w.id+'-mortar-'+i,w.alongX?[width,height,.09]:[.09,height,width],w.alongX?[mid,(r.y0+r.y1)/2,w.fixed]:[w.fixed,(r.y0+r.y1)/2,mid],wallMortar,parent);}}
 for(const o of recipe.wood)wood(o);
 for(const f of recipe.floors){if(f.material==='existing-wood-step')continue;const parent=group(f.id.endsWith('-roof')?'roofs':'floors');if(f.material==='mortar')box(f.id,[f.x1-f.x0,f.thickness,f.z1-f.z0],[(f.x0+f.x1)/2,f.y-f.thickness/2,(f.z0+f.z1)/2],groundMortar,parent);else{const n=Math.max(1,Math.ceil((f.z1-f.z0)/.55));for(let i=0;i<n;i++){const dz=(f.z1-f.z0)/n;wood({id:f.id+'-plank'+i,size:[f.x1-f.x0,f.thickness,dz-.002],position:[(f.x0+f.x1)/2,f.y-f.thickness/2,f.z0+(i+.5)*dz],group:'floor'},parent);}}}
 for(const d of recipe.doors){const pivot=new THREE.Group();pivot.name='door/'+d.id;pivot.position.fromArray(d.hinge);group('doors').add(pivot);for(let j=0;j<4;j++)wood({id:d.id+'-board'+j,size:[d.height,d.width/4-.002,.038],position:[(j+.5)*d.width/4,d.height/2,0],rotation:[0,0,Math.PI/2],group:'doors'},pivot);doors.set(d.id,{pivot,record:d,open:d.open});}
 function metalMaterial(o){const k=o.role+o.color;if(!metals.has(k))metals.set(k,nativeMetal(o.role,o.color,1));return metals.get(k);}
 for(const o of recipe.metal){const mat=metalMaterial(o);let geo;
  if(o.kind==='pipe'){const curve=new THREE.CurvePath();for(let i=1;i<o.points.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(...o.points[i-1]),new THREE.Vector3(...o.points[i])));geo=new THREE.TubeGeometry(curve,Math.max(1,o.points.length-1)*6,o.radius,8,false);}
  else if(o.kind==='cylinder')geo=new THREE.CylinderGeometry(o.radius,o.radius,o.height,16,1,false);
  else if(o.kind==='bowl'){const r=o.radius,h=o.height;geo=new THREE.LatheGeometry([[r*.45,0],[r*.84,h*.16],[r,h],[r-.008,h],[r*.80,h*.20],[r*.43,.012]].map(([x,y])=>new THREE.Vector2(x,y)),20);}
  else throw Error('Unknown native parametric object '+o.kind);
  geometries.add(geo);const mesh=new THREE.Mesh(geo,mat);mesh.name=o.id;if(o.position)mesh.position.fromArray(o.position);group(o.group||'services').add(mesh);proof.metalObjects++;}
 function setDoor(id,open){const d=doors.get(id);if(!d)throw Error('Unknown door '+id);d.open=!!open;d.pivot.rotation.y=d.record.yaw+(d.open?(d.record.yaw===0?-Math.PI/2:Math.PI/2):0);d.pivot.updateMatrixWorld(true);}
 for(const d of recipe.doors)setDoor(d.id,d.open);
 function setCutaway(on){for(const id of ['A-walls','B-walls','C-walls']){const g=groups.get(id);if(g)g.visible=true;}group('roofs').visible=!on;root.userData.cutaway=!!on;for(const b of batches)b.mesh.visible=true;
  // Hide complete front-wall meshes as an inspection section, never pretend a wall opening was generated.
  for(const w of recipe.walls.filter(w=>w.side==='front')){const ids=new Set(wallCells(w,recipe.seed).map(c=>c.id));void ids;for(const obj of groups.get(w.group).children){if(obj.userData.wallId===w.id||obj.name.startsWith(w.id+'-mortar-'))obj.visible=!on;}}
 }
 // Bind exact wall ownership after construction so inspection visibility is reversible.
 let bi=0;for(const w of recipe.walls){const cells=wallCells(w,recipe.seed);for(let i=0;i<8;i++)if(cells.some(c=>c.template===i))batches[bi++].mesh.userData.wallId=w.id;}
 root.updateMatrixWorld(true);proof.sourceMaterialBindings={brick:'R3.12 original field at construction; original shadeBrick per fragment; sampled normal',mortar:'R3.12 original shadeSoil on new recipe geometry',wood:'Library v3 unchanged original shader/geometry functions',metal:'FH88 original material() closure, shader hook not replaced'};
 let disposed=false;return {root,recipe,proof,groups,doors,batches,cache,inspectionTarget:[0,2.2,-.1],setDoor,setCutaway,update(seconds){if(!Number.isFinite(seconds))throw Error('Finite shared world seconds required');root.userData.worldSeconds=seconds;},reachable(){return reachable(recipe,[...doors].filter(([,d])=>!d.open).map(([id])=>id));},metrics(){return {brickInstances:proof.brickInstances,brickTriangles:batches.reduce((n,b)=>n+b.proof.triangles,0),sourceTemplateCache:cache.stats,woodObjects:proof.woodObjects,metalObjects:proof.metalObjects,materials:[...metals.values()].length+mortars.size+batches.length+proof.woodObjects};},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const b of batches)b.dispose();for(const r of resources)r.dispose();for(const g of geometries)g.dispose();for(const m of metals.values())m.dispose();cache.dispose();}};
}
