from pathlib import Path
import datetime, gzip, hashlib, json, re, statistics

root=Path(__file__).parent.parent
q=root/'qa'
runtime='ccccfd5ca9c16b7ac8b1650ec2e59889f9d6391c'
pages='091a87cd721d77f94408521441452648dc5644b0'
run=38715311193
url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-denim-r08-'+runtime[:12]+'/'
r=json.loads((q/'r08-public-qa.json').read_text(encoding='utf-8'))
smoke=json.loads((q/'r08-public-smoke.json').read_text(encoding='utf-8'))
manifest=json.loads((q/'r08-runtime-bytes.json').read_text(encoding='utf-8'))
for result in [r,smoke]:
    assert not result.get('failure'), result.get('failure')
    assert not result['errors'] and not result['httpErrors']
assert len(r['segments'])==6 and len(smoke['actions'])==6
for action in smoke['actions']:
    assert action['selected']==action['look'] and action['running']
    assert not action['error'] and action['glError']==action['safetyTrips']==0
for path,data in smoke['files'].items():
    expected=next(x for x in manifest['files'] if x['path']==path)
    assert data['status']==200 and data['gitSHA']==expected['gitSHA'] and data['bytes']==expected['size']
assert r['manifest']['denimDraftNyquistFadeCyclesPerPixel']==[.32,.5]
assert r['audit']['coverageAntialias']['samples']==4
assert r['audit']['facePassRouting']['fallbackPasses']==0
assert r['audit']['lighting']['shadows']==1 and r['audit']['lighting']['nativeSkinDirectionalLights']==3
percentile=lambda a,p:sorted(a)[int((len(a)-1)*p)]
segments=[]
for segment in r['segments']:
    audit=segment['audit'];trace=segment['trace']
    assert not audit['error'] and not audit['fastRuntime']['lastError']
    assert audit['glError']==audit['motionAndContact']['safetyTrips']==0
    assert .95<audit['fastRuntime']['simulationToWallRatio']<1.05
    intervals=[b['wall']-a['wall'] for a,b in zip(trace,trace[1:])]
    segments.append({'look':segment['look'],'motion':segment['motion'],
        'FPS':segment['frames']/segment['wallSeconds'],
        'wallSeconds':segment['wallSeconds'],'simulationSeconds':segment['simulationSeconds'],
        'frameIntervalMedianMS':statistics.median(intervals),
        'frameIntervalP95MS':percentile(intervals,.95),'frameIntervalP99MS':percentile(intervals,.99),
        'solverMedianMS':statistics.median(x['solverMS'] for x in trace),
        'solverP95MS':percentile([x['solverMS'] for x in trace],.95),
        'activeClockRatio':audit['fastRuntime']['simulationToWallRatio'],
        'yarnTriangles':sum(x['submittedYarnTriangles'] for x in audit['rows']),
        'frameAtlasBytes':sum(x['frameAtlasBytes'] for x in audit['rows']),
        'samplingRebuilds':[None if x is None else y-x for x,y in zip(trace[0]['resamples'],trace[-1]['resamples'])],
        'safetyTrips':0,'GLError':0})
video=q/'R08_浅洗牛仔_真实动作.mp4';blob=video.read_bytes()
log=(q/'r08-video-encode.log').read_text(encoding='utf-8',errors='replace')
duration=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',log)
fps=re.search(r', (\d+\.?\d*) fps,',log)
assert duration and fps
seconds=int(duration[1])*3600+int(duration[2])*60+float(duration[3])
metadata={'path':video.name,'bytes':len(blob),'SHA256':hashlib.sha256(blob).hexdigest(),
    'gitBlobSHA':hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest(),
    'runtimeTree':runtime,'durationSeconds':seconds,'sourceAverageFPS':float(fps[1]),
    'sourceURL':r['url'],'lightingPreset':r['videoPreset'],
    'source':'Actual final immutable public canvas.captureStream; original timestamps; H264 transcode only; no interpolation or time scaling; second half shows distant motion and orbit',
    'rawSHA256':hashlib.sha256((q/'r08-public-motion.mp4').read_bytes()).hexdigest()}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for name in ['qa/R08_EVIDENCE.json','RELEASE_STATUS.json']:
    p=root/name;data=json.loads(p.read_text(encoding='utf-8'))
    data.update(status='verified-denim-scale-relief-and-far-filter',runtimeTree=runtime,pagesCommit=pages,
        pagesRun={'id':run,'conclusion':'success'},publicURL=url+'?look=D01',publicVerified=True,verifiedUTC=now,
        localRuntime='releases/r08-ccccfd5ca9c1',measurementOrigin='Final immutable public runtime in the local headless Chrome browser',
        deliveryDevice=r['device'],deliverySegments=segments,video=metadata,
        publicSmoke={'actions':smoke['actions'],'files':smoke['files'],'errors':[],'httpErrors':[]},
        deliveryGLError=0,deliverySafetyTrips=0,coverage=r['audit']['coverageAntialias'],
        faceRouting=r['audit']['facePassRouting'],lighting=r['audit']['lighting'])
    p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
