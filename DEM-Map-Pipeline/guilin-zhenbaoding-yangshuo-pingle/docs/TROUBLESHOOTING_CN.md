# 常见问题

## 双击后窗口消失

只使用带 `NO_FLASH` 的 CMD 入口。入口会启动保持打开的命令窗口。日志位于包根目录 `logs`。

## 没有 Python

启动器会尝试使用 winget 安装 Python 3.12。企业策略禁止安装时，可以先手动安装 Python 3.10 以上版本。

## 12.5 米模式提示 Token 缺失

双击 `06_SET_EARTHDATA_TOKEN_NO_FLASH.cmd`。Token 不要写入配置文件，也不要提交 GitHub。

## GitHub 登录失败

关闭浏览器中的其他 GitHub 账号会话，重新运行推送入口，并确认登录账号为 `haihao0307`。

## GitHub Pages 首次发布失败

打开仓库 Settings 中的 Pages，把 Source 设为 GitHub Actions，然后重新运行工作流。推送脚本会尝试打开对应设置页面。

## 拼接覆盖率不足

检查 `reports/QA_REPORT.json`、`metadata/selected_new_products.json` 和 `outputs/*fill_class*`。质量门槛默认要求有效覆盖率达到 99.5%。
