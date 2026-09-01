"""Build a lossless standalone Weather Mother distribution. No source deletion."""
from pathlib import Path
import json, hashlib, re, sys, zipfile
NAME='Weather_Mother_Full_Clean_V1.1.0'
PIN='970aa25814e5d5f98cf10091da69666f62dbcd28'
RENDER_PIN='fa75a338f406bebfefa3ea0458366831fef7de48'
BASE='https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/'
RUNTIME=['index.html','engine.js','cloud.glsl','field-worker.js','motion.js','optics.js']
LOCK={'index.html':'a2b1113faed7fd1a44d47dc39964fabfa2a7dd1d18a9ee92661b0a6f7ffa234d','engine.js':'1fd7329544e849ebf3ed4ba95c97c538c8ebdfb7fe367a02d96c46bafea3e0e5','cloud.glsl':'5f1f66eaa0b9ef17b8353f453c34c5f976882f4f208033e3d497d0a073b00051','field-worker.js':'a93ed87ddda5e656e377b95719571cd334a167047931bcfe2e584f068227ce2d','motion.js':'ad111fe1280e15a33981589c75af9e9bfb38f5b89bde735980129852e392622c','optics.js':'e27a0b56c6f6c2c3bf2b55f4494ef421e6eaedc9676dc3dabaeaf73817af53e8'}
POLICY_SHA='80aef698e30a6378e25d6eeb7c6ee67c1df24e6ae96faef5f4df4ef62d19c8d3'
def digest(b):return hashlib.sha256(b).hexdigest()
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def build(src,policy,out):
    if out.exists():raise FileExistsError('Refuse to replace '+str(out))
    out.mkdir(parents=True)
    for n in RUNTIME:
        b=(src/n).read_bytes();assert digest(b)==LOCK[n],n
        (out/n).write_bytes(b)
    b=policy.read_bytes();assert digest(b)==POLICY_SHA
    (out/'POLICY.json').write_bytes(b)
    old='../method-v100/lighting/?lighting=silver&quality=fine'
    new=BASE+'method-v100/lighting/?lighting=silver&quality=fine'
    p=out/'index.html';s=p.read_text();assert s.count(old)==1
    p.write_text(s.replace(old,new),encoding='utf-8')
    cases=re.findall(r'<option value="([^"]+)">([^<]+)</option>',re.search(r'<select id="weather">(.*?)</select>',s,re.S)[1])
    genera=re.findall(r'<option value="([^"]+)">',re.search(r'<select id="kind">(.*?)</select>',s,re.S)[1])
    assert len(cases)==20 and len(genera)==10
    (out/'START_HERE.md').write_text('''# Weather Mother V1.1 干净复用包

先完整读取本文件，再读 HANDOFF.json 和 INTEGRATION.md，然后按 MANIFEST.json 检查文件身份。

本包来自已发布的 V1.1 全天气工作台，保留 20 个天气案例、10 个云属、种子、风力、云速、形态循环、晨昏光照、虹彩、彩虹、雨雪、闪电和台风组织预览。共一套运行内核，不混入旧版运行程序。

把本目录整体放到目标项目的静态资源目录，通过 HTTPS 打开 index.html。主页面无需 npm、CDN、API 密钥、云照片、HDR 或外部网格。需要 WebGL2 和 Worker。文件直接双击的 file:// 方式不作交付路径。可选的独立光影页使用绝对在线链接，不是启动依赖。

五个计算文件与上游逐字节一致。index.html 仅将独立光影页的相对链接改为绝对链接，避免跨项目移动后 404。未改云体、运动、光照公式或画质档位。

日常界面没有中性检查或体积诊断标签。上层共同规则保持在 POLICY.json；原验证页面只作外部证据保留，不打包第二套运行程序。完整规则的运行时迁移仍未完成，本包不因保存规则文件获得生产批准。

接收方只在自己的授权项目内接入。先完成独立网页启动和参数控制测试，再连接目标场景的太阳、天空、海水或飞行系统。本包不自动改动目标项目的资产、DEM、灯光默认值或时钟。不得用旧 Clean V1.0 的 API 清单替代当前 V1.1 的真实接口。

QA.json 区分上游浏览器记录与本次独立打包检查。自动检查不等于视觉批准。七彩云、闪电、台风、山体和飞机关系仍有图形近似边界；3A 视觉、生产批准与目标设备性能均待验证。
''',encoding='utf-8')
    (out/'INTEGRATION.md').write_text('''# 跨项目接入

## 挂载方式

推荐先将本目录完整放在目标网站 `/modules/weather-mother/`，以独立 iframe 运行。不要把整份 engine.js 直接插入另一套已运行的页面，它使用自己的画布、DOM、Worker 和动画循环。目标主场景若要求共享 WebGL 深度、反射或单画布，需要另做适配器，本包没有完成该阶段。

```html
<iframe id="weather" src="/modules/weather-mother/index.html?weather=fair"
        title="Weather Mother" style="width:100%;height:100%;border:0"></iframe>
```

跨源 iframe 可显示，但其脚本对象不能直接由父页读取。本例要求同源；本版没有 postMessage 桥接协议。严格 CSP 站点需允许现有内联样式、内联事件和同源脚本、Worker 与资源读取，接入方应审查自己的策略，不要为了嵌入全站放宽安全策略。

同源父页应等待运行 API 就绪，避免仅在 iframe load 时假定 GPU 已完成启动：

```js
async function waitForWeather(frame, timeoutMs = 60000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const api = frame.contentWindow?.WeatherMother;
    if (api?.qa?.errors?.length) throw new Error(api.qa.errors.join("\\n"));
    if (api?.qa?.ready && api.qa.frames > 0 && typeof api.setWeather === "function") return api;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Weather Mother 启动超时");
}
const frame = document.querySelector("#weather");
const weather = await waitForWeather(frame);
weather.setWeather("typhoon");
weather.set("wind", 32);
weather.set("cloudSpeed", 4);
weather.setSeed(4217);
```

## 当前真实接口

`window.WeatherMother` 提供 `setWeather(id)`、`setKind(id)`、`setSeed(uint32)`、`set(key,value)`、`setLoopPhase(0..1)`、`setCamera(yaw,pitch,distance)`、`pause()`、`play()`、`reset()`、`triggerLightning()`、`getState()`、`resetMeasurements()` 和只读使用的 `qa`。

`getState()` 返回当前已插值状态，参数修改采用平滑过渡，不保证调用后立即等于目标值。`qa.ready` 表示已能渲染；切换天气和种子还应等待 loading 隐藏、`blend` 接近 1、`qa.weatherCase` / `qa.seed` 与目标对应。`triggerLightning()` 在暂停下只触发当前事件，持续播放由 play() 明确控制。`setTestTime()` 是遗留测试时钟钩子，禁止当作带形成历史的物理回放接口。

台风的 eyeRadius、rainbandCurl、stormRadius、cycloneSpin 四个控制，当前原生 set() 未对源场生成执行完整刷新。调用它们应经过同源子页真实滑杆事件，保留现有 UI 的重建逻辑：

```js
function setWeatherControl(frame, id, value) {
  const win = frame.contentWindow;
  const el = win.document.getElementById(id);
  if (!el || el.type !== "range" || !Number.isFinite(value)) throw new Error("无效控件");
  if (value < Number(el.min) || value > Number(el.max)) throw new RangeError("参数越界");
  el.value = String(value);
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
}
setWeatherControl(frame, "eyeRadius", 3.1);
```

开关与选择框也通过对应子页元素的 change 事件操作。`lightScene` 是主台的自然光预设选择。全天气主台保留完整天气操作；三灯独立检查页仍为可选在线链接。

## 单位与时钟

内部云场长度为 km，跨项目转换为 m 时乘以 1000。坐标为 +X 东、+Y 上、-Z 北。风向采用气象来向，270° 表示来自西方，平移朝 +X。风力与云漂移速度为 m/s，开启 windLink 才联动。相机角度为 rad，distance 为内部 km；虹彩 dropletRadius 控制为 µm。其余系数遵循页面显示范围，模型未作实测标定。

`getState().windOffset` 是 km；`qa.simulationTimeS` 是本渲染器的过程演示时钟。timeScale、形态循环、云平移和昼夜展示具有现有逻辑，不宣称统一求解器或跨系统确定性调度。

当前 V1.1 没有 Clean V1.0 的 getEnvironment、getConfiguration、applyConfiguration 接口，也没有完整 JSON 场景恢复或导出面板。接收方可读取 getState() 作为状态快照，但它缺少全部 UI 开关、目标参数和形成历史，不能称为可完全重放配置。海洋太阳与风的交换适配需在目标项目另做并验证，禁止仅凭复制文件宣称已完成跨项目耦合。

## 已知边界

台风是缩尺度的风眼、眼墙、螺旋雨带体积外观，尚无气压、海温、科氏力或数值天气求解。闪电是分支通道、复击及云内照亮图形近似。虹彩为多波段衍射外观近似。雨雪为屏幕空间效果。山体和飞机为解析示意，无真实 DEM 变更或气动求解。

保留的 112 / 192 / 320 / 480 步档位使用不同真实渲染尺寸，qa.renderSize 给出内部像素，canvas.width/height 给出显示缓冲尺寸。本包没有为了体积更小而降采样。源代码体积不代表 GPU 内存或性能，目标显卡和移动设备需单独测量。

母体规则快照随包保留，Schema 与守卫在原 method-v100 独立样本中。本 V1.1 全天气运行器尚未加载该守卫；完整初始状态、事件历史、命名空间随机流、三模式同一实例证据与跨设备回放仍未全线迁移。接收方保持所有人工视觉和生产批准为 false。
''',encoding='utf-8')
    handoff={'motherId':'Weather Mother','packageVersion':'1.1.0-clean','runtimeVersion':'1.1.0-world','packageName':NAME,'startFile':'START_HERE.md','runtimeEntry':'index.html','integrationGuide':'INTEGRATION.md','repository':'haihao0307/guilin-dem-pipeline','publicationBranch':'gh-pages','upstreamRuntimeDirectory':'weather-mother/v110-full','upstreamRuntimeRef':RENDER_PIN,'upstreamEvidenceRef':PIN,'packagedDirectory':'weather-mother/clean-v110','distributionPath':'weather-mother/distributions/'+NAME+'.zip','distributionRefNote':'The publishing commit is recorded in the adjacent ZIP receipt, not the upstream source ref.','runtimeFiles':RUNTIME,'weatherCases':dict(cases),'cloudGenera':genera,'renderingKernelByteIdentical':True,'htmlOnlyChange':'Optional lighting link made absolute','standaloneRuntime':True,'cdnOrApiKeyRequired':False,'hostRequirement':'HTTP/HTTPS, WebGL2, Worker','runtimeImageAssets':0,'runtimeImportDependenciesOutsidePackage':0,'optionalLightingViewer':BASE+'method-v100/lighting/?lighting=silver&quality=fine','policy':{'file':'POLICY.json','version':'1.0.0','sha256':POLICY_SHA,'coreModified':False,'runtimeAdoption':'partial; full weather engine does not yet invoke methodology guard','externalEvidenceDirectory':'weather-mother/method-v100','externalEvidenceRef':PIN,'externalModesNotBundled':True},'nativeAPI':['setWeather','setKind','setSeed','set','setLoopPhase','setCamera','pause','play','reset','triggerLightning','getState','resetMeasurements','qa'],'notProvided':['getEnvironment','getConfiguration','applyConfiguration','complete history replay','postMessage bridge','shared Three.js/WebGL scene adapter'],'controlCaveat':'Cyclone shape controls use DOM input events to invoke existing generator rebuild logic; see INTEGRATION.md.','cleanupScope':'Package allowlist only; no deletion of repository history, other production lines, or frozen assets.','upstreamTests':{'automatic':52,'public':52,'ref':PIN,'path':'weather-mother/v110-full/PUBLIC_QA.json','run':33477907204,'notNewPackageTests':True},'packageTests':'QA.json','unresolved':['AAA cloud and lightning visual refinement','calibrated microphysics or full fluid solver','live weather','scientific cyclone model','complete policy runtime migration','target-project coupling and GPU performance'],'visualApproved':False,'productionApproved':False,'aaaQualityApproved':False,'productionReady':False}
    dump(out/'HANDOFF.json',handoff)
    finalize(out)
