# Farmland R025 ↔ 小妈 TLO / DEM 桥梁入口

桥梁 ID：`FARMLAND_XIAOMA_TLO_DEM_BRIDGE_R025_20260911`

状态：语义与来源边界已验证；数值地形、地区田块、田间测绘、几何和视觉候选
均未接入。

## 接收方

本桥梁同时交给：

1. 小妈 / TLO：接收 Farmland 对候选 TLO 通信语义的采用状态与未冻结项；
2. DEM / Landscape：接收 Farmland 对桂林 canonical DEM 的可用范围与禁止越界；
3. 下一位 Farmland 执行者：恢复 R021–R025 的证据、合同、验证器和停止线。

## 唯一读取顺序

1. `BRIDGE_CONTRACT.json`
2. `PACKAGE_SCOPE.json`
3. `NEXT_REQUESTS.md`
4. `source/repository/AGENTS.md`
5. `source/repository/farmland-object-dna/RESTART_START_HERE.md`
6. `source/repository/farmland-object-dna/FARMLAND_PRODUCTION_RULES.md`
7. `source/repository/farmland-object-dna/V001_FAILURE_REGISTER.md`
8. `source/repository/farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/README.md`
9. `source/repository/farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/XIAOMA_TLO_DEM_INTAKE.json`
10. `source/repository/farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/FARMLAND_TLO_CHECKPOINT.json`
11. `VALIDATION_REPORT.json`
12. `PACKAGE_MANIFEST.json` 与 `SHA256SUMS.txt`

## 已经成立的桥梁

- `T=Time`、`L=Location`、`O=Object identity + Object DNA/state/evidence refs`；
- 世界坐标顺序为 `(t,x,y,z)`，Object 不是 mesh 或第五几何维度；
- TLO 仍是讨论候选，不冻结扩展名、容器、索引、压缩、流协议、全局位置、
  事件编码或关系本体；
- 桂林 canonical DEM 固定为 EPSG:32649、12.5 m、17408×18867、54 瓦片布局；
- 14 个上游文件均锁定 Git blob SHA-1 与内容 SHA-256；
- 当前没有数值瓦片、terrain sample 或查询适配器；
- 桂林 DEM 不覆盖红河，不得填充红河地形、构件尺寸或水稻参数；
- Landscape R6 是 synthetic 且未获 truth/visual/production 批准，不能成为真值。

## 强制停止线

本桥梁允许知识交换与恢复，不授予几何生产或公开发布资格。选定同一区域田块、
接通 canonical 数值地形并取得田间级测绘以前，不得生成地区结构样板。

`visualAcceptance=false`

`productionReady=false`
