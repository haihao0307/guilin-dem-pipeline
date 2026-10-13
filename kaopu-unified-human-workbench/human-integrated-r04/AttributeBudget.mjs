/** Reuse unused/duplicate channels without reducing mesh or shader precision.
 * CPU csType and eWeight stay authoritative. All subdivision is linear, so
 * packed type and ear-weight channels propagate identically through stencils. */
export function installAttributeBudget(model){
 const attach=model.faceSurface.attachSkin;
 model.faceSurface.attachSkin=skin=>{
  attach(skin);const g=skin.viewer.geometry,X=g.attributes.csExtra,T=g.attributes.csType,E=g.attributes.eWeight,V=g.attributes.eTissue;
  if(!X||!T||!E||!V||X.count!==T.count||E.count!==V.count)throw Error('Unified attribute packing requires the bound native fields');
  for(let i=0;i<T.count;i++){X.array[i*4+3]=T.array[i];V.array[i*4+2]=E.array[i];}
  X.needsUpdate=V.needsUpdate=true;
  const mat=skin.material,prior=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat);
  const exact=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Packed shader attribute contract changed: '+a);return s.replace(a,()=>b);};
  mat.onBeforeCompile=shader=>{prior(shader);let s=shader.vertexShader;
   s=exact(s,'attribute float csType;','');s=exact(s,'vCSType=csType;','vCSType=csExtra.w;');
   s=exact(s,'attribute float eWeight;','');s=exact(s,'vEWeight=eWeight;','vEWeight=eTissue.z;');
   shader.vertexShader=s;
  };
  mat.customProgramCacheKey=()=>key()+'/r03-lossless-type-ear-packed';mat.needsUpdate=true;
  skin.attributeBudget={savedAttributeSlots:2,precision:'Float32 retained',typeChannel:'csExtra.w (previously unused)',earChannel:'eTissue.z (same ear weight)',nativeCPUFieldsRetained:true,morphVertexIDBudgetPreserved:true};
 };
}
