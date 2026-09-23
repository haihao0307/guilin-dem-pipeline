# Yellowfin Fish R2 — START HERE

基线：`9b610f4ef0134e015c2fb6b14574e7e4f48ed943`
角色：Production Mother，只执行，不重新规划。
总纲：`knowledge/KAOPU_ASSET_COMPILER_R1_ZH.md` @ `cc2243928ac6e35cfb7e516a80b9ddf4ffb33214`

## 唯一 Teacher
当前冻结 Teacher：
`apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/source-workspace/source/tuna_fish_4k.glb`

旧 Biological Correction Candidate A/B：
- 仅做 LEGACY_CONTROL；
- 不作为新 R2 parent；
- 不在其基础上继续修形。

## 第一阶段
只做 Teacher Autopsy + Canonical Fish。

必须从 Teacher 直接抽取并记录：
- physical bounds / axis / scale
- scene graph / mesh / primitive
- centerline
- dorsal / ventral profiles
- dense cross-section field
- head / jaw / eye / operculum landmarks
- peduncle
- fin surfaces
- 98-bone skeleton graph
- rest transforms / bone length / inverse bind
- skin weights
- Swim animation joint curves + fixed-time deformed surface samples
- BaseColor / Normal / Roughness / Metallic / AO / Emissive / Alpha / UV

## 第一件可见成果
一个 standalone HTML：

LEFT = exact Teacher
RIGHT = current KAOPU canonical reconstruction

固定 side/front/top/quarter + skeleton + wireframe + overlay。

如果大形不对，停在 Stage A 修大形；禁止先做材质美化。

## 禁止
- 重新找“差不多”的 tuna；
- generic fish；
- 从 Candidate B 继承形体；
- 凭肉眼猜鳍位置；
- 只写文档不产出 autopsy data / reconstruction / verifier。

## 第一个 PASS
Teacher 与 KAOPU 在统一坐标、统一尺度下的宏观形体、关键截面、鳍根/尾柄、骨架关系通过 verifier，再进入材质与动作蒸馏。