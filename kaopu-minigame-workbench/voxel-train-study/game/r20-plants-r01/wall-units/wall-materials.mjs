// Reuses the host's KST1 material functions, adding a unit-local metre frame.
// Geometry is already evaluated in whole-wall local coordinates before render.
export const WALL_MATERIAL_REVISION='KST1-wall-local-1';
export const REQUIRED_HOST_MATERIAL_REVISION='KST1-surfaces-2';
const copyValue=v=>v?.clone?v.clone():Array.isArray(v)?v.slice():v;
const requireReplace=(s,a,b)=>{if(!s.includes(a))throw Error('Unsupported KST1 wall shader hook: '+a);return s.replace(a,b);};
export function createWallMaterials(library,score,recipes) {
  if(typeof library?.get!=='function')throw TypeError('Host KST1 material library is required');
  const map=new Map(),owned=[];
  try { for(const [key,recipe] of Object.entries(recipes)) {
    const base=library.get(recipe.family,recipe.options),street=base.userData?.street;
    if(!street?.textureFree||!street.uniforms||street.revision!==REQUIRED_HOST_MATERIAL_REVISION||typeof base.onBeforeCompile!=='function'||Object.values(base).some(v=>v?.isTexture))throw Error('Wall requires texture-free native KST1-surfaces-2 material');
    const m=base.clone(),uniforms=Object.fromEntries(Object.entries(street.uniforms).map(([k,u])=>[k,{value:copyValue(u.value)}]));
    uniforms.wallOpeningX={value:score.opening.x};uniforms.wallRainExposure={value:score.material.rainExposure};
    uniforms.wallDrainage={value:score.material.drainage};uniforms.wallGroundContact={value:score.material.groundContact?1:0};
    m.vertexColors=true;m.name='native-wall/'+key;
    m.userData={street:{...street,config:JSON.parse(JSON.stringify(street.config)),uniforms},wall:{coordinateSpace:'whole-unit-local-metres',revision:WALL_MATERIAL_REVISION,sourceRevision:street.revision,textureFree:true}};
    m.customProgramCacheKey=()=>WALL_MATERIAL_REVISION+'/'+base.customProgramCacheKey();
    m.onBeforeCompile=shader=>{
      base.onBeforeCompile(shader);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vWallLocalPosition;\nvarying vec3 vWallLocalNormal;\n'+shader.vertexShader;
      shader.vertexShader=requireReplace(shader.vertexShader,'#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvWallLocalNormal=objectNormal;');
      shader.vertexShader=requireReplace(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nvWallLocalPosition=transformed;');
      shader.fragmentShader='varying vec3 vWallLocalPosition;\nvarying vec3 vWallLocalNormal;\nuniform float wallOpeningX,wallRainExposure,wallDrainage,wallGroundContact;\n'+shader.fragmentShader;
      shader.fragmentShader=requireReplace(shader.fragmentShader,'vStreetPosition-stWorldOffset-stOrigin','vWallLocalPosition');
      shader.fragmentShader=requireReplace(shader.fragmentShader,'abs(normalize(vStreetNormal))','abs(normalize(vWallLocalNormal))');
      shader.fragmentShader=requireReplace(shader.fragmentShader,'float stBelowLedge=','stRising*=wallGroundContact;\nfloat stBelowLedge=');
      shader.fragmentShader=requireReplace(shader.fragmentShader,'(stUV.x+stGrid.z*.5)','(stUV.x-wallOpeningX+stGrid.z*.5)');
      shader.fragmentShader=requireReplace(shader.fragmentShader,'float stDamp=','stStreak*=wallRainExposure*(1.0-.5*wallDrainage);\nstReturn*=wallRainExposure;\nfloat stDamp=');
    };
    owned.push(m);map.set(key,m);
  }} catch(error) { for(const m of owned)m.dispose();throw error; }
  return{get:key=>{if(!map.has(key))throw Error('Unknown wall material '+key);return map.get(key);},materials:owned,
    update(time,wetness){if(!Number.isFinite(time)||!Number.isFinite(wetness)||wetness<0||wetness>1)throw Error('Invalid wall host clock/weather');for(const m of owned){m.userData.street.uniforms.stTime.value=time;m.userData.street.uniforms.stWetness.value=wetness;}},
    dispose(){for(const m of owned)m.dispose();owned.length=0;map.clear();}};
}
