#!/usr/bin/env python3
"""Build, test and narrowly publish Coast 0.1.2 playback repair."""
from __future__ import annotations
import base64, hashlib, json, os, pathlib, subprocess, sys, time, urllib.error, urllib.request

REPO='haihao0307/guilin-dem-pipeline'
BRANCH='work/ocean-mother-handoff-20260901'
BASE_SOURCE='879c7015d3f7086ffcbc39025602b66db752d829'
DEEP_REF='970aa25814e5d5f98cf10091da69666f62dbcd28'
RUNTIME='ocean-mother/coast-v012'
TOOLS='ocean-mother/coast-tools-v012'
BASE_RUNTIME='ocean-mother/coast-v011'
BASE_TOOLS='ocean-mother/coast-tools-v011'
POLICY_SHA='fe69ea88c05d9b8c74e79e21c2c2c719dc096b677848eb40305575f08b5b8fdf'
BASE_HASHES={
 'coast-app.mjs':'1177a960eef76783a49513d418616b26fca71af848570971d43cf42cb793df74',
 'coast-core.mjs':'4e2f910c55d3e5cb4aff4ed016d87c435708a8e199ae4e0d49f32376c7ac4872',
 'shaders.mjs':'9a81eb33c2252a4e6beef7698fa0860bc28fc856a65c5838cd5633f44694690e',
 'rock-domain.mjs':'449fbdcbdab1ee58bc04030da638ae83300828068ba625e8edd78772f98c8b18',
 'index.html':'51e73241f968ee790922b26566557479df41e742425f70a203dd5fc52a31720f',
 'coast.css':'f20405b6d0e7d15ffa3d65deaf8a676291d50e2affc396d3af3f3921dcd143b3',
 'policy.json':POLICY_SHA,
 'README.md':'1a7767ac2e0611a9aa3c8b7252480677d713d95c4937648a490a2cd2d2a62ed8',
 'BUILD_TEMPLATE.json':'d1de3e8090f72bf55e6361b49a3a7e7640fc909a26652e73f8f2fa53b8f060fe',
}
BASE_TOOL_HASHES={
 'browser_qa.py':'c01cd0140bf3a350b367e781422155849edc0089a4485546b52989b55e830dbc',
 'core.test.mjs':'000b4ff04031d5d70c27543bc23770c67862fb3a8f55dbb690e65f5e6bc0a535',
 'mesh.test.mjs':'ae1e3bf4fa24d87a8d2883b16e08230faff5183e24fd5195666e5ebca7592088',
}
FINAL_HASHES={
 'coast-app.mjs':'0a4aaf665bb823ce8a7b289c43da7d97cb05a7ac2c02f106f27cdfa30cee37af',
 'index.html':'ad0c4013222bbe70b72b8d95f786101c18a81e12e56faafd421cb7c28baa2118',
 'README.md':'32240db0c7e2f07aa846fff951bf969365e608d974b4ecad5e6fd15170586e41',
 'BUILD_TEMPLATE.json':'bfe4d4771e245f9444f94e219f64f5c5cc55db4ce466fa9723dade303fb16ece',
 'browser_qa.py':'31c5cf35d835b0d867b1b46d86dda1ac5a77646c02b6a3ca065217ef84a7d8d9',
 'core.test.mjs':'f2909a8dc7ba534c0b6592f94603323476fa51dd455934b9cfd51b740f18476c',
 'mesh.test.mjs':'9a5b46c525217d1af952184fab47a69d28f13abdb0a48c331533ea689d7f352c',
}
sha=lambda b:hashlib.sha256(b).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
encode=lambda d:(json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode()

def get(ref:str,path:str)->bytes:
    url=f'https://raw.githubusercontent.com/{REPO}/{ref}/{path}'
    with urllib.request.urlopen(url,timeout=60) as r:
        assert r.status==200
        return r.read()

def api(path:str,body=None,method=None):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,
      data=None if body is None else json.dumps(body).encode(),
      method=method or ('GET' if body is None else 'POST'),
      headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)

def rep(s:str,old:str,new:str)->str:
    if s.count(old)!=1:raise AssertionError(('replacement count',s.count(old),old[:90]))
    return s.replace(old,new,1)

