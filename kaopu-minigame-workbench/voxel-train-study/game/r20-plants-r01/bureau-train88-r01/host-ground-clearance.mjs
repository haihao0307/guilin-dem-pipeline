// New-entry-only material clipping of the retained host's broad earth and field
// scenery inside the original bureau site. Geometry and all other parcels remain.
export function applyBureauGroundClearance(world,getView,getRoute,exclusion){
 if(world.root.userData.bureauGroundClearance)return world.root.userData.bureauGroundClearance;
 const names=new Set(['Broad continuous earth, no exposed strip edge','Fields extending on both sides of railway']);
 const plot={value:new Float32Array(4)},proof={method:'bounded fragment exclusion on two existing host ground/scenery materials',scope:'original bureau site only',geometryMutations:0,buildingsRemoved:0,targets:[],current:null};
 function update(){const box=exclusion(getView(),getRoute());plot.value.set([box.minX,box.maxX,box.minZ,box.maxZ]);proof.current={...box};}
 world.root.traverse(object=>{if(!names.has(object.name))return;if(Array.isArray(object.material)||!object.material?.clone)throw Error('Unsupported retained host ground material');const original=object.material,material=original.clone(),oldCompile=original.onBeforeCompile,oldKey=original.customProgramCacheKey?.bind(original);object.material=material;
  material.onBeforeCompile=function(shader,renderer){oldCompile?.call(this,shader,renderer);shader.uniforms.bureauPlotXZ=plot;
   shader.vertexShader='varying vec3 bureauGroundWorld;\n'+shader.vertexShader;
   const tag='#include <project_vertex>';if(!shader.vertexShader.includes(tag))throw Error('Host ground position stage changed');shader.vertexShader=shader.vertexShader.replace(tag,tag+`\nvec4 bureauPosition=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nbureauPosition=instanceMatrix*bureauPosition;\n#endif\nbureauGroundWorld=(modelMatrix*bureauPosition).xyz;`);
   shader.fragmentShader='varying vec3 bureauGroundWorld;uniform vec4 bureauPlotXZ;\n'+shader.fragmentShader;const frag='#include <clipping_planes_fragment>';if(!shader.fragmentShader.includes(frag))throw Error('Host ground fragment stage changed');shader.fragmentShader=shader.fragmentShader.replace(frag,frag+'\nif(bureauGroundWorld.x>bureauPlotXZ.x&&bureauGroundWorld.x<bureauPlotXZ.y&&bureauGroundWorld.z>bureauPlotXZ.z&&bureauGroundWorld.z<bureauPlotXZ.w)discard;');
  };material.customProgramCacheKey=()=>String(oldKey?.()||'')+'|bureau-site-ground-exclusion-v1';material.needsUpdate=true;
  const before=object.onBeforeRender;object.onBeforeRender=function(...args){update();before?.apply(this,args);};proof.targets.push(object.name);
 });
 if(proof.targets.length!==names.size)throw Error('Cannot prove bureau plot clear of original host earth/field scenery');update();world.root.userData.bureauGroundClearance=proof;return proof;
}
