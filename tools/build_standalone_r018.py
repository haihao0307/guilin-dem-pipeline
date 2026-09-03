from pathlib import Path
import html as html_lib
import json
import re

root = Path(__file__).resolve().parents[1]
src = root / 'ocean-mother' / 'island-r018'
out = src / 'Ocean_Mother_R018_Direct_Open.html'

LINK = '<a id="standaloneLink" href="Ocean_Mother_R018_Direct_Open.html" target="_blank" rel="noopener">单文件直开版</a>'
STYLE = r'''
#standaloneLink,.standaloneBadge{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 13px;border:1px solid rgba(255,255,255,.68);border-radius:999px;background:rgba(230,247,250,.34);box-shadow:inset 0 1px rgba(255,255,255,.86),0 7px 20px rgba(23,65,78,.12);color:#173b48;text-decoration:none;font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;transition:transform .22s ease,background .22s ease,box-shadow .22s ease}
#standaloneLink:hover{background:rgba(241,252,253,.72);box-shadow:inset 0 1px #fff,0 8px 24px rgba(23,65,78,.18)}
#standaloneLink:active{transform:scale(.97)}
#standaloneLink:focus-visible{outline:2px solid rgba(12,95,120,.78);outline-offset:2px}
@media(max-width:760px){#standaloneLink{min-height:30px;padding:0 10px;font-size:10px}.topActions{gap:4px}}
'''.strip()

