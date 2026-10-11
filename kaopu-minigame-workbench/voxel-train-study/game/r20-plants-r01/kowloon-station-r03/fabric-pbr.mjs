/** Chain the original actual function, then consume the very same vertex state
 * used by geometry. No cloned material or disconnected weather overlay. */
export function bindFabricPBR(material,role,proof){const original=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);material.defaultAttributeValues={...material.defaultAttributeValues,fabricState:[0,0,0,0],fabricDetail:[0,0]};material.customProgramCacheKey=()=>key()+'/station-fabric-r03/'+role;
material.onBeforeCompile=function(shader,renderer){original.call(this,shader,renderer);proof.chainedOriginalCalls++;shader.vertexShader='attribute vec4 fabricState;attribute vec2 fabricDetail;varying vec4 vFabricState;varying vec2 vFabricDetail;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFabricState=fabricState;vFabricDetail=fabricDetail;');shader.fragmentShader='varying vec4 vFabricState;varying vec2 vFabricDetail;\n'+shader.fragmentShader;
const metal=/iron|metal|brass|copper|enamel/.test(role);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`
float kfWet=clamp(vFabricState.x,0.,1.),kfDamage=clamp(vFabricState.y,0.,1.),kfPolish=clamp(vFabricState.z,0.,1.),kfRepair=clamp(vFabricState.w,0.,1.),kfOxide=clamp(vFabricDetail.x,0.,1.);
diffuseColor.rgb*=1.-.20*kfWet-.055*kfDamage;
${metal?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.115,.055,.022),kfOxide*.76);':''}
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.075,kfRepair*.40);
roughnessFactor=clamp(roughnessFactor+.07*kfDamage+.23*kfOxide-.32*kfPolish-.18*kfWet,.24,.99);
${metal?'metalnessFactor=clamp(metalnessFactor*(1.-.75*kfOxide)+.20*kfPolish,0.,.8);':''}
#include <lights_physical_fragment>`);proof.fabricCompileCalls++;};return material;}
