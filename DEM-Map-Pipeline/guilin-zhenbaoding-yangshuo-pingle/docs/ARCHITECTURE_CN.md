# 架构说明

本项目分为五层。

第一层是任务配置。`config/task_config.json` 固定任务范围、投影、像元间距、数据源、下载规则、拼接规则和质量门槛。

第二层是源数据。`data/existing_five` 保存旧五片，`data/raw` 保存重新下载的源片和公开预览源。

第三层是生产脚本。边界解析、覆盖选择、下载、栅格拼接、COG 生成、质量检查和网页生成均位于 `scripts`。

第四层是成果。`outputs` 保存完整 DEM、覆盖计数和填补分类。`metadata` 保存来源链和选片计划。`reports` 保存质检和预览。

第五层是展示与自动化。`web` 保存三维网页，仓库根目录 `.github/workflows` 负责云端构建、构建产物和 GitHub Pages。
