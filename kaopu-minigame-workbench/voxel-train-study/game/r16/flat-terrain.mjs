import * as THREE from '../../vendor/three.module.js';
import {Blocks,PALETTE} from './heritage.mjs';

// The legacy source interval is reused as ordinary scenery, never as a bent path.
export const FLAT_WORLD=Object.freeze({
  sourceStart:-18,period:72+2*Math.PI*3.8,centerX:-8,chunkCount:8,slotCount:7,
  detailRadius:68,terrainRadius:224,groundHalfSize:1800,platformFoliageOffset:12,
  fogNear:45,fogFar:105,cameraNear:.08,cameraFar:320,maxOrbitDistance:65
});
export function flatFrame(x,elevation=0,z=0){return{position:[x,elevation,z],tangent:[1,0,0],normal:[0,1,0]};}
export function stationOffset(target,distance){return target-distance;}
// Keep the platform-to-train sightline clear; source foliage meshes remain intact.
export function floraPlacementZ(sourceZ,spec=FLAT_WORLD){return sourceZ>0?sourceZ+spec.platformFoliageOffset:sourceZ;}
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
// Seven horizontal samples of the actual original crown retain its tapered,
// lobed outline. Eight-sided bands replace tens of thousands of tiny leaf faces.
export function lowPolyPlantGeometry(source,{trunk=true,levels=7,sides=8}={}){
  const p=source.attributes.position,c=source.attributes.color,leaves=[];
  for(let i=0;i<p.count;i++)if(c.getY(i)>c.getX(i)*1.02&&c.getY(i)>c.getZ(i)*1.15)leaves.push({x:p.getX(i),y:p.getY(i),z:p.getZ(i),color:[c.getX(i),c.getY(i),c.getZ(i)]});
  if(!leaves.length)throw new Error('Original plant has no crown samples');
  let bottom=Infinity,top=-Infinity;for(const v of leaves){bottom=Math.min(bottom,v.y);top=Math.max(top,v.y);}
  const height=top-bottom,b=new Blocks(),rings=[],colors=[];
  if(trunk){const h=Math.max(.5,bottom+height*.23);b.box(0,h/2,0,.17,h,.18,0x56472a);}
  for(let level=0;level<levels;level++){
    const y=bottom+height*(level+.5)/levels,half=height/(levels*2)+.015,samples=leaves.filter(v=>Math.abs(v.y-y)<=half);
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const v of samples){minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minZ=Math.min(minZ,v.z);maxZ=Math.max(maxZ,v.z);}
    const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,rx=(maxX-minX)/2,rz=(maxZ-minZ)/2,ring=[];
    for(let side=0;side<sides;side++){const angle=2*Math.PI*side/sides;ring.push([cx+Math.cos(angle)*rx,y,cz+Math.sin(angle)*rz]);}
    rings.push(ring);colors.push(samples[(level*173+37)%samples.length].color);
  }
  function triangle(a,bp,cp,color){const ab=new THREE.Vector3().fromArray(bp).sub(new THREE.Vector3().fromArray(a)),ac=new THREE.Vector3().fromArray(cp).sub(new THREE.Vector3().fromArray(a)),normal=ab.cross(ac).normalize(),first=b.p.length/3;for(const point of [a,bp,cp]){b.p.push(...point);b.n.push(normal.x,normal.y,normal.z);b.c.push(...color);}b.i.push(first,first+1,first+2);}
  for(let level=0;level<levels-1;level++)for(let side=0;side<sides;side++){const next=(side+1)%sides,lo=rings[level],hi=rings[level+1],color=colors[(level+(side%3===0?1:0))%colors.length];triangle(lo[side],hi[side],hi[next],color);triangle(lo[side],hi[next],lo[next],color);}
  for(const [ring,y,isTop]of [[rings[0],bottom,false],[rings.at(-1),top,true]]){const center=[ring.reduce((n,p)=>n+p[0],0)/sides,y,ring.reduce((n,p)=>n+p[2],0)/sides];for(let side=0;side<sides;side++){const next=(side+1)%sides;if(isTop)triangle(center,ring[next],ring[side],colors.at(-1));else triangle(center,ring[side],ring[next],colors[0]);}}
  const geometry=b.geometry();geometry.userData={sourceDerivedCrown:true,crownLevels:levels,crownSides:sides,sourceLeafHeight:[bottom,top]};return geometry;
}
function fieldRandom(index,salt){let n=Math.imul(index+19,0x45d9f3b)^Math.imul(salt+3,0x27d4eb2d);n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;return(n>>>0)/4294967296;}
export function fieldTreePose(index,spec=FLAT_WORLD){
  const positive=index%2===1;
  return{x:spec.sourceStart+(index+.2+fieldRandom(index,1)*.6)*spec.period/16,z:positive?19+fieldRandom(index,2)*35:-12-fieldRandom(index,2)*38,variant:Math.floor(fieldRandom(index,3)*3),scale:.66+fieldRandom(index,4)*.45,yaw:fieldRandom(index,5)*Math.PI*2};
}
export function createFlatTerrain(parts,spec=FLAT_WORLD){
  const root=new THREE.Group();root.name='Continuous flat railway and preserved near-field terrain';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.04});
  const {geometries,proof}=splitFlatGround(parts.ground,spec);
  root.userData.proof={...parts.proof,...proof,flat:true,period:spec.period,terrainRadius:spec.terrainRadius,detailRadius:spec.detailRadius,groundHalfSize:spec.groundHalfSize,recycleOutsideDistance:3*spec.period,blackUndersideRendered:false,platformSideFloraShiftZ:spec.platformFoliageOffset};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(spec.groundHalfSize*2,spec.groundHalfSize*2),new THREE.MeshStandardMaterial({color:PALETTE.grass,roughness:.99,metalness:0}));ground.rotation.x=-Math.PI/2;ground.position.y=.081;ground.receiveShadow=true;ground.name='Broad continuous earth, no exposed strip edge';root.add(ground);
  const base=new Blocks(),length=spec.terrainRadius*2+40;
  base.box(spec.centerX,.1297,0,length,.10,3.02,0xaba995);
  for(const z of [-.76,.76]){base.box(spec.centerX,.2447,z,length,.155,.13,0x625e53);base.box(spec.centerX,.3307,z,length,.035,.15,0x9d9a88);}
  const railway=new THREE.Mesh(base.geometry(),material);railway.receiveShadow=true;railway.name='Unbroken straight ballast and rails';root.add(railway);
  const high=geometries.map((geometry,index)=>Array.from({length:spec.slotCount},(_,slot)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name=`Original close detail ${index}:${slot}`;root.add(mesh);return mesh;}));
  const low=geometries.map((_,index)=>{const mesh=new THREE.InstancedMesh(farTrackChunk(index,spec),material,spec.slotCount);mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name=`Distant sleepers and fence ${index}`;root.add(mesh);return mesh;});
  const fields=new THREE.InstancedMesh(sceneryGeometry(spec),material,spec.slotCount);fields.receiveShadow=true;fields.frustumCulled=false;fields.name='Fields extending on both sides of railway';root.add(fields);
  const flora=parts.plants.map((plant,index)=>({...plant,displayZ:floraPlacementZ(plant.z,spec),meshes:Array.from({length:spec.slotCount},(_,slot)=>{const mesh=new THREE.Mesh(plant.geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name=`Preserved original tree or shrub ${index}:${slot}`;root.add(mesh);return mesh;})}));
  const proxyTrees=parts.plants.slice(0,3).map((plant,index)=>{const mesh=new THREE.InstancedMesh(lowPolyPlantGeometry(plant.geometry),material,160);mesh.name=`Distant source-derived crown variant ${index+1}`;return mesh;}),proxyShrubs=new THREE.InstancedMesh(lowPolyPlantGeometry(parts.plants[3].geometry,{trunk:false,levels:5}),material,60);
  for(const mesh of [...proxyTrees,proxyShrubs]){mesh.frustumCulled=false;mesh.receiveShadow=true;root.add(mesh);}proxyShrubs.name='Distant source-derived low shrubs';
  root.userData.proof.farCrownVariants=proxyTrees.length;root.userData.proof.farCrownTriangles=proxyTrees.map(mesh=>mesh.geometry.index.count/3);
  const pose=new THREE.Object3D();
  function matrix(x,y=0,z=0,sx=1,sy=sx,sz=sx,yaw=0){pose.position.set(x,y,z);pose.scale.set(sx,sy,sz);pose.rotation.set(0,yaw,0);pose.updateMatrix();return pose.matrix;}
  function update(distance,exclusions=[]){
    const excluded=(x,z)=>exclusions.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ);
    const slots=terrainSlots(distance,spec);let fieldCount=0,treeCounts=[0,0,0],shrubCount=0,highTriangles=0,lowTriangles=0;
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
        // Seeded off-grid placement and original crown variants avoid a row of
        // identical sticks, while keeping motion and chunk recycling deterministic.
        for(let i=0;i<16;i++){const placement=fieldTreePose(i,spec),x=placement.x+slot.offset;if(Math.abs(x-spec.centerX)>spec.terrainRadius)continue;const {z,variant,scale,yaw}=placement;if(excluded(x,z))continue;proxyTrees[variant].setMatrixAt(treeCounts[variant]++,matrix(x,.08,z,scale,scale,scale,yaw));}
      }
      for(const plant of flora){const x=plant.x+slot.offset,active=Math.abs(x-spec.centerX)<spec.terrainRadius&&!excluded(x,plant.displayZ),detail=active&&Math.abs(x-spec.centerX)<=spec.detailRadius+2,mesh=plant.meshes[slot.slot];mesh.position.set(x,0,plant.displayZ);mesh.visible=detail;
        if(detail)highTriangles+=mesh.geometry.index.count/3;
        else if(active){const sourceVariant=flora.indexOf(plant)%4;if(sourceVariant===3)proxyShrubs.setMatrixAt(shrubCount++,matrix(x,0,plant.displayZ));else proxyTrees[sourceVariant].setMatrixAt(treeCounts[sourceVariant]++,matrix(x,0,plant.displayZ));}
      }
    }
    fields.count=fieldCount;fields.instanceMatrix.needsUpdate=true;for(let i=0;i<proxyTrees.length;i++){proxyTrees[i].count=treeCounts[i];proxyTrees[i].instanceMatrix.needsUpdate=true;}proxyShrubs.count=shrubCount;proxyShrubs.instanceMatrix.needsUpdate=true;
    root.userData.coverage={min:Math.min(...slots.map(s=>s.min)),max:Math.max(...slots.map(s=>s.max)),detailMin:spec.centerX-spec.detailRadius,detailMax:spec.centerX+spec.detailRadius,groundHalfSize:spec.groundHalfSize};
    root.userData.proof.activeHighTriangles=highTriangles;root.userData.proof.activeLowTriangles=lowTriangles+fieldCount*fields.geometry.index.count/3+proxyTrees.reduce((n,mesh,i)=>n+treeCounts[i]*mesh.geometry.index.count/3,0)+shrubCount*proxyShrubs.geometry.index.count/3;
  }
  update(0);parts.ground.dispose();parts.interior.dispose();
  return{root,update};
}
