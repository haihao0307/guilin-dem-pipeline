# 跨项目接入

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
    if (api?.qa?.errors?.length) throw new Error(api.qa.errors.join("\n"));
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
