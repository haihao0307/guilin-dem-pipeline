from pathlib import Path
import json
root=Path(__file__).parent;old=root.parent/'web-r003'
s=(old/'main.mjs').read_text()
def sub(before,after):
 global s
 assert before in s,'Missing baseline patch anchor: '+before[:80]
 s=s.replace(before,after)
sub("import {clone} from 'three/addons/utils/SkeletonUtils.js';","import {decodeEmbedded,reconstructTeacher,installPartExplorer} from './canonical.mjs';")
sub("let roots=[teacher.scene,clone(teacher.scene)],wrappers=roots.map", "const pkg=JSON.parse(document.getElementById('canonicalPackage').textContent);document.getElementById('canonicalPackage').remove();const compiled=await reconstructTeacher(pkg,decodeEmbedded('canonicalFields'),await teacher.parser.getDependencies('texture'));let roots=[teacher.scene,compiled.scene],wrappers=roots.map")
sub("actions=mixers.map(m=>m.clipAction(clip))","actions=mixers.map((m,i)=>m.clipAction(i===0?clip:compiled.animations.find(c=>c.name===clip.name)))")
sub('解剖查看 · 原始数据副本','结构回解 · 教师数据候选')
sub('当前阶段：老师解剖学习','当前阶段：结构数据回解')
sub('右侧是原始数据的解剖副本，不是独立生成的新鱼。没有简化或替换骨架。','右侧由教师数据包重新构造场景、表面、控制骨架与动作轨道，不克隆原模型对象。未进入压缩或物种变体。')
sub('源数据副本顶点一致性：','结构数据回解顶点一致性：')
sub('（不是独立生成验收）','（不是生物学或生成器批准）')
sub('let last=performance.now()',r'''installPartExplorer({compiled,meshes,state,applyDisplay,qa,renderer,cam,readSurface,verify});
window.FISH_STRUCTURAL={
 allPoseChecks(){const ts=new Set();for(const t of pkg.motionFields[0].tracks)for(const v of compiled.field(t.timeField))ts.add(v);const keys=[...ts].sort((a,b)=>a-b),times=[...keys,...keys.slice(1).map((v,i)=>(v+keys[i])/2)];let max=0,worst=null;for(const t of times){const q=verify(t);if(q.maxError>=max){max=q.maxError;worst=q;}}const a=meshes[0][0],b=meshes[1][0];return {keyTimes:keys.length,midpoints:keys.length-1,total:times.length,maxError:max,worst,passed:max<=1e-6,distinctGeometryObjects:meshes[0].every((m,i)=>m.geometry!==meshes[1][i].geometry),distinctSkeletonObjects:a.skeleton!==b.skeleton,distinctJointObjects:a.skeleton.bones.every((j,i)=>j!==b.skeleton.bones[i]),distinctClips:teacher.animations[0]!==compiled.animations[0],noModelClone:true};},
 silhouettes(){state.play=false;at(0,true);const target=new THREE.WebGLRenderTarget(256,256),a=new Uint8Array(256*256*4),b=new Uint8Array(a.length),mat=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});const saved=meshes.flat().map(m=>[m,m.material,m.visible]);saved.forEach(([m])=>{m.material=mat;m.visible=true;});const backgrounds=scenes.map(s=>s.background),vis=scenes.map((s,i)=>s.children.filter(o=>o!==wrappers[i]).map(o=>[o,o.visible]));vis.flat().forEach(([o])=>o.visible=false);scenes.forEach(s=>s.background=new THREE.Color(0));const results=[];for(const view of ['side','front','top','quarter']){preset(view);renderer.setRenderTarget(target);renderer.setViewport(0,0,256,256);renderer.setScissorTest(false);renderer.clear();renderer.render(scenes[0],cam);renderer.readRenderTargetPixels(target,0,0,256,256,a);renderer.clear();renderer.render(scenes[1],cam);renderer.readRenderTargetPixels(target,0,0,256,256,b);let intersection=0,union=0;for(let i=0;i<a.length;i+=4){const x=a[i]>127,y=b[i]>127;if(x&&y)intersection++;if(x||y)union++;}results.push({view,intersection,union,iou:union?intersection/union:0});}renderer.setRenderTarget(null);saved.forEach(([m,material,visible])=>{m.material=material;m.visible=visible;});scenes.forEach((s,i)=>s.background=backgrounds[i]);vis.flat().forEach(([o,v])=>o.visible=v);target.dispose();mat.dispose();preset('side');return results;}
};
let last=performance.now()''')
s=s.replace('FISH_AUTOPSY_R003','FISH_CANONICAL_R004').replace('R003','R004')
assert 'clone(teacher.scene)' not in s and 'SkeletonUtils' not in s
(root/'main.mjs').write_text(s)
build=(old/'build.py').read_text().replace('FISH_AUTOPSY_R003','FISH_CANONICAL_R004').replace('R003','R004')
extra="extra='<script id=\"canonicalPackage\" type=\"application/json\">'+(out/'canonical-r004/teacher-package.json').read_text().replace('<','\\u003c')+'</script><script id=\"canonicalFields\" type=\"application/octet-stream\">'+base64.b64encode((out/'canonical-r004/teacher-fields.bin').read_bytes()).decode()+'</script>'\n"
assert 'html=head+' in build
build=build.replace('html=head+',extra+'html=head+extra+')
(root/'build.py').write_text(build)
q=(old/'qa.mjs').read_text().replace('FISH_AUTOPSY_R003','FISH_CANONICAL_R004')
anchor=' result.initial=initial;'
assert anchor in q
q=q.replace(anchor,r''' result.canonical=initial.canonical;assert(initial.canonical.geometryRigMotionDecodedFromPackage&&!initial.canonical.sourceCloneUsed,'right candidate is still a clone');
 result.allPoseChecks=await page.evaluate(()=>window.FISH_STRUCTURAL.allPoseChecks());console.log('CANONICAL_ALL_POSES',JSON.stringify(result.allPoseChecks));assert(result.allPoseChecks.passed&&result.allPoseChecks.total===209&&result.allPoseChecks.distinctGeometryObjects&&result.allPoseChecks.distinctJointObjects&&result.allPoseChecks.distinctClips,'independent decoded candidate mismatch');
 result.silhouettes=await page.evaluate(()=>window.FISH_STRUCTURAL.silhouettes());assert(result.silhouettes.every(v=>v.union>10&&v.iou>.999),'same-camera silhouettes differ');
 for(const i of [3,4,7,10,14,30,33]){await page.selectOption('#groupSelect',String(i));assert(await page.evaluate(i=>window.FISHQA.selectedControlGroup===i,i),'group did not select');await page.waitForTimeout(100);}
 await page.selectOption('#groupSelect','10');await page.screenshot({path:path.join(dir,'canonical-group.png')});result.faceTrace=await page.evaluate(()=>window.FISH_CANONICAL.inspect(0,1000));assert(result.faceTrace.sourceTriangle===1000&&result.faceTrace.overlappingAuthorGroups.length>0,'face provenance lost');await page.locator('#clearGroup').click();
 result.initial=initial;''')
q=q.replace("await page.locator('#toolsBtn').click();assert", "await page.locator('#toolsBtn').click();await page.selectOption('#groupSelect','4');assert(await page.evaluate(()=>window.FISHQA.selectedControlGroup===4),'mobile canonical groups failed');await page.locator('#clearGroup').click();assert")
q=q.replace("result.errors=errors.concat", "await page.screenshot({path:path.join(dir,'review-thumb.jpg'),type:'jpeg',quality:45,scale:'css'});result.errors=errors.concat")
(root/'qa.mjs').write_text(q)
print('R004_PATCH_READY: approved shell/favicon retained; new canonical decoder; 209 poses and 4 silhouettes; original QA retained')
