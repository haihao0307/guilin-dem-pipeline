# R02 固定构建视觉复查 · 2026-10-13

检查对象：`518cc9bd85b9aec53d8abbeffe303d1c0d03ddd9`，HTML SHA-256 `86046567b030d3722830a2ca6d0ea3b14318352b269aabcb1dfba83ce92e3c0a`。

Actions `38354321071` 的最终附件 `skin-r02-final-2`，artifact ID `11792901487`，ZIP SHA-256 `143a862a705bfbee903fe1eb3f1b2de847811f54bb91b020d4560e10d633426e`。附件已下载、解包，预览及源文件摘要均与 BUILD.json 匹配；本记录依据实际浏览器截图，不是生成参考图。Actions 附件按 workflow 保留14天，本仓库 JSON 收据与本记录另行保留。

## 对照条件

R01 对照为 `8eb41852b4751b02003867b9aff2c4dd7a6e338c`。两边均通过固定公网地址加载，不用本地假页面替代。1500×1120 桌面视口，脸部镜头 zoom 1.35，中性光，相同 strength 1.1 / slack .92 / compression .72 / nasolabial 1 / cheeks .85 / sag .85，先灰模、后皮肤、再 makeup 1。详细参数、相机与实际坐标摘要见 EXTRA_QA.json。

## 人工观察

R01 灰模中，从鼻翼向嘴角延伸的褶线过窄、过硬，嘴角外侧及下颊也呈双脊刻痕。最终 R02 的这几处改成更宽、端部更柔和的起伏；眼口保护区域没有观察到新增断层。它仍然有形体变化，并非只换灯光或涂暗线。实际顶点变化与保护区零位移由数值检查另行证实，截图本身不取代该检查。

第一轮 R02 `fc81146b50eded2cf104c5fc1c499d0e7509f113` 虽然全部技术测试通过，但灰模仍留有下颊窄双脊，因此没有作为本轮最终推荐版本。最后形态修改 `d1dcc565dc817058c21101a59fd9a7faae31b719` 单独拓宽下颊软褶，并修正外眼角支持区提前结束；新的完整公开测试重新通过。

皮肤/强妆感图中，亮斑更克制，粗糙度分区和部分微结构保留；但不能写成蜡感已经根治。面颊仍比较平，皮肤透光不足，额纹和眼下折线仍偏规则。当前熟龄参数不是完整衰老解剖模型；下一轮需要改善皮下层次和折叠方向差异，而不是再次叠加刻线。

第二个原生人物预设可加载，雀斑、原眼睛/嘴唇和新面部几何正常显示；这不是36个预设全部视觉验收。390×844截图未见横向溢出，但纵向首屏较拥挤、需要滚动；未做手机实机、触控或 Safari 认证。

## 实际检查的截图摘要

`r02-evidence/extra/baseline-gray-mature.png`：`85223a744433aff6366cc0b703b51aefce28149c0f7bfb101bfcc75a88a1d47a`

`r02-evidence/extra/r02-gray-mature.png`：`0f7edddd793a905ce29a84552feca5494ff0d79f57e651f96b9e2853a2b95626`

`r02-evidence/extra/r02-skin-mature.png`：`af1629724db779b443606884dac103ff2126c51d93e65c5ded46598c6d26487d`

`r02-evidence/extra/r02-makeup.png`：`b3fa9dd29d7fa69dcb6ef5d134cf6426151eeb39234218caa5d51ae5721f1167`

`r02-evidence/extra/r02-second-native-person.png`：`671312e2356521b53e4e2aa0daa23ba9bdf873d74f93e5493e796cb351ae0443`

`r02-evidence/public/09-mobile-viewport.png`：`a479bac17241f9b00a9ce4fddbf982b1aed0be01e289efe3b908caaa5bdea1da`

## 状态

本记录完成了 CI 收据生成之后的人工截图复查；DELIVERY.json 中 `visualReviewPending:true` 保留为生成当时的原始记录，由本文件补充，不改写测试事实。用户尚未视觉验收，productionReady 仍为 false。当前推荐的是可操作的 R02 迭代候选，不是影视终版。此次文档提交不改变已测试的运行时和固定公开网页。