DEEP_FALLBACK = r'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#061c28;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#dff7fb}canvas{position:fixed;inset:0;width:100%;height:100%}.title{position:fixed;left:24px;top:24px;z-index:2;text-shadow:0 2px 15px #001923}.title small{display:block;letter-spacing:.24em;font-size:10px;opacity:.72}.title h1{margin:7px 0 4px;font-size:27px;font-weight:560}.title p{margin:0;font-size:12px;opacity:.74}.topActions{position:fixed;right:22px;top:22px;z-index:3;display:flex;gap:7px}.topActions button,#panel button{border:1px solid #c9f3fa75;border-radius:999px;background:#c8edf31d;color:#e3f9fc;padding:8px 13px;backdrop-filter:blur(14px);cursor:pointer}.topActions button:hover,#panel button:hover{background:#ddf8fc42}#panel{position:fixed;right:22px;top:72px;bottom:22px;z-index:4;width:min(340px,calc(100vw - 44px));padding:18px;border:1px solid #d8f7fb5a;border-radius:22px;background:linear-gradient(145deg,#bee9ef24,#67afbf16);backdrop-filter:blur(20px) saturate(1.15);box-shadow:inset 0 1px #fff3,0 20px 60px #00131f88;overflow:auto;transition:transform .3s ease,opacity .3s ease}#panel.closed{transform:translateX(calc(100% + 34px));opacity:0;pointer-events:none}#panel h2{margin:0 0 6px;font-size:18px}#panel p{margin:0 0 16px;font-size:11px;line-height:1.6;opacity:.7}.row{display:grid;grid-template-columns:1fr 70px;gap:8px;align-items:center;margin:11px 0}.row label{font-size:12px}.row output{text-align:right;font-variant-numeric:tabular-nums;font-size:11px;opacity:.8}.row input{grid-column:1/-1;width:100%;accent-color:#8de3ef}.status{position:fixed;left:22px;bottom:18px;z-index:2;padding:7px 11px;border:1px solid #d8f7fb52;border-radius:999px;background:#bde7ec1f;backdrop-filter:blur(14px);font-size:11px;opacity:.86}@media(max-width:680px){.title{left:16px;top:80px}.title h1{font-size:22px}.topActions{left:12px;right:12px;top:12px;justify-content:flex-end;flex-wrap:wrap}#panel{left:12px;right:12px;top:66px;bottom:12px;width:auto}.status{left:12px;bottom:10px}}
</style></head><body><canvas id="deepCanvas"></canvas><div class="title"><small>OCEAN MOTHER / EMBEDDED DEEP FIELD</small><h1>深海连续波场</h1><p>单文件内嵌预览 · 多尺度涌浪 · 风向响应 · 无外部资产</p></div><div class="topActions"><button id="togglePanel">参数</button><button id="pause">暂停</button><button id="restart">重新启动</button><button id="reset">复位镜头</button></div><aside id="panel"><h2>深海控制</h2><p>该内嵌页用于单文件直开。在线工作台中的“深海”页继续加载完整 Ocean Mother 深海运行时。</p><div id="rows"></div></aside><div class="status" id="status">深海 · 实时运行</div><script>
(()=>{const canvas=document.getElementById('deepCanvas'),ctx=canvas.getContext('2d',{alpha:false});const panel=document.getElementById('panel'),status=document.getElementById('status');let paused=false,t=0,last=performance.now();const cfg={swell:1.15,period:8.8,wind:10.5,windDir:235,chop:.36,clarity:.72,haze:.26,exposure:1.0};const defs=[['swell','涌浪高度',.2,2.4,.05,'m'],['period','涌浪周期',4,14,.1,'s'],['wind','风速',0,24,.2,'m/s'],['windDir','风向',0,360,1,'°'],['chop','短波细节',0,1,.02,''],['clarity','海水清澈度',.2,1.4,.02,''],['haze','海气薄雾',0,.8,.02,''],['exposure','曝光',.65,1.5,.02,'']];const rows=document.getElementById('rows');for(const d of defs){const row=document.createElement('div');row.className='row';const label=document.createElement('label'),out=document.createElement('output'),input=document.createElement('input');label.textContent=d[1];input.type='range';input.min=d[2];input.max=d[3];input.step=d[4];input.value=cfg[d[0]];out.textContent=cfg[d[0]]+d[5];input.oninput=()=>{cfg[d[0]]=+input.value;out.textContent=(+input.value).toFixed(d[4]<.1?2:1)+d[5]};row.append(label,out,input);rows.append(row)}function resize(){const d=Math.min(1.5,devicePixelRatio||1);canvas.width=Math.max(2,Math.floor(innerWidth*d));canvas.height=Math.max(2,Math.floor(innerHeight*d));ctx.setTransform(d,0,0,d,0,0)}addEventListener('resize',resize);resize();function noise(x,y){return Math.sin(x*12.9898+y*78.233)*43758.5453%1}function draw(){const w=innerWidth,h=innerHeight,horizon=h*.43;const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#8aafbd');sky.addColorStop(.62,'#aac8d0');sky.addColorStop(1,'#d5dde0');ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);const sea=ctx.createLinearGradient(0,horizon,0,h);sea.addColorStop(0,'#557f8b');sea.addColorStop(.24,'#214d60');sea.addColorStop(1,'#031923');ctx.fillStyle=sea;ctx.fillRect(0,horizon,w,h-horizon);const dir=cfg.windDir*Math.PI/180,phaseX=Math.cos(dir),phaseY=Math.sin(dir);ctx.save();ctx.beginPath();ctx.rect(0,horizon-8,w,h-horizon+8);ctx.clip();for(let layer=0;layer<9;layer++){const depth=layer/8,y0=horizon+Math.pow(depth,1.55)*(h-horizon)*.94;const amp=(2.0+depth*8.5)*cfg.swell*(1-layer*.035);ctx.beginPath();for(let x=-20;x<=w+20;x+=4){const px=x/w*14;const perspective=.28+depth*1.35;const y=y0+Math.sin(px*(1.15+layer*.12)+t*(.55+layer*.025)+layer*.9)*amp+Math.sin(px*(3.7+layer*.18)-t*.9+layer*1.7)*amp*.22*cfg.chop+Math.sin((px*phaseX+layer*phaseY)*8.3+t*1.45)*amp*.08*cfg.wind/12; if(x===-20)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle=`rgba(${105+layer*5},${166+layer*4},${181+layer*3},${.15+depth*.18})`;ctx.lineWidth=.7+depth*1.6;ctx.stroke()}const glint=ctx.createLinearGradient(w*.22,horizon,w*.77,h);glint.addColorStop(0,'rgba(255,244,215,0)');glint.addColorStop(.47,`rgba(255,244,215,${.055*cfg.exposure})`);glint.addColorStop(.53,`rgba(255,244,215,${.12*cfg.exposure})`);glint.addColorStop(1,'rgba(255,244,215,0)');ctx.fillStyle=glint;ctx.fillRect(0,horizon,w,h-horizon);ctx.restore();const haze=ctx.createLinearGradient(0,horizon-34,0,horizon+90);haze.addColorStop(0,'rgba(220,232,234,0)');haze.addColorStop(.46,`rgba(220,232,234,${cfg.haze*.34})`);haze.addColorStop(1,'rgba(220,232,234,0)');ctx.fillStyle=haze;ctx.fillRect(0,horizon-34,w,124);ctx.fillStyle=`rgba(235,243,245,${.06+.08*cfg.clarity})`;for(let i=0;i<75;i++){const x=((i*97.31+t*(4+i%5)*phaseX)% (w+100))-50,y=horizon+30+(i*53.7%(h-horizon-45)),r=.35+(i%7)*.11;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}}function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!paused)t+=dt;draw();requestAnimationFrame(loop)}document.getElementById('togglePanel').onclick=()=>panel.classList.toggle('closed');document.getElementById('pause').onclick=e=>{paused=!paused;e.currentTarget.textContent=paused?'继续运行':'暂停';status.textContent=paused?'深海 · 已暂停':'深海 · 实时运行'};document.getElementById('restart').onclick=()=>{t=0;paused=false;document.getElementById('pause').textContent='暂停';status.textContent='深海 · 已重新启动'};document.getElementById('reset').onclick=()=>{cfg.windDir=235;cfg.swell=1.15;cfg.period=8.8;location.hash='reset'};requestAnimationFrame(loop)})();
</script></body></html>'''


def strip_module(path: Path, namespace: bool = False) -> str:
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'^import[^\n]*\n', '', text, flags=re.M)
    names = re.findall(r'^export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', text, flags=re.M)
    text = re.sub(r'^export\s+', '', text, flags=re.M)
    if namespace:
        text += '\nconst SH=Object.freeze({' + ','.join(names) + '});\n'
    return text

index_path = src / 'index.html'
css_path = src / 'coast.css'
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

if 'id="standaloneLink"' not in index:
    marker = '<button id="panelToggle"'
    index = index.replace(marker, LINK + marker, 1)
    index_path.write_text(index, encoding='utf-8')
if '#standaloneLink' not in css:
    css = css.rstrip() + '\n' + STYLE + '\n'
    css_path.write_text(css, encoding='utf-8')

parts = [
    strip_module(src / 'params.mjs'),
    strip_module(src / 'core.mjs'),
    strip_module(src / 'geometry.mjs'),
    strip_module(src / 'shaders.mjs', namespace=True),
    strip_module(src / 'app.mjs'),
]
js = '\n\n'.join(parts).replace('</script>', '<\\/script>')
standalone = index
standalone = standalone.replace('<meta name="description"', '<meta name="artifact" content="standalone-single-html"><meta name="description"', 1)
standalone = re.sub(r'<link rel="stylesheet" href="coast\.css\?v=r018">', lambda _: '<style>\n' + css + '\n</style>', standalone)
standalone = standalone.replace(LINK, '<span class="standaloneBadge">单文件直开版</span>', 1)
standalone = re.sub(
    r'<iframe id="deepFrame" title="深海工作台" data-src="\.\./v001/" hidden></iframe>',
    lambda _: '<iframe id="deepFrame" title="深海工作台" data-src="about:blank" src="about:blank" srcdoc="' + html_lib.escape(DEEP_FALLBACK, quote=True) + '" hidden></iframe>',
    standalone,
)
standalone = re.sub(
    r'<iframe id="deepFrame" title="深海工作台" data-src="\.\./v001/" hidden></iframe>',
    lambda _: '<iframe id="deepFrame" title="深海工作台" data-src="about:blank" src="about:blank" srcdoc="' + html_lib.escape(DEEP_FALLBACK, quote=True) + '" hidden></iframe>',
    standalone,
)
standalone = re.sub(r'<script type="module" src="app\.mjs\?v=r018"></script>', lambda _: '<script>\n' + js + '\n</script>', standalone)
out.write_text(standalone, encoding='utf-8')

print(json.dumps({
    'output': str(out),
    'bytes': out.stat().st_size,
    'inlineCss': '<link rel="stylesheet"' not in standalone,
    'inlineRuntime': 'src="app.mjs' not in standalone,
    'embeddedDeep': 'EMBEDDED DEEP FIELD' in standalone,
    'externalUrls': bool(re.search(r'https?://', standalone, re.I)),
}, ensure_ascii=False))