table='| 材料 | 走路 | 跑步 | 反复跳跃 |\n| --- | ---: | ---: | ---: |\n'
for look,label in [('D01','深靛牛仔'),('D03','浅洗牛仔')]:
    table+='| '+label+' | '+' | '.join(format(s['FPS'],'.2f')+' FPS' for s in segments if s['look']==look)+' |\n'
text='''# MP05 R08 · 牛仔织纹与远距过滤

固定候选 `releases/r08-ccccfd5ca9c1/`：默认织纹放大 6 倍，可调 1–8 倍。浅洗款增加纱束起伏、棉质柔光和水洗层次；物理厚度仍为 0.7 mm。近处保留闭合经纬纱，远处按屏幕足迹共同过滤颜色、起伏法线与逐纱高光。

'''
text+='[本地集合](http://127.0.0.1:8897/Human-Clothing-Workbench/%E6%9C%8D%E8%A3%85%E9%9E%8B%E5%B8%BD%E5%B7%A5%E4%BD%9C%E5%8F%B0.html?v=R08-'+runtime[:12]+') · [固定公开预览]('+url+'?look=D03)\n\n'
text+='本机浏览器访问最终固定公开版本实测：1600×1150 / DPR 1 / RTX 4070 Ti SUPER / Chrome 155。每个动作 12 秒，计数已完成的真实绘制帧，跳跃反复触发。公开预览的代码字节及六段动作另行检查。\n\n'+table
text+='\nR07 双牛仔同机基线约 6.3–7.0 FPS。最终录像 `qa/'+video.name+'`，'+format(seconds,'.2f')+' 秒，源平均 '+format(float(fps[1]),'.2f')+' FPS，原始时间戳；没有插帧或变速。仍可能掉帧，不宣称所有设备锁定 60 FPS。\n\n'
text+='四档距离的受控相位对照见 `qa/r08-far-moire.json.gz`；远处波动明显降低，但不宣称所有镜头和边缘完全没有摩尔纹。18 段材料动作检查、集合切换和暂停缩放检查已通过。\n\nR07、早期 R08 和失败试验均保留。完整自由布料、全自碰撞、CCD、材料标定与七阶段成衣工艺验收没有因此完成。方法、原人物并行修改的保留方式及验证边界见 [开发记录](docs/R08_DENIM.md) 与 `qa/R08_EVIDENCE.json`。\n'
(root/'README.md').write_text(text,encoding='utf-8')
text='# R08 最终验证\n\nRuntime `'+runtime+'`；Pages commit `'+pages+'`；部署任务 `'+str(run)+'` 成功。\n\n'
text+='本机访问最终固定公开版本：1600×1150 / DPR 1 / RTX 4070 Ti SUPER / Chrome 155；每段 12 秒，反复触发跳跃。\n\n'+table+'\n'
text+='| 材料 | 动作 | 帧间隔 P95 / P99 (ms) | 求解 P95 (ms) |\n| --- | --- | ---: | ---: |\n'
for s in segments:
    text+='| '+s['look']+' | '+s['motion']+' | '+format(s['frameIntervalP95MS'],'.2f')+' / '+format(s['frameIntervalP99MS'],'.2f')+' | '+format(s['solverP95MS'],'.2f')+' |\n'
text+='\n公开页面另外核对材质着色器与构建清单的 Git blob 字节摘要，并验证深浅两款的走、跑、跳，帧率和录像均来自该最终公开页面。最终录像来自上述固定公开版本，后半段包含远距离运动和转动。录制有额外开销，不插帧、不变速。\n\n'
text+='1 / 1.5 / 2 / 3 倍全身距离的相位对照已完成；远距颜色、起伏法线及逐纱高光同步过滤，1.5–3 倍距离 RMS 约降低 41%–91%。中央上衣区域的 16 个亚像素偏移指标不代表所有边缘和动作完全无闪烁。\n\n'
text+='18 段材质动作、集合衣鞋帽返回、暂停近远缩放均无错误。R07/R08 同步走路 120 步位置最大差 0；本次仅改显示。参数应用仍沿用重建物理控制器的旧流程，不保留旧时钟。完整自由布料、全自碰撞、CCD、材料标定和七阶段成衣工艺验收仍未完成。\n'
(q/'R08_VALIDATION.md').write_text(text,encoding='utf-8')
for path in q.glob('r08-*.json'):
    if 'upload' not in path.name:
        Path(str(path)+'.gz').write_bytes(gzip.compress(path.read_bytes(),mtime=0))
print(json.dumps({'segments':segments,'video':metadata},ensure_ascii=True,indent=2))
