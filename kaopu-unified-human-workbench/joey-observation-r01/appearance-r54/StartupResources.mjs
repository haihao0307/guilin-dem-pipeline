// Bounded, local-only resource descriptors. Counts are not a measurement of GPU RAM.
export function snapshotStartupResources(viewer){
 const r=viewer?.renderer,c=r?.domElement,gl=r?.getContext?.(),buffers=new Set(),textures=new Set(),geometries=new Set(),materials=new Set(),shadows=[];
 let geometryArrayBytes=0,textureArrayBytes=0;
 viewer?.scene?.traverse(o=>{
  const g=o.geometry;if(g&&!geometries.has(g)){geometries.add(g);for(const a of [...Object.values(g.attributes||{}),g.index].filter(Boolean)){const b=a.array?.buffer;if(b&&!buffers.has(b)){buffers.add(b);geometryArrayBytes+=b.byteLength;}}}
  for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){
   if(materials.has(m))continue;materials.add(m);
   for(const t of Object.values(m)){if(!t?.isTexture||textures.has(t))continue;textures.add(t);const b=t.image?.data?.buffer;if(b&&!buffers.has(b)){buffers.add(b);textureArrayBytes+=b.byteLength;}}
  }
  if(o.isLight&&o.shadow)shadows.push({name:o.name||o.type,width:o.shadow.mapSize?.x,height:o.shadow.mapSize?.y,allocated:!!o.shadow.map,castShadow:!!o.castShadow});
 });
 const parameter=k=>{try{return gl&&!gl.isContextLost()?gl.getParameter(k):null;}catch{return null;}};
 return {canvas:c?{width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight}:null,devicePixelRatio:globalThis.devicePixelRatio??null,rendererPixelRatio:r?.getPixelRatio?.(),contextLost:gl?.isContextLost?.()??null,maxTextureSize:gl?parameter(gl.MAX_TEXTURE_SIZE):null,maxRenderbufferSize:gl?parameter(gl.MAX_RENDERBUFFER_SIZE):null,rendererMemory:{...r?.info?.memory},programs:r?.info?.programs?.length??null,lastRender:{...r?.info?.render},scene:{geometries:geometries.size,materials:materials.size,directTextureProperties:textures.size,uniqueGeometryArrayBytes:geometryArrayBytes,uniqueDirectTextureArrayBytes:textureArrayBytes},shadows,heap:globalThis.performance?.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null,limits:'CPU arrays/direct texture properties and Three counters only; not total process/GPU memory. A returned render call does not prove GPU completion.'};
}
