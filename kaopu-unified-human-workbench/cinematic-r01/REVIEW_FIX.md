# ET20 首次浏览器审片与修正

首轮 source run 38133116272 未发布：布光、分量、7项肤质参数、几何不变量与档案恢复通过；固定等待800ms的待机播放断言失败。记录中无JS/GLSL错误，待机ready/enabled均为true。下一轮改为等待真实时钟推进并完成至少3帧，保留60秒超时；不是删除待机验证，也不将等待时间称为性能认证。

人工查看光照/肤质四组合和独立阴影画面后，额颊的规则波纹可在shadow-only中复现，确认不是皮肤毛孔。PCF原实现用中心深度比较全部偏移采样，现为每个实际texel中心计算receiver-plane深度，保留投影阴影并限制极端坡度；新增光照额部的GPU阴影局部变化检查。方法参考Microsoft官方深度偏移与PCF说明：https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps 。不以压黑背景、关闭阴影或磨平原皮肤掩盖伪影。

这份修正说明不等于测试通过；下一次完整source/public浏览器报告与人工审片决定交付状态。
