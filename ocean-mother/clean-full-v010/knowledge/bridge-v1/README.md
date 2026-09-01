# Ocean Mother O1A 只读天气环境接入

当前状态：48 项本地单元测试通过；完整浏览器和公开页面验收尚未进行。海面渲染尚未实现。

## 固定上游

仓库 haihao0307/guilin-dem-pipeline。
启动文件 weather-mother/OCEAN_START_HERE.md 固定于 c762658e22d76f9d833c726140831ed257162b75。
所有 clean-v1 文件和原 ZIP 固定于 2619725efe236d2df8f2a55031bdae9e60a51555。
版本 1.0.0-clean，渲染基线 0.6.2-loop。UPSTREAM_LOCK.json 保留运行文件、清单与原 ZIP 的字节身份。
原天气目录不作修改，旧 repositoryReadRef 不用于定位交付目录。

## 接入

在与天气工作台同源的宿主页面加载 environment-bridge.js：

```js
const bridge = new OceanMotherBridge.EnvironmentBridge(
  () => document.getElementById('weather').contentWindow.WeatherMother
);
try {
  const frame = bridge.sample();
  // 海洋后续模块读取 frame.wind.velocityMps 和 frame.clock.simulationSeconds。
} catch (error) {
  // NOT_READY / SOURCE_TRANSITION 时暂停下游消费。
  // 其他错误明确呈现；不合成替代天气，也不继续返回旧帧。
  console.error(error.code, error.message);
}
```

只有 qa.ready=true、qa.errors 为空、当前云属和种子已经生效、blend=1 时才返回有效帧。当前 API 没有独立的密度生成 job 就绪字段；同种子同云属下 count/instability 重建的所有中间资源状态不能由这组字段完整识别。本层只提供参数合同，不证明共享 GPU 资源已就绪。

米制接口不再次乘 1000，模拟秒增量不再次乘 timeScale，阵风不再次乘入风向量。云速保持独立，云循环相位归零不重置海洋时钟。日照方向、线性色彩和控件强度原样传递，夜间不补做新太阳公式。

首次采样、已观察到的时间回退、来源替换或重新取得来源时，产生明确的 discontinuity 和零积分增量。由宿主控制的配置载入前调用 bridge.resynchronize()，可处理向前跳时；任意外部配置载入的向前跳时与正常长时间间隔无法仅由该 API 完整区分。

运行期版本字段不能证明所加载字节身份，所以输出显式保留 runtimeByteIdentityVerified=false。部署必须另做 URL 和资源哈希核验。适配器不写入上游，不终止其 Worker。

## 测试

在仓库根目录执行：

```sh
node --test ocean-mother/bridge-v1/tests/*.cjs
```

源接口测试默认读取仓库根目录 weather-mother/clean-v1/engine.js，也可以用环境变量 WEATHER_ENGINE_PATH 指向精确原件。测试先核验 engine.js SHA256，再提取原 getEnvironment 和 normal 函数执行。外围状态与 DOM checkbox 使用明示夹具。32 项适配器合同测试加 16 项精确原接口函数测试，共 48 项。

此测试不运行完整 WebGL 引擎，不等同于浏览器、视觉或用户设备性能验收。GitHub 工作流 Ocean Mother bridge contract tests 将对触发提交再次运行这些测试并保存证据。

## 已验证交接与证据

本轮独立 Actions run 33458136570 对原 ZIP、CRC、文件列表、MANIFEST 和仓库源文件完成 54 项检查，全部通过。证据 artifact 9782171953。
本窗口已下载该 artifact，取出完整原 ZIP 并实际解压，再次核验 11 个清单条目和 12 个仓库文件，全部一致。

原 ZIP：37,906 bytes，SHA256 596b963fef0cc2eafe7855178ae9f93c3e2aef2b78bdf98dd5e9e49c1a443bae。

附带 PUBLICATION_RECEIPT.json 对 HANDOFF.json 记录 1,586 bytes / 74e4b0e160210fb63b0423fca11f14507198ed86891159861dfb857169d31138；最终 ZIP、MANIFEST 与固定 ref 为 1,647 bytes / 47dd18c42597813aae798039c02848c23c8b9e7f71295755d7b5619b52cf635d。该条目有差异，原因和先后顺序不作推断，原收据保持原字节。

包内 59/60 项自动检查记录属于上游证据，不与本轮 54 项完整性检查或 48 项单元测试混计。

## 下一关

先用允许导航和 WebGL2 的真实浏览器验证同源读取、暂停/恢复、风云独立、配置重载后的 readiness 和重同步，再另做公开 URL 与静态资源身份验证。
随后在 Ocean Mother 独立模块制作受 wind 驱动的可控海面及独立涌浪。泡沫、破碎浪、潮汐、海水光学与海底分步实现。完整水天场景还需共享相机、深度遮挡、合成和天空反射采样；不得仅叠加两个画布后宣告完成。

visualAcceptance=false，productionReady=false，oceanRendererImplemented=false，publicDeploymentVerified=false。
