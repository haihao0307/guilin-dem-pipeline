# 学习材料入口

自己的造波文档在造波/；这些是知识库2026-10-06快照，内部指向G:/小妈的路径在接手机器需自行定位，不能据此称所有专题已应用或通过验收。

原学习案例官方页面（2026-10-06已重新检查）：
https://www.3dscanstore.com/blog/Free-3D-Head-Model

官方下载（约2.02GB，以SHA清单为准）：
https://samplescan.s3.us-west-2.amazonaws.com/3D_ScanStore_Free+Head.zip

来源条款： https://www.3dscanstore.com/terms-and-conditions-licensing

新机器：创建Git外的私人目录，例如D:/HairWorkbenchPrivate，然后在PowerShell执行：

    powershell -NoProfile -File .\TEN24-original-download\Download-Original-Windows.ps1 -PrivateAssetsParent D:\HairWorkbenchPrivate

脚本需要已有私人目录，自动创建新子目录，不覆盖原件；约7.4GB空闲空间（原ZIP+展开文件+余量）。成功后按verify_original.py的--help用原ZIP与展开目录独立校验。保留原Blender Scene.blend，只在新的工作副本中做观察/实验。Blender打开时关闭Python自动运行。本轮确认5.2.0LTS可打开，但未验证原3.2.2渲染等价。

程序材料采样阅读来源：
https://www.pbr-book.org/4ed/Textures_and_Materials/Texture_Sampling_and_Antialiasing
GNM来源： https://github.com/xrblocks/assets-gnm/tree/134feb02b11fa642a43ff5e7e880246255a74e86

本包既提供学习记录，也提供原件重新获取方式；不把原件搬到GNM程序或公开包里。
