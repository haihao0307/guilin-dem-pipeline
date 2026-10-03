# Living 3D Tree R04 — 生物事实与工程映射

本记录只服务于 R04 的生命语法，不把某一种模式强行定义为所有树种的共同形态。

## 1. 顶端不是“硬封口”

Shoot Apical Meristem（SAM）位于地上生长轴的顶端，是持续产生新组织与器官的分生组织区域。R04 因此不把末端做成圆柱平截面，而采用“木质半径逐渐收束 + apical meristem zone 保留”的关系。

证据：
- Traas & Doonan, *Cellular basis of shoot apical meristem development*, 2001. PubMed PMID 11510568.
- Murray et al., *Systems Analysis of Shoot Apical Meristem Growth and Development: Integrating Hormonal and Mechanical Signaling*, The Plant Cell, 2012. https://pmc.ncbi.nlm.nih.gov/articles/PMC3517227/
- Barton, *Twenty years on: the inner workings of the shoot apical meristem*, Developmental Biology, 2010. PubMed PMID 19961843.

工程边界：不同树种是否形成显眼的 terminal bud、芽鳞、嫩梢形态，必须由 Species Score 决定；Core 只保存“顶端仍是生长器官”。

## 2. 潜在芽不等于最终枝条

Shoot architecture 与 apical / axillary meristem 的活动有关；侧芽能否释放受发育与内源信号控制。因此 R04 沿用 R03 的“potential bud / released bud”分离，不把固定 BR 直接当作真实枝数。

证据：
- McSteen & Leyser, *Shoot Branching*, Annual Review of Plant Biology, 2005.
- Teichmann & Muhr, *Shaping plant architecture*, related shoot-architecture reviews; R04 当前只借鉴“芽释放是状态决策”这一层，不实现具体基因网络。

## 3. 根尖必须同时面对多个地下刺激

根的生长方向会同时受到重力、水分梯度、机械刺激等因素影响；hydrotropism 与 gravitropism 可以相互竞争。R04 因此把地下水分、向下性、岩石/障碍和横向/地表根声部分开。

证据：
- Cassab et al., *Root hydrotropism: an update*, American Journal of Botany, 2013. PubMed PMID 23258371.
- Dietrich, *Hydrotropism: how roots search for water*, Journal of Experimental Botany, 2018. PubMed PMID 29529239.
- Takahashi et al., *Hydrotropism mechanisms and their interplay with gravitropism*, review update, PubMed PMID 38394056.

工程边界：“深根、横根、地表根、支柱根/板根”等必须由物种谱与环境共同选择，不能用一个通用根模板覆盖所有植物。

## 4. 树干—分枝不是机械拼接件

真实 branch–stem junction 需要传递载荷并维持水分/营养运输，局部纤维方向会围绕 junction 连续改变；研究也观察到 junction 周围的材料与形态适应。R04 因此把“一节一节圆柱”降级为观察骨架，最终外表面改为统一 implicit field 的 smooth union。

证据：
- Hu et al., *Fibre directions at a branch-stem junction in Norway spruce: a microscale investigation using X-ray computed tomography*, Wood Science and Technology, 2022. https://link.springer.com/article/10.1007/s00226-021-01353-y
- Jungnikl et al., *The role of material properties for the mechanical adaptation at branch junctions*, Trees, 2009. https://link.springer.com/article/10.1007/s00468-008-0305-9

工程边界：R04 的 implicit skin 目前只解决连续外表面与 smooth union，不宣称已经复现真实木材纤维组织。

## 5. 粗细必须与冠层和下游负载有关

树干/枝条 taper 不应只是 recursion depth × 常数。已有研究把 segment diameter 与到后代叶群的路径长度、风载等联系起来。R03/R04 保留 tip-to-base support back-propagation，再由支持需求进入半径。

证据：
- Eloy et al., *Wind loads and competition for light sculpt trees into self-similar structures*, Nature Communications, 2017. https://www.nature.com/articles/s41467-017-00995-6
- Larson, *Stem Form Development of Forest Trees*, Forest Science, 1963.

## 6. R04 当前生命循环

R04 工程语法：

Seed
→ Root + Shoot 同时释放
→ Root tips 读取地下环境并产生 water/mineral uptake
→ Shoot tips / generic leaves 读取 light 并产生 carbon source
→ shared resource budget
→ Root/Shoot allocation
→ Bud / Root-tip proposals competition
→ 新 topology
→ support back-propagation
→ radius field
→ continuous implicit skin
→ next life pass

这仍不是完整植物生理学模型。真实 hormone transport、hydraulic resistance、secondary cambial growth、flower/fruit lifecycle、species-specific phyllotaxis 与物种叶形仍需后续声部。
