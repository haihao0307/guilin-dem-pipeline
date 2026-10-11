# ET20-CINE-R01 影视布光与皮肤候选

固定网页：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/d12fef31670258f769e37a4145476d0d500189c6/kaopu-unified-human-workbench/cinematic-r01/preview.html

源码 `5d6e61d21b39ecd18ffb8786ab996d7a677dc4e1`；固定构建 `d12fef31670258f769e37a4145476d0d500189c6`。

Actions：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38133912491

原待机版及人物、眼球、嘴唇、身体源码保留，只新增 cinematic-r01 与专用 workflow。4组灯光、独立灯光/肤质对照、分灯、真实材质输出检查和完整人物保存。具体浏览器测量见 evidence/source-qa.json 和 evidence/public-qa.json。截图在运行 artifact；尚需人工检查，自动测试不构成视觉验收。

参考与代码映射见 RESEARCH.md。不是 Karma、RenderMan、路径追踪或完整 ACES/OCIO；主光采用单中心深度投影、receiver-plane校正与PCF近似，非面积光可见度积分。皮肤为双高光瓣、程序化微表面与继承的屏幕空间RGB扩散，不是扫描位移或体积组织仿真。

原待机缓存和在线原生资产的成本继承；新增阴影目标和查找表增加GPU开销。桌面1560×1150、手机390×844视口，非手机实机/消费显卡性能认证。原走跑和多人模式未做此次影视照明升级。

保留Draft，不合并、不强推，用户视觉验收待定。
