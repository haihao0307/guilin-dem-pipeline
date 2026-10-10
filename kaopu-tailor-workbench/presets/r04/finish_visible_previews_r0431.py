from pathlib import Path
P=Path(__file__).resolve().parent;f=P/'app.mjs';s=f.read_text()
if 'function queueVisibleVariantPreviews' not in s:
 marker='\nasync function sourcePaper(row)'
 assert s.count(marker)==1
 s=s.replace(marker,'\n'+(P/'variant-gallery-r0431.inc.mjs').read_text()+marker)
 old="$ ('page-next').onclick=()=>{outfitPage++;cards()};}\n}".replace('$ (','$(')
 new="$('page-next').onclick=()=>{outfitPage++;cards()};}\n queueVisibleVariantPreviews();\n}"
 assert s.count(old)==1;s=s.replace(old,new)
 s=s.replace("'当前参数变体 · 点击三维查看'","'当前参数变体 · 更新三维预览'")
 s=s.replace("'旧版缩略图已停用，避免把原版图片当作新参数效果。'","'正在用这次真实结果更新可见套系；旧图不冒充新效果。'")
 s=s.replace("release:'R04.3.1',ready", "release:'R04.3.1',variantPreviewQueueLength:variantPreviewQueue.length,variantPreviewRendering:variantPreviewBusy,ready")
 f.write_text(s)
f=P/'qa_integrated_r0431.py';s=f.read_text()
if 'all visible edited outfit cards regenerate automatically' not in s:
 marker="  p.screenshot(path=str(OUT/'outfit-variant.png'))"
 addition='''  p.wait_for_function('Array.from(document.querySelectorAll(".card")).every(c=>c.querySelector("img")?.src.startsWith("data:image/png;"))',timeout=120000)
  check('all visible edited outfit cards regenerate automatically',p.locator('.card img').count()==24)
  check('automatic preview queue does not change selection or native geometry',state(p)['selectedId']=='T01-P01' and state(p)['renderCoordinateErrorM']==0 and state(p)['clothIndexMatchesNative'])
'''
 assert marker in s;s=s.replace(marker,addition+marker);f.write_text(s)
print('VISIBLE_VARIANT_OUTFIT_PREVIEWS_ENABLED')
