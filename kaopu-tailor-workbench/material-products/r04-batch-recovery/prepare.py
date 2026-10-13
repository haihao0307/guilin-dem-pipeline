from pathlib import Path
import json,shutil,sys,hashlib
r=Path(sys.argv[1]);here=Path(__file__).resolve().parent
for name in ['yarn-batching.mjs','test-batch.mjs']:
 shutil.copyfile(here/name,r/name)
s=(r/'solid-textiles.mjs').read_text()
s="import {batchYarnTiles} from './yarn-batching.mjs';\n"+s
s=s.replace("let forceDetail=false,moving=false;", "const batching=batchYarnTiles(tiles,group,stats);let forceDetail=false,moving=false;")
s=s.replace('stats.visibleBatches=visible;', 'batching.update();stats.visibleBatches=visible;')
s=s.replace('return{group,stats,panels,update(camera)', 'return{group,stats,panels,verifyBatches:()=>batching.verify(),update(camera)')
s=s.replace('dispose(){trims.dispose();', 'dispose(){batching.dispose();trims.dispose();')
assert 'const batching=' in s and 'batching.update()' in s and 'verifyBatches' in s
(r/'solid-textiles.mjs').write_text(s)
for name in ['app.mjs','index.html','motion-transport.mjs','qa-case.cjs','_build/publish-snapshot.py']:
 p=r/name;s=p.read_text().replace('MP04.4.1','MP04.4.2').replace('mp04.4.1','mp04.4.2')
 if name=='_build/publish-snapshot.py':s=s.replace("prefix='kaopu-tailor-workbench/material-products/r04-4-1'","prefix='kaopu-tailor-workbench/material-products/r04-4-2'").replace('mp04-r4-1-','mp04-r4-2-').replace('presentation clock and transport only; all physical states, original person, material metrics and geometry preserved','same yarn primitives grouped by identical material/chart/LOD; physical states and material dimensions preserved')
 if name=='qa-case.cjs':
  s=s.replace('report.passed=true;', "report.batchProof=await p.evaluate(()=>window.__MP04__.debug().items.map(i=>i.solid.verifyBatches()));assert(report.batchProof.every(x=>x.passed));const rows=(await audit()).rows;for(const row of rows)if(row.yarnSpans){assert.equal(row.batchedYarnTriangles,row.submittedYarnTriangles);assert(row.batchedYarnDrawCalls<=row.originalVisibleYarnDrawCalls);}report.finalRows=rows;report.passed=true;")
  s=s.replace("report.errors.push(e.stack||String(e));console.error(e);await shot('failure')", "report.errors.push(e.stack||String(e));console.error(e);report.lastState=await p.evaluate(()=>{const d=window.__MP04__?.debug();return {frames:window.__observedFrames,gate:d?.viewer?.frameGate?.audit(),running:d?.physics?.running,motion:d?.physics?.frame?.audit,status:document.getElementById('status')?.textContent};}).catch(()=>null);save();await shot('failure')")
 p.write_text(s)
(r/'BATCH_RECOVERY_SCOPE.json').write_text(json.dumps({'version':'MP04.4.2','parentSource':'d00fc2de66dcf57367443d7ecfdc60977bc2b6ee','change':'merge original yarn tile submissions only when material object and LOD/template are identical','samePrimitiveCount':True,'sameYarnInstances':True,'sameShaders':True,'sameClothAndCharacter':True,'sameActualSolvedClips':True,'remaining':['full knit R15 fuzz/distance integration','denim R12 independent damaged-yarn forces','real GPU performance certification'],'preservedFailedRun':38365883577,'fullUserTaskComplete':False,'userAccepted':False},ensure_ascii=False,indent=2))
(r/'README.md').write_text((r/'README.md').read_text()+'\n\n## MP04.4.2 同几何绘制合批\n按同裁片、同材质对象和同LOD合并原始纱线提交；原始针目、经纬实例、闭合截面、材质着色器和阴影质量不变。每个可见集合逐项检查纱线实例和模板，合批前后三角形数相同。保留上一轮失败，不能将软件渲染时限或CPU提交减少说成用户显卡帧率。\n')
print('Prepared exact-primitive batching; original solver and shaders unchanged')
