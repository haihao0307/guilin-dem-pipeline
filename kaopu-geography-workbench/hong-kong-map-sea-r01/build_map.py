from pathlib import Path
import json,gzip,base64,hashlib,re,numpy as np
R=Path(__file__).resolve().parent
source=R.parent/'hong-kong-background-sea-r01/index.html'
s=source.read_text()
assert hashlib.sha256(source.read_bytes()).hexdigest()=='84c48cc777f9860cb3e62cbfe2246a7e5fbf49e206d740546fd0f4abf7d46325'
D=json.loads((R/'data/scene.json').read_text());height=np.load(R/'data/heights.npy').astype('<f4');mask=np.load(R/'data/mask.npy').astype('u1');assert height.shape==mask.shape==(D['height'],D['width'])
D['heights']=base64.b64encode(gzip.compress(height.tobytes(),mtime=0)).decode();D['mask']=base64.b64encode(gzip.compress(mask.tobytes(),mtime=0)).decode()
D['build']='HK-MAP-SEA-R01-20261013'; data_script='<script>window.HK_MAP_DATA='+json.dumps(D,ensure_ascii=False,separators=(',',':'))+';</script>'
s=s.replace('<script>\n/* Ocean adapter.',data_script+'<script>\n/* Ocean adapter.',1)
s=s.replace('<title>KAOPU 香港背景海 · Ocean Mother 试接 R01</title>','<title>陆港铁路 · 香港海陆总览 R01</title>')
s=s.replace('data-build="HK-BACKGROUND-SEA-R01C-20261012" data-map-assembled="false"','data-build="HK-MAP-SEA-R01-20261013" data-map-assembled="true"')
s=s.replace('香港背景海试接：Ocean Mother V001 实时位移海面，地图尚未装配','香港真实 30 米背景地形与 Ocean Mother 海面；架空铁路概念走向')
s=s.replace('<h1>KAOPU · 香港背景海</h1><span>Ocean Mother V001 · R01C</span><b id="mapStatus">独立试接 · 香港地图尚未装配</b>','<h1>陸港鐵路 · 香港海陸總覽</h1><span>HONG KONG TERRAIN / OCEAN MOTHER R01C</span><b id="mapStatus">真实 30 m 背景 · 现代地表 · 故事线为概念</b>')
s=s.replace('<section id="titleCard">','<section id="titleCard">').replace('<div class="eyebrow">HONG KONG · BACKGROUND SEA TRIAL</div><h2 id="presetTitle">香港蓝绿背景海</h2><p id="caption">长涌浪、局部风浪与微细波纹共同演化。</p>','<div class="eyebrow">MODERN GEOGRAPHY / FICTIONAL RAILWAY</div><h2 id="presetTitle">从维多利亚港到罗湖</h2><p id="caption">粉色虚线：架空走向意向，未做坡度与隧道工程。蓝线：现代东铁参照。</p>')
s=s.replace('24 层几何波 · 原版法线与反光 · 地图未装配','30 m DSM · 真米制高度 1× · 现代海岸 · 非 0.5 m 近景')
s=s.replace('此页尚未接入香港地形、铁路、岸线、海底或潮汐。','地图采用真实 30 m DSM 概览，海岸采用现代水体数据。无海底或潮汐；不代替原 0.5 m DTM，也不代表 1970 年代海岸。')
s=s.replace('<strong>香港背景海</strong>','<strong>香港海陆总览</strong>')
css='''\n#panel{display:none}#panel.open{display:block}.mapLabel{position:fixed;transform:translate(-50%,-100%);padding:3px 7px;border:1px solid #ffffff40;border-radius:4px;background:#0b1e27d9;color:#ecf4ed;font-size:11px;white-space:nowrap;text-shadow:0 1px 3px #000;pointer-events:none}.mapLabel.story{border-color:#ef88ac;color:#ffbed4}.mapLabel.reference{color:#b5d4d9}.mapLabel:after{content:'';position:absolute;bottom:-5px;left:50%;height:5px;border-left:1px solid #fff8}#mapLabels{position:fixed;inset:0;pointer-events:none;z-index:2}#mapViews{position:fixed;left:30px;top:96px;z-index:4;display:flex;gap:6px;max-width:calc(100% - 50px);flex-wrap:wrap}#mapLegend{position:fixed;right:24px;bottom:70px;max-width:310px;padding:13px 15px;background:#081e29df;border:1px solid #bcdfcc33;border-radius:8px;font-size:11px;z-index:3;color:#d3e6df}#mapLegend p{margin:4px 0}#mapLegend small{color:#a4bdba;font-size:10px}#titleCard h2{font-size:25px}#titleCard p{max-width:420px}#titleCard{bottom:77px}.legendKey{display:inline-block;width:25px;border-top:3px solid #52bfff;vertical-align:middle;margin-right:7px}.legendKey.story{border-top:3px dashed #ff7cac}.sourceLink{font-size:10px}#titleCard{pointer-events:none}@media(max-width:700px){#mapViews{top:96px;left:12px;gap:4px}#mapViews button{font-size:10px;padding:5px 7px}#mapLegend{right:10px;bottom:60px;max-width:230px;padding:8px;font-size:10px}#mapLegend .extra{display:none}#titleCard{display:none}.mapLabel{font-size:9px;padding:2px 4px}#mast .topActions button{padding:5px}#mapStatus{max-width:240px;font-size:9px}}
'''
s=s.replace('</style>',css+'</style>',1)
s=s.replace('<div id="oceanControls"></div>','<div id="oceanControls"></div><details><summary>数据与来源</summary><p>produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved</p><p>海陆：同源官方 Water Body Mask。EPSG:2326 统一水平坐标；高程保持 EGM2008，海面显示零位，无潮汐模型。未与 HKPD 混接。</p><p>© OpenStreetMap contributors，<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">ODbL</a>；<a href="https://www.openstreetmap.org/relation/4248592" target="_blank" rel="noopener">东铁源关系</a>。蓝线没有轨面高程，只作地图标注。</p><p>地图外为未加载区域，无人为侧墙。此页面不代表历史海岸或已成型铁路工程。</p></details>')
nav='''<nav id="mapViews"><button data-map-view="overview" class="active">整条线路</button><button data-map-view="harbour">维港 / 第二站</button><button data-map-view="lion">狮子山穿山</button><button data-map-view="shatin">沙田候选区</button><button id="showStory">故事线 开</button><button id="showRail">真实线 开</button><button id="showLabels">地名 开</button></nav><aside id="mapLegend"><p><i class="legendKey story"></i>故事概念线，尚未工程定线</p><p><i class="legendKey"></i>现代东铁，仅地理参照</p><p>第二站与沙田站均为候选区域。</p><p class="extra">沙田候选综合城门河、马场、大学关系；狮子山为穿山意向。</p><small>拖动旋转 · 滚轮缩放 · 右键拖动平移<br>高程设色，非卫星影像。山体真高度 1×。<br>Copernicus GLO-30 DSM / EGM2008，约 30 m。<br>尚未恢复并接入 0.5 m CEDD DTM 近景。</small></aside>'''
s=s.replace('<aside id="panel">',nav+'<aside id="panel">',1)
# Only geographic clipping is added to the frozen water fragment; its lighting/wave core is not rewritten.
old="const seaProgram=program(await text('ocean.vert'),atmosphere+await text('water.frag')),skyProgram=program(V,atmosphere+await text('sky.frag')),envProgram=program(V,envSource);"
new="""const clipWater=(await text('water.frag')).replace('void main(){','uniform sampler2D uHKMask;uniform vec4 uHKBbox;\\nvoid main(){vec2 uv=(wPos.xz-uHKBbox.xy)/uHKBbox.zw;if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))discard;if(texture(uHKMask,uv).r>.001)discard;');
const seaProgram=program(await text('ocean.vert'),atmosphere+clipWater),skyProgram=program(V,atmosphere+await text('sky.frag')),envProgram=program(V,envSource);"""
assert old in s;s=s.replace(old,new)
anchor="const f=(p,n,x)=>gl.uniform1f(loc(p,n),x),i=(p,n,x)=>gl.uniform1i(loc(p,n),x),v2=(p,n,a,b)=>gl.uniform2f(loc(p,n),a,b),v3=(p,n,a)=>gl.uniform3fv(loc(p,n),a),v4=(p,n,a)=>gl.uniform4fv(loc(p,n),a);"
assert anchor in s;s=s.replace(anchor,anchor+'\n'+(R/'map-integration.js').read_text())
s=re.sub(r'function cameraData\(\)\{.*?\}\nfunction set', 'function cameraData(){return mapCamera()}\nfunction set',s,count=1)
anchor="gl.bindVertexArray(gridVao.vao);gl.drawElements(gl.TRIANGLES,gridIndexCount,gl.UNSIGNED_INT,0);"
replacement="gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,hkMaskTex);i(seaProgram,'uHKMask',6);v4(seaProgram,'uHKBbox',hkBox);"+anchor+"\ndrawHK(now,s,e,c);"
assert anchor in s;s=s.replace(anchor,replacement,1)
start=s.index("$('reset').onclick=");end=s.index("$('newSeed').onclick=",start)
s=s[:start]+"$('reset').onclick=()=>mapFocus('overview');$('togglePanel').onclick=()=>$('panel').classList.toggle('open');\n"+s[end:]
start=s.index('let drag=false,x=0,y=0;');end=s.index('function config()',start)
s=s[:start]+'''let drag=false,pan=false,x=0,y=0;canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{drag=true;pan=e.button===2||e.shiftKey;x=e.clientX;y=e.clientY;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;let dx=e.clientX-x,dy=e.clientY-y;if(pan){let c=mapCamera(),scale=mapState.distance*.001;mapState.target[0]-=c.right[0]*dx*scale-c.flat[0]*dy*scale;mapState.target[2]-=c.right[2]*dx*scale-c.flat[2]*dy*scale}else{mapState.yaw-=dx*.004;mapState.pitch=clamp(mapState.pitch-dy*.003,-1.5,-.15)}x=e.clientX;y=e.clientY;needFrame=true};canvas.onpointerup=()=>drag=false;canvas.onpointercancel=()=>drag=false;canvas.addEventListener('wheel',e=>{e.preventDefault();mapState.distance=clamp(mapState.distance*Math.exp(e.deltaY*.001),2000,60000);needFrame=true},{passive:false});addEventListener('resize',()=>needFrame=true);
for(const el of document.querySelectorAll('[data-map-view]'))el.onclick=()=>mapFocus(el.dataset.mapView);for(const [id,key,label]of [['showStory','story','故事线'],['showRail','rail','真实线'],['showLabels','labels','地名']])$(id).onclick=()=>{mapState[key]=!mapState[key];$(id).textContent=label+' '+(mapState[key]?'开':'关');needFrame=true};mapFocus('overview');
''' +s[end:]
# Preserve original named preset parameters but avoid reintroducing obsolete map status copy.
s=s.replace("$('presetTitle').textContent=p.title;$('caption').textContent=p.caption;",'')
# Standalone adapter is no longer a not-assembled status source.
s=s.replace('mapAssembled:false,terrainAssembled:false,railwayAssembled:false,seaLevelDatum:\'UNBOUND\'','mapAssembled:true,terrainAssembled:true,railwayAssembled:false,seaLevelDatum:\'EGM2008 display zero; not HKPD\'')
(R/'index.html').write_text(s)
manifest={k:v for k,v in D.items() if k not in ['heights','mask']};manifest.update({'sourceOceanSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'htmlBytes':len(s.encode()),'htmlSha256':hashlib.sha256(s.encode()).hexdigest(),'displayOnly':True,'native05mRestored':False,'visualAcceptance':False,'productionReady':False,'scope':'independent case; existing Ocean R01C and geography cases unchanged'})
(R/'SOURCE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('built',len(s.encode()),manifest['htmlSha256'])
