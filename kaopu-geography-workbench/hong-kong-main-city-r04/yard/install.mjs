import {buildYard,makeRenderRoutes,checkBuildingClearance,serializableYard} from './tinhau-yard.mjs';
function joinTrackGeometry(THREE,meshes){
 const names=['position','normal','color'],sizes={position:3,normal:3,color:3},total=meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0);
 const arrays=Object.fromEntries(names.map(n=>[n,new Float32Array(total*sizes[n])]));const indices=[];let offset=0;
 for(const m of meshes){const g=m.geometry,n=g.attributes.position.count;for(const name of names){const a=g.attributes[name];if(!a||a.itemSize!==sizes[name])throw Error('Reusable track attribute mismatch '+name);arrays[name].set(a.array,offset*sizes[name]);}if(g.index)for(const ix of g.index.array)indices.push(ix+offset);else for(let i=0;i<n;i++)indices.push(i+offset);offset+=n;}
 const out=new THREE.BufferGeometry();for(const name of names)out.setAttribute(name,new THREE.BufferAttribute(arrays[name],sizes[name]));out.setIndex(indices);out.computeBoundingSphere();return out;
}
function makePlatforms(THREE,yard){
 // Display cache of the authored platform ribbon; no terrain or rail offsets.
 const positions=[],normals=[],indices=[];const top=.85,bottom=-.3;
 function triangle(a,b,c){const n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a))).normalize(),base=positions.length/3;positions.push(...a,...b,...c);normals.push(n.x,n.y,n.z,n.x,n.y,n.z,n.x,n.y,n.z);indices.push(base,base+1,base+2);}
 const raised=(p,d)=>[p[0],p[1]+d,p[2]];
 for(const platform of yard.platforms){const v=platform.worldPolygon,n=v.length/2;if(!Number.isInteger(n))throw Error('Platform boundaries must pair');for(let i=0;i<n-1;i++){const a=raised(v[i],top),b=raised(v[i+1],top),c=raised(v[v.length-2-i],top),d=raised(v[v.length-1-i],top);triangle(a,c,b);triangle(a,d,c);}for(let i=0;i<v.length;i++){const j=(i+1)%v.length,a=raised(v[i],top),b=raised(v[j],top),c=raised(v[j],bottom),d=raised(v[i],bottom);triangle(a,b,c);triangle(a,c,d);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#968b71',roughness:.95,side:THREE.DoubleSide}));
}
export async function installTinhauYard(game,{boundsURL=new URL('../route/current-building-bounds.json',import.meta.url),parametersURL=new URL('./parameters.json',import.meta.url),groundURL=new URL('./current-scene-ground-review.json',import.meta.url)}={}){
 if(!game.attachRouteScene)throw Error('R04 shared scene adapter unavailable');const response=await fetch(boundsURL),paramsResponse=await fetch(parametersURL);if(!response.ok||!paramsResponse.ok)throw Error('Yard geometry evidence unavailable');const groundResponse=await fetch(groundURL);if(!groundResponse.ok)throw Error('Yard current-ground evidence unavailable');const [{models},parameters,groundEvidence]=await Promise.all([response.json(),paramsResponse.json(),groundResponse.json()]);
 const center=game.route.stops.find(s=>s.id==='second');if(!center)throw Error('New route has no registered Tin Hau station');const yard=buildYard({centerS:center.d,sampleRoute:game.route.sample,sourceRouteLengthM:game.route.length,parameters,geographicRegistration:game.route.metadata?.registration||null});
 if(!yard.validation.ok)throw Error('Registered yard failed: '+yard.validation.errors.join(', '));
 const obstacles=models.map(m=>{const[x,z,X,Z]=m.boundsLocalXZ;return{id:m.objectId,polygon:[[x,z],[X,z],[X,Z],[x,Z]]};});const clearance=checkBuildingClearance(yard,{obstacles,coverageComplete:false});
 // A broadphase hit blocks the proposed yard until reviewed, never deletes a building.
 if(clearance.hits.length)throw Error('Registered yard needs building-conflict review: '+[...new Set(clearance.hits.map(h=>h.buildingId))].join(', '));
 const actualRailTop=game.route.sample(center.d).p[1];if(Math.abs(actualRailTop-groundEvidence.groundDesign.railTopM)>1e-7)throw Error('Yard design ground evidence does not match rail spectrum');
 const groundProbes=groundEvidence.browserProbes.map(p=>({...p,sceneHeightM:window.HKMap?.sampleHeight(p.x,p.z)??null}));const measured=groundProbes.filter(p=>Number.isFinite(p.sceneHeightM));const maxProbeErrorM=measured.length?Math.max(...measured.map(p=>Math.abs(p.sceneHeightM-p.h))):null;if(measured.length&&maxProbeErrorM>1e-5)throw Error('Current scene differs from station ground design evidence');
 const groundDesign={...groundEvidence.groundDesign,groundDistribution:groundEvidence.summary.all570x60,nativeDTMEvidence:groundEvidence.nativeDTMEvidence,probes:groundProbes,sceneProbeCount:measured.length,maxProbeErrorM,evidenceURL:groundURL.href};
 let renderStats;
 game.attachRouteScene(({THREE,scene,track,makeTrack,requestFrame})=>{
  const routes=makeRenderRoutes(yard),roots=routes.map(makeTrack),beds=roots.map(r=>r.children[0]),ties=roots.map(r=>r.children[1]);
  if(beds.some(m=>!m?.isMesh)||ties.some(m=>!m?.isInstancedMesh))throw Error('Frozen makeTrack scene shape changed');
  const root=new THREE.Group();root.name='Tin Hau authored 5-track yard; shared route profile';
  const bedGeometry=joinTrackGeometry(THREE,beds);root.add(new THREE.Mesh(bedGeometry,track.children[0].material));
  const tieCount=ties.reduce((n,m)=>n+m.count,0),instances=new THREE.InstancedMesh(track.children[1].geometry,track.children[1].material,tieCount),matrix=new THREE.Matrix4();let k=0;for(const m of ties)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);instances.setMatrixAt(k++,matrix);}instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();root.add(instances);root.add(makePlatforms(THREE,yard));scene.add(root);
  for(const r of roots)for(const m of r.children){m.geometry.dispose();m.material.dispose();}
  renderStats={drawObjects:root.children.length,reusedFrozenMakeTrack:true,uniqueSideEdges:routes.length,centralTrackDuplicated:false,ties:tieCount,railBedTriangles:bedGeometry.index.count/3,platformHeightAboveRailM:.85,platformBearingBelowRailM:.3,canopyRendered:false,sideTrackDrivingEnabled:false};
  window.HKTinhauYard={ready:true,yard,clearance,stats:()=>({ready:true,centerS:center.d,counts:yard.validation.counts,validation:yard.validation,clearance,render:renderStats,groundDesign,routeIsMainDriveRoute:game.route===window.HKRailVertical.route}),exportScore:()=>serializableYard(yard),setVisible(v){root.visible=!!v;requestFrame();}};
 });
 return window.HKTinhauYard;
}
