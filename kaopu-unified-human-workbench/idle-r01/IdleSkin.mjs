/** Composes with ET18's EXISTING face/lip shader. No new pore noise or UV atlas.
 * Reduces stacked pore relief, widens dry-cheek reflection, preserves wet lips/eyes.
 * Expression-linked meso relief is a bounded approximation, not stress simulation.
 */
export function installIdleSkin(viewer,settings){
 const skin=viewer.skin,mat=skin.material,prior=mat.onBeforeCompile,key=mat.customProgramCacheKey.bind(mat);
 const U={uIdleSurface:{value:settings.surface?settings.surfaceGain:0},uIdleWrinkle:{value:settings.wrinkleGain},uIdleBlink:{value:0},uIdleSmile:{value:0}};
 const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('ET18 material anchor changed: '+a);return s.replace(a,()=>b);};
 const report={version:'IDLE-R01',compiled:0,addedTextureBytes:0,method:'composed roughness/clearcoat + filtered inherited pore bands + expression-linked meso contrast',stressSolver:false};
 mat.onBeforeCompile=shader=>{prior(shader);Object.assign(shader.uniforms,U);shader.fragmentShader='uniform float uIdleSurface,uIdleWrinkle,uIdleBlink,uIdleSmile;\n'+shader.fragmentShader;
  shader.fragmentShader=replace(shader.fragmentShader,'float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65);','float idleFoot=max(length(dFdx(vCSRest)),length(dFdy(vCSRest)))*1000.;float idleAA=1.-smoothstep(.16,.7,idleFoot);float csHeight=csSurface*csDetail*csCover*(1.-vFA.x*uFEnabled*.65)*mix(1.,mix(1.,.55*idleAA,vFA.x*uFEnabled),uIdleSurface);');
  shader.fragmentShader=replace(shader.fragmentShader,'h*=fMask*fHostDetail*(1.-lpMask);','h*=fMask*fHostDetail*(1.-lpMask)*mix(1.,.86+uIdleWrinkle*(.16*uIdleBlink*vFA.z+.28*uIdleSmile*vFB.y),uIdleSurface);');
  shader.fragmentShader=replace(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`float idleDrySkin=fMask*(1.-lpMask)*(1.-vFA.z*.65);roughnessFactor=clamp(roughnessFactor+uIdleSurface*idleDrySkin*(.045+.028*vFB.y-.033*vFA.w),.24,.93);
   #include <clearcoat_normal_fragment_maps>`);
  const anchor='material.clearcoatRoughness=mix(material.clearcoatRoughness,.43-lpMoist*uLWet*.20,lpMask);';
  shader.fragmentShader=replace(shader.fragmentShader,anchor,anchor+`\nmaterial.clearcoat*=1.-uIdleSurface*idleDrySkin*(.56-.28*vFA.w);material.clearcoatRoughness=clamp(material.clearcoatRoughness+uIdleSurface*idleDrySkin*.065,.20,.65);`);
  report.compiled++;
 };
 mat.customProgramCacheKey=()=>key()+'/IDLE-R01-surface';mat.needsUpdate=true;
 return{report,U,update(s,weights={}){U.uIdleSurface.value=s.surface?s.surfaceGain:0;U.uIdleWrinkle.value=s.wrinkleGain;U.uIdleBlink.value=(weights.blinkL||0)+(weights.blinkR||0);U.uIdleSmile.value=weights.smile||0;},dispose(){mat.onBeforeCompile=prior;mat.customProgramCacheKey=key;mat.needsUpdate=true;}};
}
