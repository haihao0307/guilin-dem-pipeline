import * as T from 'three';
import {buildSolid} from './solid-textiles.mjs';
import {layerLayout} from './material-settings.mjs';
import {sewnTrims} from './screen-trims.mjs';
import {LeatherKernel,DEFAULT} from './native/leather-r13.mjs';
const tiles=new Map(),leathers=new Map(),loader=new T.TextureLoader();
async function field(info,renderer){
 const key=JSON.stringify([info.id,info.settings]);
 if(info.family==='leather'){
  if(!leathers.has(key)){const k=new LeatherKernel(renderer),m=k.bake({...DEFAULT,...info.parameters,resolution:1024});leathers.set(key,{kernel:k,material:m});}
  return {material:leathers.get(key).material,period:info.parameters.tileMM||96};
 }
 if(!tiles.has(info.id))tiles.set(info.id,(async()=>{const root=new URL('./runtime-tiles/'+info.id,import.meta.url).href;const meta=await(await fetch(root+'.json')).json(),maps={};await Promise.all(['outer','inner'].map(async side=>{maps[side]=await Promise.all(['color','normal'].map(async(type)=>{const tex=await loader.loadAsync(root+'-'+side+'-'+type+'.png');tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=type==='color'?T.SRGBColorSpace:T.NoColorSpace;tex.anisotropy=4;return tex;}));}));return {meta,maps};})().catch(e=>{tiles.delete(info.id);throw e;}));
 return tiles.get(info.id);
}
/** Finite-thickness curved garment surface for unresolved yarns, not an extra backing. Native closed yarns replace it in microscope mode. */
export async function buildAdaptiveSolid(native,packet,info,{renderer,signal,onProgress}={}){
 const started=performance.now(),fieldData=await field(info,renderer),layout=layerLayout(info),src=native.geometry,n=src.attributes.position.count,group=new T.Group(),materials=[],geometries=[],surfaces=[];
 const stats={family:info.family,material:info.id,representation:'screen-scale finite shell / original yarn microscope',layers:1,totalThicknessMM:layout.thickness,originalVertices:n,opaqueBackingSheets:0,aggregateSurfaces:1,separateClothLayers:false,externalAppearanceImages:0,notPixelEquivalentToMicroscope:true,physicsChanged:false};
 const uv=src.attributes.uv.array,normalScale=info.family==='knit'?.42:.34;
 for(let side=0;side<2;side++){
  const g=new T.BufferGeometry(),p=new Float32Array(n*3),norm=p.slice(),coords=new Float32Array(n*2),indices=Array.from(src.index.array);
  if(side)for(let f=0;f<indices.length;f+=3)[indices[f+1],indices[f+2]]=[indices[f+2],indices[f+1]];
  const period=info.family==='leather'?[fieldData.period,fieldData.period]:fieldData.meta.tileMM,ratio=info.family==='knit'?info.settings.gauge/(fieldData.meta.tileMM[0]/16):1;
  for(let i=0;i<n;i++){coords[i*2]=uv[i*2]*1000/(period[0]*ratio);coords[i*2+1]=uv[i*2+1]*1000/(period[1]*ratio);}
  g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('normal',new T.BufferAttribute(norm,3));g.setAttribute('uv',new T.BufferAttribute(coords,2));g.setIndex(indices);
  let mat;if(info.family==='leather'){mat=fieldData.material.clone();if(side){mat.clearcoat=0;mat.roughness=.92;mat.color.multiplyScalar(.88);}}
  else{const [map,normalMap]=fieldData.maps[side?'inner':'outer'];mat=new T.MeshPhysicalMaterial({map,normalMap,normalScale:new T.Vector2(normalScale,normalScale),roughness:info.family==='knit'?.86:.82,sheen:info.family==='knit'?.62:.30,sheenRoughness:.92,sheenColor:new T.Color(info.parameters['base-dye']||info.geometry?.warpDye||'#aaaabb'),envMapIntensity:.6});}
  mat.side=T.FrontSide;const mesh=new T.Mesh(g,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);materials.push(mat);geometries.push(g);surfaces.push({mesh,p,norm,side});
 }
 const rimBase=[],rimFrac=[],rimIndex=[];let off=0;
 for(const panel of packet.spec.panels){const B=panel.boundary;for(let k=0;k<B.length;k++){const a=off+B[k],b=off+B[(k+1)%B.length],base=rimBase.length;for(let j=0;j<5;j++){rimBase.push(a,b);rimFrac.push(j/4,j/4);if(j<4){const c=base+j*2;rimIndex.push(c,c+1,c+2,c+1,c+3,c+2);}}}off+=panel.uvMm.length;}
 const rg=new T.BufferGeometry(),rp=new Float32Array(rimBase.length*3);rg.setAttribute('position',new T.BufferAttribute(rp,3));rg.setIndex(rimIndex);const rm=new T.MeshStandardMaterial({color:info.parameters.color||info.parameters['base-dye']||info.geometry?.warpDye||'#575552',roughness:.9,side:T.DoubleSide});const rim=new T.Mesh(rg,rm);rim.castShadow=rim.receiveShadow=true;rim.frustumCulled=false;group.add(rim);geometries.push(rg);materials.push(rm);
 const trims=sewnTrims(native,packet,info);group.add(trims.group);Object.assign(stats,trims.stats);let micro=null,microPromise=null,active=false,moving=false,disposed=false,revision=0,detailGeneration=0;
 function deform(){const pos=src.attributes.position.array,N=src.attributes.normal.array;for(const s of surfaces){const offset=(s.side?.35:layout.thickness)*.001;for(let i=0;i<pos.length;i++){s.p[i]=pos[i]+N[i]*offset;s.norm[i]=N[i]*(s.side?-1:1);}s.mesh.geometry.attributes.position.needsUpdate=s.mesh.geometry.attributes.normal.needsUpdate=true;}
  for(let i=0;i<rimBase.length;i++){const k=rimBase[i]*3,f=rimFrac[i],d=(.35+(layout.thickness-.35)*f)*.001;for(let j=0;j<3;j++)rp[i*3+j]=pos[k+j]+N[k+j]*d;}
  rg.attributes.position.needsUpdate=true;rg.computeVertexNormals();trims.update();if(active&&micro)micro.deform();revision++;
 }
 async function detail(on=true){const generation=++detailGeneration;if(!on){active=false;if(micro)micro.group.visible=false;for(const s of surfaces)s.mesh.visible=true;rim.visible=trims.group.visible=true;return;}
  if(!microPromise)microPromise=buildSolid(native,packet,info,{renderer,signal,onProgress}).then(x=>{if(disposed){x.dispose();return null;}micro=x;micro.group.visible=false;group.add(micro.group);return x;}).catch(e=>{microPromise=null;throw e;});
  await microPromise;if(disposed||!micro||generation!==detailGeneration)return;active=true;for(const s of surfaces)s.mesh.visible=false;rim.visible=trims.group.visible=false;micro.group.visible=true;micro.deform();
 }
 deform();stats.buildMS=performance.now()-started;
 return {group,stats,deform,motion(on){moving=on;micro?.motion(on);},update(camera){if(active&&micro){micro.update(camera);stats.submittedYarnTriangles=micro.stats.submittedYarnTriangles;stats.lod='native microscope';}else{stats.submittedYarnTriangles=0;stats.lod='mip-filtered finite surface';}stats.detailResident=!!micro;stats.displayMoving=moving;},detail,plain(on){for(const m of materials){m.userData.originalMap??=m.map;if(m.map||m.userData.originalMap)m.map=on?null:m.userData.originalMap;m.needsUpdate=true;}trims.plain(on);micro?.plain(on);},wire(on){materials.forEach(m=>m.wireframe=on);micro?.wire(on);},resources(){return{materials:materials.length,meshes:group.children.length,detailResident:!!micro,aggregateTriangles:src.index.count/3*2+rimIndex.length/3,deformationRevision:revision};},dispose(){disposed=true;detailGeneration++;micro?.dispose();trims.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
