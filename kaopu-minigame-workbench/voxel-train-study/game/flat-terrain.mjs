import * as THREE from '../vendor/three.module.js';
import {Blocks,PALETTE} from './heritage.mjs';

// The legacy source interval is reused as ordinary scenery, never as a bent path.
export const FLAT_WORLD=Object.freeze({
  sourceStart:-18,period:72+2*Math.PI*3.8,centerX:-8,chunkCount:8,slotCount:7,
  detailRadius:68,terrainRadius:224,groundHalfSize:1800,
  fogNear:45,fogFar:105,cameraNear:.08,cameraFar:320,maxOrbitDistance:65
});
export function flatFrame(x,elevation=0,z=0){return{position:[x,elevation,z],tangent:[1,0,0],normal:[0,1,0]};}
export function stationOffset(target,distance){return target-distance;}
export function flatActor(actor,distance,frontX=5){
  if(actor.frame!=='world')return actor;
  return{...actor,frame:'train',position:[actor.position[0]-distance+frontX,actor.position[1],actor.position[2]]};
}
const modulo=(x,n)=>((x%n)+n)%n;
// A slot is recycled only after its WHOLE original interval is at least 3 periods
// behind the train. Its new interval is also outside every supported camera's fog.
export function terrainSlots(distance,spec=FLAT_WORLD){
  const {period,sourceStart,centerX,slotCount}=spec,half=Math.floor(slotCount/2);
  const centerTile=Math.floor((distance-centerX-sourceStart)/period);
  return Array.from({length:slotCount},(_,slot)=>{
    const tile=centerTile+modulo(slot-centerTile+half,slotCount)-half;
    const offset=centerX+tile*period-distance;
    return{slot,tile,offset,min:sourceStart+offset,max:sourceStart+period+offset};
  });
}
export function chunkBounds(index,spec=FLAT_WORLD){const width=spec.period/spec.chunkCount,min=spec.sourceStart+index*width;return{min,max:min+width};}
export function chunkDetail(min,max,spec=FLAT_WORLD){return max>=spec.centerX-spec.detailRadius&&min<=spec.centerX+spec.detailRadius;}

