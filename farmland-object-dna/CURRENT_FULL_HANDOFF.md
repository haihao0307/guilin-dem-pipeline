# Farmland Object DNA 当前全量交接入口

当前包：`Farmland_Object_DNA_Current_Full_Handoff_R025_2026-09-11.zip`

仓库：`haihao0307/guilin-dem-pipeline`

分支：`restart/farmland-object-dna-v020-20260907`

PR：`#65`

仓库内路径：
`farmland-object-dna/distributions/Farmland_Object_DNA_Current_Full_Handoff_R025_2026-09-11.zip`

这是当前 Farmland R021–R025 的全量工作交接包。其他执行者不应再把
`Farmland_Object_DNA_Full_Clean_Restart_2026-09-07_V0.2.0.zip` 当成当前包；
旧包是历史重启快照，不包含 R021–R025。

## 固定身份

- 源提交：`9fb3c6837bc8358a57450d48758760fa96a51ca8`
- 源树：`5702677fa967895d658b7f4e352c065388344f2b`
- 字节数：`222262`
- SHA256：`815a599044ea3717d1c5cc4e399c1ca211485db9b9aa9551b017f454227e8010`
- 载荷文件：`79`
- 测试：`118/118 PASS`

这个易发现文件名与 R025 桥梁目录里的 canonical ZIP 逐字节相同。包内入口仍为
`00_START_HERE.md`，然后读取 `BRIDGE_CONTRACT.json`、`PACKAGE_SCOPE.json` 和
`NEXT_REQUESTS.md`。

## 范围边界

“全量”指完整的当前 Farmland 工作状态、合同、研究记录、验证器、测试和必需的
仓库级规则。它不包含数值 DEM、上游 Mother 仓库资产、受保护门户内容、历史
ZIP 或被否决的 V0.1 视觉工作台。

`numericTerrainConnected=false`

`visualAcceptance=false`

`productionReady=false`
