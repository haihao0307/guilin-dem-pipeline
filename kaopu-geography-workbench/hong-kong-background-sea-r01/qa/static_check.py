from pathlib import Path
import re,json,hashlib,subprocess
R=Path(__file__).resolve().parents[1]
s=(R/'index.html').read_text(); base=(R/'source/Ocean_Mother_V001_Frozen_Deep.html').read_text()
assert '<iframe' not in s
assert not re.search(r'<(?:script|img|audio|video)[^>]+(?:src|href)=["\'](?:https?:|[^#d])',s)
assert 'data-map-assembled="false"' in s and '香港地图尚未装配' in s
assert "O=vec4(film(col),1.);" in s
assert 'for(int k=0;k<24;k++)' in s
assert 'for(int i=0;i<12;i++)' in s
assert "function makeWaves()" in s
for path in sorted((R/'qa').glob('candidate-script-*.js')):subprocess.run(['node','--check',str(path)],check=True)
# Execute exactly the inherited deterministic wave and sampling functions in Node.
a=s.index('function makeWaves()');b=s.index('function cameraData()',a)
generator=s[a:b]
hashfn=s[s.index('const hash=(n)=>'):s.index('const waveK=',s.index('const hash=(n)=>'))]
probe="""const S={seed:8071,period:8.8,swell:.3,chop:.4};const W={snapshot:()=>({wind:4,direction:270})};const qa={};const waveK=new Float32Array(96),waveA=new Float32Array(96);let currentK=null,currentA=null,waveDirty=true,seaTime=0;
"""+hashfn+generator+"""\nmakeWaves();const first=Array.from(waveA);const h=Array.from({length:1000},(_,i)=>surface(i*.7,i*1.3,i*.05));makeWaves();if(!h.every(Number.isFinite)||!first.every((v,i)=>v===waveA[i])||qa.spectralComponents!==24||qa.maxSteepnessBound>.70)throw Error('Wave parity or numeric failure');console.log(JSON.stringify({samples:h.length,min:Math.min(...h),max:Math.max(...h),deterministic:true,spectralComponents:qa.spectralComponents,maxSteepnessBound:qa.maxSteepnessBound}));"""
(R/'qa/numeric_probe.cjs').write_text(probe)
numeric=json.loads(subprocess.check_output(['node',str(R/'qa/numeric_probe.cjs')]))
r={'passed':True,'build':'HK-BACKGROUND-SEA-R01-20261012','bytes':len(s.encode()),'sha256':hashlib.sha256(s.encode()).hexdigest(),'syntax':'PASS','kernelParity':json.loads((R/'SOURCE_MANIFEST.json').read_text())['sourceParity'],'noIframe':True,'singleFile':True,'opaqueWater':True,'numericProbe':numeric,'realBrowserPassed':False,'physicalGpuPassed':False,'visualAcceptance':False,'productionReady':False}
(R/'qa/STATIC_QA.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
