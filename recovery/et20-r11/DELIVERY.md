# ET20-CINE-R01.1 布光 / 皮肤恢复交付

固定公网：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/ccf5a1ed9ddde8803e292f1e62d777b141ff52d8/kaopu-unified-human-workbench/cinematic-r01/preview.html

源码：`cdb27baae71bb51af1f176ac67ef9c2ecf0c44eb`；构建：`ccf5a1ed9ddde8803e292f1e62d777b141ff52d8`。

Actions：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38187713183

17组完整固定公网回归通过，JS、GLSL与失败请求均为0。原11组纯源码测试和7200调度采样通过。具体范围见 recovery/et20-r11/PUBLIC_QA.json；不把软件GPU测试说成消费显卡帧率或手机实机认证。

本轮恢复已实现的ET20，并实际增加曲面阴影查询修正；原人物、材质贴图与待机、旧ET19/ET20网页保留。选择1.5mm上限的法线方向查询偏移，未移动网格；细小接触阴影可能弱化，未实现完整面积阴影/体积散射，不能称影视级完成。

最终截图在同一run artifact，人工视觉尚待检查，用户视觉验收尚未通过。

保持Draft，不合并、不强推。
