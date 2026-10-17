/** Physical R05 road receivers. Coarse fracture shape is actual mesh displacement;
 * sub-grid cracks/aggregate remain filtered residual normal relief. Units: metres. */
import {normalizeRoadOptions,roadPotential,roadDamage,sampleRoadField,ROAD_PROVENANCE} from './road-field.mjs';
import {makeRoadMaterial} from './road-material.mjs';
export {sampleRoadField,ROAD_PROVENANCE};

function panelGeometry(T,state,z0,z1,thickness){
 const nx=Math.ceil(state.width/state.spacing),nz=Math.ceil((z1-z0)/state.spacing),positions=[],rest=[],face=[],macro=[],potentials=[],records=[],indices=[];
 const x0=-state.width/2,x1=state.width/2,top=state.topY,bottom=top-thickness;
 function vertex(x,y,z,f=1,moves=1){const n=positions.length/3;positions.push(x,y,z);rest.push(x,y,z);face.push(f);macro.push(0);potentials.push(moves?roadPotential(x,z,state):null);records.push({x,y,z,moves});return n}
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)vertex(x0+(x1-x0)*i/nx,top,z0+(z1-z0)*j/nz);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d)}
 // Separate edge vertices preserve real section normals instead of rounding the slab side into its top.
 function edge(points,reverse=false){for(let i=0;i<points.length-1;i++){const [ax,az]=points[i],[bx,bz]=points[i+1],a=vertex(ax,top,az,0),b=vertex(bx,top,bz,0),c=vertex(ax,bottom,az,0,0),d=vertex(bx,bottom,bz,0,0);if(reverse)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d)}}
 const xs=Array.from({length:nx+1},(_,i)=>x0+(x1-x0)*i/nx),zs=Array.from({length:nz+1},(_,i)=>z0+(z1-z0)*i/nz);
 edge(xs.map(x=>[x,z0]),true);edge(xs.map(x=>[x,z1]),false);edge(zs.map(z=>[x0,z]),false);edge(zs.map(z=>[x1,z]),true);
 const a=vertex(x0,bottom,z0,0,0),b=vertex(x1,bottom,z0,0,0),c=vertex(x0,bottom,z1,0,0),d=vertex(x1,bottom,z1,0,0);indices.push(a,b,c,b,d,c);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('roadRest',new T.Float32BufferAttribute(rest,3));g.setAttribute('roadFace',new T.Float32BufferAttribute(face,1));g.setAttribute('roadMacro',new T.Float32BufferAttribute(macro,1));g.setIndex(indices);
 g.userData={records,potentials,topVertices:(nx+1)*(nz+1),actualSpacing:[state.width/nx,(z1-z0)/nz],zRange:[z0,z1]};
 return g;
}
function applyGeometry(g,state){const a=g.attributes.position,macro=g.attributes.roadMacro,rest=g.attributes.roadRest;for(let i=0;i<a.count;i++){
 const r=g.userData.records[i],p=g.userData.potentials[i];if(!p)continue;const d=roadDamage(p,state);
 a.setY(i,r.y+d.macro);macro.setX(i,d.macro);
 // Section carries the physical top to its cut edge. Rest y follows actual section
 // height while top samples use the undeformed metric domain for stable wear patterns.
 rest.setY(i,g.attributes.roadFace.getX(i)>.5?r.y:r.y+d.macro);
 }a.needsUpdate=true;macro.needsUpdate=true;rest.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
function foundation(T,state,thickness){
 // Simple schematic granular support; main road section above carries the procedural aggregate.
 const g=new T.BoxGeometry(state.width+.035,.075,state.length+.035);
 const a=g.attributes.position,rest=[],face=[],macro=[];
 for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i)+state.topY-thickness-.0375,z=a.getZ(i);a.setY(i,y);rest.push(x,y,z);face.push(0);macro.push(0)}
 g.setAttribute('roadRest',new T.Float32BufferAttribute(rest,3));g.setAttribute('roadFace',new T.Float32BufferAttribute(face,1));g.setAttribute('roadMacro',new T.Float32BufferAttribute(macro,1));
 // Deliberately subdued foundation: own ordinary PBR, not a fake extra aging channel.
 const m=new T.MeshStandardMaterial({color:state.family==='concrete'?0x776f60:0x646256,roughness:.98});const mesh=new T.Mesh(g,m);mesh.name='Granular support section (schematic)';return mesh;
}
export function buildRoadCase(T,options={}){
 const state=normalizeRoadOptions(options),root=new T.Group(),geometries=[],materials=[],thickness=state.family==='concrete'?.18:.14,jointWidth=state.family==='concrete'?.020:0;
 root.name=`R05 ${state.family} ${state.variant===0?'baseline':'used'} receiver`;
 const material=options.material??makeRoadMaterial(T,state);if(!options.material)materials.push(material);
 const ranges=state.family==='concrete'?[[-state.length/2,-jointWidth/2],[jointWidth/2,state.length/2]]:[[-state.length/2,state.length/2]];
 for(let i=0;i<ranges.length;i++){const g=panelGeometry(T,state,...ranges[i],thickness);applyGeometry(g,state);geometries.push(g);const mesh=new T.Mesh(g,material);mesh.name=`${state.family} ${state.family==='concrete'?'slab '+(i+1):'wearing/base course'} with displaced surface and cut section`;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh)}
 const support=foundation(T,state,thickness);support.receiveShadow=true;support.castShadow=true;root.add(support);geometries.push(support.geometry);materials.push(support.material);
 if(jointWidth){
  // Real open separation between slab panels, filled below the top. These are joints, not cracks.
  const sealMat=new T.MeshStandardMaterial({color:0x282a27,roughness:.62}),fillerMat=new T.MeshStandardMaterial({color:0x494637,roughness:.94});materials.push(sealMat,fillerMat);
  const seal=new T.Mesh(new T.BoxGeometry(state.width,.013,jointWidth*.84),sealMat);seal.position.set(0,state.topY-.0175,0);seal.name='20 mm construction joint / recessed top seal';seal.receiveShadow=true;root.add(seal);geometries.push(seal.geometry);
  const filler=new T.Mesh(new T.BoxGeometry(state.width,.125,jointWidth*.95),fillerMat);filler.position.set(0,state.topY-.09,0);filler.name='Compressible filler / real slab separation';root.add(filler);geometries.push(filler.geometry);
 }
 const metadata={family:state.family,variant:state.variant,units:'metres',width:state.width,length:state.length,topY:state.topY,sectionBottom:state.topY-thickness-.075,slabThickness:thickness,jointWidth,nominalMeshSpacing:state.spacing,actualMeshSpacing:geometries.filter(g=>g.userData.actualSpacing).map(g=>g.userData.actualSpacing),provenance:ROAD_PROVENANCE,
  limits:['Illustrative procedural fracture/aggregate study; no structural fracture, traffic-life, surveyed historic layout or material calibration claim.','Actual mesh resolves the broad crack/erosion channel and sectional silhouette; apertures and aggregate below grid spacing remain residual normal relief, not open geometry or individual stones.','Concrete construction separation is real geometry; procedural fracture depressions do not split the slab into independent pieces.','Current wetness is optical only. No fluid, puddle depth, absorption transport or structural damage simulation.','No browser visual acceptance is implied by native numerical or shader tests.'],
  modes:{0:'final',1:'coarse height',2:'roughness',3:'fracture / edge erosion / repair',4:'aggregate exposure / marking / binder-paste',5:'shading normal'}};
 let disposed=false;
 function update(next={}){
  if(disposed)return;
  // Structural/domain changes need an explicit rebuild to preserve coordinate and shader agreement.
  for(const key of ['family','width','length','spacing','seed','topY'])if(next[key]!==undefined&&next[key]!==state[key])throw new Error(`Road ${key} is structural; rebuild buildRoadCase instead of update.`);
  const previousWear=state.wear,previousRepair=state.repair,previousVariant=state.variant;
  const input={...state,...next};if(next.wet!==undefined&&next.wetness===undefined)input.wetness=next.wet;
  Object.assign(state,normalizeRoadOptions(input));
  if(previousWear!==state.wear||previousRepair!==state.repair||previousVariant!==state.variant)for(const g of geometries)if(g.userData.potentials)applyGeometry(g,state);
  material.userData.update?.();metadata.variant=state.variant;return root;
 }
 function dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 Object.assign(root.userData,{state,metadata,update,dispose,audit:()=>auditRoadCase(root),sample:(x,z)=>sampleRoadField(x,z,state),material});
 return root;
}
export function auditRoadCase(group){
 const state=group.userData.state,meshes=[];let vertices=0,triangles=0,invalid=0,minY=Infinity,maxY=-Infinity,macroMin=Infinity,macroMax=-Infinity;
 group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position;vertices+=p.count;triangles+=(g.index?g.index.count:p.count)/3;for(let i=0;i<p.count;i++){const y=p.getY(i);if(!Number.isFinite(p.getX(i)+y+p.getZ(i)))invalid++;minY=Math.min(minY,y+o.position.y);maxY=Math.max(maxY,y+o.position.y)}const m=g.attributes.roadMacro;if(g.userData.potentials)for(let i=0;i<m.count;i++){macroMin=Math.min(macroMin,m.getX(i));macroMax=Math.max(macroMax,m.getX(i));}meshes.push({name:o.name,vertices:p.count,triangles:(g.index?g.index.count:p.count)/3})});
 return {family:state.family,variant:state.variant,vertices,triangles,invalid,minY,maxY,macroRange:[macroMin,macroMax],meshes,state:{...state},limits:group.userData.metadata.limits,visualAcceptance:false};
}