def transform(runtime:dict[str,bytes],tools:dict[str,bytes]):
    s=runtime['coast-app.mjs'].decode()
    s=rep(s,"qa={version:'0.1.1-coast'","qa={version:'0.1.2-coast'")
    s=rep(s,"volumetricBreaking:false};","volumetricBreaking:false,displayLagSkippedSeconds:0,resumeCount:0,realtimeLimited:false,pauseReason:null,lastResume:null};")
    marker="function range(parent,id,label,min,max,step,value,unit,onchange){"
    addition="function pauseSimulation(reason='manual'){paused=true;W.pause();qa.pauseReason=reason;$('pause').textContent='继续运行';last=performance.now();}\nfunction resumeSimulation(reason='manual'){const pending=Math.max(0,accumulator);qa.displayLagSkippedSeconds=(qa.displayLagSkippedSeconds||0)+pending;qa.lastResume={reason,droppedDisplayLagSeconds:pending,physicalTime:sim?.t??0};qa.resumeCount=(qa.resumeCount||0)+1;qa.pauseReason=null;qa.backlogPause=false;qa.realtimeLimited=false;accumulator=0;paused=false;W.play();$('pause').textContent='暂停';$('status').textContent='Coast · 演化中';last=performance.now();}\n"
    s=rep(s,marker,addition+marker)
    s=rep(s,"$('pause').onclick=()=>{paused=!paused;if(paused)W.pause();else W.play();$('pause').textContent=paused?'继续':'暂停';last=performance.now();};","$('pause').onclick=()=>paused?resumeSimulation('button'):pauseSimulation('button');")
    s=rep(s,"function VERSION(){return '0.1.1-coast'}","function VERSION(){return '0.1.2-coast'}")
    s=rep(s,"paused=new URLSearchParams(location.search).has('still');last=performance.now();accumulator=0;$('pause').textContent=paused?'继续':'暂停';$('loading').style.display='none';","paused=new URLSearchParams(location.search).has('still');accumulator=0;qa.backlogPause=false;qa.realtimeLimited=false;qa.pauseReason=paused?'still':null;if(paused)W.pause();else W.play();last=performance.now();$('pause').textContent=paused?'继续运行':'暂停';$('loading').style.display='none';")
    s=rep(s,"paused=true;W.pause();$('pause').textContent='继续';qa.lastReplay=","pauseSimulation('replay');qa.lastReplay=")
    old="try{const elapsed=last?(now-last)/1000:0;last=now;if(!paused)accumulator+=elapsed*speed;let steps=0;while(!paused&&accumulator>=sim.dt&&steps<8){advance();accumulator-=sim.dt;steps++;}qa.pendingSimulationSeconds=accumulator;if(accumulator>2&&!paused){paused=true;W.pause();$('pause').textContent='继续';qa.backlogPause=true;$('status').textContent='设备未跟上，已暂停。可降低窗口尺寸后继续。';}\n"
    new="try{const elapsed=last?(now-last)/1000:0;last=now;if(!paused){const requested=Math.max(0,elapsed*speed),capacity=sim.dt*16,accepted=Math.min(requested,capacity);qa.lastFrameRequestedSeconds=requested;qa.lastFrameAcceptedSeconds=accepted;if(requested>accepted+1e-9){qa.displayLagSkippedSeconds+=requested-accepted;qa.realtimeLimited=true;}else qa.realtimeLimited=false;accumulator+=accepted;}let steps=0;while(!paused&&accumulator>=sim.dt&&steps<16){advance();accumulator-=sim.dt;steps++;}qa.pendingSimulationSeconds=accumulator;qa.backlogPause=false;\n"
    s=rep(s,old,new)
    s=rep(s,"$('status').textContent=qa.backlogPause?'已暂停以保留求解时间':'Coast · '+(paused?'已暂停':'演化中');","$('status').textContent=paused?'Coast · 已暂停':qa.realtimeLimited?'算力限速 · 仍在连续演化':'Coast · 演化中';")
    s=rep(s,"积压时间 ${accumulator.toFixed(3)} s\\n像素","待求解时间 ${accumulator.toFixed(3)} s\\n墙钟未追赶 ${qa.displayLagSkippedSeconds.toFixed(3)} s\\n继续次数 ${qa.resumeCount}\\n像素")
    s=rep(s,"pause:()=>{paused=true;W.pause();},play:()=>{paused=false;W.play();qa.backlogPause=false;last=performance.now();},advanceSteps","pause:()=>pauseSimulation('api'),play:()=>resumeSimulation('api'),resume:reason=>resumeSimulation(reason||'api'),isPaused:()=>paused,advanceSteps")
    runtime['coast-app.mjs']=s.encode()

    h=runtime['index.html'].decode()
    h=h.replace('COAST / 边界与岩体校正','COAST / 连续运行修复').replace('<button id="pause">暂停</button>','<button id="pause" title="暂停后可从当前物理状态继续运行">暂停</button>').replace('R007 / 96 × 84 m。侧面为观察剖切，横向流量单独记账。三维翻卷与体素烟火仍待接入，视觉批准待定。','R008 / 连续运行修复。交互长帧会降低墙钟追赶速度并明确记账，固定物理步长保持；暂停按钮可从当前状态继续运行。三维翻卷与体素烟火仍待接入，视觉批准待定。').replace('COAST 011','COAST 012')
    runtime['index.html']=h.encode()

    r=runtime['README.md'].decode().replace('# Ocean Mother / Coast 0.1.1','# Ocean Mother / Coast 0.1.2')
    r += "\n## 连续运行修复\n\n参数拖动或浏览器长帧不再触发永久积压暂停。调度器继续使用 1/120 s 固定物理步长，每个显示帧最多推进 16 步。设备暂时跟不上时，显示时钟降低追赶速度并在 `displayLagSkippedSeconds` 中明确累计，物理状态和历史不重置。\n\n顶部按钮在暂停时显示“继续运行”。继续会从当前物理状态恢复，清空只属于墙钟追赶的待处理量，同时写入 `lastResume` 与累计次数。新种子不再承担恢复运行的职责。\n\n本修复只涉及播放调度和状态记录，水体方程、网格、岸线、岩石、烟火、天气与深海均保持 V0.1.1 的运行内容。\n"
    runtime['README.md']=r.encode()

    d=json.loads(runtime['BUILD_TEMPLATE.json']);d['version']='0.1.2-coast';d['sourceCommit']=None;d['scheduler']='fixed 1/120 s; max 16 physics steps per display frame; explicit display-lag accounting';runtime['BUILD_TEMPLATE.json']=encode(d)
    tools['core.test.mjs']=tools['core.test.mjs'].decode().replace('../coast-v011/','../coast-v012/').encode()
    tools['mesh.test.mjs']=tools['mesh.test.mjs'].decode().replace('../coast-v011/','../coast-v012/').encode()
    q=tools['browser_qa.py'].decode().replace("'version':'0.1.1-coast'","'version':'0.1.2-coast'").replace("OceanCoast.qa.version==='0.1.1-coast'","OceanCoast.qa.version==='0.1.2-coast'")
    marker="  check('no imported image requests',not imageReq,imageReq)"
    extra="  # Regression: a long interaction frame must no longer dead-stop the simulation.\n  page.evaluate(\"OceanCoast.play();const t=performance.now();while(performance.now()-t<2300){}\")\n  start=page.evaluate('OceanCoast.getState().t')\n  page.wait_for_function('(t)=>OceanCoast.getState().t>t',arg=start,timeout=180000)\n  check('long interaction frame keeps simulation running',not page.evaluate('OceanCoast.isPaused()'))\n  check('display lag is explicitly accounted',page.evaluate('OceanCoast.qa.displayLagSkippedSeconds')>1,page.evaluate('OceanCoast.qa.displayLagSkippedSeconds'))\n  page.locator('#pause').click();check('pause button stops at current state',page.evaluate('OceanCoast.isPaused()') and page.locator('#pause').inner_text()=='继续运行')\n  frozen=page.evaluate('OceanCoast.getState().t');page.wait_for_timeout(400);check('manual pause preserves physical time',abs(page.evaluate('OceanCoast.getState().t')-frozen)<1e-12)\n  page.locator('#pause').click();page.wait_for_function('(t)=>OceanCoast.getState().t>t',arg=frozen,timeout=180000)\n  check('continue button resumes without new seed',not page.evaluate('OceanCoast.isPaused()') and page.evaluate('OceanCoast.qa.resumeCount')>0)\n  page.evaluate('OceanCoast.pause()')\n"
    q=rep(q,marker,extra+marker)
    tools['browser_qa.py']=q.encode()
    for n,h in FINAL_HASHES.items():
        actual=sha((runtime if n in runtime else tools)[n])
        assert actual==h,(n,actual,h)
    return runtime,tools

