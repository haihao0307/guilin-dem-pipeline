from pathlib import Path
import hashlib, json, shutil, subprocess, sys, zipfile, os

ROOT = Path.cwd()
SOURCE = ROOT / 'weather-mother' / 'clean-v110'
OUT_PARENT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_weather_restart_stage'
PACKAGE_NAME = 'Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0'
OUT = OUT_PARENT / PACKAGE_NAME
ZIP_PATH = OUT_PARENT / f'{PACKAGE_NAME}.zip'
RECEIPT_PATH = OUT_PARENT / f'{PACKAGE_NAME}.receipt.json'

if OUT_PARENT.exists():
    shutil.rmtree(OUT_PARENT)
OUT.mkdir(parents=True)

source_manifest = json.loads((SOURCE / 'MANIFEST.json').read_text())
assert source_manifest['package'] == 'Weather_Mother_Full_Clean_V1.1.0'
assert source_manifest['status'] == 'PACKAGE_BROWSER_VERIFIED'
for name, record in source_manifest['files'].items():
    raw = (SOURCE / name).read_bytes()
    assert len(raw) == record['bytes']
    assert hashlib.sha256(raw).hexdigest() == record['sha256']
    shutil.copyfile(SOURCE / name, OUT / name)

(OUT / 'PACKAGE_HANDOFF_V1.1.0.json').write_bytes((OUT / 'HANDOFF.json').read_bytes())

