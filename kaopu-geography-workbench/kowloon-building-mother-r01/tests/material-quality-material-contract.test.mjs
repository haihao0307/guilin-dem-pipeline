import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {materialQualityOpticalContract,rendererDiagnosticContract} from '../material-quality-r01/renderer.mjs';
const file=path=>readFile(new URL(path,import.meta.url),'utf8');
const app=await file('../material-quality-r01/app.mjs'),renderer=await file('../material-quality-r01/renderer.mjs'),html=await file('../material-quality-r01.html');
const sourceContract=Object.freeze({model:'bounded_single_pane_two_interface_refraction',reflection:'sky_environment_approximation_not_scene_reflection',absorption:'Beer_Lambert_from_actual_internal_path_metres',caustics:false});
const spec=Object.freeze({fieldKind:'hosted-context',mode:'design',opticalContract:sourceContract});
test('current optical report describes actual display reflection without changing frozen source contract',()=>{
 const out=materialQualityOpticalContract(spec);assert.match(out.reflection,/one_actual_displayed_scene_reflection_ray/);assert.equal(out.absorption,sourceContract.absorption);assert.equal(out.caustics,false);
 assert.match(out.secondaryShading,/geometric_normal.*approximate.*no_microheight_normal/);assert.match(out.totalInternalReflection,/sky_only_approximation/);assert.match(out.reflectionWeight,/not_separate_internal_reflection_paths/);
 assert.equal(sourceContract.reflection,'sky_environment_approximation_not_scene_reflection');assert.notEqual(out,sourceContract);
 assert.equal(materialQualityOpticalContract(spec,{sceneReflection:0}).reflection,'authored_analytic_environment_only');
 assert.equal(materialQualityOpticalContract({fieldKind:'measured-surface'}),null);
});
test('diagnostics, renderer snapshot, primary snapshot and quality snapshot share current contract',()=>{
 assert.deepEqual(rendererDiagnosticContract(spec,0,0,{sceneReflection:0}).opticalModel,materialQualityOpticalContract(spec,{sceneReflection:0}));
 assert.match(renderer,/opticalModel:materialQualityOpticalContract\(this\.spec,this\.options\)/);
 assert.match(app,/opticalModel:renderer\.snapshot\(\)\.opticalModel/);assert.match(app,/optics:renderer\.snapshot\(\)\.opticalModel/);
 assert.doesNotMatch(app,/opticalModel:spec\.opticalContract\?\?/);
 assert.doesNotMatch(renderer,/Reflections and total-internal-reflection fallback sample only the sky/);
});
test('hosted primary miss and glass use the same analytic sky/output conversion; nonhosted sky is retained',()=>{
 assert.match(renderer,/#if FIELD_HOSTED\s+return vec4\(hostedDisplayColor\(hostedSky\(rd\)\),1\.\);\s+#else\s+return vec4\(sky,1\.\);\s+#endif/);
 assert.match(renderer,/return vec4\(hostedDisplayColor\(hostedGlassRadiance\(uEye,rd,t,h,n\)\),1\.\);/);
 assert.match(renderer,/vec3 hostedDisplayColor\(vec3 radiance\)\{vec3 mapped=radiance\/\(1\.\+radiance\);return pow\(max\(mapped,vec3\(0\.\)\),vec3\(1\.\/2\.2\)\);\}/);
});
test('material selector reports real ring-versus-solid-door modes without changing colors, pose or options',()=>{
 const begin=app.indexOf('function syncQualityFinishControl(){'),end=app.indexOf('function updateQualityUI(){',begin);assert.ok(begin>=0&&end>begin);
 const helper=app.slice(begin,end),nodes={'quality-finish':{value:'-1'},'quality-finish-combined':{textContent:''}};
 for(const [frame,door,expected]of [[2,1,'-1'],[1,1,'1'],[0,0,'0'],[2,2,'2'],[1,2,'-1']]){
  const options=Object.freeze({frameMaterialMode:frame,doorMaterialMode:door,frameColor:Object.freeze([.12,.34,.56]),doorColor:Object.freeze([.7,.6,.5]),openT:.6});
  const before=JSON.stringify(options),run=new Function('$','renderer',helper+'\nreturn syncQualityFinishControl;')(id=>nodes[id],{options});run();
  assert.equal(nodes['quality-finish'].value,expected);assert.equal(JSON.stringify(options),before);
  if(frame===2&&door===1)assert.equal(nodes['quality-finish-combined'].textContent,'窗框扇涂漆木底／实体门木材（设计）');
 }
 assert.match(app,/function sync\(\)\{\s+syncQualityFinishControl\(\);/);
 assert.match(app,/Object\.assign\(renderer\.options,o\);syncQualityFinishControl\(\);/);
 assert.match(html,/id="quality-finish-combined"/);assert.doesNotMatch(html,/框漆／扇木/);assert.match(html,/KAOPU · MATERIAL QUALITY/);assert.match(html,/与GPU冷启动验收独立/);assert.match(html,/不表示设备问题已修复/);assert.doesNotMatch(html,/隔离修复候选/);
});
test('explicit-resolution repaint is queued behind GPU readiness rather than forced over a pending fence',()=>{
 const paint=app.slice(app.indexOf('function paint(reason='),app.indexOf('function paintInteraction('));
 assert.match(paint,/scheduler\.request\(\{quality:'manual',reason,settle:false\}\)/);assert.doesNotMatch(paint,/scheduler\.flush/);
});