def load_and_transform():
    runtime={};tools={}
    for n,h in BASE_HASHES.items():
        b=get(BASE_SOURCE,BASE_RUNTIME+'/'+n);assert sha(b)==h,(n,sha(b));runtime[n]=b
    for n,h in BASE_TOOL_HASHES.items():
        b=get(BASE_SOURCE,BASE_TOOLS+'/'+n);assert sha(b)==h,(n,sha(b));tools[n]=b
    return transform(runtime,tools)

def write_stage(runtime,tools):
    root=pathlib.Path('stage')
    for n,b in runtime.items():
        p=root/RUNTIME/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    for n,b in tools.items():
        p=root/TOOLS/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
    m=json.loads(get(DEEP_REF,'ocean-mother/v001/MANIFEST.json'))
    p=root/'ocean-mother/v001';p.mkdir(parents=True,exist_ok=True)
    (p/'MANIFEST.json').write_bytes(get(DEEP_REF,'ocean-mother/v001/MANIFEST.json'))
    for n,e in m['files'].items():
        b=get(DEEP_REF,'ocean-mother/v001/'+n);assert len(b)==e['bytes'] and sha(b)==e['sha256'];q=p/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b)
    return len(m['files'])

def stage_and_commit():
    assert os.environ['GITHUB_REPOSITORY']==REPO and os.environ['GITHUB_REF']=='refs/heads/'+BRANCH
    head=os.environ['GITHUB_SHA'];runtime,tools=load_and_transform();deep=write_stage(runtime,tools)
    for p in [pathlib.Path('stage')/RUNTIME/n for n in runtime if n.endswith(('.mjs','.js'))]:subprocess.run(['node','--check',str(p)],check=True)
    test=subprocess.run(['node','--test','stage/'+TOOLS+'/core.test.mjs','stage/'+TOOLS+'/mesh.test.mjs'],capture_output=True,text=True)
    pathlib.Path('evidence').mkdir(exist_ok=True);pathlib.Path('evidence/CORE_TESTS.tap').write_text(test.stdout+test.stderr)
    assert test.returncode==0 and '# pass 28' in test.stdout and '# fail 0' in test.stdout
    assert api('/git/ref/heads/'+BRANCH)['object']['sha']==head
    for d in ['coast-v012','coast-tools-v012']:
        try:api('/contents/ocean-mother/'+d+'?ref='+head)
        except urllib.error.HTTPError as e:
            if e.code!=404:raise
        else:raise RuntimeError('V012 source already exists; refuse replacement')
    entries=[];allfiles={**{RUNTIME+'/'+n:b for n,b in runtime.items()},**{TOOLS+'/'+n:b for n,b in tools.items()}}
    for n,b in allfiles.items():
        bid=api('/git/blobs',{'content':b.decode(),'encoding':'utf-8'})['sha'];assert bid==blob(b);entries.append({'path':n,'mode':'100644','type':'blob','sha':bid})
    base=api('/git/commits/'+head)['tree']['sha'];tree=api('/git/trees',{'base_tree':base,'tree':entries})['sha']
    source=api('/git/commits',{'message':'fix(ocean): keep Coast running after parameter changes and make continue button effective','tree':tree,'parents':[head]})['sha']
    diff=api('/compare/'+head+'...'+source)['files'];assert len(diff)==len(allfiles) and all(x['status']=='added' and x['filename'] in allfiles for x in diff)
    assert api('/git/ref/heads/'+BRANCH)['object']['sha']==head
    api('/git/refs/heads/'+BRANCH,{'sha':source,'force':False},'PATCH');assert api('/git/ref/heads/'+BRANCH)['object']['sha']==source
    build=json.loads(runtime['BUILD_TEMPLATE.json']);build['sourceCommit']=source;build['workflowRunId']=int(os.environ['GITHUB_RUN_ID']);buildb=encode(build)
    (pathlib.Path('stage')/RUNTIME/'build.json').write_bytes(buildb)
    ids={n:{'bytes':len(b),'sha256':sha(b),'gitBlobSha':blob(b)} for n,b in allfiles.items()}
    pathlib.Path('evidence/SOURCE.json').write_bytes(encode({'sourceCommit':source,'workflowCommit':head,'version':'0.1.2-coast','files':ids,'deepFilesVerified':deep,'nodeTests':28,'visualApproved':False,'productionApproved':False}))
    pathlib.Path('evidence/build.json').write_bytes(buildb)
    with open(os.environ['GITHUB_ENV'],'a') as f:f.write('COAST_V012_SOURCE='+source+'\n')
    print(source)

