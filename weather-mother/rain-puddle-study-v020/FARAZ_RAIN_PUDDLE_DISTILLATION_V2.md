# Weather Mother · Faraz Rain Puddle 技术蒸馏 V2

日期：2026-09-03

## 固定来源

仓库：`Faraz-Portfolio/demo-2023-rain-puddle`

分支：`main`

固定提交：`257066b63d08b227df8f982377e60f91752ddc81`

固定树：`3c66b1f3db3dc506676aca16dba698c78d15d9bf`

公开演示：`https://faraz-portfolio.github.io/demo-2023-rain-puddle/`

## 从源码确认的系统组织

### 共享降雨进度

`src/useMakeRain.ts` 维护一个五秒线性增长的 `rainProgressRef`。雨滴、水洼材质和声音读取同一进度，建立统一天气事件时钟。

### 雨滴

`src/Rain/Drops.tsx` 使用 1000 个实例化平面。平面朝向相机，逐帧下降，到达地面后随机重生。片元着色器通过不均匀胶囊距离函数形成细长软边轮廓。

### 水洼与涟漪

`src/Floor/PuddleMaterial.tsx` 在原道路 PBR 材质中注入水洼逻辑。sFBM 形成不规则水洼覆盖。降雨前段先降低粗糙度，后段再加入水面法线和涟漪。涟漪使用 3 × 3 邻域、哈希随机中心、独立相位和传播半径累积成法线扰动。

### 飞溅

`src/Rain/Splashes/index.tsx` 使用 1000 个实例化平面和 4 × 5 翻页动画。`useSplashPositions.ts` 读取场景网格顶点，使用朝上的法线建立 `skyWeight`，通过 `MeshSurfaceSampler` 把飞溅分配到可受雨表面。每个飞溅保存独立生命周期相位。

### 声音与雷暴

`src/Rain/index.tsx` 使用 Howler 循环播放雨声和夜间环境声，两层读取同一降雨进度，同时使用不同增益曲线。

`src/Rain/Thunder.tsx` 将雷雨音频划分成两个 audio sprite，在 5 至 20 秒随机间隔内触发。雷声事件同时驱动环境中的闪光面板。仓库里还存在风声音频，当前运行源码没有引用，因此只登记为未接入资产。

### 环境与后期

`src/Lights.tsx` 使用 HDR 环境，并把雷暴闪光嵌入环境照明。`src/App.tsx` 使用 Bloom、ToneMapping、对比度、饱和度、亮度和多层渐变整理最终画面。

## 蒸馏进入 Weather Mother 的规则

1. 降雨、湿润、水洼、涟漪、飞溅、闪光与声音共享一个天气状态时钟。
2. 雨滴轮廓保持细长、软边、随机尺度和随机相位。
3. 湿润先改变粗糙度，积水形成后再增强反射与涟漪法线。
4. 水洼边界来自连续场，禁止规则圆形平铺。
5. 飞溅读取表面方向、遮挡、雨量通量和材质。
6. 雨声、环境声、风声、积水击打和雷声作为独立声音层混合。
7. 闪光与雷声属于同一个雷暴事件，雷声延迟由距离和声速决定。
8. 水面必须读取可辨识的环境反射和最终色彩分级。

## V0.2 独立演示

运行目录：`weather-mother/rain-puddle-study-v020/`

演示使用单文件 WebGL2 与 Web Audio，零图片、零模型、零外部音频、零 HDR。程序化生成城市雨景、湿润路面、不规则水洼、多中心涟漪、飞溅、近中远雨层、环境闪光、雨声、夜间底噪、风声、积水击打和延迟雷声。

点击“开始声画”后，降雨在五秒内渐入。移动端控制面板默认关闭，数秒后界面自动消失，Weather Mother 壳层也进入纯画面模式。点击画面可唤回控制。

## 许可证与来源边界

仓库根 `LICENSE` 是 GNU GPL v3.0，作者项目页页脚当前写 GNU AGPL v3.0。仓库中的道路贴图、HDR、贴花和音频缺少独立来源收据。本演示采用清洁蒸馏，没有复制原仓库源码、贴图、HDR、模型、翻页图、音频或二进制资产。

## 当前状态

```text
visualApproved=false
aaaQualityApproved=false
productionReady=false
```
