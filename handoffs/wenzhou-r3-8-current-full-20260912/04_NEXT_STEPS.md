# 下一步继续顺序

## 1. R3.8 WRB 显示整合

当前 `site/dist/r3-8/data/wrb/` 已经由成功工作流生成并校验。继续时先做 R3.8 UI/运行时，不重新下载或重算 WRB。

必须同时保留：
- 官方 MostProbable 分类；
- 30 个 WRB 发生概率声部；
- 对齐概率后的 argmax 仅作为派生审计层；
- 官方分类 vs 派生分类差异层。

不要把二者约 6.1% 差异解释成“官方错了”或“归档被 bilinear 损坏”。独立 nearest 重投影已经证明官方分类归档与 categorical nearest 路径逐像元一致。

## 2. 六层土壤剖面

R3.7 当前浏览器只接 0–5 cm。下一步从永久 SoilGrids Release 派生其余 5 个深度：
- 5–15 cm
- 15–30 cm
- 30–60 cm
- 60–100 cm
- 100–200 cm

不要做成六个独立谱。语义上归为同一地点 `SoilProfile` 的 depth axis，属性/uncertainty 随 depth 读取。

浏览器仍按需加载：当前 property + current depth + uncertainty，不一次加载全部 96+ 栅格。

## 3. JRC GSW 长期水体

永久源已锁：`wenzhou-r3.4-environment-evidence-20260910`。

接入时应作为 `HistoricalWaterObservation` 声部，支持 occurrence / recurrence / transitions / change / seasonality / extent。

禁止：
- 用 JRC 替换当前海陆拓扑；
- 用 JRC 替换河网；
- 把 1984–2024 历史统计解释为某一天实时水位；
- 把 JRC 与 R3.2 演示海面混成同一物理真值。

## 4. 统一世界谱索引

把现有：
- canonical terrain / display terrain
- coast / rivers
- demo sea
- WorldCover
- SoilGrids properties + profile + uncertainty
- WRB class probabilities
- JRC water history
- OSM roads / building footprints

都挂回一个地点/时间/对象语义入口。证据文件可以独立，世界身份不分裂。

优先设计“一个 location 查询返回多个 voice refs”，而不是多个孤立页面/多套世界。

## 5. 显示与运行时收敛

用户不希望世界无限膨胀。后续每加声部都必须回答：
- 是否真的需要常驻？
- 能否按位置/尺度/任务懒加载？
- 能否与已有声部合并为统一语义而不是新开一套 UI？
- 是否有独立真值来源？

## 6. 最终 QA

R3.8 完成显示后，重新做：
- 静态来源/哈希/语义门；
- 本地 Chromium；
- fixed-commit raw.githack；
- 390×844；
- R3.7 道路/建筑/海面/1.600m 回归；
- WRB 官方分类/概率/差异审计；
- 土壤 depth 切换与按需加载；
- JRC 与当前水体语义隔离。

只有这些通过后才把 R3.8 标为 verified candidate。
