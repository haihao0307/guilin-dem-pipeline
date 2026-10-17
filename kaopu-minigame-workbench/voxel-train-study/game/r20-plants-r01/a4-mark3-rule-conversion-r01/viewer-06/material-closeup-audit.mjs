import * as T from 'three';
import {applyAcceptanceCamera} from '../../a4-a6-source-comparison-r03/src/orthographic-acceptance.mjs';
// Diagnostic camera crops only: full scenes, original transforms, lights and environment remain intact.
export async function captureMaterialCloseups(q){
 const width=1000,height=700,worldUnitsPerPixel=.004;
 const cases=[
  {id:'a4-wheel-metal',key:'a4',mesh:57,primitive:0,view:'side'},
  {id:'a4-body-paint',key:'a4',mesh:18,primitive:0,view:'side'},
  {id:'mark3-roof-paint',key:'mark3',mesh:7,primitive:0,view:'top'},
  {id:'mark3-window-glass',key:'mark3',mesh:8,primitive:0,view:'side'},
  {id:'a4-wheel-metal-micro',key:'a4',mesh:57,primitive:0,view:'side',scale:.0005,patch:'bottom-rim'},
  {id:'a4-body-paint-micro',key:'a4',mesh:18,primitive:0,view:'side',scale:.0005,patch:'body-offset'}
 ];
 const result={sourceUnits:'UNCALIBRATED',cameraOnlyCrop:true,worldUnitsPerPixel,width,height,materialVersion:q.materialVersion,cases:[]};
 const find=(p,c)=>{let found; p.source.root.traverse(o=>{const a=p.source.model.parser.associations.get(o);if(o.isMesh&&a?.meshes===c.mesh&&a.primitives===c.primitive)found=o;});if(!found)throw Error('CLOSEUP_PRIMITIVE_MISSING '+c.id);return found;};
 const bounds=o=>{const b=new T.Box3(),v=new T.Vector3(),p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));return b;};
 const material=m=>({name:m.name,color:m.color?.toArray(),metalness:m.metalness,roughness:m.roughness,clearcoat:m.clearcoat,opacity:m.opacity,transparent:m.transparent,alphaTest:m.alphaTest,side:m.side,transmission:m.transmission});
 try{
 for(const c of cases){
  const pair=['original','converted'].map(s=>q.panels.find(p=>p.id===c.key+'-'+s));
  if(pair.some(p=>!p))throw Error('CLOSEUP_PAIR_MISSING');
  const original=find(pair[0],c),converted=find(pair[1],c),b=bounds(original),center=b.getCenter(new T.Vector3());
  if(c.patch==='bottom-rim')center.y=b.min.y+.04;
  if(c.patch==='body-offset'){center.z+=.5;center.y+=.2;}
  const camera=new T.OrthographicCamera();applyAcceptanceCamera(T,camera,{view:c.view,center,worldUnitsPerPixel:c.scale||worldUnitsPerPixel,width,height});
  const entry={...c,center:center.toArray(),sourceBounds:{min:b.min.toArray(),max:b.max.toArray()},camera:camera.userData.acceptance,originalMaterial:material(original.material),candidateMaterial:material(converted.material),images:{}};
  for(const p of pair){
   const before=p.source.root.matrixWorld.elements.slice();
   q.renderer.setRenderTarget(null);q.renderer.setScissorTest(false);q.renderer.setSize(width,height,false);q.renderer.setViewport(0,0,width,height);q.renderer.clear();q.renderer.render(p.scene,camera);q.renderer.getContext().finish();
   if(q.renderer.getContext().isContextLost())throw Error('CLOSEUP_CONTEXT_LOST');
   if(!before.every((x,i)=>x===p.source.root.matrixWorld.elements[i]))throw Error('CLOSEUP_MODEL_MOVED');
   entry.images[p.id.endsWith('original')?'original':'candidate']=q.renderer.domElement.toDataURL('image/png');
  }
  result.cases.push(entry);
 }
 }finally{q.render();}
 return result;
}
