# 推送到 GitHub

在全量包根目录双击 `06_PUSH_TO_GITHUB_NO_FLASH.cmd`。

脚本默认使用账号和仓库 `haihao0307/GeoJson2UE`，目标分支为 `dem-zhenbaoding-yangshuo-pingle`。它只同步以下路径：

`DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle`

`.github/workflows/guilin-dem-extended.yml`

脚本不会覆盖仓库中的其他项目目录。首次运行会检查 Git 和 GitHub CLI，并打开浏览器完成 GitHub 登录。提交前会显示待提交文件，随后要求确认。

大体积旧 DEM、下载缓存和最终 COG 保持在本机及 GitHub Actions 构建产物中，不会直接加入普通 Git 提交。网页轻量数据与网页文件可由工作流提交并发布。
