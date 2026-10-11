# ET17-L1 — 恢复交付与续接检查点

日期：2026-10-11。
状态：运行代码、固定构建、本地及真实公网浏览器回归均已完成；视觉效果交用户验收。

## 固定入口

新版：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/7f90e53c1d114f65b08710d67d792d489719ee67/kaopu-unified-human-workbench/lip-structure/preview.html

用户原版（保留）：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/7bc25d5e31808d0a5724f602d4a4ade42a14c385/kaopu-unified-human-workbench/eye-materials/preview.html

源实现：`103ecc900644545b796a9f400a7e6b98bdad9e27`。
固定构建：`7f90e53c1d114f65b08710d67d792d489719ee67`。
分支：`fix/identity-lips-et17-20261011`。
Draft PR：https://github.com/haihao0307/guilin-dem-pipeline/pull/214 。未合并。

## 本次中断恢复查明的事实

1. 中断前提交的构建任务已经成功，不应因为聊天没有返回交付消息就判断源码或网页丢失。
2. Actions `38117861263` 成功结束；其源码、BUILD.json、固定网址、两组浏览器报告及真实截图已经下载并审阅。
3. 本次恢复未重做嘴唇运行时，也未以新版本号冒充再次开发；只是恢复已有 ET17-L1 并补全可续接交付记录。
4. 聊天中断的具体根因没有诊断日志，保持 Unknown，不归因于用户网络、电脑或 GitHub 故障。
5. 此记录降低中断后丢失工作位置的风险，不代表能够保证聊天服务永不中断。

## 已实现的本轮范围

同一原生人物网格的派生显示面：上唇体积与转折、下唇双瓣体积、唇峰、中央唇珠、嘴角收口。
唇红与皮肤边缘柔和度、非重复唇纹、显色、内侧湿润与外侧粗糙度分别控制。
共 12 个新控制，包括整体结构幅度及眼周表面微整。
眼周只做受限皮肤表面细分；自然眼球、虹膜与眼白参数保留，不是完整眼睑重建。
正面、45 度、侧面、唇纹特写、整脸；同人同相机同灯光的新旧切换；灰模结构检查；撤回及完整人物档案保存/恢复。

## 已审阅的实际浏览器证据

运行：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38117861263
产物：`identity-lips-et17-delivery`，artifact ID `11694283907`。
产物保存期限截至 2026-10-25；此文字检查点及固定源码/网页不依赖临时下载地址。
本地与公网各 9 组检查通过。两份报告中 browser errors、shader errors、failed requests 均为空。

检查内容：同相机灯光的新旧像素对比；原生顶点/索引引用与身体保留；灰模结构变化；10 个局部结构/材质控制的真实像素变化；完整人物档案往返和无效档案回滚；36 个原人物预设的有限数值及拓扑回归；张嘴、小幅微笑、眨眼原有路径；自然眼球左右独立；真实滑块事件与保存按钮下载。

原生 25,417 顶点、50,624 三角形不变。默认派生显示面 150,459 顶点、300,424 三角形。
检查到身体与眼球顶点偏差为 0；默认唇部最大形变约 0.827 mm；无第二个头或嘴部覆盖网格。
公网正面新旧对比变化 22,731 像素；灰模对比变化 16,513 像素。这些数字证明画面发生变化，不证明审美合格。
测试环境：1600×1000，GitHub Actions Chromium / SwiftShader。不是消费级 GPU 性能基准。未做手机实机或手机视口验证。

## 哈希校验

preview.html：4,764,520 bytes；SHA256 `84c7a27d1e8765d41c640a0bc66075bcddd82e81af1590d4d296ca49659dbafa`。
public/browser-report.json：SHA256 `6a8b370ea82b9abaad598e10b631931f208401466db32d0cf6f6664274c927f4`。
local/browser-report.json：SHA256 `95bb664c444956ed4be0faae642b7cc3971f51533c5653844ca0319880d17c2a`。
相对用户锚点的 GitHub compare 确認：仅新增 lip-structure 与其三个专用 workflow，共 16 文件；原有 eye-materials、identity-lab、人物/眼/面部运行时零修改。

## 视觉复核与边界

已审阅真实公网正面原版/新版、45 度材质及灰模图。新版的唇峰和唇红区域更明确，但默认唇红边界仍偏规整，极近景仍有程序化感；不得描述为达到 Ten24 扫描或影视终版。
形体、材质、参考学习分别记录，不把像素差异或测试通过等同于解剖认证。
当前没有新增嘴唇与牙齿/舌头的软组织碰撞、完整口腔物理或肌肉系统。大幅表情需要另行验收。
细分增加显示面开销；原生拓扑不变不代表渲染开销不变。
参考来源与许可证边界见 RESEARCH.md；未购买、复制或重新授权第三方商业扫描资产。

## 下一窗口从哪里继续

先读本文件、BUILD.json、RESEARCH.md 和实际 GitHub 分支头；核对固定构建与源码提交，不重新寻找项目。
用户要求继续精修时，在已交付 ET17-L1 上修改对应 LipSurface/LipMaterial/LipUI，保留原固定 URL；先灰模轮廓，再唇红边界及微纹，再表情。
每次独立阶段记录源提交、构建提交、测试运行与真实通过/失败状态。失败时只重试失败步骤，不覆盖已通过的固定构建。
PR 保持 Draft。其眼球基分支已经独立前进，当前不可自动合并；不要为了消除合并冲突擅自重基、强推或改写其他眼球工作。主线集成另行处理。
