from pathlib import Path
import hashlib,json,shutil,sys
P=Path(__file__).resolve().parent;B=Path(sys.argv[1]);S=Path(sys.argv[2]);S.mkdir(parents=True,exist_ok=True);D=S/'young-coral-r01';D.mkdir(exist_ok=True)
base={'index.html':'09f79eff26831fbf7ad8245923f3b8225a456fa921724830a9019bef0c8c97e8','runtime.js':'1141e15415ce0fac43a6d3b8bec07d65eb71b9d3fcb35cb25d9cfc253f8d4dac','studio.css':'72d082d5240ec8c0e2ba115f727b624d9699fa4e0f067bd1ada09aa3151cae14','studio.js':'317a3a5f2de487d888ce6de954ff676fd95ae3b4b05510d7662f1a6af50546e5'}
for n,h in base.items():assert hashlib.sha256((B/n).read_bytes()).hexdigest()==h,('baseline changed; stop',n)
assert hashlib.sha256((P/'study.html').read_bytes()).hexdigest()=='53cf9583e86c5647a26e436a084fb003b2dc4b5cbb47aa3d550009606238c84b','study differs from local tested source'
for n in base:shutil.copyfile(B/n,S/n)
shutil.copyfile(P/'study.html',D/'index.html')
h=(S/'index.html').read_text();j=(S/'runtime.js').read_text()
h=h.replace('工作台 R05','工作台 R05 · 芽簇 R01').replace('R05 · NATIVE CAMERA / PIXELS','R05 + YOUNG R01')
needle='<button data-view="staghorn">';assert needle in h
h=h.replace(needle,'<button data-view="young"><b>芽簇形态 R01</b><small>原码学习 · 实时复演</small></button>'+needle,1)
needle='<section class="view" id="view-staghorn">';assert needle in h
h=h.replace(needle,'<section class="view" id="view-young"><iframe id="youngFrame" title="芽簇珊瑚原码学习 R01" style="display:block;width:100%;height:calc(100dvh - 99px);min-height:560px;border:0;background:#101619" allow="fullscreen"></iframe></section>\n'+needle)
h=h.replace('runtime.js?v=R05-20261003','runtime.js?v=R05-young-r01-20261003')
j=j.replace("'rosette','staghorn'","'rosette','young','staghorn'")
j=j.replace("const K={home:","const K={young:['芽簇形态 R01','基于用户提供的 Yohei Nishitsuji 紧凑原码：98次外循环、12次反演折叠；只补确定初始化和不透明输出。老师小窗与学生主窗均实时运行该码。时间仅改变观察变换，不是生长模拟。'],home:")
j=j.replace("version:'studio-r05-20261003'","version:'studio-r05-young-r01-20261003'")
needle="if(id==='tree'&&!$('treeFrame').src)";assert needle in j
j=j.replace(needle,"if(id==='young'&&!$('youngFrame').getAttribute('src'))$('youngFrame').src='young-coral-r01/?embedded=1&v=R01';if($('youngFrame').contentWindow)$('youngFrame').contentWindow.postMessage({type:'coral:active',active:id==='young'},location.origin);"+needle)
needle='boot();\n})();';assert needle in j
j=j.replace(needle,"window.addEventListener('message',e=>{const f=$('youngFrame');if(e.origin!==location.origin||e.source!==f.contentWindow)return;if(e.data?.type==='coral:home')select('home');if(e.data?.type==='coral:young-ready')f.contentWindow.postMessage({type:'coral:active',active:current==='young'},location.origin);if(e.data?.type==='coral:young-state')state.young=e.data});\n"+needle)
(S/'index.html').write_text(h);(S/'runtime.js').write_text(j)
M={'version':'R05-YOUNG-R01-20261003','base':base,'files':{n:hashlib.sha256((S/n).read_bytes()).hexdigest() for n in ['index.html','runtime.js','studio.css','studio.js','young-coral-r01/index.html']},'young_fragment_sha256':'60f2ed28f199c435ffac60a6f9fde0426ff64246e69d5016eaf7fe65b5f5da2f','base_rosette_shader_changed':False,'blueRestored':False,'colorRestored':False,'scope':'New user-supplied young morphology study and one top navigation entry only'}
assert M['files']['index.html']=='1f4f6971dbd747b0185f341e8d320ab479bf942b2c18599fa26beff3bc106013',M
assert M['files']['runtime.js']=='96f6d7c4dc206774dccb2b4e17802d4a9a238c72a62d777c76980ec5ad3662b0',M
(S/'YOUNG_MANIFEST.json').write_text(json.dumps(M,ensure_ascii=False,indent=2));print(json.dumps(M,indent=2))
