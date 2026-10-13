# F03 / 出根方向、区域弧长与完整稀疏导向

用户在本轮明确说『可以可以，这一版通过了，可以继续往下一轮走了』。通过范围限定为 F02.1 默认生长域、耳前局部修剪；不自动意味着全部毛发物理、所有头型或完整发型通过，不授权合并 PR。

## 冻结基线

父提交111066a5058a2937420c25565f7b1fbd0d5d81a2。
用户验收的运行构建ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3；F02.1网页HTML SHA256 afb12cd47db9d8fe4df36765d42bc029e6d7a298ee25f393d7f03e3436729e68。
F03将四个范围模块逐字复制到src/approved：BoundaryKernel、F02Boundary、EarClearance、LegacyFoundation。构建核查冻结清单哈希。默认根库保持3300条/a624b76f、激活3067；默认域面积627.94943956743 cm²为目标网格工程数，不是人体测量。生长范围参数不进入F03方案可编辑字段，旧F02.1/F02/F01/短发和其他工作台保持不动。

## 本轮实际实现

从同一原生GNM根点计算表面法线、切向和离切平面的出根角。前额、双侧颞/鬓角、冠部、后脑、后颈有独立角度，冠旋位置/偏转可调整。极靠近冠旋中心标记singular，不将不确定性说成照片实测。

出根与根上方梳理分离：分缝只影响随后曲线，不改毛根或根部方向场。三个结构测试族为区域方向、中/侧分、向后梳理，不冒充用户已经指定的照片发型。照片全发型入口尚未实现。

从已通过的3067个激活诊断根点选出192条稳定的原生面/重心绑定导向。先分区播种，再最远点选样；不搬动诊断根点。2mm步长延续到240mm，保存完整静态路径与累积弧长。六个区域长度分别控制，15–240mm；长度修改通过缓存路径剪短/延伸发梢，非均匀缩放整根。其他区域曲线逐字保持。显示24–192条导向只控制可见数量，不是密度/生物毛囊数。

使用原生三角面BVH构建静态接触保护，不是F01的5mm距离场采样。原生线段检查和最近面缓冲约束用于避免曲线穿面；仅是静态构建，不是动态连续碰撞或精确有限半径发丝接触。全长240mm的某些根会走出截断半身区域，不声称完整身体约束。

8mm直探针检查发现一个默认耳上根会在更远处击中耳廓。保持根点和生长域不动，只将局部方向抬起至无穿面角；requestedAngle/resolvedAngle和clearanceAdjusted分别保留。不是把所有毛根强制同一个18°，也不把接触修正当成真实生物起根角。

WebGL显示完整导向、出根箭头、法线对照和已通过范围。原灰模与灯光保持。构建/检查在Worker，旧结果收到过期任务不替换。静态按需渲染，无连续假物理动画。新增独立HairGuideRecipe、kaopu.hair.F03本地存档与JSON进出；拒绝错误拓扑、范围版本、根库、越界/未知字段。

## 验收边界

本轮完成定义是可检查的方向与静态导向，不是密发成品。没有推进新物理解算器，旧F01约15fps的软件显卡问题不能声称在这里已经解决。没有生成/上传用户人物图片，不使用之前错误生成的标注图。

本地Node通过默认加9个参数情形的原生中心线与8mm探针检查，包含双侧分缝、两端冠旋、起根偏移、15/240mm长度。所有数值必须由实际evidence/core.json为准，不把测试数当全部参数空间证明。浏览器验证另测固定公网链接；390×844只为手机视口，不是实机。公开交付状态以DELIVERY.json为准；存在网页失败时标记交付未完成。

## 参考方法与授权

SideFX Guide Groom（Lock Root / Lift / Cut-Extend） https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html
SideFX Hair Generate（skin/rest/guides分离） https://www.sidefx.com/docs/houdini/nodes/sop/hairgen.html
仅学习分层方法，未复制Houdini程序或资产。GuideKernel为自有JavaScript；SurfaceQuery沿用已保存L03/F01的原生三角面查询。原生头部和Three.js沿用已冻结资产，licenses保留既有许可，不因调参声称取得第三方原始资产所有权。

复现：esbuild@0.25.0和Playwright@1.55.1；python build.py，node tests/core.mjs，通过HTTP提供site，node tests/browser.mjs <URL> candidate。固定HTTPS另测public。作者容器的浏览器导航由管理策略阻止，不绕过；实际网页截图与交互通过GitHub Actions生成。PR保持Draft，禁止合并/强推；不修改共享gh-pages。
