# R04.2 本轮实际交付：后片识别与空卡片状态修正

固定工作台，默认T08高领长袖：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r042-e292aa796e43/?preset=T08

当前工作台：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r04/?preset=T08

旧R04.1同款对照，保留不改：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r041-8e98936acb85/?preset=T08

## 用户截图对应的具体修正

不是所有空卡片都是网络没加载。旧版23款没有完整求解结果，其中20款求解中止、3款材料/缝边受限。

本轮确认前后片分类代码漏掉以`_b`结尾的后袖和后袖口。47个后片角色被误判，18款受影响。独立回归重现45组前后片位于同一平面的错误；衣身在后续缝袖窿时被拉向肩颈。现在补齐后缀判断，前后片按原组装程序分到正确两侧。

全部60份原纸样进行227项新旧对照，确认原纸样字节、材料UV、三角顺序和缝针配对不变。共同人物、数值求解数学、原静态门槛不变。重新求解后的三维位置确实改变，没有在显示层另造衣壳、缩小人物或强行抹平结果。

## 当前结果，不掩盖剩余失败

完整原生求解记录：37 → 45。静态通过：7 → 9，新增T08和T15；原7款通过结果保持。另有36份完整记录仍未通过。无完整结果：23 → 15，其中12款求解中止、3款材料/缝边受限。

新增完整结果：D02、D12、J03、P07、P10、T07、T10、T11、T13。T06在本次修正后的重算中因严重变形中止，不能继续把它以前的失败图当作新结果，所以净增加8份记录。J06仍触发计算预算中止。

新增静态通过/有结果需修复/无完整结果筛选。无完整结果的卡片明确列出中止原因；真正的图片资源读取错误单独提示，不再混同为“等加载”。所有60个原设计保留。

## 实际公网验证

原纸样和后片回归、18款重算、真实浏览器图库：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38022155568

实际公网发布、所有运行文件字节核对、原结果回放、筛选和新的T08求解：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38023440805

GitHub Pages实际部署：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38023518218

R042_RELEASE_STATE.json.publicVerified=true。400个公网路径SHA256匹配；三组公网检查分别54、22、11项通过。固定入口和当前入口均打开相同原共同人物，25,417顶点、50,624三角面；模型几何、状态、三角序列和适配器身份保持。

公网实际点击读取原纸样、重网格、缝合、暂停、继续、取消；T08新求解通过原静态门槛，与本次缓存的同输入结果最大位置差为0毫米。测试从启动缝合到恢复后结束约70.98秒，包含暂停操作，不代表用户设备固定耗时。裁片分色、线框只改显示，不改原结果。页面和HTTP错误均为0。

取回公网证据ZIP并核对SHA256：25e5cb2981e97d0df63f05be774c82fc1624ffe953fccd79fa1672c40d154a2e；artifact 11659891241。已读取报告并检查新求解T08正面、背面实图。证据持久提交ea37fafb327405968c69440e88a605d3dafdb82d，不仅存在临时artifact。

桌面1440×1080与移动390×844均为Chromium浏览器测试；移动为视口模拟，不是手机实机。原共同人物、R01/R02/R03、R04.1固定快照、原R07及catalogue七个目录发布前后Git tree一致。

## 明确未完成

实际画面里，T08/T09/T12/T15的衣身已经回到躯干，不再整体挤在肩颈，但T08领口和袖部皱褶仍不够自然。T09和T12仍未通过原检查。T14腰部堆叠、P01等非本次后片分类错误导致的问题没有解决。

本轮没有完成真实面料弯曲/拉伸参数标定、运行期布料自碰撞、动态穿着或任意人物量体适配。绿色“静态检查通过”只代表当前数值门槛通过，不代表最终成衣外观认可。不能靠刷新、换贴图、放宽门槛或显示层抹平来冒充解决。

physicalFitAccepted=false；dynamicWearCertified=false；all60GarmentsAccepted=false；finalVisualQualityAccepted=false；userAccepted=false。完整60款成衣与全部搭配仍未完成。

## 固定提交

原基线：1a5f98ff4e345f466b4050f9a6e723f21c04ef18。

重算源：bbe7256cacc5d0698de2b8fbc70ff4a483ab245f。

已审运行资产：033875d737ddbaca7dc10e1f90c7daaca4a5fbfc。

发布源：e292aa796e434aad4acce85b146ea62ba3692263。

Pages发布：91303c1dcd949519947b5bd42649e21d63eafdc1。

Pages激活：900d68a6206b9f8d220dff5a6c34fb0aa683deb5。

最终公网证据：ea37fafb327405968c69440e88a605d3dafdb82d。

Draft PR #181，未合并、未强推；历史失败与旧版保留。R03独立人台/衣壳路线仍被拒绝，本轮没有重新接入。
