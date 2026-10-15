import * as THREE from './three.module.js';
import {BUNDLES,bundleOf} from './BundlePlan.mjs';
import {nativeFrame,localOffsets} from './GuideExchange.mjs';
import {point} from './NativeSurface.mjs';
import {unit,add,sub,mul,cross,len} from './approved/LegacyFoundation.mjs';
// Every translucent strip is generated ONLY from its guide's complete path.
// There is no cap, closed shell, face reclassification or independent fringe.
export function createShape(surface,state,bindings){
 const group=new THREE.Group();group.name='F08-root-bundles';group.matrixAutoUpdate=false;
 const parts=[],materials=[],geometries=[];let selected='all',colored=true,showRoots=true,showRibbons=true,xray=false,alpha=.18,version=-1;
 const colorOf=id=>BUNDLES.find(b=>b.id===id)?.color||'#a6cec4';
 for(const g of bindings){
  const curve=state.curves.find(c=>c.rootId===g.rootId),id=curve.bundleId||'generic',spec=BUNDLES.find(b=>b.id===id),N=curve.points.length/3;
  const linePositions=[],ribbonPositions=[],uv=[],index=[],p=curve.points;
  for(let j=0;j<N;j++){
   const v=p.slice(j*3,j*3+3);
   if(j)linePositions.push(...surface.toNative(p.slice((j-1)*3,j*3)),...surface.toNative(v));
   // Width is an inspection proxy, not a follicle radius or final hair asset.
   const before=p.slice(Math.max(0,j-1)*3,Math.max(0,j-1)*3+3),after=p.slice(Math.min(N-1,j+1)*3,Math.min(N-1,j+1)*3+3),t=unit(sub(after,before)),radial=unit([v[0],.018,v[2]-.008]);let side=cross(t,radial);if(len(side)<1e-7)side=[1,0,0];side=unit(side);
   const u=j/(N-1),width=(spec?.kind==='fringe'?.0019:spec?.layer==='outer'?.0050:.0037)*Math.min(1,.18+u/.05)*Math.pow(Math.max(0,1-u),.35)*(1+.16*Math.sin(g.rootId*2.1));
   ribbonPositions.push(...surface.toNative(add(v,mul(side,-width))),...surface.toNative(add(v,mul(side,width))));uv.push(0,u,1,u);if(j){const a=j*2;index.push(a-2,a,a-1,a-1,a,a+1);}
  }
  const frame=nativeFrame(surface.referenceHead,g.binding.triangle,g.binding.barycentric),make=(positions,type)=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometries.push(geometry);const m=type==='line'?new THREE.LineBasicMaterial({color:colorOf(id),transparent:true,opacity:.94,depthWrite:false}):new THREE.MeshBasicMaterial({color:colorOf(id),transparent:true,opacity:alpha,depthWrite:false,side:THREE.DoubleSide});materials.push(m);const object=type==='line'?new THREE.LineSegments(geometry,m):new THREE.Mesh(geometry,m);object.frustumCulled=false;object.userData.bundleId=id;object.userData.rootId=g.rootId;object.name='F08-'+id+'-'+g.rootId+'-'+type;if(type!=='line'){geometry.setIndex(index);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}group.add(object);return{object,geometry,offsets:localOffsets(positions,frame),binding:g.binding,type,id};};
  parts.push(make(linePositions,'line'),make(ribbonPositions,'ribbon'));
 }
 const rootParts=[];
 for(const spec of BUNDLES){
  const roots=surface.roots.filter(r=>r.active&&bundleOf(r,state.recipe)===spec.id),geo=new THREE.BufferGeometry(),array=new Float32Array(roots.length*3);geo.setAttribute('position',new THREE.BufferAttribute(array,3));const material=new THREE.PointsMaterial({color:spec.color,size:.0011,sizeAttenuation:true,transparent:true,opacity:.65,depthWrite:false});const object=new THREE.Points(geo,material);object.frustumCulled=false;object.name='F08-scalp-root-patch-'+spec.id;group.add(object);rootParts.push({roots,geo,array,material,object,id:spec.id});geometries.push(geo);materials.push(material);
 }
 const tips=new THREE.BufferGeometry(),tipArray=new Float32Array(bindings.length*3);tips.setAttribute('position',new THREE.BufferAttribute(tipArray,3));const tipColors=[];for(const g of bindings){const c=new THREE.Color(colorOf(g.bundleId));tipColors.push(c.r,c.g,c.b);}tips.setAttribute('color',new THREE.Float32BufferAttribute(tipColors,3));const tipMaterial=new THREE.PointsMaterial({size:.0021,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.95,depthWrite:false}),tipObject=new THREE.Points(tips,tipMaterial);tipObject.frustumCulled=false;tipObject.name='F08-individual-tip-endpoints';group.add(tipObject);geometries.push(tips);materials.push(tipMaterial);
 function refresh(){for(const p of parts){p.object.visible=(selected==='all'||p.id===selected)&&(p.type!=='ribbon'||showRibbons);p.object.material.color.set(colored?colorOf(p.id):'#b0d8d0');p.object.material.depthTest=!xray;if(p.type==='ribbon')p.object.material.opacity=alpha;}for(const p of rootParts){p.object.visible=showRoots&&(selected==='all'||p.id===selected);p.material.depthTest=!xray;p.material.color.set(colored?colorOf(p.id):'#c4e1d1');}tipMaterial.depthTest=!xray;}
 function mode(colors=true,id='all'){colored=colors;selected=id;version=-1;refresh();}
 function display(options={}){if('roots'in options)showRoots=!!options.roots;if('ribbons'in options)showRibbons=!!options.ribbons;if('xray'in options)xray=!!options.xray;if('opacity'in options){if(!Number.isFinite(options.opacity)||options.opacity<.03||options.opacity>.5)throw Error('透明度范围 0.03–0.5');alpha=options.opacity;}refresh();}
 function update(head,mesh,positionVersion){
  group.matrix.copy(mesh.matrix);group.matrixWorld.copy(mesh.matrixWorld);if(version===positionVersion)return;version=positionVersion;
  for(const p of parts){const f=nativeFrame(head,p.binding.triangle,p.binding.barycentric),a=p.offsets,out=p.geometry.attributes.position.array;for(let j=0;j<a.length;j+=3)for(let k=0;k<3;k++)out[j+k]=f.origin[k]+f.t[k]*a[j]+f.b[k]*a[j+1]+f.n[k]*a[j+2];p.geometry.attributes.position.needsUpdate=true;}
  for(const p of rootParts){let i=0;for(const r of p.roots){const f=nativeFrame(head,r.f,r.b);p.array.set(add(f.origin,mul(f.n,.00065)),i);i+=3;}p.geo.attributes.position.needsUpdate=true;}
  let i=0;for(const g of bindings){const f=nativeFrame(head,g.binding.triangle,g.binding.barycentric),a=g.localOffsets,j=a.length-3;tipArray.set(selected==='all'||g.bundleId===selected?[0,1,2].map(k=>f.origin[k]+f.t[k]*a[j]+f.b[k]*a[j+1]+f.n[k]*a[j+2]):[100,100,100],i);i+=3;}tips.attributes.position.needsUpdate=true;
 }
 refresh();return{group,update,mode,display,diagnostics:()=>({mode:'continuous root-owned guides and translucent path-derived ribbons',closedShell:false,groups:BUNDLES.map(b=>b.id),guides:bindings.length,ribbons:bindings.length,rootSamples:rootParts.reduce((n,p)=>n+p.roots.length,0),colored,selected,showRoots,showRibbons,opacity:alpha,xray,outline:'deterministic per-root length and outward accents, continuous from fixed root',physics:false}),dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