files = {
'START_HERE.md': '''# Weather Mother 全量重启交接包 V1.1.0

日期：2026-09-02

这是新窗口继续 Weather Mother 的唯一启动包。先完整读取本文件，再依次读取：

1. `HANDOFF.json`
2. `CURRENT_STATE.md`
3. `METHOD_ADOPTION.md`
4. `INTEGRATION.md`
5. `POLICY.json`
6. `MANIFEST.json`
7. `RESTART_QA.json`

读取完成后，先核对 GitHub 上的候选运行版、稳定回退版和当前分支状态，再继续代码工作。不要从旧 Cloud Mother、V0.3.2、独立光影实验页或其他 Mother 的文件恢复路线。

## 当前主线

主线名称是 **Weather Mother**。主要目标是一个纯程序化、可复现、可交互的高质量体积天气母体，覆盖云形、光学、风场、时间演化、天气事件和跨项目接口。

当前全天气候选为 `1.1.0-world`，包含 20 个天气案例、10 个云属、种子切换、独立风力与云速、连续形态循环、晨昏光照、虹彩、彩虹、雨雪、闪电和台风组织预览。

在线候选：
`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v110-full/`

干净在线镜像：
`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v110/`

稳定回退：
`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v1/`

## 下一窗口的第一优先级

继续完整 Weather Mother，不把工作缩成单独打光页。保留当前 20 个天气案例与 10 个云属，优先提高云体细腻度、内部光影层次、闪电真实度和真实 GPU 帧率；继续扩展天气体系时，所有新现象需有原因、关系、时间历史、单位、适用尺度和近似边界。

台风目前是风眼、眼墙、螺旋雨带和高层云盾的程序化组织预览。闪电目前仍是图形近似。它们可以继续迭代，禁止提前标记为最终 3A 通过或科学求解完成。

## 保护规则

只修改 Weather Mother 明确授权的目录。不得借本包修改 Ocean Mother、Landscape Mother、桂林 DEM、冻结真值、其他仓库或其他生产线。不得强推、改写历史或自动授予人工批准。

共同方法已经蒸馏为 `POLICY.json` 与 `METHOD_ADOPTION.md`。原始长文不在本包重复保存。运行时完整守卫迁移尚未覆盖全天气引擎，缺口必须继续如实记录。

`visualApproved=false`、`aaaQualityApproved=false`、`productionReady=false`，直到用户对精确构建作出明确批准。
''',
'CURRENT_STATE.md': '''# Weather Mother 当前状态

## 身份与仓库

仓库：`haihao0307/guilin-dem-pipeline`

发布分支：`gh-pages`

全天气运行版本：`1.1.0-world`

运行发布提交：`fa75a338f406bebfefa3ea0458366831fef7de48`

公开证据提交：`970aa25814e5d5f98cf10091da69666f62dbcd28`

干净复用包发布提交：`0303d499ebba7e7ddcfa105124c29087b9e421b2`

本次重启包由工作流提交 `${GITHUB_SHA}` 制作。这个值只标识打包启动点；Weather Mother 的权威运行身份仍由上面的运行发布提交和公开证据提交确定。

## 已实现

全天气主工作台提供 20 个案例：晴日积云、海岸层积云、山间湿雾、阴天降雨、深对流雷暴、雨后彩虹、雪与低云、高空冰云、七彩薄云、七彩云缘、山前荚状云、鱼鳞状卷积云、晨光低云、落日积云、湿雾云海、夜间雷暴、暖锋云幕、冷锋过境、飑线雷暴、台风云系。

云属包括 Cu、Cb、Sc、St、Ns、Ac、As、Ci、Cc、Cs。

工作台保留种子、云浓度、云团数量、湿度、对流强度、降水、风力、独立云速、来风方向、阵风、湍流、风切变、日照时间、曝光、连续形态循环、画质档位、暂停、相机、虹彩、彩虹、闪电和台风组织控制。

运行时不依赖云照片、HDR 图片、贴图图集或外部模型。当前干净运行代码约 87 KB，生成数据驻留浏览器内存。

## 已验证

全天气候选完成 52 项部署前浏览器检查和 52 项公开网页检查。运行文件公开字节和 SHA256 已核对，页面 HTTP、WebGL 首帧、20 个天气案例、10 个云属、种子变化、循环闭合、风向运动、虹彩边界、闪电像素变化、台风参数变化和移动端首次渲染均有记录。

干净复用包完成 42 项独立打包检查。晴日、七彩云、台风、夜间雷暴在同一测试环境中与上游运行版像素一致。

## 用户已经确认的方向

用户确认完整 Weather Mother 的路线正确，并要求继续做高质量体积天气、更多天气案例、七彩云、台风、闪电与高帧率优化。用户没有授予最终视觉批准或生产批准。

## 当前视觉问题

云体仍需更细腻，近景边缘、内部明暗褶皱和时间稳定性需继续提高。闪电的通道形态、亮度、持续时间、云内照亮和遮挡仍需参考校准。台风尚缺科学风场、气压、海温、科氏力、边界层与眼墙置换等过程。雨雪、山体抬升、飞机扰动和部分光学仍为图形近似。

## 性能问题

已有空区排除、距离下界跳步、时间重建和 GPU 计时基础。软件渲染器测试不能代表用户显卡。后续需要在真实 GPU 上记录分辨率、采样数、P50/P95 帧时、GPU 时间、显存和动态画质策略，禁止用源文件小推导高帧率。

## 禁止回退

禁止恢复 V0.3.2 的颗粒蘑菇云、低采样砂点、硬盒切边和删减光照路径。独立光影页只作展示证据，不能替代全天气主台。禁止用旧 Clean V1.0 接口清单冒充 V1.1 的实际接口。
''',
'METHOD_ADOPTION.md': '''# Weather Mother 对 Mother 统一世界演化方法的接入状态

共同原则版本：`1.0.0`

本包保留机器可读规则快照 `POLICY.json`。方法的核心已进入 Weather Mother 的设计与证据体系：对象作为随时间变化的状态；云形、光学、风、环境和事件按原因与关系组织；主种子与实例身份可复现；风力、云速和展示光照分开；未知机制、图形近似与未完成项明确标记；人工批准与自动 QA 分开。

已经存在的实际运行证据包括种子变化、形态循环、风向平流、虹彩受太阳与云体约束、台风参数改变体积画面、闪电改变实际像素、公开浏览器和构建身份。

完整接入仍有缺口。全天气运行器尚未在生成、参数修改、导出和发布的每个入口加载统一 Schema 与 guard。完整 initialState、formationHistory、environmentHistory、interactionHistory 和检查点重放尚未覆盖全部 20 个天气案例。对流微物理、水汽与冰晶收支、台风动力学、闪电电荷过程和实况天气均未完成。

中性检查、工作室展示和诊断证据保留在独立方法验证目录，日常全天气操作页不显示这些标签。共同原则没有被删除或改写。后续需要保持证据入口，同时让主工作台继续围绕天气生产。

任何新天气案例至少应记录对象身份、云属与主种子，初始状态与边界条件，湿度、温度、稳定度、风、地形或锋面的驱动来源，形态、密度、光学、降水和事件之间的因果连接，physicalTime、solverStep、displayTime 的关系，数值单位、坐标、适用尺度、校准状态和失效条件，以及中性、展示、诊断、环境、构建、浏览器和性能证据。

`visualApproved`、`productionApproved` 和 `aaaQualityApproved` 继续保持为 false。
''',
'NEXT_WINDOW_PROMPT.txt': '''请解压并完整读取 Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0。

严格按 START_HERE.md 的顺序读取 HANDOFF.json、CURRENT_STATE.md、METHOD_ADOPTION.md、INTEGRATION.md、POLICY.json、MANIFEST.json 和 RESTART_QA.json，然后核对 GitHub 的最新 gh-pages HEAD、全天气运行提交 fa75a338f406bebfefa3ea0458366831fef7de48 与公开证据提交 970aa25814e5d5f98cf10091da69666f62dbcd28。

继续 Weather Mother 全天气主线。保留 20 个天气案例、10 个云属、种子、独立风力和云速、连续形态循环、虹彩、彩虹、闪电、台风与现有光照。不要把项目缩成单独打光页，不恢复旧 Cloud Mother 或颗粒蘑菇云路线。

下一轮优先提高云体近景细腻度、内部光学层次、闪电真实度和真实 GPU 帧率，并继续按统一世界演化方法补齐原因、关系、历史、单位与证据。只修改 Weather Mother 授权目录，不改 Ocean Mother、Landscape Mother、DEM 真值或其他生产线。所有人工视觉和生产批准保持 false，直到用户对精确构建明确确认。
'''
}
for name, text in files.items():
    (OUT / name).write_text(text.replace('${GITHUB_SHA}', os.environ.get('GITHUB_SHA','LOCAL_BUILD')), encoding='utf-8')

