# 给海洋生产线的 Weather Mother 接入交接

## 唯一输入

整包 Weather_Mother_Clean_V1.0.0。版本 1.0.0-clean，渲染基线 V0.6.2-loop。只用这一套入口和同目录运行文件，不从旧版本或未发布实验目录寻找替换资产。

## 已存在的接口

页面完成初始化后，`window.WeatherMother.qa.ready` 为 true。

```js
const wm = window.WeatherMother;
const recipe = wm.getConfiguration();
wm.applyConfiguration(recipe);
const env = wm.getEnvironment();
wm.set('wind', 20);
wm.set('cloudSpeed', 12);
wm.set('direction', 270);
wm.set('hour', 17.5);
wm.setSeed(4217);
wm.setLoopPhase(0.25);
wm.pause();
wm.play();
```

`getConfiguration()` 包含天气案例、云属、种子、所有数值控制、开关、画质、相机、演化时钟、循环相位和漂移位置。载入会重新生成密度数据；等待 qa.ready 与云体切换结束后检查。配置记录不包含上一代云体和时间重建历史，载入过程中短暂重新生成属于正常行为，不承诺任意中间帧的逐像素回放。手动闪电瞬态不保存。

`getEnvironment()` 输出共享数据，长度统一为米、速度为米/秒。内部体积坐标仍采用千米，因此读取 GPU 场或相机数据时另外乘以 1000。方向约定为 +X 东、+Y 上、-Z 北。270° 西风吹向 +X，0° 北风吹向 +Z。

wind.velocityMps 表示含阵风的演示风向量；cloud.velocityMps 表示独立的云漂移向量。两者不能混用。海浪应首先参考 wind，只有选中“云速跟随风速”时云速才联动。

sun.direction、sun.linearColor、sun.intensity 与工作台当前光照使用同一组公式。它们用于同步海面日照方向和光色，未包括天空立方体反射贴图或真实地理太阳历。hour 为示意日周期；没有经纬度、日期或实况气象。

## 场景接入边界

当前 engine.js 自己持有全屏 WebGL2 画布和 DOM 控件。它可以直接作为独立工作台运行，也可以置于同源 iframe；父页面在加载完成后通过 iframe.contentWindow.WeatherMother 读取数据。

它尚未封装为可直接插入 Three.js 场景图的组件。完整海洋场景需要再实现共享相机、场景深度遮挡、云和海面合成、天空反射采样以及资源生命周期。不要把两个独立画布简单叠加后声称已完成水天一体。

## 冻结边界

云的密度生成、噪声和光照内核来自此次已验证基线；不要顺便退回旧蘑菇云或低采样沙点方案。雨雪为屏幕图形效果，山体抬升、尾流和彩虹属于解析外观近似。闪电视觉仍待修正，默认普通晴日不启用。七彩云、台风和新版闪电暂缓，不随本包交付。

当前仅完成天气侧的可复用参数合同。海浪谱、涌浪、破碎浪、泡沫、潮汐、海水光学与海底需在海洋生产线独立制作。
