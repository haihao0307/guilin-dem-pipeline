"""R006.1 delivery hotfix only. The teacher, analyses and controls are unchanged."""
from pathlib import Path
import base64, hashlib, json, os, re, subprocess, sys
R=Path(__file__).parent;PREV=R.parent/'web-r006';OUT=Path('dist/fish-mother-yellowfin')
H=lambda x:hashlib.sha256(x).hexdigest()
def prepare():
 subprocess.run([sys.executable,str(PREV/'prepare_r006.py')],check=True)
 s=(PREV/'main.mjs').read_text()
 s=s.replace("from './boundary.mjs'","from '../web-r006/boundary.mjs'")
 pattern=r"const element=\$\('#teacher'\),s=element.textContent.trim\(\),raw=atob\(s\),bytes=new Uint8Array\(raw.length\);for\(let i=0;i<raw.length;i\+\+\)bytes\[i\]=raw.charCodeAt\(i\);element.remove\(\);"
 s,n=re.subn(pattern,"let bytes=window.FISH_BOOT.takeSource();",s);assert n==1,'Source decoder anchor changed'
 before="let teacher=await loader.parseAsync(bytes.buffer,'');"
 assert before in s;s=s.replace(before,before+"bytes=null;window.FISH_BOOT.mark('teacher-parsed','原鱼与原贴图已读取，正在构造对照视图。');")
 assert 'function fail(e){' in s;s=s.replace('function fail(e){','function fail(e){window.FISH_BOOT?.fail(e);')
 # Context failures can occur after startup. Keep recovery HTML independent of WebGL.
 anchor="const renderer=new THREE.WebGLRenderer"
 assert anchor in s
 s=s.replace(anchor,"$('#view').addEventListener('webglcontextlost',e=>{e.preventDefault();qa.ready=false;window.FISH_BOOT.fail('三维图形上下文中断。可关闭其他三维标签页后使用本页重试按钮；资料未改变。','webgl-context-lost');});\n"+anchor)
 s=s.replace('preserveDrawingBuffer:true','preserveDrawingBuffer:false')
 anchor="qa.ready=true;$('#loading').hidden=true;"
 assert anchor in s;s=s.replace(anchor,"qa.ready=true;$('#loading').hidden=true;window.FISH_BOOT.done();")
 s=s.replace('FISH_BOUNDARY_R006','FISH_OPEN_R006_1').replace('R006</span>','R006.1</span>')
 (R/'main.mjs').write_text(s)
 q=(PREV/'qa.mjs').read_text().replace('FISH_BOUNDARY_R006','FISH_OPEN_R006_1')
 # Also assert that successful startup consumes the exact, complete chunk stream.
 anchor=' result.initial=initial;';assert anchor in q
 q=q.replace(anchor," result.openfix=await page.evaluate(()=>({version:window.FISH_BOOT.version,ready:window.FISH_BOOT.ready,received:window.FISH_BOOT.received,total:window.FISH_BOOT.total,chunks:window.FISH_BOOT.chunks,sourceReleased:window.FISH_BOOT.sourceReleased,decodeMode:window.FISH_BOOT.decodeMode,phases:window.FISH_BOOT.phases}));assert(result.openfix.ready&&result.openfix.received===58908280&&result.openfix.sourceReleased&&result.openfix.chunks===75,'incomplete openfix source load');"+anchor)
 (R/'qa_regression.mjs').write_text(q)
 print('OPENFIX_PREPARED: full prior QA retained; no acceptance threshold changed')
def build():
 OUT.mkdir(parents=True,exist_ok=True)
 source=Path('apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/source-workspace/source/tuna_fish_4k.glb').read_bytes()
 assert H(source)=='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe'
 prefix=(R/'boot.html').read_text().replace('__BUILD_SHA__',os.environ.get('GITHUB_SHA','local')).replace('__SOURCE_BYTES__',str(len(source)))
 assert len(prefix.encode())<16384 and 'id="fish-boot-title"' in prefix
 path=OUT/'index.html';chunk_bytes=786432;roundtrip=hashlib.sha256();chunks=0
 with path.open('w') as f:
  f.write(prefix)
  for offset in range(0,len(source),chunk_bytes):
   value=base64.b64encode(source[offset:offset+chunk_bytes]).decode();roundtrip.update(base64.b64decode(value,validate=True))
   f.write('<script type="application/octet-stream" data-fish-chunk="source" data-index="'+str(chunks)+'">'+value+'</script><script>FISH_BOOT.chunk(document.currentScript.previousElementSibling);document.currentScript.remove();</script>\n');chunks+=1
  for id,relative in [('canonicalPackage','canonical-r004/teacher-package.json'),('surfaceRegions','parts-r005/parts.json'),('boundaryEvidence','boundary-r006/boundary-evidence.json')]:
   text=(OUT/relative).read_text().replace('<','\\u003c');json.loads(text);f.write('<script id="'+id+'" type="application/json">'+text+'</script>')
  data=(OUT/'canonical-r004/teacher-fields.bin').read_bytes();f.write('<script id="canonicalFields" type="application/octet-stream">'+base64.b64encode(data).decode()+'</script>')
  runtime=(R/'bundle.js').read_text().replace('</script','<\\/script');f.write('<script type="module">'+runtime+'</script></body></html>')
 assert roundtrip.hexdigest()==H(source) and chunks==75
 body=path.read_bytes();assert b'id="teacher"' not in body
 result={'version':'FISH_OPEN_R006_1','buildSha':os.environ.get('GITHUB_SHA','local'),'bytes':len(body),'sha256':H(body),'sourceGlbSha256':H(source),'sourceBytes':len(source),'sourceChunkBytes':chunk_bytes,'sourceChunks':chunks,'sourceChunkRoundtripHashMatches':True,'bootPrefixBytes':len(prefix.encode()),'visibleHtmlBeforeSource':True,'boundedBase64Decode':True,'fullSourceAtobRemoved':True,'sourcePrecisionChanged':False,'originalPngBytesEmbedded':True,'runtimeEmbedded':True,'externalRuntimeDependencies':0,'standalone':True,'previousWhiteScreenReportedByUser':True,'originalClientCauseConfirmed':False,'productionReady':False,'independentReconstruction':False,'manualVisualAcceptance':False}
 (OUT/'BUILD_MANIFEST.json').write_text(json.dumps(result,indent=2));print('OPENFIX_BUILD',json.dumps(result),flush=True)
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='prepare':prepare()
 else:build()
