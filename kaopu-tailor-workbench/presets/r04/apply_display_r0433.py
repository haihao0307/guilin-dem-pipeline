"""Replayable, hash-guarded repair of R0432 display; never modifies solver geometry."""
from pathlib import Path
import hashlib,json
P=Path(__file__).parent
EXPECTED={
 'app.mjs':'4b7d0ef63106dd5431a3d41a4019216d4ca874cc5249816fc18013223f4272af',
 'index.html':'2b16d67fd2de9ce2fc42b97bb74852bce713611cc63840612cd4f3a5d8f8800a',
 'style.css':'8d80fbf513144829c9a78c5d3c06949e157e86f3d1537b38aa2a666177753bff',
 'variant-preview-r0431.mjs':'6cddf94dc884a04d1e069a9106b1b3b4218a2982655914cd13e1a9218c8ea4cd'}
texts={n:(P/n).read_text() for n in EXPECTED}
for n,h in EXPECTED.items():
 assert hashlib.sha256((P/n).read_bytes()).hexdigest()==h,('Baseline mismatch',n)
def edit(n,a,b,count=1):
 assert texts[n].count(a)==count,(n,a[:110],texts[n].count(a),count)
 texts[n]=texts[n].replace(a,b)
n='app.mjs'
texts[n]="import{BoundedCache,installGarmentDisplay}from'./display-r0433.mjs';\n"+texts[n]
edit(n,'let model,viewer,lock,','let model,viewer,display,lock,')
edit(n,'packetCache=new Map(),paperCache=new Map()','packetCache=new BoundedCache(32),paperCache=new BoundedCache(8)')
edit(n,"editor?.lock(['meshing'","editor?.lock(!!viewer?.lost||['loading','meshing'")
edit(n,"const busy=['meshing'","const busy=!!viewer?.lost||['loading','meshing'")
edit(n,"boot:'载入原系统',idle:","boot:'载入原系统',loading:'正在读取所选服装',idle:")
edit(n,"$('person').disabled=!ready;","$('person').disabled=!ready||!!viewer?.lost;")
edit(n,"const r=await fetch(row.nativePaper);","const r=await fetch('assets/papers/'+row.id+'.json.gz');")
old="async function select(id){stop();clearCloth();parameterPending=false;activeRequest=null;paperDoc=null;error=null;editor?.invalidate();const row=catalogue.rows.find(r=>r.id===id)||outfits.find(r=>r.id===id);if(!row)throw Error('未知原款或套系 '+id);current=row;phase=eligible()?'idle':'blocked';"
new="""async function select(id){const row=catalogue.rows.find(r=>r.id===id)||outfits.find(r=>r.id===id);if(!row)throw Error('未知原款或套系 '+id);stop();clearCloth();parameterPending=false;activeRequest=null;paperDoc=null;error=null;editor?.invalidate();current=row;phase=eligible()?'loading':'blocked';
 const nextCollection=row.members?'outfits':'single';if(collection!==nextCollection){collection=nextCollection;category='全部';qualityFilter='all';query='';$('search').value='';updateModes();categories();}if(row.members){$('pair-top').value=row.members[0];$('pair-bottom').value=row.members[1];if(!query&&qualityFilter==='all')outfitPage=Math.floor(outfits.indexOf(row)/24)+1;}
 """