repo_state = {
    'motherId': 'Weather Mother',
    'handoffVersion': '1.1.0-restart-2026-09-02',
    'repository': 'haihao0307/guilin-dem-pipeline',
    'branch': 'gh-pages',
    'repositoryHeadAtPackaging': os.environ.get('GITHUB_SHA','LOCAL_BUILD'),
    'weatherRuntimeCommit': 'fa75a338f406bebfefa3ea0458366831fef7de48',
    'weatherEvidenceCommit': '970aa25814e5d5f98cf10091da69666f62dbcd28',
    'cleanPackageCommit': '0303d499ebba7e7ddcfa105124c29087b9e421b2',
    'candidateURL': 'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v110-full/',
    'cleanMirrorURL': 'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v110/',
    'stableFallbackURL': 'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v1/',
    'policyVersion': '1.0.0',
    'policySHA256': hashlib.sha256((OUT / 'POLICY.json').read_bytes()).hexdigest(),
    'weatherCases': 20,
    'cloudGenera': 10,
    'runtimeImageAssets': 0,
    'visualApproved': False,
    'aaaQualityApproved': False,
    'productionReady': False
}
(OUT / 'REPOSITORY_STATE.json').write_text(json.dumps(repo_state, ensure_ascii=False, indent=2)+'\n')

prior = json.loads((OUT / 'PACKAGE_HANDOFF_V1.1.0.json').read_text())
handoff = {
    'motherId': 'Weather Mother',
    'handoffVersion': '1.1.0-restart-2026-09-02',
    'packageName': PACKAGE_NAME,
    'startFile': 'START_HERE.md',
    'readOrder': ['START_HERE.md','HANDOFF.json','CURRENT_STATE.md','METHOD_ADOPTION.md','INTEGRATION.md','POLICY.json','MANIFEST.json','RESTART_QA.json'],
    'runtimeVersion': prior['runtimeVersion'],
    'runtimeEntry': 'index.html',
    'repository': prior['repository'],
    'publicationBranch': prior['publicationBranch'],
    'runtimeCommit': prior['upstreamRuntimeRef'],
    'evidenceCommit': prior['upstreamEvidenceRef'],
    'cleanPackageCommit': '0303d499ebba7e7ddcfa105124c29087b9e421b2',
    'candidateEntry': 'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/v110-full/',
    'cleanMirrorEntry': 'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v110/',
    'stableFallbackEntry': 'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/clean-v1/',
    'weatherCases': prior['weatherCases'],
    'cloudGenera': prior['cloudGenera'],
    'runtimeFiles': prior['runtimeFiles'],
    'nativeAPI': prior['nativeAPI'],
    'methodPolicy': {'file':'POLICY.json','version':'1.0.0','runtimeAdoption':'partial','rawMethodologyDocumentBundled':False},
    'preserved': ['20 weather cases','10 cloud genera','seed controls','independent wind force and cloud drift','continuous morphology loop','time of day and lighting','iridescence and rainbow','rain and snow','graphical lightning','procedural typhoon organization','quality tiers and performance readout'],
    'firstNextTasks': ['AAA cloud edge and interior-detail refinement','AAA lightning reference calibration','real GPU frame pacing and empty-space acceleration','complete runtime policy and schema guard adoption','extend weather system without cross-Mother writes'],
    'protectedScopes': ['Ocean Mother','Landscape Mother','Guilin DEM truth assets','other repositories and Mother production lines','Git history and stable fallback releases'],
    'unresolved': prior['unresolved'],
    'runtimeImageAssets': 0,
    'visualApproved': False,
    'aaaQualityApproved': False,
    'productionReady': False
}
(OUT / 'HANDOFF.json').write_text(json.dumps(handoff, ensure_ascii=False, indent=2)+'\n')

