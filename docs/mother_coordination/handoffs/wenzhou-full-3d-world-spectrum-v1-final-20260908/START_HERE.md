# 小温州全温州三维世界谱 V1 最终续接入口

日期：2026年9月8日

本入口供 Astra 直接接管。主线覆盖完整温州锁定范围，不再制作面向用户的小窗口视觉版本。小窗口只保留为自动回归测试。

## 固定地图身份

```text
CRS: EPSG:32651
Bounds: [190475, 2991275, 411250, 3241862.5]
Resolution: 12.5 m
Rows: 20047
Columns: 17662
Canonical cold store SHA256: 8800c053608c5fa74eeebd2ce0d06c1bed54fd65274ed059d6e84fc2ec82a1dc
```

## 核心架构

```text
一份权威全维总谱
多份任务指挥索引
独立环境声部
全域三维按需展开
完整真值可逆恢复
```

## Astra 启动顺序

1. 读取 `CURRENT_STATE.json`。
2. 读取 `MASTER_PLAN.md`。
3. 读取 `ASTRA_EXECUTION_BRIEF.md`。
4. 读取 `DATA_PAYLOAD_LEDGER.json`。
5. 接收并解开外部全量包 `WENZHOU_FULL_3D_WORLD_SPECTRUM_V1_0_FULL_HANDOFF_2026-09-08.zip`。
6. 先运行包内 `08_TOOLS/verify_package.py`。
7. 打开包内 `04_FULL_3D_FOUNDATION/index.html`，确认现有全域三维底板。
8. 直接建设完整温州谱页、共享边、多尺度瓦片、相机调度与环境声部。

## 不得违反

1. 不得使用旧 Qingjiang 或额外 30 米陆地数据回退。
2. 不得把 SoilGrids 250 米、100 米水文、10 米分类数据写成 12.5 米实测真值。
3. 海床、潮位、波浪、洋流保持独立身份。
4. 程序化细节不得移动真实峰顶、鞍部、山脊、河谷、河岸和海岸。
5. 面向用户的下一版必须覆盖完整锁定范围，主画面必须为可旋转、可缩放、可贴地观察的三维世界。
6. 最终交付必须使用固定版本公网 HTTPS 地址，并完成桌面与 390 × 844 手机浏览器复验。

## 每次提交必须留下

代码、合同、来源账本、生成命令、输入哈希、输出哈希、机器 QA、视觉 QA、当前状态和下一步。
