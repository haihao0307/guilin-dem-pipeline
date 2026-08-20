# 本地运行说明

## 工作目录

默认工作目录：

`C:\HaihaoDEM\Guilin_Extended_DEM_Full_v2_0`

可以设置环境变量 `GUILIN_DEM_WORK_ROOT` 修改位置。源码会复制到工作目录，已有下载会继续复用。

## 自动模式

双击 `00_BUILD_AUTO_NO_FLASH.cmd`。程序检查 Python 3.10 以上版本，创建独立虚拟环境，安装地理依赖，解析任务边界，检查旧五片，检索新增覆盖，完成拼接、COG 输出、质检和网页生成。

保存过 Earthdata Token 时，程序使用 ASF RTC 数据。未保存 Token 时，程序生成约 30 米公开完整范围预览。

## 12.5 米模式

先双击 `06_SET_EARTHDATA_TOKEN_NO_FLASH.cmd` 保存 Token，再双击 `01_BUILD_ASF_12_5M_NO_FLASH.cmd`。Token 使用 Windows DPAPI 加密，保存位置为 `%APPDATA%\HaihaoDEM\earthdata-token.dpapi`。

## 断点继续

下载文件、虚拟环境和运行记录都保存在工作目录。网络中断后再次运行相同入口即可继续。

## 日志

本地包日志位于根目录 `logs`。工作日志也会写入工作目录的 `logs`。
