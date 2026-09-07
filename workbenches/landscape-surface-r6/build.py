from pathlib import Path
import re, hashlib

base = Path('workbenches/landscape-surface-r5/index.html').read_text(encoding='utf-8')
assert hashlib.sha256(base.encode()).hexdigest() == 'ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2'
s = base
def change(a, b):
    global s
    assert a in s, a[:100]
    s = s.replace(a, b)

change('水蚀石灰岩 R5 表面显微层', '水蚀石灰岩 R6 · 雨后石境')
change('葡萄峰丛 · 水蚀岩壁 R5', '雨后石境 · 石灰岩 R6')
change('Brick 石材 · <span id="seedLabel">种子 83</span> · microscope 表面层', 'LANDSCAPE STUDY / 06 · <span id="seedLabel">种子 83</span>')
change("release:'limestone-water-surface-r5'", "release:'limestone-water-surface-r6'")
change('R5 冻结这份', 'R6 沿用 R5 并冻结这份')
change('scope:.82,micro:.70,wet:0,exposure:1.08', 'scope:.58,micro:.72,wet:.22,exposure:1.02')
change('antialias:false', 'antialias:true')
# Preserve mineral variation under diffuse lighting; weathering reads the same surface fields.
change('vec3(.32,.354,.365),vec3(.60,.565,.48)', 'vec3(.345,.373,.382),vec3(.625,.603,.533)')
change('seams);', 'seams*.65);')
change('float habitat=.72*broad+.28*edge;', 'float habitat=.70*broad+.22*edge+.08*bmN(q*1.7+vec3(17.,3.,9.));')
change('smoothstep(.33,.56,habitat)*smoothstep(.10,.42,retention)*smoothstep(-.42,.24,n0.y)', 'smoothstep(.47,.66,habitat)*smoothstep(.20,.57,retention)*smoothstep(-.22,.38,n0.y)')
change('vec3(.075,.091,.081),stain*.38*(1.-smoothstep(.24,.86,n0.y))', 'vec3(.13,.145,.134),stain*.32*smoothstep(.18,.68,retention)*(1.-smoothstep(.24,.86,n0.y))')
change('vec3(.060,.070,.064),caveWeather*.48', 'vec3(.19,.204,.187),caveWeather*.23*smoothstep(.14,.62,retention)')
change('vec3(.17,.245,.078),vec3(.40,.435,.17)', 'vec3(.13,.207,.061),vec3(.33,.375,.132)')
change('moss=pow(moss,.72);', 'moss=pow(moss,1.08);')
change('family==6?0.:.13', 'family==6?0.:.035')
change('rough=clamp(rough-moisture*.30,.30,1.)', 'rough=clamp(rough-moisture*.23,.42,1.)')
change('vec3(.10,.098,.093),vec3(.38,.403,.43)', 'vec3(.15,.135,.113),vec3(.49,.535,.575)')
change('pow(ao,1.28)', 'pow(ao,1.04)')
change('vec3(5.4,5.15,4.82)', 'vec3(5.5,5.3,4.94)')
change('vec3(.125,.15,.18)', 'vec3(.20,.225,.25)')
# Soft photographic shoulder, retaining neutral limestone highlights.
change('vec3 c=srgb(color/(1.+color));', 'vec3 mapped=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);vec3 c=srgb(mapped);')
change('vec3(.74,.79,.76),fog', 'vec3(.69,.745,.74),fog')
change("$('#status').textContent=`函数现场生成 · ${Math.round(report.parts.reduce((s,p)=>s+p.triangles,0)/1000)}k 面 · 无保存网格`", "$('#status').textContent='拖动旋转 · 滚轮靠近 · 右键平移'")
change('一套石材核心 / 无外部资源', '雨后石境 / R6')
change('</style>', '''
:root{--ink:#2e3c38;--paper:#f5f4eeeb;--active:#4b5a49}
body{background:radial-gradient(ellipse at 48% 35%,#e6e8de 0%,#c9d3cc 55%,#9fbbb9 100%)}
.brand{background:#f4f4edce;border:1px solid #ffffff90;border-radius:3px;padding:15px 19px}
.brand h1{font-weight:450;letter-spacing:1px}.eyebrow{letter-spacing:3px;color:#667568}
.subline{letter-spacing:1px}.tools button,.glass{box-shadow:0 4px 20px #3145370d}
nav.views{border-radius:5px}.panel h4{color:#66774f}.footer{letter-spacing:1px}
</style>''')
for ident in ['worldSource', 'generateSource']:
    pattern = r'<script id="'+ident+r'" type="text/plain">(.*?)</script>'
    assert re.search(pattern, base, re.S)[1] == re.search(pattern, s, re.S)[1]
out=Path('workbenches/landscape-surface-r6/index.html')
out.write_bytes(s.encode())
print(len(s.encode()), hashlib.sha256(s.encode()).hexdigest())