for name in ['engine.js','field-worker.js','motion.js','optics.js']:
    subprocess.check_call(['node','--check',str(OUT/name)])

runtime_names = ['index.html','engine.js','cloud.glsl','field-worker.js','motion.js','optics.js']
runtime_hashes = {n: hashlib.sha256((OUT/n).read_bytes()).hexdigest() for n in runtime_names}
for name in runtime_names:
    assert runtime_hashes[name] == source_manifest['files'][name]['sha256']

restart_qa = {
    'status': 'PASS',
    'package': PACKAGE_NAME,
    'checks': [
        {'name':'source clean package manifest and file hashes verified','pass':True},
        {'name':'runtime files unchanged from browser-verified clean V1.1 package','pass':True,'details':runtime_hashes},
        {'name':'JavaScript syntax checks passed','pass':True,'details':['engine.js','field-worker.js','motion.js','optics.js']},
        {'name':'single runtime only','pass':True},
        {'name':'no image, model, cache, build tool, nested archive or obsolete runtime files','pass':True},
        {'name':'restart read order and next-window prompt included','pass':True},
        {'name':'policy snapshot included without duplicating raw methodology document','pass':True},
        {'name':'all approval flags remain false','pass':True}
    ],
    'inheritedBrowserEvidence': {
        'runtimeAutomaticChecks': 52,
        'runtimePublicChecks': 52,
        'cleanPackageChecks': 42,
        'scope': 'Existing verified runtime and clean-package evidence; this restart package changes documentation only.'
    },
    'visualApproved': False,
    'aaaQualityApproved': False,
    'productionReady': False
}
(OUT / 'RESTART_QA.json').write_text(json.dumps(restart_qa, ensure_ascii=False, indent=2)+'\n')

records = {}
for path in sorted(OUT.iterdir()):
    if path.name == 'MANIFEST.json':
        continue
    raw = path.read_bytes()
    records[path.name] = {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
manifest = {
    'package': PACKAGE_NAME,
    'version': '1.1.0-restart-2026-09-02',
    'runtimeVersion': '1.1.0-world',
    'runtimeCommit': 'fa75a338f406bebfefa3ea0458366831fef7de48',
    'evidenceCommit': '970aa25814e5d5f98cf10091da69666f62dbcd28',
    'sourceCleanPackage': 'Weather_Mother_Full_Clean_V1.1.0',
    'sourceCleanPackageManifestSHA256': hashlib.sha256((SOURCE/'MANIFEST.json').read_bytes()).hexdigest(),
    'files': records,
    'fileCountExcludingManifest': len(records),
    'runtimeImageAssets': 0,
    'nestedArchives': 0,
    'oldRuntimeCopies': 0,
    'status': 'PACKAGE_VERIFIED_PENDING_GITHUB_PUBLICATION',
    'visualApproved': False,
    'aaaQualityApproved': False,
    'productionReady': False
}
(OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')

with zipfile.ZipFile(ZIP_PATH,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for path in sorted(OUT.iterdir()):
        assert path.is_file()
        assert path.suffix.lower() not in {'.png','.jpg','.jpeg','.webp','.hdr','.exr','.ktx','.ktx2','.glb','.gltf','.zip'}
        info=zipfile.ZipInfo(f'{PACKAGE_NAME}/{path.name}',date_time=(2026,9,2,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=0o100644<<16
        archive.writestr(info,path.read_bytes())
with zipfile.ZipFile(ZIP_PATH) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(list(OUT.iterdir()))

receipt = {
    'package': PACKAGE_NAME,
    'zipBytes': ZIP_PATH.stat().st_size,
    'zipSHA256': hashlib.sha256(ZIP_PATH.read_bytes()).hexdigest(),
    'uncompressedBytes': sum(path.stat().st_size for path in OUT.iterdir()),
    'files': len(list(OUT.iterdir())),
    'runtimeFilesUnchanged': True,
    'runtimeImageAssets': 0,
    'archiveIntegrity': True,
    'sourceWorkflowHead': os.environ.get('GITHUB_SHA','LOCAL_BUILD'),
    'githubPublicationPending': True,
    'visualApproved': False,
    'aaaQualityApproved': False,
    'productionReady': False
}
RECEIPT_PATH.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False))
