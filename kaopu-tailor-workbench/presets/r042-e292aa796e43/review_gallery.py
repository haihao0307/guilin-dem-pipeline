"""Present actual native results without altering any cloth/body coordinates."""
from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'app.mjs';s=f.read_text()
if '// NATIVE_GALLERY_DISPLAY_V1' not in s:
 s=s.replace("let readiness={rows:{},summary:{}},coordinateAudit=0,indexAudit=true;", "let readiness={rows:{},summary:{}},coordinateAudit=0,indexAudit=true;let panelColors=false;")
 s=s.replace("color:[0xbbab8b,0x9ab5ac,0xc4a4a4,0xa1a8c6][i%4]", "color:panelColors?[0xbbab8b,0x9ab5ac,0xc4a4a4,0xa1a8c6][i%4]:0xc6b591")
 s=s.replace("cloth.geometry.computeBoundingSphere();const audit=", "cloth.geometry.computeBoundingSphere();for(const m of cloth.material)m.wireframe=$('wire').checked;const audit=")
 s=s.replace("paperDoc=null;$('selected-title')", "paperDoc=null;$('progress').value=0;$('selected-title')")
 s=s.replace("phase='solving';error=null;controls();worker.postMessage", "phase='solving';error=null;$('progress').value=0;controls();worker.postMessage")
 s=s.replace("const list=rows();$('count')", "const rank=r=>cache.rows[r.id]?.qualityPassed?0:cache.rows[r.id]?1:2;const list=rows().sort((a,b)=>rank(a)-rank(b));$('count')")
 s=s.replace("${Object.keys(cache.rows).length} 个原求解记录", "${Object.keys(cache.rows).length} 个原求解记录 / ${Object.values(cache.rows).filter(r=>r.qualityPassed).length} 个通过静态检查")
 s=s.replace('<div class="thumb">','<div class="thumb ${e?.qualityPassed?\'static-pass\':\'\'}">')
 s=s.replace("window.__R04={state,", "// NATIVE_GALLERY_DISPLAY_V1\n$('panel-colors').onclick=()=>{panelColors=!panelColors;$('panel-colors').setAttribute('aria-pressed',panelColors);if(cloth)cloth.material.forEach((m,i)=>m.color.set(panelColors?[0xbbab8b,0x9ab5ac,0xc4a4a4,0xa1a8c6][i%4]:0xc6b591));viewer.render()};window.__R04={state,")
 f.write_text(s)
f=P/'index.html';s=f.read_text()
if 'id="panel-colors"' not in s:s=s.replace('<label><input id="wire"', '<button id="panel-colors" aria-pressed="false">裁片分色</button><label><input id="wire"')
s=s.replace('本轮保留原纸样尺码，不冒称已按当前人物重新量体制版。','当前使用原纸样尺码，尚未按切换后的人物重新量体制版。')
f.write_text(s)
f=P/'style.css';s=f.read_text()
if 'NATIVE_GALLERY_DISPLAY_V1' not in s:s+='\n/* NATIVE_GALLERY_DISPLAY_V1 */\n.thumb.static-pass>span{background:#315948e8;color:#d9ece0}.card[aria-pressed=true]{outline:2px solid #a4c3b1;outline-offset:1px}button:focus-visible,a:focus-visible{outline:2px solid #a4c3b1;outline-offset:2px}#count{line-height:1.8}.thumb img{object-fit:cover}#panel-colors{font-size:11px}\n'
f.write_text(s)
print('NATIVE_GALLERY_DISPLAY_READY')
