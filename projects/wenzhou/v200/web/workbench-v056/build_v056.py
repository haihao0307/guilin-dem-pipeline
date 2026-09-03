"""Wenzhou-only V0.5.6 build. Reuses the exact published V0.5.5 baseline."""
from pathlib import Path
import sys,json,gzip,hashlib,shutil,math,re,os
VERSION='wenzhou-workbench-0.5.6-mobile-view-stream'
EXPECTED='743676495bcc26f99f0afbe67189a2a029962e9f'

def sha(b):return hashlib.sha256(b).hexdigest()
def write_json(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
def replace(s,a,b):
    if a not in s:raise RuntimeError('Missing patch anchor '+a[:90])
    return s.replace(a,b)

def build(baseline,src,out):
    manifest=json.loads((baseline/'BUILD.json').read_text())
    assert manifest['sourceCommit']==EXPECTED
    for n,d in manifest['files'].items():assert sha((baseline/n).read_bytes())==d['sha256'],n
    if out.exists():shutil.rmtree(out)
    shutil.copytree(baseline,out)
    vectors=json.loads(gzip.decompress((out/'data/vectors.json.gz').read_bytes()))
    tile_dir=out/'data/view-tiles';tile_dir.mkdir()
    terrain=json.loads((out/'manifest.json').read_text())
    cx=(terrain['bounds'][0]+terrain['bounds'][2])/2;cz=(terrain['bounds'][1]+terrain['bounds'][3])/2
    groups={};segment_count=0
    for line in vectors['rivers']:
        coords=line['coords'];run=None;key=None
        for i in range(len(coords)-1):
            a,b=coords[i:i+2];x=(a[0]+b[0])/2-cx;z=cz-(a[1]+b[1])/2
            k=(math.floor(x/16000),math.floor(z/16000))
            if key!=k:
                run={j:v for j,v in line.items() if j not in ('coords','tidalDistancesM')};run['coords']=[a];run['tidalDistancesM']=[line.get('tidalDistancesM',[-1]*len(coords))[i]]
                groups.setdefault(k,[]).append(run);key=k
            run['coords'].append(b);run['tidalDistancesM'].append(line.get('tidalDistancesM',[-1]*len(coords))[i+1]);segment_count+=1
    def save_tile(id,rows):
        b=gzip.compress(json.dumps({'rivers':rows},ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
        name=f'data/view-tiles/{id}.json.gz';(out/name).write_bytes(b)
        pts=[(p[0]-cx,cz-p[1]) for row in rows for p in row['coords']]
        bounds=[min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)] if pts else [0]*4
        return {'id':id,'path':name,'bytes':len(b),'sha256':sha(b),'bounds':bounds}
    entries=[save_tile(f'{x}_{y}',rows) for (x,y),rows in sorted(groups.items())]
    overview=save_tile('overview',[r for r in vectors['rivers'] if r.get('kind')=='river'])
    index={'schema':'wenzhou-view-tiles-1','sourceSha256':manifest['files']['data/vectors.json.gz']['sha256'],'segmentCount':segment_count,'sourceCoordinatesUnchanged':True,'tileSizeM':16000,'overview':overview,'tiles':entries}
    write_json(out/'view-index.json',index)
    meta={k:v for k,v in vectors.items() if k not in ('rivers','coastlines','ocean','inlandRiverWater')};meta['rivers']=[]
    write_json(out/'vectors-meta.json',meta)
    # The original file is retained as an auditable source. Runtime never eagerly fetches it.
    for n in ['sky-pass.mjs','mobile-shell.mjs','view-stream.mjs']:shutil.copyfile(src/n,out/n)
    html=(out/'index.html').read_text()
    css='''
:root{--panel:#10272fec;--ink:#edf5f4;--muted:#aac0c4}
html,body{overscroll-behavior:none}#gl{position:fixed;inset:0;width:100%;height:100%;touch-action:none}
#topbar,footer{display:none!important}#panel{display:none;transform:none;transition:none;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));top:auto;bottom:calc(12px + env(safe-area-inset-bottom));width:auto;max-width:660px;max-height:66dvh;border-radius:20px;padding:16px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;backdrop-filter:none;box-shadow:0 15px 70px #03131c66}
#panel.open{display:block}#panel section[hidden]{display:none!important}#panel section{margin-top:12px}#panel button,#panel select,#panel input[type=date]{min-height:44px;font-size:13px;border-radius:10px;padding:8px}
#panel label,.row{font-size:13px;min-height:36px}#panel h2{font-size:13px;margin:6px 0 12px}.note,.lock{font-size:11px;line-height:1.65}.metric{padding:8px;min-height:50px}.metric span{font-size:10px}.metric b,label b{font-size:12px}.cloud-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.pair,.triple{gap:6px}#panel input[type=range]{min-height:32px}.sheet-head{display:flex;align-items:center;justify-content:space-between;position:sticky;top:-16px;background:#10272f;z-index:2;margin:-16px -16px 12px;padding:12px 16px}.sheet-tabs{display:flex;gap:6px;overflow:auto}.sheet-tabs button{flex:1;white-space:nowrap}.minimal-brand{position:fixed;left:18px;top:calc(16px + env(safe-area-inset-top));z-index:5;color:white;text-shadow:0 1px 8px #143644;font:600 18px system-ui;pointer-events:none}.minimal-brand small{font-size:10px;font-weight:400;letter-spacing:2px;display:block;margin-top:4px}.round-button{position:fixed;right:16px;top:calc(14px + env(safe-area-inset-top));z-index:6;min-width:48px;min-height:48px;border-radius:24px;background:#10272fdb;border:1px solid #cee0df60;color:white;font-size:14px}#touchToolbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(22px + env(safe-area-inset-bottom));z-index:5;display:flex;gap:5px;padding:7px;background:#10272fe8;border:1px solid #a8c4ca50;border-radius:18px;white-space:nowrap}#touchToolbar[hidden]{display:none}#touchToolbar button{min-width:52px;min-height:44px;font-size:12px;border:0;border-radius:11px}#gestureHint{position:fixed;left:50%;transform:translateX(-50%);bottom:90px;z-index:3;padding:8px 13px;background:#152f38a8;border-radius:20px;font-size:11px;color:white;white-space:nowrap;pointer-events:none}#dataBadge{position:fixed;bottom:calc(7px + env(safe-area-inset-bottom));right:12px;font-size:10px;color:#f1f7f7;text-shadow:0 1px 4px #122d36;pointer-events:none}#loadingNote{font-size:11px;color:#afc5c9;margin-top:8px}#error{z-index:20}
@media(min-width:900px){#panel{right:16px;left:auto;width:540px;bottom:20px;max-height:78dvh}}@media(max-height:500px){#panel{max-height:82dvh}#gestureHint{bottom:68px}} 
'''
    html=replace(html,'</style>',css+'\n</style>')
    html=html.replace('width=device-width,initial-scale=1','width=device-width,initial-scale=1,viewport-fit=cover').replace('seasonalAuto=true','seasonalAuto=optional').replace('温州真实大气循环工作台','温州手机优先地理工作台')
    html=html.replace('V0.5.5','V0.5.6').replace('src="./runtime.js?v=055"','src="./runtime.js?v=056"')
    html=replace(html,'<aside id="panel">','<aside id="panel" aria-hidden="true" inert><div class="sheet-head"><strong>温州 · 场景控制</strong><button id="sheetClose" aria-label="收起菜单">收起</button></div><nav class="sheet-tabs"><button data-tab-button="view">视角</button><button data-tab-button="weather">天气</button><button data-tab-button="world">地表</button><button data-tab-button="info">状态</button></nav>')
    tabs=['view','weather','weather','world','world','world','info'];counter=iter(tabs)
    html=re.sub(r'<section>',lambda _:f'<section data-tab="{next(counter)}">',html)
    html=replace(html,'<h2>温州观察位置</h2>','<h2>温州观察位置</h2><button id="dayReview">回到白天 12:00</button>')
    html=replace(html,'<h2>运行与真值</h2>','<h2>运行与真值</h2><p class="note">小温州负责温州地区。天气由独立 Weather Mother 提供只读模块，温州负责本地集成。</p><div id="loadingNote">按视野请求河道数据</div><p class="note">当前地形为 800 m 数字概览。原生 12.5 m 数据尚未接入。云高为米制场景参数，尚非实测探空。</p>')
    html=replace(html,'<body>','<body><div class="minimal-brand">小温州<small>WENZHOU · 0.5.6</small></div><button id="menuButton" class="round-button" aria-expanded="false" aria-label="打开温州控制菜单">菜单</button><nav id="touchToolbar" hidden><button data-action="home">全域</button><button data-action="coast">沿海</button><button data-action="cloudView">云中</button><button data-action="weather">天气</button></nav><div id="gestureHint">单指旋转 · 双指缩放与平移 · 点屏幕显示工具</div><div id="dataBadge">800 m 概览 · 云高 1:1</div>')
    html=html.replace('type="checkbox" checked></label>\n  <label>日历自动运行','type="checkbox"></label>\n  <label>日历自动运行').replace('id="calendarToggle" type="checkbox" checked','id="calendarToggle" type="checkbox"')
    (out/'index.html').write_text(html)
    rt=(out/'runtime.js').read_text()
    rt="import{createSky}from'./sky-pass.mjs';import{installMobileShell}from'./mobile-shell.mjs';import{createViewStream}from'./view-stream.mjs';\n"+rt
    rt=rt.replace('wenzhou-workbench-0.5.5-seasonal-real-units',VERSION)
    rt=replace(rt,'return{vao,count:ind.length,vertices:v.length/10};','return{vao,vb,ib,count:ind.length,vertices:v.length/10};')
    rt=replace(rt,'S.river=make(V,I);','if(S.river){S.gl.deleteBuffer(S.river.vb);S.gl.deleteBuffer(S.river.ib);S.gl.deleteVertexArray(S.river.vao);}S.river=make(V,I);')
    rt=replace(rt,'readData(m.vectorsPath)',"request('./vectors-meta.json')")
    rt=replace(rt,'S.vectors=JSON.parse(new TextDecoder().decode(vec));','S.vectors=vec;')
    rt=re.sub(r'let left=innerWidth>=700.*?:0;g.viewport\(left,0,w-left,h\);','let left=0;g.viewport(0,0,w,h);',rt,count=1)
    rt=replace(rt,'dpr=1,w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr)',"dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(4096000/(innerWidth*innerHeight))),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr)")
    rt=replace(rt,'(innerWidth>=2200?100:33)','33')
    rt=replace(rt,"let err=g.getError();if(err)throw Error('WebGL draw '+err);g.flush();", "if(S.frames%180===0){let err=g.getError();if(err)throw Error('WebGL draw '+err);}g.flush();")
    rt=replace(rt,'g.useProgram(S.p);g.uniformMatrix4fv(S.u.uVP,false,vp);','S.viewProjection=vp;S.sky.draw(S.eye,S.target,w,h,ws);g.useProgram(S.p);g.uniformMatrix4fv(S.u.uVP,false,vp);')
    rt=replace(rt,'viewport:[left,0,w-left,h],mode:S.mode,logFar','viewport:[left,0,w-left,h],mode:S.mode,logFar,moving:performance.now()-(S.lastInteraction||0)<400')
    rt=replace(rt,'S.gl=g;g.enable','S.gl=g;S.sky=createSky(g);g.enable')
    rt=replace(rt,"await Promise.resolve(S.weather.setAutoWeather(true));", "S.weather.setAutoWeather(false);S.weather.setCalendarPlaying(false);S.weather.setHour(12);")
    rt=replace(rt,"$('flightView').click();S.ready=true;", "$('flightView').click();S.ready=true;installMobileShell(S,surface,record);const ix=await request('./view-index.json');S.stream=createViewStream({index:ix,onChange:rows=>{S.vectors.rivers=rows;riverMesh();},onError:e=>{S.streamError=e;}});")
    rt=replace(rt,'function loop(now){try{let dt=(now-last)/1000;',"function loop(now){try{if(document.hidden){last=now;requestAnimationFrame(loop);return;}let dt=(now-last)/1000;")
    rt=replace(rt,'if(draw())count++;mark();',"if(draw())count++;S.stream?.update(S);if(now-(S.lastMark||0)>180){mark();S.lastMark=now;const t=S.stream?.stats;if(t)$('loadingNote').textContent=`当前 ${t.activeTiles} 块 · 缓存 ${t.cachedTiles} 块 · 待载 ${t.pending} · 已传 ${(t.receivedBytes/1024).toFixed(0)} KB · ${S.streamError||t.detailLevel}`;}")
    rt=replace(rt,"ui:{compact:true,topBarPx:38,panelWidthPx:226}","ui:{mobileFirst:true,sheetOpen:S.mobile?.sheetOpen||false,gestures:S.mobile?.stats,fullCanvas:true},viewStream:S.stream?.stats,sky:{defaultHour:12,calendarStartsPaused:true},cameraRadius:S.r")
    # A testable navigation API uses the same camera state as touch input.
    rt=replace(rt,'window.__WZ_API__={','window.__WZ_API__={navigate:(x,z,r)=>{S.cur=[x,z];S.r=r;S.lastEye=null;},')
    (out/'runtime.js').write_text(rt)
    weather=(out/'weather-scene.mjs').read_text()
    weather=weather.replace("'0.5.5-seasonal-real-units'","'0.5.6-mobile-view-stream'").replace('hour: 15.5,','hour: 12,').replace('calendarPlaying: true,','calendarPlaying: false,').replace('autoWeather: true,','autoWeather: false,')
    weather=replace(weather,'const typhoonChance = Number(dateIso.slice(5, 7)) >= 8 ? 0.08 : 0.035;','const typhoonChance = 0; // Extreme events require explicit selection or sourced event data.')
    weather=replace(weather,'function draw({ vp, eye, target, viewport, mode, logFar })','function draw({ vp, eye, target, viewport, mode, logFar, moving = false })')
    weather=replace(weather,'gl.uniform1f(uniform(\'uStepCount\'), steps);',"gl.uniform1f(uniform('uStepCount'), moving?10:(state.quality==='high'?48:30));")
    weather=replace(weather,'uniform float uGenus,uPhaseG','uniform float uDay;\nuniform float uGenus,uPhaseG')
    weather=replace(weather,"gl.uniform1f(uniform('uGenus'), profile.genusCode);","gl.uniform1f(uniform('uDay'), current.solar.day);gl.uniform1f(uniform('uGenus'), profile.genusCode);")
    # The upstream field already encodes genus morphology. Avoid evaluating 3D fractals per ray sample.
    weather=replace(weather,'return morphology(worldP,q,base);','float h=(worldP.y-uCloudVerticalM.x)/max(1.,uCloudVerticalM.y-uCloudVerticalM.x);return smoothstep(0.025,0.72,base)*verticalEnvelope(h)*uDensityScale;')
    weather=replace(weather,'vec3 ambient=mix(vec3(0.19,0.24,0.31),vec3(0.49,0.58,0.68),h);','vec3 ambient=mix(vec3(0.22,0.27,0.34),vec3(0.58,0.66,0.75),h);')
    weather=replace(weather,'return lit;','return lit*mix(0.055,1.0,uDay);')
    weather=replace(weather,'vec3(0.48,0.58,0.67),clamp(aerial,0.0,0.72)','mix(vec3(0.01,0.02,0.04),vec3(0.43,0.63,0.78),uDay),clamp(aerial,0.0,0.72)')
    weather=replace(weather,'function rebuild() {\n    job++;','function rebuild() {\n    if(resolver)resolver({superseded:true});resolver=rejecter=null;\n    job++;')
    (out/'weather-scene.mjs').write_text(weather)
    shaders=(out/'shaders.js').read_text()
    shaders=shaders.replace('vec3(.055,.11,.04),vec3(.15,.22,.08)','vec3(.027,.083,.041),vec3(.115,.195,.065)')
    shaders=shaders.replace('vec3(.12+.29*uAtmosphere.z*uAtmosphere.x)','vec3(.08+.30*uAtmosphere.z*uAtmosphere.x)')
    shaders=shaders.replace('vec3(.56,.65,.71),clamp(weatherFog,0.,.78)','mix(vec3(.01,.02,.04),vec3(.38,.56,.70),uAtmosphere.x),clamp(weatherFog,0.,.78)')
    (out/'shaders.js').write_text(shaders)
    receipt={**manifest,'version':VERSION,'sourceCommit':os.environ.get('GITHUB_SHA','local-unpublished'),'baselineCommit':EXPECTED,'baselinePublication':'06030ac61c4115b3ea1b8c125f4f1061c4e67b26'}
    receipt['viewStreaming']={'tileCount':len(entries),'sourceSegmentsPreserved':segment_count,'maxParallelRequests':2,'maxCachedTiles':24,'nativeDemConnected':False,'eagerFullVectorDownload':False}
    receipt['mobile']={'singleFingerRotate':True,'twoFingerZoomAndPan':True,'longPressGroundFocus':True,'sheetInitiallyClosed':True,'minimumButtonCssPx':44,'nativeDrawingBufferMaxPixels':4096000}
    receipt['displayContract']={'controllerViewport':[2560,1600],'devicePixelRatio':'responsive, maximum 2','maxDrawingBufferPixels':4096000}
    receipt['scientificStatus']['nasaPowerConnected']=False
    receipt['scientificStatus']['seasonalSelection']='deterministic rule candidate; no automatic extreme events'
    receipt['files']={n.relative_to(out).as_posix():{'bytes':n.stat().st_size,'sha256':sha(n.read_bytes())} for n in sorted(out.rglob('*')) if n.is_file() and n.name!='BUILD.json'}
    write_json(out/'BUILD.json',receipt)
    print(json.dumps({'version':VERSION,'viewStreaming':receipt['viewStreaming'],'bootstrapVectorBytes':(out/'vectors-meta.json').stat().st_size,'oldEagerVectorBytes':6044961},indent=2))
if __name__=='__main__':build(Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]))