def finalize(out):
    files={p.name:{'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())} for p in sorted(out.iterdir()) if p.is_file() and p.name!='MANIFEST.json'}
    m={'package':NAME,'version':'1.1.0-clean','runtimeVersion':'1.1.0-world','upstreamRuntimeRef':RENDER_PIN,'upstreamEvidenceRef':PIN,'upstreamRuntimeSHA256':LOCK,'files':files,'fileCount':len(files)+1,'runtimeBytes':sum(files[n]['bytes'] for n in RUNTIME),'status':'PACKAGE_BROWSER_VERIFIED' if 'QA.json' in files and json.loads((out/'QA.json').read_text())['status']=='PASS' else 'BUILT_PENDING_PACKAGE_QA','visualApproved':False,'productionApproved':False,'aaaQualityApproved':False}
    dump(out/'MANIFEST.json',m)
def archive(out,dest):
    finalize(out);m=json.loads((out/'MANIFEST.json').read_text());assert m['status']=='PACKAGE_BROWSER_VERIFIED'
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(out.iterdir()):
            info=zipfile.ZipInfo(NAME+'/'+p.name,(2026,9,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,p.read_bytes())
    with zipfile.ZipFile(dest) as z:assert z.testzip() is None
    receipt={'package':NAME,'zipBytes':dest.stat().st_size,'zipSHA256':digest(dest.read_bytes()),'files':len(list(out.iterdir())),'uncompressedBytes':sum(p.stat().st_size for p in out.iterdir()),'manifestSHA256':digest((out/'MANIFEST.json').read_bytes()),'runtimeBytes':m['runtimeBytes'],'upstreamRuntimeRef':RENDER_PIN,'upstreamEvidenceRef':PIN,'packageBrowserChecks':len(json.loads((out/'QA.json').read_text())['checks']),'visualApproved':False,'productionApproved':False,'aaaQualityApproved':False}
    dump(dest.with_suffix('.receipt.json'),receipt);print(json.dumps(receipt,indent=2))
if __name__=='__main__':
    if sys.argv[1]=='build':build(Path(sys.argv[2]),Path(sys.argv[3]),Path(sys.argv[4]))
    elif sys.argv[1]=='archive':archive(Path(sys.argv[2]),Path(sys.argv[3]))
    else:raise ValueError('build or archive required')
