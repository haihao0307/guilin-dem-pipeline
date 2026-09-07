# R6 — 雨后石境

R5 的洞内染黑、宽泛苔藓覆盖与强面法线混合容易压平石灰岩层次。R6 调整矿物色层、来水与遮蔽约束的湿痕、团簇苔藓阈值、漫反射补光与高光过渡，减轻近景面片明暗，启用抗锯齿。默认是自然光，不是蓝灯或蓝色夜景。

唯一入口：`index.html`。独立单文件 WebGL2，仍为可旋转、缩放、平移的真实数值三维样板。`python workbenches/landscape-surface-r6/build.py` 从固定 SHA256 的 R5 重建此文件。

R5 来源：039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90，HTML SHA256 ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2。构建时逐字验证 worldSource 和 generateSource 保持；山体、洞口、峰脚、土体、落石与固定网格完全继承。零贴图、零 LOD，保护核心及区域真值不变。不得把材质效果解释为新增几何或已标定地质过程。

QA.json 记录本轮实际 HTTP 浏览器验证、R5 网格指纹对比、显微壳层与湿润参数不变性、状态导出恢复、七个视角、鼠标旋转缩放和窄屏布局检查。测试环境为桌面 Chromium / SwiftShader，手机视口检查不代表物理手机或 GPU 性能通过。

保留原版，不覆盖其他生产线。visualApproved=false，productionReady=false。这一版是可评审的材质与照明改进，不宣称整个资产已达到 3A 最终生产标准。原固定几何的局部轮廓与洞壁网格局限仍在。
