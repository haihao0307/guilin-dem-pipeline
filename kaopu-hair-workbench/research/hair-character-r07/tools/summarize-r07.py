from pathlib import Path
import json,statistics
P=Path('.');r=json.loads((P/'qa/distance-performance.json').read_text(encoding='utf-8'));rows=[]
def mean(samples):
 values=[x['gpuMS'] for x in samples if x.get('gpuMS') is not None]
 return statistics.mean(values) if values else None
for c in r['cases']:
 render=c['render'];cached=mean(render['withHair'])-mean(render['carrierOnly']);animated=mean(render['animatedWithHair'])-mean(render['animatedCarrierOnly']);steps=c['update']['guideSteps']
 rows.append({'style':c['style'],'heads':c['count'],'strands':c['distance']['visibleStrands'],'cachedHairGpuIncrementMS':cached,'animatedWindHairGpuIncrementMS':animated,'cpuMSPerUpdateCall':c['update']['wallMS']/180,'cpuMSPerActualGuideStep':c['update']['wallMS']/steps if steps else None,'guideSteps':steps,'liveWindFPS':c['live']['fps']})
summary={'passed':r['passed'],'sourceHashes':r['sourceHashes'],'driver':r['cases'][0]['driver'],'viewport':{'width':1500,'height':1050},'rows':rows,'runningCases':r.get('runningCases',[]),'fluffyCases':r.get('fluffyCases',[]),'limits':['One complete native person plus native-head fixtures; no independent full-body or network cost.','One fine guide solver and one ordered display buffer; other heads retain twelve coarse physical coordinates.','Subtracted GPU means include timing noise.','Results are this machine and browser, not a guarantee for other devices.']}
(P/'qa/distance-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
text='# R07 性能与连续距离显示\n\n后台 Chrome，RTX 4070 Ti SUPER / ANGLE D3D11，1500×1050。没有控制桌面鼠标。GPU 使用计时查询；表中动态增量包含每次更新后重建显示丝的 GPU 接触，不只测静止缓存。实时帧率另测，包含人物、物理和绘制。\n\n| 发型 / 场景 | 可见丝合计 | 动态头发额外 GPU ms | 更新 CPU ms / 调用 | 微风实时 FPS |\n|---|---:|---:|---:|---:|\n'
for x in rows:
 label=('中长发' if x['style']=='medium' else '长发')+(' · 近处' if x['heads']==1 else ' · '+str(x['heads'])+' 个远处头部')
 text+=f"| {label} | {x['strands']:,} | {x['animatedWindHairGpuIncrementMS']:.2f} | {x['cpuMSPerUpdateCall']:.3f} | {x['liveWindFPS']:.1f} |\n"
text+='\nCPU 样本为 180 次每次 1/120 秒的更新调用；精细导向实际为 60 Hz，所以近处约一半调用执行导向步骤。逐次实际步骤成本另列在 JSON，不能把调用均值当成每个 60 Hz 完整步骤的成本。远处不执行导向步骤，仍更新十二个受力坐标，并为关注人物执行较少采样的 GPU 连续接触。\n\n## 跑步与蓬松压力场景\n\n| 发型 / 场景 | 实时 FPS |\n|---|---:|\n'
for x in r.get('runningCases',[]):
 text+=f"| {'中长发' if x['style']=='medium' else '长发'} · 跑步 · {x['count']} 个头部 | {x['fps']:.1f} |\n"
for x in r.get('fluffyCases',[]):
 text+=f"| {'中长发' if x['style']=='medium' else '长发'} · 2.7 倍蓬松 · 跑步加风 | {x['fps']:.1f} |\n"
text+='\n近景精细互动仍有明确成本，未宣称零开销或所有场景稳定 60 FPS。不同发型默认镜头距离不同，近处可见丝数量不同，不能当成完全等负载比较。压力场景只有一个完整原生人物，其余是共享原生头部载体，没有包含独立身体、骨骼、角色间完整碰撞或联网成本。\n\n## 预算与缓存\n\n同一毛囊顺序和同一发型几何随屏幕投影连续调整可见前缀、整根采样和细节权重，没有替换发型模型。共享目标预算 128,000 根，另加少量淡入边界。远处保留惯性、风与回弹，近远切换拟合当前位移和速度。\n\n一个关注对象复用有序 GPU 显示缓冲，最多约 51.9 MB；静止曲线约 12.8 MB；两套表面场的原始和过滤 GPU 目标约 25.2 MB，另有 CPU 读回和毛囊属性。它们不是为每个头部复制。实际人物几何和形变存储共享，动作位置复用原生姿态缓存。远处不读回精细导向接触场。停止风和动作后，只有在整个静止窗口的运动都低于接触分辨率时才休眠，新的运动或外力会唤醒。\n\n原始样本见 `qa/distance-performance.json`；汇总见 `qa/distance-summary.json`。GPU 差值是不同样本均值的差，包含时钟与计时噪声。\n'
(P/'docs/performance.md').write_text(text,encoding='utf-8')
print(json.dumps({'rows':rows,'running':[(x['style'],x['count'],x['fps']) for x in r.get('runningCases',[])],'fluffy':[(x['style'],x['fps']) for x in r.get('fluffyCases',[])]},ensure_ascii=False))
