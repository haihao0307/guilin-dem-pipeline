"""Additive startup repair of frozen R14.2. Never regenerate or alter its groom."""
from pathlib import Path
import shutil,hashlib,json,base64,gzip,subprocess,sys
p=Path(__file__).resolve().parent
old=p.parent/'r14'
for name in ['src','vendor','native-head','data','licenses']:
    shutil.copytree(old/name,p/name,dirs_exist_ok=True)
for name in ['index.html','workbench.css','bundle.mjs','NATIVE_HEAD_LOCK.json']:
    shutil.copy2(old/name,p/name)
shutil.copy2(p/'patches/EmbeddedHead.js',p/'src/EmbeddedHead.js')
f=p/'src/app.js';s=f.read_text()
def change(a,b):
    global s
    assert s.count(a)==1,(a,s.count(a))
    s=s.replace(a,b)
change("import {loadFixedAsset} from './AssetLoader.js';","import {loadEmbeddedHead} from './EmbeddedHead.js';")
change('let nativeHead;',"let nativeHead;\nlet startupStage='idle',startupFailure=null,bootPromise=null;")
start=s.index('function fail(e)');end=s.index('function draw()',start)
s=s[:start]+'''function fail(e){
 if(e?.name==='AbortError')return;
 const message=String(e.message||e);errors.push(String(e.stack||message));
 $('error').hidden=false;
 if(!ready){startupFailure={stage:startupStage,code:e.code||'STARTUP_ERROR',message};startupStage='error';
  $('error').textContent='工作台启动未完成：'+message+'\\n尚未生成可操作的人物。';$('busy').hidden=true;$('startupRecovery').hidden=false;
  $('retryStartup').textContent=model||head?'重新载入本页':'重试本页载入';
 }else $('error').textContent='本次操作未完成：'+message+'\\n已显示的旧造型保留。';
 console.error(e);
}
''' + s[end:]
start=s.index('async function load(kind)');end=s.index('async function init()',start)
s=s[:start]+'''async function load(kind){
 if(kind!=='head')throw Error('未知资源');startupStage='unpack';
 const a=await loadEmbeddedHead({onProgress:(phase,n,total)=>{
  const labels={decode:'读取随页人物数据',inflate:'本地解压原 GNM',verify:'校验原人物 SHA-256',ready:'原人物校验完成'};
  $('progressText').textContent=labels[phase]+' · '+(n/1e6).toFixed(1)+' / '+(total/1e6).toFixed(1)+' MB';
  $('progress').value=phase==='decode'?.25*n/total:phase==='inflate'?.25+.65*n/total:.95;
 }});
 assets.push({kind,sha256:'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961',bytes:34937952,compressedBytes:a.compressedBytes,transport:a.transport});
 return parseContainer(a.buffer);
}
''' + s[end:]
change("const h=await load('head');model=", "const h=await load('head');startupStage='native-head';$('progressText').textContent='建立原人物皮肤与眼球…';model=")
change("$('progressText').textContent='继承 R12 真实发根…';", "startupStage='groom';$('progressText').textContent='继承 R12 真实发根…';")
change("init().catch(fail);sync();",'''async function boot(){
 if(bootPromise)return bootPromise;
 startupFailure=null;startupStage='starting';$('error').hidden=true;$('startupRecovery').hidden=true;$('busy').hidden=false;
 bootPromise=init().then(()=>{startupStage='ready';sync();}).catch(fail).finally(()=>{bootPromise=null;});return bootPromise;
}
function retryStartup(){
 if(bootPromise||ready)return bootPromise;
 if(model||head){location.reload();return;}
 errors.length=0;return boot();
}
$('retryStartup').onclick=retryStartup;
$('copyStartupLog').onclick=async()=>{
 const text=JSON.stringify({version:'R14.2-L01',startupStage,startupFailure,assets,errors},null,2);
 try{await navigator.clipboard.writeText(text);$('copyStartupLog').textContent='诊断已复制';}
 catch{$('startupLog').hidden=false;$('startupLog').textContent=text;}
};
window.lengthGroom.retryStartup=retryStartup;
boot();sync();''')
change("function diagnostics(){return{version:'R14.2',", "function diagnostics(){return{startup:{stage:startupStage,failure:startupFailure,embeddedModel:true},version:'R14.2',")
s=s.replace('R14.2','R14.2-L01').replace('R14.2-L01-L01','R14.2-L01')
f.write_text(s)
f=p/'index.html';s=f.read_text().replace('R14.2','R14.2-L01').replace('静态造型验收','随页资源 · 启动修复')
s=s.replace('<div id="error" hidden role="alert"></div>','<div id="error" hidden role="alert"></div><div id="startupRecovery" hidden><button id="retryStartup">重试本页载入</button><button id="copyStartupLog">复制诊断信息</button><pre id="startupLog" hidden></pre></div>')
s=s.replace('载入原模型…','读取随页原模型…')
f.write_text(s)
f=p/'workbench.css';f.write_text(f.read_text()+'''\n#startupRecovery{position:absolute;bottom:18px;left:20px;right:20px;display:flex;gap:8px;flex-wrap:wrap;background:#161d24ef;padding:10px;border-radius:6px}#startupRecovery[hidden]{display:none}#startupLog{max-height:150px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;width:100%;font-size:11px}#busy span{max-width:66%;min-width:140px}#busy progress{min-width:50px}''')
# The exact same gzip checked into R12; decoded bytes must match frozen GNM SHA.
z=Path(sys.argv[1]).read_bytes();raw=gzip.decompress(z)
assert len(z)==9930135 and len(raw)==34937952
assert hashlib.sha256(raw).hexdigest()=='fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'
(p/'HEAD_PAYLOAD.b64').write_text(base64.b64encode(z).decode())
(p/'HEAD_TRANSPORT.json').write_text(json.dumps({'compressedBytes':len(z),'compressedSha256':hashlib.sha256(z).hexdigest(),'decodedBytes':len(raw),'decodedSha256':hashlib.sha256(raw).hexdigest(),'source':'a042dc0e4aa0370e2dbd3225dfa05f8c9ee905d4/kaopu-hair-workbench/fusion/r12/assets/gnm_head_web.bin.gz','newAsset':False},indent=2))
protected=[]
for folder in ['src','native-head','data','vendor']:
 for a in sorted((old/folder).rglob('*')):
  if not a.is_file() or a==old/'src/app.js':continue
  b=p/a.relative_to(old);assert a.read_bytes()==b.read_bytes(),str(a)
  protected.append({'path':str(a.relative_to(old)),'sha256':hashlib.sha256(a.read_bytes()).hexdigest()})
(p/'UNCHANGED_RUNTIME.json').write_text(json.dumps(protected,indent=2))
print('Preserved',len(protected),'runtime files; original head packaged losslessly')
r=json.loads((old/'evidence/root-study/report.json').read_text())
(p/'BASELINE_HASHES.json').write_text(json.dumps({x['style']:{k:x['diagnostics'][k] for k in ['rootHash','curveHash','modelPositionHash','geometryBytes','activeCount','guideCount']} for x in r['candidate']},indent=2))
