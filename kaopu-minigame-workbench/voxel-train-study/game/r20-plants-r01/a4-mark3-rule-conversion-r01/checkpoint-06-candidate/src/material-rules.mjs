/* Shared glTF core PBR function interpreter. See README for exact scope. */
export const VERSION = "kaopu.shared-material-functions/1";
export const SCHEMA = {"pbr_surface":[["name",null,null],["pbrMetallicRoughness",null,"pbr_metallic_roughness"],["alphaMode","OPAQUE",null],["alphaCutoff",0.5,null],["doubleSided",false,null],["normalTexture",null,"normal_binding"],["occlusionTexture",null,"occlusion_binding"],["emissiveTexture",null,"texture_binding"],["emissiveFactor",[0,0,0],null]],"pbr_metallic_roughness":[["baseColorFactor",[1,1,1,1],null],["metallicFactor",1,null],["roughnessFactor",1,null],["baseColorTexture",null,"texture_binding"],["metallicRoughnessTexture",null,"texture_binding"]],"texture_binding":[["index",null,null],["texCoord",0,null],["extensions",null,"binding_extensions"]],"normal_binding":[["index",null,null],["texCoord",0,null],["scale",1,null],["extensions",null,"binding_extensions"]],"occlusion_binding":[["index",null,null],["texCoord",0,null],["strength",1,null],["extensions",null,"binding_extensions"]],"binding_extensions":[["KHR_texture_transform",null,"uv_transform"]],"uv_transform":[["offset",[0,0],null],["rotation",0,null],["scale",[1,1],null],["texCoord",null,null]],"texture_source":[["source",null,null],["sampler",null,null],["name",null,null]],"sampler_state":[["magFilter",null,null],["minFilter",null,null],["wrapS",10497,null],["wrapT",10497,null],["name",null,null]],"image_definition":[["uri",null,null],["mimeType",null,null],["bufferView",null,null],["name",null,null]]};
const clone=x=>structuredClone(x);
export function restoreMaterialBundle(bundle){
  if(bundle.schema!==VERSION)throw Error('Unsupported material schema');
  const calls=bundle.calls,memo=new Map(),active=new Set();
  function evaluate(ref){
    if(memo.has(ref))return clone(memo.get(ref));
    if(!Number.isInteger(ref)||ref<0||ref>=calls.length)throw Error('Invalid call reference');
    if(active.has(ref))throw Error('Cyclic material function graph');
    active.add(ref);const call=calls[ref],schema=SCHEMA[call.fn];
    if(!schema)throw Error('Unsupported material function '+call.fn);
    const p=call.present;
    if(!Number.isInteger(p)||p<0||p>=(1<<schema.length))throw Error('Invalid presence mask');
    let ai=0;const out={};
    for(let i=0;i<schema.length;i++)if(p&(1<<i)){
      if(ai>=call.args.length)throw Error('Missing function argument');
      const [key,,nested]=schema[i],v=call.args[ai++];out[key]=nested?evaluate(v):clone(v);
    }
    if(ai!==call.args.length)throw Error('Extra function argument');
    for(const [k,v] of Object.entries(call.uninterpretedResidual??{})){
      if(Object.hasOwn(out,k))throw Error('Residual overrides recognized parameter');
      Object.defineProperty(out,k,{value:clone(v),writable:true,enumerable:true,configurable:true});
    }
    active.delete(ref);memo.set(ref,out);return clone(out);
  }
  return Object.fromEntries(Object.entries(bundle.roots).map(([k,refs])=>[k,refs.map(evaluate)]));
}
