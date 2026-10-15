from pathlib import Path
import json, hashlib, statistics, datetime, subprocess

root=Path(__file__).resolve().parents[1]
read=lambda path:json.loads((root/path).read_text(encoding='utf-8'))
write=lambda path,data:(root/path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest=read('qa/r09-runtime-bytes.json');tree='1fb8036d09d96f6eac307946cd3a4991202a1614'
url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-board-r09-1fb8036d09d9/'
delivery=read('qa/r09-final-delivery.json');smoke=read('qa/r09-public-smoke.json');combinations=read('qa/r09-combinations.json');materials=read('qa/r09-material-final.json');cache=read('qa/r09-contact-reuse-proof.json');contact=read('qa/r09-crotch-sweep.json');collection=read('qa/r09-collection-qa.json');video=read('qa/r09-video-metadata.json')
for report in [delivery,smoke,combinations,materials,cache,contact,collection]:
 assert not report.get('failure'),report.get('failure');assert not report.get('errors'),report.get('errors')
assert delivery['url']==smoke['url']==url and len(smoke['bytes'])==17
assert len(delivery['segments'])==6 and len(combinations['combinations'])==12 and len(materials['cases'])==6 and len(contact['cases'])==36
assert all(row['passed'] for row in cache['cases'])
for row in combinations['combinations']:assert not row['GL'] and not row['error'] and not row['safetyTrips']
for row in materials['cases']:assert not row['GL'] and not row['error'] and not row['safetyTrips']
for folder in ['r09-board','releases/r09-1fb8036d09d9']:
 for row in manifest['files']:assert hashlib.sha256((root/folder/row['path']).read_bytes()).hexdigest()==row['sha256'],(folder,row['path'])
collection_root=root.parent/'Human-Clothing-Workbench'
backup=read('qa/R09_COLLECTION_BACKUP.json');backup_path=collection_root/backup['backup']
assert hashlib.file_digest(open(backup_path,'rb'),'sha256').hexdigest()==backup['beforeSHA256']
assert hashlib.sha256((collection_root/'服装鞋帽工作台.html').read_bytes()).hexdigest()==backup['afterSHA256']
for filename in ['CURRENT_STAGE.json','PROJECT_INDEX.json','CURRENT_PACKAGE.json']:
 old=json.loads(subprocess.check_output(['git','show','eca8f6971b28b448dffb0023de8697c1fd634ece:'+filename],cwd=collection_root))
 now=json.loads((collection_root/filename).read_text(encoding='utf-8'));now.pop('previewMaintenance',None);assert now==old,filename
minimum=min(min(row['regions'][1]['minBodyVertexDistanceMM'],row['regions'][1]['minBodyTriangleCentroidDistanceMM'])for row in contact['cases'])
assert minimum>=0
assert all(row['regions'][1]['sewnBoundary']['continuousSpanMaxMM']==0 for row in contact['cases'])
q=lambda values,p:sorted(values)[min(len(values)-1,int((len(values)-1)*p))]
rates=[]
for row in delivery['segments']:
 assert not row['audit']['error'] and not row['audit']['glError'] and not row['audit']['motionAndContact']['safetyTrips']
 trace=row['trace'];timings=[x['solverMS']for x in trace];intervals=[b['wall']-a['wall']for a,b in zip(trace,trace[1:])]
 rates.append({'look':row['look'],'motion':row['motion'],'FPS':row['frames']/row['wallSeconds'],'wallSeconds':row['wallSeconds'],'solverMedianMS':statistics.median(timings),'solverP95MS':q(timings,.95),'renderIntervalP95MS':q(intervals,.95),'simulationToWallRatio':row['audit']['fastRuntime']['simulationToWallRatio'],'safetyTrips':0,'GL':0})
controls={row['bottom']:{'coarseDynamicControls':row['pipeline']['physicalParticles'][1],'materialControls':row['pipeline']['visualControlVertices'][1]}for row in contact['cases']}
evidence={'version':'MP05-R09-Board','status':'verified-pattern-first-board-and-sampled-rise-contact-repair','runtimeTree':tree,'runtimeFiles':346,'parentRuntimeTree':'ccccfd5ca9c16b7ac8b1650ec2e59889f9d6391c','pagesCommit':'7129ed5a7a0cf1c1208298dffeaf28b2d8863824','pagesRun':{'id':38731451030,'conclusion':'success'},'publicURL':url,'publicVerified':True,'publishedCriticalFilesVerified':17,'remoteRuntimeBlobsVerified':346,'collectionCodeCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=collection_root,text=True).strip(),'localCollectionURL':'http://127.0.0.1:8897/Human-Clothing-Workbench/%E6%9C%8D%E8%A3%85%E9%9E%8B%E5%B8%BD%E5%B7%A5%E4%BD%9C%E5%8F%B0.html?v=R09-1fb8036d09d9','workflow':['top and bottom patterns','independent materials','explicit live try-on'],'catalogCounts':{'tops':4,'bottoms':3,'materials':12,'verifiedCombinations':12},'device':delivery['device'],'publicMotionRates':rates,'sampledRiseContact':{'poses':36,'minimumBodyDistanceMM':minimum,'maximumContinuousSeamGapMM':0,'controlsByDenimTrouser':controls,'actualBodyTriangles':True,'samples':'declared rise and side seam vertices, added material contact points, neighboring triangle centroids','continuousCollisionCertified':False},'materialContactRefinement':read('qa/r09-rise-refinement-test.json'),'topology':read('qa/r09-topology-proof.json'),'packetContract':read('qa/r09-packet-contract-test.json'),'queryReuse':{'type':'only identical body and sample coordinates with satisfied clearance','sameFixedStepPositions':all(r['maximumPositionDifferenceMeters']==0 for r in cache['cases']),'maximumPositionDifferenceMeters':max(r['maximumPositionDifferenceMeters']for r in cache['cases'])},'otherMaterialMotionCases':materials['cases'],'recipeDetailsRestored':cache['recipe']['applied'][1]['weaveScale']==7,'mobile':combinations['mobile'],'collectionFlowVerified':not collection.get('failure'),'video':video,'backup':backup,'fullFreeCloth':False,'selfCollisionCertified':False,'paperMetricCertified':False,'productionAcceptanceChanged':False,'noDesktopMouseUsed':True,'concurrentCandidateCharacterFilesExcluded':True,'supersededTrialRuntime':'9930c71031390f2c6a506a784003f7a0c7a30f24','verifiedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
write('qa/R09_EVIDENCE.json',evidence)
write('qa/r09-final-integrity.json',{'runtimeTree':tree,'filesVerified':346,'workingAndImmutableReleaseEqual':True,'oldCollectionBackupSHA256':backup['beforeSHA256'],'collectionSHA256':backup['afterSHA256'],'oldProductionStageDataUnchanged':True})
publish=read('qa/R09_PUBLISH.json');publish.update(pagesVerified=True,pagesRun={'id':38731451030,'conclusion':'success'},publishedCriticalFilesVerified=17);write('qa/R09_PUBLISH.json',publish)
table=[]
for look,label in [('D01','深靛牛仔'),('D03','浅洗牛仔')]:
 values=[next(r['FPS']for r in rates if r['look']==look and r['motion']==motion)for motion in ['walk','run','jump']];table.append('| '+label+' | '+' | '.join(f'{v:.2f}'for v in values)+' |')
readme=f'''# MP05 R09 · 服装案板

打开后先选上衣和下装版型，再各自选材质，确认后试穿。四款上衣、三款裤型与十二种材质独立管理；配方可保存材质细节。原裁片轮廓直接显示在案板，目录浏览不重复生成衣物。

[打开本地集合]({evidence['localCollectionURL']}) · [固定公开预览]({url}) · [真实动作录像](qa/R09_服装案板_真实动作.mp4)

![版型案板](qa/R09_board_patterns.png)

裤装修复分两层：补齐原侧缝漏掉的中间材料节点约束；在裆缝邻域的少数长三角形内部追加 26–44 个真实材料接触点，处理运动时的身体穿出。没有补洞背板或额外衣壳。三种裤型的 36 个采样姿态中，检查区域的接缝间隙为 0，最小身体离体距离 {minimum:.3f} mm。该检查不是连续碰撞或整衣工艺验收。

固定公开版本由本机 Chrome 155 / RTX 4070 Ti SUPER / 1600×1150 / DPR 1 实测，每段 8 秒，计数已完成的真实绘制帧：

| 材料 | 走路 FPS | 跑步 FPS | 反复跳跃 FPS |
| --- | ---: | ---: | ---: |
{chr(10).join(table)}

实际录像 {video['final']['seconds']:.2f} 秒、{video['final']['frames']} 帧，平均 {video['final']['averageFPS']:.2f} FPS；保留原始时间戳，没有插帧或变速。针织、皮革六段动作及十二组版型加载通过；相同固定步进的缓存开关坐标差为 0。完整记录见 [R09 QA](qa/R09_EVIDENCE.json) 与 [开发说明](docs/R09_BOARD_AND_CROTCH.md)。

R08 牛仔放大织纹、浅洗起伏与远距过滤保留。旧集合完整备份已保留在相邻集合项目，旧固定版本保持。人物并行候选文件未纳入此版本。完整自由布料、全自碰撞、CCD、材料标定及七阶段成衣工艺验收仍未完成。
'''
(root/'README.md').write_text(readme,encoding='utf-8')
p=root/'docs/R09_BOARD_AND_CROTCH.md';text=p.read_text(encoding='utf-8').split('\n## 最终交付结果')[0];text+=f'''\n## 最终交付结果

最终固定树 `{tree}`，346 文件；公开 Pages 提交 `{evidence['pagesCommit']}`、运行 38731451030 成功，17 个变更关键文件通过实际 HTTP 字节核验，全部 346 个 Git blob 与本地固定文件一致。集合提交 `{evidence['collectionCodeCommit']}`，完整旧页面备份散列保持。

三裤型×三动作×四相位共 36 次离散检查：整段缝合间隙为 0，当前真实身体的检查点和相邻三角面重心最小离体 {minimum:.6f} mm。局部控制点和实时粗分区的实际数量记录在 `qa/R09_EVIDENCE.json`，不能把只补接缝时的原点数不变推广到最终局部材料细分。

四乘三种版型加载、针织/皮革六段动作、公开牛仔六段长动作、配方材质细节还原、390/1024 窄屏及集合入口检查通过。原角色服装仍是骨架参考加分区次级布料；这些通过项不授予完整自由布料、CCD、自碰撞或七阶段工艺验收。
''';p.write_text(text,encoding='utf-8')
print(json.dumps({'runtimeTree':tree,'publicVerified':True,'motionFPS':[round(r['FPS'],2)for r in rates],'contactMinimumMM':minimum,'videoFrames':video['final']['frames']},ensure_ascii=True))
