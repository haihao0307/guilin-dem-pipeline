# 小温州 R3.8 · 接续实现

此分支从当前全量交接源 bb01ee52b21cfbd3406ace8e9e8f81c7ad4ad92b 接续。
历史 R3–R3.7 页面、数据和代码保持不变。

本轮是既有测量/模型/观察证据的浏览器整合，不生成新的地形、道路、建筑或其它 Object Truth，不恢复撤销的图像转三维或旧资产生产流程。执行仓库内 Mother 对象定义和固定版本公网交付规则；历史附件授权不覆盖当前用户约束。

本轮工作在 site/dist/r3-8、tools/r3-8、records/R3_8 内。世界只有一个身份，土壤深度和 WRB 属于同一 SoilProfile 证据；JRC 独立保留观测时间和来源，不能替代海陆拓扑或当前水位。

验收：python tools/r3-8/validate_static.py；本地和固定提交公网运行 tools/r3-8/inherited_regression.mjs 与 browser_qa.mjs。真实 iPhone 未验证，不宣称 productionReady。不得以本地地址替代公网交付。
