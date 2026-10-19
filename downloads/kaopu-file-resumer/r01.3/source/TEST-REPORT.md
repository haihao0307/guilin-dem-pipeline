# r01.3 验证记录

2026-10-19，Linux Python标准库环境。命令：python -m unittest -v test_core test_release test_dpi test_ui test_brand。

44项测试：17项本地HTTP故障/字节一致性集成测试；8项发布脚本/核心哈希静态检查；4项mock DPI API路径；9项纯布局决策；6项品牌资产/透明格式/ICO尺寸/UI调用绑定检查。

PNG1254×1254 RGBA，alpha范围0–255，837,070像素完全透明。原PNG SHA256与用户批准锚点一致；Windows ICO七尺寸均可解码且保留透明像素，UI用32像素PNG。窗口标题与header调用绑定已mock检查，快捷方式显式覆盖新IconLocation的代码已静态检查。

core.py与r01.2逐字节相同。旧版本未改，包内不含运行data、用户下载地址或截图。

## 未实测

当前环境无法建立图形显示socket。Windows真实窗口、DPI清晰度、紧凑布局、VBScript运行与快捷方式缓存刷新未实测。WindowsDPAPI集成和用户真实香港大文件迁入仍需实机确认。静态/mock检查不是GUI实测。

品牌为用户2026-10-19视觉确认的截图恢复重制版，不是九月原文件。
