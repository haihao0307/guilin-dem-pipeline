# R22：恢复完整原天气系统入口

问题：R21 的“原天气系统”接入了单独的云天气工作台，漏接原 studio-v073 的完整模块菜单。Liquid Rain / Fog / Snow 等原文件没有删除，但用户无法从该入口进入。

修复：恢复 World、Rain · Liquid、Fog、Snow、Cloud、Storm 六个入口。Rain 接回原 liquid-rain-v130 村院，保留降雨、云源、地面水、湿玻璃、屋瓦砖墙、镜头六组控制。Fog、Snow、Cloud、Storm 恢复原来的天气案例路由。World 仍保留 R21 使用的20个天气案例及云体细节增强。

从原版本清单校验并解开 studio-v073 和 liquid-rain-v130；来源哈希见 BASELINES.json。R22 将完整源码内嵌，避免 srcdoc 中相对路径与查询参数丢失，并将天气界面放在外层导航条下方。新增桥接使隐藏的天气/降雨暂停渲染、模拟与音频，返回时保留当前参数。Rain 的原渲染、模型、液体规则未重做；这里不升级其物理精度或生产就绪声明。

R21 的飞机、银边/云海观云和原自由飞行模块源码逐项保持完全一致，旧版公网文件不覆盖。

本地/公网 qa.cjs 使用真实用户的 Rain 渲染分支（原版对 navigator.webdriver 有简化分支；本次显式关闭该分支后验证）。检查六个模块、六组 Rain 控制、前后隐藏恢复及 430×932 / 932×430 视口。移动视口并不等于实体手机性能验证。实际结果见 LOCAL_QA.json、PUBLIC_QA.json 和 PUBLICATION_PROOF.json。