function makeGeometry(bucket){const g=new THREE.BufferGeometry();for(const [key,values]of [['position',bucket.p],['normal',bucket.n],['color',bucket.c]])g.setAttribute(key,new THREE.Float32BufferAttribute(values,3));g.setIndex(bucket.i);g.computeBoundingSphere();return g;}
// Copy every retained source vertex without resampling, displacement or deformation.
// The former dark underside lies below the continuous ground and is not rendered.
export function splitFlatGround(source,spec=FLAT_WORLD){
  const p=source.attributes.position,n=source.attributes.normal,c=source.attributes.color,indices=source.index.array;
  const buckets=Array.from({length:spec.chunkCount},()=>({p:[],n:[],c:[],i:[],lookup:new Map()}));let kept=0,removed=0,maxPositionDeviation=0;
  for(let t=0;t<indices.length;t+=3){const ids=[indices[t],indices[t+1],indices[t+2]],maxY=Math.max(...ids.map(i=>p.getY(i)));if(maxY<.083){removed++;continue;}
    const x=ids.reduce((s,i)=>s+p.getX(i),0)/3,k=Math.max(0,Math.min(spec.chunkCount-1,Math.floor((x-spec.sourceStart)/spec.period*spec.chunkCount))),bucket=buckets[k];
    for(const id of ids){let mapped=bucket.lookup.get(id);if(mapped===undefined){mapped=bucket.p.length/3;bucket.lookup.set(id,mapped);bucket.p.push(p.getX(id),p.getY(id),p.getZ(id));bucket.n.push(n.getX(id),n.getY(id),n.getZ(id));bucket.c.push(c.getX(id),c.getY(id),c.getZ(id));}bucket.i.push(mapped);}kept++;
  }
  const geometries=buckets.map(makeGeometry);
  for(let k=0;k<buckets.length;k++)for(const [id,mapped]of buckets[k].lookup){const out=geometries[k].attributes.position;maxPositionDeviation=Math.max(maxPositionDeviation,Math.abs(out.getX(mapped)-p.getX(id)),Math.abs(out.getY(mapped)-p.getY(id)),Math.abs(out.getZ(mapped)-p.getZ(id)));}
  return{geometries,proof:{retainedGroundTriangles:kept,buriedTrianglesOmitted:removed,sourceVertexDeviation:maxPositionDeviation}};
}
function farTrackChunk(index,spec){
  const b=new Blocks(),{min,max}=chunkBounds(index,spec),start=spec.sourceStart,end=start+spec.period;
  for(let x=start;x<end;x+=.64){if(x<min||x>=max)continue;b.box(x,.184,0,.23,.16,2.33,0x514839);for(const z of [-.76,.76])b.box(x,.277,z,.28,.03,.29,0x423e36);}
  for(let x=start;x<end;x+=1.07){if(x<min||x>=max)continue;b.box(x,.56,-3.01,.11,1.12,.11,0xc3c6b2);b.box(x,.99,-3.01,.17,.08,.17,0xd8d9c7);b.box(x+.53,.72,-3.01,1.06,.09,.076,0xc9cbb8);b.box(x+.53,.32,-3.01,1.06,.08,.075,0xb4b7a7);}
  return b.geometry();
}
function sceneryGeometry(spec){
  const b=new Blocks(),start=spec.sourceStart,L=spec.period;
  // Shallow field bands join the original close grass rather than a raised island.
  for(const side of [-1,1])for(let row=0;row<6;row++){
    const z=side<0?-8-row*7:12+row*7,width=6.1;
    for(let j=0;j<8;j++){const span=L/8,x=start+(j+.5)*span,seed=(j*7+row*11+(side+1)*3)%9;
      b.surfaceBox(x,.087,z,span-.12,.008,width,[0x526330,0x566633,0x596b35,0x50602f][seed%4],n=>n[1]>.9);
      for(let line=0;line<4;line++)b.surfaceBox(x,.095,z-width/2+.8+line*1.25,span-.35,.016,.065,seed%2?0x657738:0x465a2d,n=>n[1]>.9);
    }
  }
  // Narrow farm lanes and irregular low hedges stay out of station access space.
  for(const z of [-20,24]){b.surfaceBox(start+L/2,.092,z,L,.016,.85,0x8b8754,n=>n[1]>.9);for(let j=0;j<12;j++)b.box(start+(j+.5)*L/12,.22,z+1.25,L/12-.7,.27,.52,j%3?0x526332:0x61743a);}
  return b.geometry();
}
function proxyGeometry(kind=0){
  const b=new Blocks();if(kind===2){for(const [x,y,z,w,h,d,c]of [[0,.48,0,2.5,.73,1.05,0x536530],[-.8,.42,.05,1.0,.62,.94,0x667736],[.65,.56,-.05,1.1,.81,.96,0x445a2b]])b.box(x,y,z,w,h,d,c);}
  else{b.box(0,1.16,0,.17,2.32,.18,0x56472a);for(const [x,y,z,w,h,d,c]of [[0,2.8,0,1.55,1.9,1.2,0x475627],[-.45,2.17,.03,.8,1.17,.96,0x5e6d2e],[.45,2.36,-.06,.9,1.3,.91,0x354321],[0,3.53,0,.88,.67,.85,0x718137]])b.box(x,y,z,w,h,d,c);}
  return b.geometry();
}
export function createFlatTerrain(parts,spec=FLAT_WORLD){
  const root=new THREE.Group();root.name='Continuous flat railway and preserved near-field terrain';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.04});
  const {geometries,proof}=splitFlatGround(parts.ground,spec);
  root.userData.proof={...parts.proof,...proof,flat:true,period:spec.period,terrainRadius:spec.terrainRadius,detailRadius:spec.detailRadius,groundHalfSize:spec.groundHalfSize,recycleOutsideDistance:3*spec.period,blackUndersideRendered:false};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(spec.groundHalfSize*2,spec.groundHalfSize*2),new THREE.MeshStandardMaterial({color:PALETTE.grass,roughness:.99,metalness:0}));ground.rotation.x=-Math.PI/2;ground.position.y=.081;ground.receiveShadow=true;ground.name='Broad continuous earth, no exposed strip edge';root.add(ground);
  const base=new Blocks(),length=spec.terrainRadius*2+40;
  base.box(spec.centerX,.1297,0,length,.10,3.02,0xaba995);
  for(const z of [-.76,.76]){base.box(spec.centerX,.2447,z,length,.155,.13,0x625e53);base.box(spec.centerX,.3307,z,length,.035,.15,0x9d9a88);}
  const railway=new THREE.Mesh(base.geometry(),material);railway.receiveShadow=true;railway.name='Unbroken straight ballast and rails';root.add(railway);
  const high=geometries.map((geometry,index)=>Array.from({length:spec.slotCount},(_,slot)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name=`Original close detail ${index}:${slot}`;root.add(mesh);return mesh;}));
  const low=geometries.map((_,index)=>{const mesh=new THREE.InstancedMesh(farTrackChunk(index,spec),material,spec.slotCount);mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name=`Distant sleepers and fence ${index}`;root.add(mesh);return mesh;});
  const fields=new THREE.InstancedMesh(sceneryGeometry(spec),material,spec.slotCount);fields.receiveShadow=true;fields.frustumCulled=false;fields.name='Fields extending on both sides of railway';root.add(fields);
  const flora=parts.plants.map((plant,index)=>({...plant,meshes:Array.from({length:spec.slotCount},(_,slot)=>{const mesh=new THREE.Mesh(plant.geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name=`Preserved original tree or shrub ${index}:${slot}`;root.add(mesh);return mesh;})}));
  const proxyTrees=new THREE.InstancedMesh(proxyGeometry(),material,160),proxyShrubs=new THREE.InstancedMesh(proxyGeometry(2),material,60);for(const mesh of [proxyTrees,proxyShrubs]){mesh.frustumCulled=false;mesh.receiveShadow=true;root.add(mesh);}
  proxyTrees.name='Distant low-detail field trees';proxyShrubs.name='Distant low-detail shrubs';
  const pose=new THREE.Object3D();
  function matrix(x,y=0,z=0,sx=1,sy=sx,sz=sx){pose.position.set(x,y,z);pose.scale.set(sx,sy,sz);pose.updateMatrix();return pose.matrix;}
  function update(distance){
    const slots=terrainSlots(distance,spec);let fieldCount=0,treeCount=0,shrubCount=0,highTriangles=0,lowTriangles=0;
    for(let index=0;index<spec.chunkCount;index++){
      const bounds=chunkBounds(index,spec);let count=0;
      for(const slot of slots){const min=bounds.min+slot.offset,max=bounds.max+slot.offset,active=max>=spec.centerX-spec.terrainRadius&&min<=spec.centerX+spec.terrainRadius,detail=active&&chunkDetail(min,max,spec),mesh=high[index][slot.slot];mesh.position.x=slot.offset;mesh.visible=detail;
        if(detail)highTriangles+=mesh.geometry.index.count/3;
        if(active&&!detail){low[index].setMatrixAt(count++,matrix(slot.offset));lowTriangles+=low[index].geometry.index.count/3;}
      }
      low[index].count=count;low[index].instanceMatrix.needsUpdate=true;
    }
    for(const slot of slots){
      if(slot.max>=spec.centerX-spec.terrainRadius&&slot.min<=spec.centerX+spec.terrainRadius){fields.setMatrixAt(fieldCount++,matrix(slot.offset));
        // A few broad silhouettes supply depth without duplicating dense voxel trees.
        for(let i=0;i<16;i++){const x=spec.sourceStart+(i+.5)*spec.period/16+slot.offset,z=i%2?16+(i%4)*9:-12-(i%5)*8,scale=.66+(i*7%9)*.11;if(Math.abs(x-spec.centerX)>spec.terrainRadius)continue;proxyTrees.setMatrixAt(treeCount++,matrix(x,.08,z,scale,scale*(i%3===0?1.2:1),scale));}
      }
      for(const plant of flora){const x=plant.x+slot.offset,active=Math.abs(x-spec.centerX)<spec.terrainRadius,detail=active&&Math.abs(x-spec.centerX)<=spec.detailRadius+2,mesh=plant.meshes[slot.slot];mesh.position.set(x,0,plant.z);mesh.visible=detail;
        if(detail)highTriangles+=mesh.geometry.index.count/3;
        else if(active){const shrub=plant.count>0&&plant.z>6&&plant.x!==11.75&&Math.abs(((plant.x-11.75)% (spec.period/2)))>.01;if(shrub)proxyShrubs.setMatrixAt(shrubCount++,matrix(x,0,plant.z));else{const tall=plant.z<0&&Math.abs(((plant.x-7.15)%(spec.period/2)))<.01,scale=tall?1.6:plant.z>0?1.0:.8;proxyTrees.setMatrixAt(treeCount++,matrix(x,0,plant.z,scale,scale,scale));}}
      }
    }
    fields.count=fieldCount;fields.instanceMatrix.needsUpdate=true;proxyTrees.count=treeCount;proxyTrees.instanceMatrix.needsUpdate=true;proxyShrubs.count=shrubCount;proxyShrubs.instanceMatrix.needsUpdate=true;
    root.userData.coverage={min:Math.min(...slots.map(s=>s.min)),max:Math.max(...slots.map(s=>s.max)),detailMin:spec.centerX-spec.detailRadius,detailMax:spec.centerX+spec.detailRadius,groundHalfSize:spec.groundHalfSize};
    root.userData.proof.activeHighTriangles=highTriangles;root.userData.proof.activeLowTriangles=lowTriangles+fieldCount*fields.geometry.index.count/3+treeCount*proxyTrees.geometry.index.count/3+shrubCount*proxyShrubs.geometry.index.count/3;
  }
  update(0);parts.ground.dispose();parts.interior.dispose();
  return{root,update};
}
