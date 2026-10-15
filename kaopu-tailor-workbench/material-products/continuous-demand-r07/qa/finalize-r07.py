from pathlib import Path
import datetime, gzip, hashlib, json, statistics

q = Path(__file__).parent
root = q.parent
r = json.loads((q / 'r07-public-qa.json').read_text(encoding='utf-8'))
assert not r.get('failure'), r.get('failure')
assert not r['errors'] and not r['httpErrors']
assert r['manifest']['version'] == 'MP05-R07-Temporal'
assert r['audit']['version'] == 'MP05-R07-Regional'
assert r['audit']['glError'] == 0
assert r['audit']['motionAndContact']['safetyTrips'] == 0
assert r['faceRouting']['fallbackPasses'] == 0
assert r['coverage']['samples'] == 4
assert r['audit']['lighting']['shadows'] == 1
assert r['audit']['lighting']['nativeSkinDirectionalLights'] == 3
physics = json.loads((q / 'r07-physics-proof.json').read_text(encoding='utf-8'))
assert not physics.get('failure') and not physics['errors']
assert all(x['passed'] for x in physics['checks']['checks'])
assert physics['checks']['glError'] == 0
variants = json.loads((q / 'r07-variants.json').read_text(encoding='utf-8'))
assert not variants.get('failure') and not variants['errors']
assert len(variants['looks']) == 12 and variants['final']['glError'] == 0
assert variants['camera']['timeUnchanged'] and variants['camera']['stepsUnchanged']
assert variants['settingsRetainPlayback']
percentile = lambda values, p: sorted(values)[int((len(values)-1)*p)]
segments = []
for s in r['segments']:
    samples, trace = s['samples'], s['pacing']
    assert all(not x['error'] and x['visible'] for x in samples)
    intervals = [b['wall']-a['wall'] for a,b in zip(trace,trace[1:])]
    segments.append({
        'motion': s['motion'], 'wallSeconds': s['wallSeconds'],
        'simulationSeconds': s['simSeconds'], 'FPS': s['frames']/s['wallSeconds'],
        'frameIntervalMedianMS': statistics.median(intervals),
        'frameIntervalP95MS': percentile(intervals,.95),
        'frameIntervalP99MS': percentile(intervals,.99),
        'solverMedianMS': statistics.median(x['solverMS'] for x in samples),
        'solverP95MS': percentile([x['solverMS'] for x in samples],.95),
        'simulationWallRatio': s['simSeconds']/s['wallSeconds'],
        'resamplesAtStart': trace[0]['resamples'],
        'resamplesAtEnd': trace[-1]['resamples'],
        'samplingRebuilds': [None if a is None else b-a for a,b in zip(trace[0]['resamples'],trace[-1]['resamples'])]
    })
video = q / 'R07_K03_闪烁卡顿修复.mp4'
data = video.read_bytes()
metadata = {
    'path': video.name, 'bytes': len(data),
    'SHA256': hashlib.sha256(data).hexdigest(),
    'gitBlobSHA': hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),
    'runtimeTree': '527117f28a680730aceceb5293160f3c53585122',
    'durationSeconds': 17.63, 'sourceAverageFPS': 55.56, 'canvasSize': [964,680],
    'source': 'Direct final deployed WebGL canvas.captureStream; original frame timestamps; H264 transcode only; no interpolation or time scaling',
    'rawSHA256': hashlib.sha256((q/'r07-public-motion.mp4').read_bytes()).hexdigest()
}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
coverage = json.loads((q/'r07-coverage-proof.json').read_text(encoding='utf-8'))['proof']
coverage['rmsReductionPercent'] = 100*(1-coverage['results'][1]['rmsPhaseVariation']/coverage['results'][0]['rmsPhaseVariation'])
for name in ['qa/R07_EVIDENCE.json','RELEASE_STATUS.json']:
    path = root/name
    d = json.loads(path.read_text(encoding='utf-8'))
    d.update({
        'status':'publicly-verified-temporal-stability-maintenance',
        'publicVerified':True, 'verifiedUTC':now,
        'pagesRun':{'id':38703482521,'conclusion':'success'},
        'publicDevice':r['device'], 'publicSegments':segments,
        'publicSafetyTrips':0,'publicGLError':0,
        'publicPageErrors':r['errors'],'publicHTTPErrors':r['httpErrors'],
        'publicFacePassRouting':r['faceRouting'],'publicCoverage':r['coverage'],
        'publicLighting':r['audit']['lighting'],
        'coverageTest':coverage,'physicsCausalChecks':physics['checks']['checks'],
        'activeClockSimulationRatio':r['audit']['fastRuntime']['simulationToWallRatio'],
        'finalLocalCodeCommit':'ffa87a3','initialSourceCommit':'d42d4a2211bfeaadbb3dea2682f81f7e2c4a92b9',
        'video':metadata
    })
    d['collectionURL']='http://127.0.0.1:8897/Human-Clothing-Workbench/%E6%9C%8D%E8%A3%85%E9%9E%8B%E5%B8%BD%E5%B7%A5%E4%BD%9C%E5%8F%B0.html?v=R07-527117f28a68'
    path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

