# UI additions only. R01 teacher program is never edited.
ui='''<section class="palette-bar" aria-label="学生色彩">
<div class="palette-set">
<button data-palette="0" class="palette"><i style="background:#d5eaeb"></i>R01 原色</button>
<button data-palette="1" class="palette"><i style="background:#b8844d"></i>金棕 · 奶油</button>
<button data-palette="2" class="palette"><i style="background:#8b9a62"></i>绿棕 · 灰绿</button>
<button data-palette="3" class="palette"><i style="background:#64a771"></i>棕底 · 绿点</button>
<button data-palette="4" class="palette"><i style="background:#ba7148"></i>锈橙 · 浅褐</button>
</div>
<div class="palette-adjust">
<label>着色 <input id="pigment" type="range" min="0" max="1" step=".01" value="1"><output id="pigmentLabel">100%</output></label>
<button id="colorReset">还原当前色系</button><button id="colorEvidence">配色依据</button>
</div></section>'''
css='''
/* Color controls never change canvas size when switching presets. */
.palette-bar{border:1px solid #384542;border-radius:7px;background:#172221;padding:7px 9px;margin-bottom:9px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.palette-set{display:flex;flex-wrap:wrap;gap:5px}.palette{font-size:11px!important;min-height:30px!important;padding:4px 8px!important;display:inline-flex;gap:6px;align-items:center}
.palette i{width:11px;height:11px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff38}.palette.on{border-color:#e0c89d;color:#ecdcbd}
.palette-adjust{display:flex;align-items:center;gap:7px}.palette-adjust label{display:flex;align-items:center;gap:5px;font-size:10px;color:#a4b3ac}.palette-adjust input{width:80px;accent-color:#d6c19a}.palette-adjust output{min-width:30px;font:10px ui-monospace,monospace}.palette-adjust button{font-size:10px;min-height:28px;padding:3px 7px}
#studentView,html.embed #studentView{height:calc(100dvh - 333px)}.pigment-sliders{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 0}.pigment-sliders label{display:flex;align-items:center;gap:8px}.pigment-sliders input{accent-color:#cbb48e;width:140px}.source-list a{display:inline-block;margin-right:10px}
@media(max-width:700px){.palette-bar{padding:6px;gap:8px}.palette-set{gap:4px}.palette{font-size:10px!important;padding:4px 6px!important}.palette-adjust{width:100%;justify-content:space-between}.palette-adjust input{width:75px}#studentView,html.embed #studentView{height:calc(100dvh - 353px);min-height:260px}}
'''
notes='''<details id="paletteEvidence"><summary>配色依据与局部控制 · NOAA / PICRC</summary><div class="notes">
<p><strong>R01 形态与老师原程序保留；现在只修改学生颜色。</strong>四套是设计试色，不是 NOAA 或 PICRC 发布的色卡，也不是已鉴定的帕劳幼珊瑚物种。点击“R01 原色”或把着色降至 0%，学生直接切回原程序。</p>
<div class="pigment-sliders"><label>斑驳细节 <input id="mottle" type="range" min="0" max="1" step=".01" value=".75"></label><label>浅色 / 绿色点缀 <input id="pale" type="range" min="0" max="1.5" step=".01" value="1"></label></div>
<p id="paletteDescription"></p>
<p>NOAA 的太平洋珊瑚资料描述了 Acropora globiceps 的棕、黄棕、绿棕、浅褐与灰绿色，以及 A. retusa 的棕绿和 A. speciosa 的锈色。这里只据此选择色系；数值、斑驳和浅色区域是本工作台的程序化设计。</p>
<p>PICRC 的报道确认其在帕劳培育 Acropora tenuis 幼珊瑚，但没有提供可直接使用的幼体标准色值，也不能证明当前分形就是该物种。R01 的“芽簇”仍只是形态类比。</p>
<p>更正之前的简化说法：共生藻并不是所有珊瑚颜色的唯一来源，NOAA 的研究也记录了珊瑚荧光蛋白。本轮“棕底·绿点”只做色彩效果，没有模拟激发光谱，不是夜间自行发光。浅色区域是几何特征代理，不当作年龄或生长端的证明。</p>
<p>颜色在相机变换之后的三维坐标和折叠特征上计算，再沿原采样累计；不是贴在屏幕上的彩色滤镜。保留原亮度结构、步进、98×12 次循环和镜头，没有新增纹理、模型、辉光或假生长。</p>
<div class="source-list">
<a href="https://www.fisheries.noaa.gov/feature-story/meet-your-pacific-islands-protected-coral-species" target="_blank" rel="noreferrer">NOAA · 太平洋珊瑚色系</a>
<a href="https://picrc.org/nearly-40000-coral-juveniles-produced-at-picrc-to-support-reef-restoration/" target="_blank" rel="noreferrer">PICRC · 幼珊瑚培育</a>
<a href="https://coastalscience.noaa.gov/data_reports/fluorescent-proteins-in-dominant-mesophotic-reef-building-corals/" target="_blank" rel="noreferrer">NOAA · 荧光蛋白</a>
</div></div></details>'''
controls=r'''
const colorNames=['R01 原色','金棕 · 奶油','绿棕 · 灰绿','棕底 · 绿点','锈橙 · 浅褐'];
const colorNotes=[
'R01 已认可原程序。学生与老师在相同时间、分辨率下应像素一致。',
'金棕与浅褐为主，混入受控的奶油浅色区域。默认色系；局部浅色是设计代理，不是对幼体年龄的测量。',
'绿棕基底与灰绿斑驳，局部浅黄绿。源于 NOAA 所述太平洋色系范围，未声称是帕劳特定幼体色卡。',
'暖棕底上分布绿色局部点缀。参考荧光色彩现象，但当前只是色彩映射；没有灯光激发或物理荧光模型。',
'锈橙、浅褐与奶油色对照。NOAA 的 A. speciosa 提供锈色色系参考，不把本形态鉴定为该物种。'
];
let colorPref={palette:1,strength:1,mottle:.75,pale:1};
try{const x=JSON.parse(localStorage.getItem('coral-young-color-r02'));if(x&&Number.isInteger(x.palette)&&x.palette>=0&&x.palette<=4){for(const k of ['strength','mottle','pale'])if(!Number.isFinite(x[k]))throw Error('invalid color preference');colorPref={palette:x.palette,strength:Math.max(0,Math.min(1,x.strength)),mottle:Math.max(0,Math.min(1,x.mottle)),pale:Math.max(0,Math.min(1.5,x.pale))}}}catch(_){}
function applyColor(){
 S.palette=colorPref.palette;S.colorSettings={...colorPref};
 document.querySelectorAll('[data-palette]').forEach(b=>{const on=Number(b.dataset.palette)===colorPref.palette;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});
 $('pigment').value=colorPref.strength;$('pigmentLabel').textContent=Math.round(colorPref.strength*100)+'%';
 $('mottle').value=colorPref.mottle;$('pale').value=colorPref.pale;
 $('paletteDescription').textContent=colorNotes[colorPref.palette];
 $('studentRole').textContent='学生 · '+colorNames[colorPref.palette];
 try{localStorage.setItem('coral-young-color-r02',JSON.stringify(colorPref))}catch(_){}
 request();
}
document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{colorPref.palette=Number(b.dataset.palette);applyColor()});
$('pigment').oninput=()=>{colorPref.strength=Number($('pigment').value);applyColor()};
$('mottle').oninput=()=>{colorPref.mottle=Number($('mottle').value);applyColor()};
$('pale').oninput=()=>{colorPref.pale=Number($('pale').value);applyColor()};
$('colorReset').onclick=()=>{colorPref.strength=1;colorPref.mottle=.75;colorPref.pale=1;applyColor()};
$('colorEvidence').onclick=()=>{const d=$('paletteEvidence');d.open=!d.open;if(d.open)d.scrollIntoView({block:'nearest',behavior:'smooth'})};
'''