edit(n,old,new)
edit(n," controls();provenance();return state();}"," if(token===serial){display?.frame();controls();provenance();}return state();}")
edit(n,"drawRecord(record);phase='done';$('progress')","drawRecord(record);phase='done';display?.frame();$('progress')")
edit(n,"viewer.update();viewer.view('three');","viewer.update();display.frame('three');")
edit(n,"version:'R04-SOURCE-5.2',release:'R04.3.2'","version:'R04-SOURCE-5.3',release:'R04.3.3',display:display?.audit(),packetCacheSize:packetCache.size,paperCacheSize:paperCache.size")
edit(n,"variantPreviewRendering:variantPreviewBusy,ready,phase","variantPreviewRendering:variantPreviewBusy,ready:ready&&!viewer?.lost,phase")
needle="viewer=new CommonViewer({canvas:$('canvas'),container:$('stage'),model,onStatus:message});"
edit(n,needle,needle+"\n display=installGarmentDisplay(THREE,viewer,{meshes:()=>viewer.scene.children.filter(m=>m.userData?.binding?.presetId),onGraphics:ok=>{controls();message(ok?'三维显示已恢复；原人物与原服装数据保留。':'显卡上下文暂不可用，已保留原服装；等待浏览器恢复或刷新本页。',!ok)}});\n for(const b of document.querySelectorAll('[data-focus]'))b.onclick=()=>{for(const e of document.querySelectorAll('[data-focus]'))e.setAttribute('aria-pressed',e===b);display.focus(b.dataset.focus)};")
edit(n,"b.onclick=()=>viewer.view(b.dataset.view)","b.onclick=()=>display.frame(b.dataset.view)")
edit(n,"view:n=>viewer.view(n)","view:n=>display.frame(n),focus:n=>display.focus(n),thumbnail:()=>display.thumbnail(),displayAudit:()=>display.audit(),pixelAudit:()=>viewer.pixelAudit(),loseContext:()=>viewer.renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext(),restoreContext:()=>viewer.renderer.getContext().getExtension('WEBGL_lose_context')?.restoreContext()")
edit(n,"await select(id);viewer.view('three');viewer.render();return{state:state(),png:$('canvas').toDataURL('image/png')}","await select(id);return{state:state(),png:display.thumbnail()}")
edit(n,"addEventListener('pagehide',()=>{stop();viewer?.dispose()});boot();","addEventListener('pagehide',e=>{if(e.persisted)return;stop();display?.dispose();viewer?.dispose()});boot();")
n='index.html'
edit(n,'R04.3.2 · 原生套系与制版参数','R04.3.3 · 全类别三维展示修复')
edit(n,'<button data-view="three">斜前</button>','<button data-view="three">斜前</button><button data-focus="scene" aria-pressed="true">完整人物 / 衣摆</button><button data-focus="garment" aria-pressed="false">服装近看</button>')
edit(n,'原人物、原裁片与原生缝合继续保留。新增腰头材料周长支承、抽褶来源修复、可恢复计算，以及真实上下装套系和原制版参数。结果通过、失败、中间状态分开标识，未冒称完整布料物理已经完成。','保留原人物、60款原裁片、432套系与122项参数。修复服装取景、近看、缩略图比例、套系选择与显示恢复；未通过数值检查的款式仍标明待修复，不把展示可用当作合格成衣。')
n='variant-preview-r0431.mjs'
edit(n,"saved=viewer.cameraState();viewer.view('three');viewer.render();\n    const url=canvas.toDataURL('image/png');","saved=viewer.cameraState();\n    const url=viewer.captureNativeThumbnail?viewer.captureNativeThumbnail():(viewer.view('three'),viewer.render(),canvas.toDataURL('image/png'));")
texts['style.css']+='\n/* R0433: real 320x400 garment-framed cards; keep every source pixel. */\n.thumb img{object-fit:contain;aspect-ratio:4/5}#stage:focus-within{outline:1px solid #b0c6a9}.views button[data-focus]{border-style:dashed}\n'
for n,text in texts.items():(P/n).write_text(text)
(P/'R0433_DISPLAY_PATCH.json').write_text(json.dumps({'baseline':'7be34c18a44859e2ce2143c377d2c450e1ad89f5','before':EXPECTED,'after':{n:hashlib.sha256((P/n).read_bytes()).hexdigest() for n in texts},'bodyGeometryChanged':False,'solverCoordinatesChanged':False,'qualityThresholdsChanged':False},indent=2))
print('Applied display repair to app.mjs, index.html, variant previews and CSS')
