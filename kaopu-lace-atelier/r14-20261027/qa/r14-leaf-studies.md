# 叶面组织研究：已采用的试验与保留候选

## 参考和目标

[Art Institute of Chicago 的花叶蕾丝](https://www.artic.edu/artworks/24842/medallion-insert) 同时出现密织区、沿叶脉的透空和细底网；[The Met 的 Duchesse lace](https://www.metmuseum.org/art/collection/search/214535) 则展示花叶与细桥的关系。[RSN 的 point de reprise](https://rsnstitchbank.org/stitch/point-de-reprise) 描述了交替穿过平行线的针织填充。馆藏图没有同尺度、同光照标定；下列独立程序只是研究视觉关系，不复刻某一件文物或认证针法。

## 没有作为默认的尝试

- **局部细系线**：在原叶面上叠加两根细线，`leaf-tie-baseline.png` 与 `leaf-tie-candidate.png` 显示其更像细绳铺在表面，连接与疏密改善不够。`src/leaf-tie.js` 未接入工作台。
- **叶脉透空**：截短原填线并加边线，`openwork-baseline.png`、`openwork-candidate.png` 与 `openwork-bound-candidate.png` 显示开口仍像整齐断裂，线端缺少可信连接。`src/leaf-openwork.js` 未接入工作台。
- **变化针距**：两轮保守提案的接受率分别较低；明确边界后，玫瑰藤蔓候选 2 覆盖 35.09% 填线，花边全部回退，仍未做画面验收。见 `r14-stitch-density.md`，`src/stitch-density.js` 未接入工作台。
- **单向叠加横线**：`crossweave-candidate.png` 和 `crossweave-dense.png` 表现为整齐的点线叠加在平行线之上；且增加很多采样线段。可用 `python tools/build-crossweave-study.py` 在被忽略的本地目录重建，不进入工作台。

## 当前可选的双向交织

后来对原填线和横向线都做上下位移，交点处两组中心线交替穿过，视觉上更接近织物。最初保留全部旧拐点的单叶版本在扫掠检查中产生翻折；改为沿原路径等弧长采样后，在本轮选定的范围内通过了结构检查。旧路径的两个端点保留，内部采样和形状会有小幅变化；这不是无变形地保留每个旧点。

最终 `src/leaf-interlace.js` 仅作用于完整且轮廓明确的叶片，新增的横线仍有内部端点，未构造真实连续缝线；稀、密两档分别为每片 7、11 条横线。无法安全应用的叶片保留原样并在界面计数。全局预算不足时整个候选拒绝，不自动降低密度。`r14-interlace-cost.json`、`r14-interlace-sweep.jsonl` 和 `r14-interlace-large.jsonl` 分别记录成本、144 组参数检查和完整小样检查；这些不是工艺或运动验收。

视觉上交织仍过于均匀，有篮织感。下一步应研究逐行连接、叶脉附近的透空与局部疏密，降低重复感，再处理花瓣、裁切边和背面；同时改进几何开销。对照见 `r14-interlace-comparison.png`。
