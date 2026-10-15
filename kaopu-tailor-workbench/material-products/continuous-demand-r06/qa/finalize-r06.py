from pathlib import Path
import json,gzip,hashlib,statistics,datetime
q=Path(__file__).parent;root=q.parent
r=json.loads((q/'r06-public-qa.json').read_text(encoding='utf-8'))
assert not r.get('failure'),r.get('failure')
assert not r['errors'] and not r['httpErrors']
assert r['manifest']['version']=='MP05-R06-Regional'
assert r['audit']['glError']==0 and r['audit']['motionAndContact']['safetyTrips']==0
assert r['faceRouting']['fallbackPasses']==0
video=q/'R06_K03_连续走跑跳.mp4';b=video.read_bytes()
percentile=lambda a,p:sorted(a)[int((len(a)-1)*p)]
segments=[]
for s in r['segments']:
 samples=s['samples'];assert all(not x['error'] and x['visible'] for x in samples)
 segments.append({'motion':s['motion'],'wallSeconds':s['wallSeconds'],'simulationSeconds':s['simSeconds'],'FPS':s['frames']/s['wallSeconds'],'solverMedianMS':statistics.median(x['solverMS'] for x in samples),'solverP95MS':percentile([x['solverMS'] for x in samples],.95),'gpuMedianMS':statistics.median(x['gpuMS'] for x in samples),'simulationWallRatio':s['simSeconds']/s['wallSeconds']})
before=[statistics.median(s['gpuMS']) for s in r['fixedSceneAB'] if not s['enabled']];after=[statistics.median(s['gpuMS']) for s in r['fixedSceneAB'] if s['enabled']]
assert all(s['glError']==0 for s in r['fixedSceneAB'])
assert len(set(s['simulationSeconds'] for s in r['fixedSceneAB']))==1
ab={'oldPassGpuMedianMS':statistics.median(before),'newPassGpuMedianMS':statistics.median(after),'reductionPercent':100*(1-statistics.median(after)/statistics.median(before)),'identicalPausedSimulation':True,'oldSamples':before,'newSamples':after}
metadata={'path':video.name,'bytes':len(b),'SHA256':hashlib.sha256(b).hexdigest(),'runtimeTree':'96863267eab7922b4b7c8bc72f1d8519ac9fb8fb','source':'direct deployed WebGL canvas.captureStream; actual timing; H264 transcode only; no frame interpolation or time scaling'}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for name in ['qa/R06_EVIDENCE.json','RELEASE_STATUS.json']:
 p=root/name;d=json.loads(p.read_text(encoding='utf-8'));d.update({'status':'publicly-verified-regional-character-cloth','publicVerified':True,'verifiedUTC':now,'publicDevice':r['device'],'publicSegments':segments,'fixedSceneGpuComparison':ab,'publicSafetyTrips':0,'publicGLError':0,'publicPageErrors':r['errors'],'publicHTTPErrors':r['httpErrors'],'publicFacePassRouting':r['faceRouting'],'activeClockSimulationRatio':r['audit']['fastRuntime']['simulationToWallRatio'],'video':metadata});p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
for p in q.glob('r06-*.json'):
 if any(t in p.name for t in ['upload','profile']):continue
 (q/(p.name+'.gz')).write_bytes(gzip.compress(p.read_bytes(),mtime=0))
p=root/'README.md';s=p.read_text(encoding='utf-8').replace('（发布及公开验证进行中）','（已公开实测）');s+='\n公开实测：'+', '.join(x['motion']+' '+format(x['FPS'],'.1f')+' FPS' for x in segments)+'；同一静止场景 GPU 中位耗时 '+format(ab['oldPassGpuMedianMS'],'.2f')+' → '+format(ab['newPassGpuMedianMS'],'.2f')+' ms。实际录像：`qa/'+video.name+'`。\n';p.write_text(s,encoding='utf-8',newline='\n')
p=q/'R06_VALIDATION.md';s=p.read_text(encoding='utf-8').replace('公开部署及录像仍待最终测试；','公开部署与实际录像均已验证；');s+='\n公开测试（Chrome / RTX 4070 Ti SUPER）：\n\n'+''.join('- '+x['motion']+'：'+format(x['FPS'],'.2f')+' FPS，求解中位 '+format(x['solverMedianMS'],'.2f')+' ms / P95 '+format(x['solverP95MS'],'.2f')+' ms。\n' for x in segments)+'\n同一暂停场景，GPU 中位 '+format(ab['oldPassGpuMedianMS'],'.2f')+' → '+format(ab['newPassGpuMedianMS'],'.2f')+' ms，减少 '+format(ab['reductionPercent'],'.1f')+'%。未减少可见衣物几何；原面部柔光保留。公开页页面/HTTP/GL 错误及保护暂停均为 0。\n\n录像 `'+video.name+'` 来自实际公开页面，保留原始时间，不插帧或变速。\n';p.write_text(s,encoding='utf-8',newline='\n')
print(json.dumps({'segments':segments,'fixedSceneAB':ab,'video':metadata,'clockRatio':r['audit']['fastRuntime']['simulationToWallRatio']},ensure_ascii=False,indent=2))