def publish():
    q=json.loads(pathlib.Path('candidate-browser/QA.json').read_text());assert q['status']=='BROWSER_QA_PASS' and len(q['checks'])>=47 and all(x['passed'] for x in q['checks']) and not q['errors']
    names=['coast-app.mjs','coast-core.mjs','shaders.mjs','rock-domain.mjs','index.html','coast.css','policy.json','README.md','build.json']
    files={n:(pathlib.Path('stage')/RUNTIME/n).read_bytes() for n in names}
    source=json.loads(pathlib.Path('evidence/SOURCE.json').read_text())['sourceCommit'];assert json.loads(files['build.json'])['sourceCommit']==source
    manifest={'format':'ocean-coast-runtime-manifest','version':'0.1.2-coast','sourceCommit':source,'candidateRun':int(os.environ['GITHUB_RUN_ID']),'files':{n:{'bytes':len(b),'sha256':sha(b)} for n,b in files.items()},'schedulerRegressionChecks':['long interaction remains running','pause preserves physical time','continue resumes without new seed','display lag accounted'],'visualApproved':False,'productionApproved':False,'fullReplication':False}
    files['MANIFEST.json']=encode(manifest)
    blobs={}
    for n,b in files.items():
        bid=api('/git/blobs',{'content':b.decode(),'encoding':'utf-8'})['sha'];assert bid==blob(b);blobs[n]=bid
    subtree=api('/git/trees',{'tree':[{'path':n,'mode':'100644','type':'blob','sha':bid} for n,bid in blobs.items()]})['sha']
    parent=api('/git/ref/heads/gh-pages')['object']['sha']
    try:api('/contents/'+RUNTIME+'?ref='+parent)
    except urllib.error.HTTPError as e:
        if e.code!=404:raise
    else:raise RuntimeError('Public V012 already exists; refuse replacement')
    base=api('/git/commits/'+parent)['tree']['sha'];tree=api('/git/trees',{'base_tree':base,'tree':[{'path':RUNTIME,'mode':'040000','type':'tree','sha':subtree}]})['sha']
    deploy=api('/git/commits',{'message':'deploy(ocean): publish Coast V012 continuous-run repair','tree':tree,'parents':[parent]})['sha']
    diff=api('/compare/'+parent+'...'+deploy)['files'];assert len(diff)==len(files) and all(x['status']=='added' and x['filename'].startswith(RUNTIME+'/') for x in diff)
    if api('/git/ref/heads/gh-pages')['object']['sha']!=parent:raise RuntimeError('Concurrent Pages update; stop safely')
    api('/git/refs/heads/gh-pages',{'sha':deploy,'force':False},'PATCH');assert api('/git/ref/heads/gh-pages')['object']['sha']==deploy
    url='https://haihao0307.github.io/guilin-dem-pipeline/'+RUNTIME+'/'
    checked={}
    for attempt in range(48):
        try:
            for n,b in files.items():
                with urllib.request.urlopen(url+n+'?v='+sha(b)[:12],timeout=30) as r:got=r.read();assert r.status==200 and got==b
                checked[n]={'bytes':len(b),'sha256':sha(b)}
            break
        except Exception as e:
            if attempt==47:raise
            print('wait pages',attempt,type(e).__name__,flush=True);time.sleep(10)
    pathlib.Path('evidence/PUBLICATION.json').write_bytes(encode({'status':'PUBLIC_BYTES_VERIFIED_BROWSER_PENDING','sourceCommit':source,'deploymentCommit':deploy,'url':url,'files':checked,'candidateChecks':len(q['checks']),'visualApproved':False,'productionApproved':False}))
    with open(os.environ['GITHUB_ENV'],'a') as f:f.write('COAST_V012_URL='+url+'\nCOAST_V012_DEPLOY='+deploy+'\n')

if __name__=='__main__':
    if len(sys.argv)!=2 or sys.argv[1] not in {'stage','publish'}:raise SystemExit('stage|publish')
    stage_and_commit() if sys.argv[1]=='stage' else publish()