path = root/'README.md'
text = path.read_text(encoding='utf-8').replace('v=R07-7ad0e0f08594','v=R07-527117f28a68').replace('（部署验证中）','（已公开实测）')
text = text.replace('原人物、原裁片、针目、三股纱线、材质、灯光、实际物理步与动作保持。','原人物、原裁片、针目、三股纱线、材质、实际物理步与动作保持；冷暖灯光保留，实时阴影由主光计算。')
text += '\n最终公开页实测（RTX 4070 Ti SUPER / Chrome 155 / 1440×1150 / DPR 1）：'+', '.join(s['motion']+' '+format(s['FPS'],'.2f')+' FPS' for s in segments)+'；对应帧间隔 P99 约 33.1–33.7 ms；连续运行阶段无重复采样重建，页面、HTTP、GL 错误及保护暂停均为 0。固定镜头受控相位 RMS 减少约 '+format(coverage['rmsReductionPercent'],'.1f')+'%，不是对所有闪烁的消除声明。\n\n实际公开版录像：`qa/'+video.name+'`（17.63 秒，原始时间戳；录制平均约 55.56 FPS）。\n'
path.write_text(text,encoding='utf-8',newline='\n')

path = q/'R07_VALIDATION.md'
text = '''# R07 最终验证

最终 runtime tree `527117f28a680730aceceb5293160f3c53585122`，Pages commit `0a4bc3f1b75008597f8948ab57416b710bb22f10`，部署任务 `38703482521` 成功；实际公开页面已完成独立回归与录制。

R06 同视口固定镜头基线约 49.5 FPS、帧间隔 P99 50.1 ms，12 秒采样重建 21 次。早期 R07 约 59.4 FPS / P99 17.7 ms。早期结果与最终公开数据分开保存，不把早期数字冒充最终公开结果。

最终公开测试：RTX 4070 Ti SUPER / Chrome 155 / 1440×1150 / DPR 1：

'''
text += ''.join('- '+s['motion']+'：'+format(s['FPS'],'.2f')+' FPS，帧间隔 P95 '+format(s['frameIntervalP95MS'],'.2f')+' / P99 '+format(s['frameIntervalP99MS'],'.2f')+' ms，求解中位 '+format(s['solverMedianMS'],'.2f')+' / P95 '+format(s['solverP95MS'],'.2f')+' ms。\n' for s in segments)
text += '\n连续运行时采样重建 0 次；活动时钟模拟/真实时间比 '+format(r['audit']['fastRuntime']['simulationToWallRatio'],'.6f')+'。页面、HTTP、GL 错误及保护暂停均为 0；原生面部同帧深度复用回退为 0。公开页面仍有少量双刷新间隔帧，不宣称所有设备锁定 60 FPS。\n'
text += '\n最终单主光阴影的受控亚像素测试：关闭/开启 4 重覆盖抗锯齿，RMS '+format(coverage['results'][0]['rmsPhaseVariation'],'.8f')+' → '+format(coverage['results'][1]['rmsPhaseVariation'],'.8f')+'，减少 '+format(coverage['rmsReductionPercent'],'.2f')+'%；关/开/关/开两轮重复一致。该指标只描述冻结姿态下的亚像素覆盖变化。\n'
text += '''
集合入口同页交替对照：双阴影约 56.57 / 57.69 FPS、P99 33.4 / 33.6 ms；仅主光实时阴影约 59.94 / 59.31 FPS、P99 16.8 / 21.4 ms。冷暖轮廓光和补光仍参与照明。额外显示插值方案约 42.3 FPS，已撤回，失败源码与数据保留。

四款 × 三动作回归通过；四种灯光、视口变化、设置变更不误停播放。实际近景纱线数仍为 6882，返回全身时缓存约 381 MB → 130 MB，峰值不超过 384 MiB；暂停检查不推进物理。重力、冲量、弯曲参数的因果检查，以及衣物/身体/时钟原子回滚和恢复检查共 5 项通过。物理求解源码与 R06 相同。

公开录像 `R07_K03_闪烁卡顿修复.mp4` 长 17.63 秒，源录制平均 55.56 FPS，保留真实帧时间；只做 H264 转码，不插帧或变速。

完整自由布料、全自碰撞、高速 CCD、材料标定及其他设备持续性能仍未完成。本轮维护已有角色服装显示和调度，未修改成衣制作七阶段验收结论。
'''
path.write_text(text,encoding='utf-8',newline='\n')
for path in q.glob('r07-*.json'):
    if any(t in path.name for t in ['upload','source']):continue
    (q/(path.name+'.gz')).write_bytes(gzip.compress(path.read_bytes(),mtime=0))
print(json.dumps({'segments':segments,'video':metadata,'coverageReduction':coverage['rmsReductionPercent']},ensure_ascii=True,indent=2))
