# R04.1 原共同人物 / 原裁缝：本轮来源修正交付

## 实际打开

本次核验版本：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r041-8e98936acb85/?preset=T01

本线入口：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r04/?preset=T01

两个入口都已经实际在HTTPS浏览器中打开验证。默认T01是本轮原静态门槛通过的款式；J06未完成原求解，不再用外观衣壳替代。

## 用户指出的错误与纠正

R03并非用户原来的共同人物与裁缝输出：它另造了13,718顶点的Anny展示人台，并由人体偏移衣壳、独立裙面等生成外观。这条路线已被用户拒绝。R03历史源码和旧网页保留用于对照，不代表当前认可结果。

R04直接调用原共同人物CommonPerson、CommonViewer、原生状态和72个新旧人物预设。模型保持原25,417顶点、50,624三角面；几何、三角序列、参数状态和适配器指纹与原系统实际输出一致。没有替换头部、另造姿态、缩放身体或隐藏身体以伪装合身。

服装从原60份纸样读入，验证纸样字节与recipeHash，进入原compileAnalytic材料网格、原XPBD/WASM求解及原质量门槛。记录和显示均保存材料顶点、三角顺序及原求解坐标；显示误差为0，只作明示的米/毫米和坐标轴转换。R03的贴体衣壳、独立裙面和细分造型均不进入本页。

## 全部60款的真实状态

本轮实际逐款尝试60份原纸样，没有只统计卡片数量。57款生成原生材料网格；37款产生完整求解记录，其中7款通过原静态检查、30款未通过。另20款求解中止，3款在材料或缝边限制处被拒绝。完整60款成衣与全部搭配目标仍未完成。

7款通过的是T01圆领无袖、T02省道合体无袖、T03 V领、T04方领、T16贝塞尔领、T17梯形领、T18折角袖窿。静态工程检查通过不等于材料标定、动态穿着或完整物理认证。

相比此前49款可重网格，本轮解除8款顶点预算阻塞。仅在确认内部采样点数量超过原上限时重试采样；原轮廓、缝边、曲线误差、原校验预算与质量门槛不改变。49款原可网格化材料的哈希与原实现一致；新旧所有成功材料均通过面积及原预算检查。S11、D08仍触发原松量/抽褶门槛，S12仍触发材料坐标检查，失败均保留。

37张缩略图都是原CommonViewer对真实求解记录的渲染；7款通过结果排在前面，其余清楚标明失败，未完成款不伪造成衣。默认统一布色便于观察，可切回原裁片分色；这一显示调整没有改变任何原求解记录字节或坐标。

## 不是仅有缓存回放

追加了真实公网操作检查：点击读取原纸样，实际重新网格化，再点击原求解器缝合；暂停、继续和取消均实测。T01本次重新求解约27.321秒（包含测试暂停与等待，不代表所有设备的性能承诺），通过原静态门槛，新结果与此前相同输入的原生结果坐标差为0毫米。裁片分色和线框只改显示，原材料及求解数据不变。

## 已取得并读取的证据

全60款原生试验：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38017330226

图库与原人物验证：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38018718698

公网发布、342个路径的SHA256核对与46项浏览器检查：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38019008383

实际公网新求解及11项控制检查：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38019644379

Pages部署：
https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38019097884

PUBLIC_CONTINUATION_REPORT.json、PUBLIC_NATIVE_BYTES.json、PUBLIC_LIVE_CONTROLS_REPORT.json均通过；未出现页面异常、失败HTTP或R03代理模型请求。桌面1440×1080和移动390×844均为Chromium视口，不是手机实机。已经取回并读取报告、核对ZIP哈希、查看实际公网桌面和新求解截图。报告及截图持久保存在Git，不只依赖临时artifact。

公网证据ZIP SHA256：475b06bf0d1a4950db0804fbd371c712e50c55dc1c5f8badd6cf8a66d13b4f92。
新求解证据ZIP SHA256：006283064b44f9346d7fde4a5fe9694a5aec074c94bdb47643acf1e1f35169fa。

原生结果源：d9ca9315939cf86cbae78733acbc515a0a3c6744。
运行发布源：8e98936acb859cc00c727b2be56986fc7ed7a430。
Pages发布：b47f491992ff428a7d24218020cca4dd192740c8。
Pages激活：2c9c6403815083b731d40051cc1d711cfdd7c34f。
公网来源检查证据：04fc05b61cfc76a935c09b567e65f636af3df546。
公网新求解证据：27a0b2d942e83ac5c0e0ef65c0307d02aa3e8f7f。

## 未完成与现实限制

当前仍使用原纸样尺码，不是已为每个共同人物重新量体和制版。只有原默认状态具备本轮匹配的全身碰撞输入；更换人物后旧服装立即清除，没有新量体及碰撞数据时不允许复用默认衣服。首次载入会读取原共同人物模型资产，不是独立轻量替代人台。

长袖、领帽、多层抽褶、裤装和连体款仍有自交、整段开缝、异常变形及求解中止等问题。布料自碰撞、连续碰撞、动态穿着、面料实测和真实缝份没有因此得到认证。不能把本次来源修正与公网可用性等同于完整服装质量达标。

physicalFitAccepted=false；dynamicWearCertified=false；all60GarmentsAccepted=false；userAccepted=false。

原共同人物、R01/R02/R03、原R07和catalogue六个受保护目录在发布前后Git tree哈希完全一致。Draft PR #181未合并，没有强推或改写历史。
