# Coral Factory Pilot Matrix R1
## 第一批三工位：Branching / Massive / Sea Fan

日期：2026-09-21
目的：验证“母型工厂”而不是继续单个 coral 死磕。

## 科学来源

主要分类入口：
- NOAA Corals Tutorial — How do corals grow?
  https://oceanservice.noaa.gov/education/tutorial_corals/coral03_growth.html
- NOAA Types of Stony Coral
  https://oceanservice.noaa.gov/education/tutorial_corals/media/supp_coral03b.html
- NOAA Types of Soft Coral
  https://oceanservice.noaa.gov/education/tutorial_corals/media/supp_coral03c.html
- CRRF Palau Species Diversity
  https://coralreefpalau.org/research/coral-reefs/species-diversity/

NOAA 的硬珊瑚 growth forms 包括 branching、digitate/pillar、table、foliose、encrusting、massive、mushroom 等。
软珊瑚可形成 tree、bush、fan、whip、grass 等形态。

Palau 的物种数量大，因此本系统先生产母型，再派生具体物种候选。

---

# Lane A — CORAL-BRANCHING-STAGHORN-R1

TARGET_ARCHETYPE: CORAL_BRANCHING_STAGHORN

Identity:
Branching coral / staghorn-like branching morphology。

Identity image:
https://oceanservice.noaa.gov/education/tutorial_corals/media/staghorn-coral-large.jpg

Credit:
NOAA。

Primary morphology:
- 多分枝；
- 可有 primary + secondary branches；
- colony silhouette 不是球状块体；
- 不是平面扇网；
- 不是脑沟表面主导。

CONFUSION_SET:
- MASSIVE/BRAIN
- SEA_FAN
- FOLIOSE
- DIGITATE without secondary branches

Existing evidence-backed candidate pointer:
handoff/coral-mother-r06-t08-branching-approved-20260921
@ dd2ecff919426bd968b3371555e10349f6ac96e3

注意：
“approved” 仅指该 handoff 自己记录的 branching lineage；仍须在 Factory Stage gate 下重新核对，不能自动等同用户最终接受。

First bounded task:
Stage A verify only:
- silhouette；
- branch hierarchy；
- secondary branching presence；
- colony breadth/height；
- no drift into cauliflower toy / brain mass / fan plane。

First output:
- one archetype card；
- one current candidate render；
- one CURRENT_LARGEST_DEVIATION；
- one Stage-A receipt。

---

# Lane B — CORAL-MASSIVE-BRAIN-R1

TARGET_ARCHETYPE: CORAL_MASSIVE_BRAIN

Identity:
Massive / brain-family production archetype。

NOAA Massive source:
https://oceanservice.noaa.gov/education/tutorial_corals/media/supp_coral03h.html

NOAA description anchor:
massive corals have ball/boulder-like stable profiles.

Important production interpretation:
- “massive” 是 colony macro-volume；
- “brain” 是可在 massive/submassive 基体上出现的 meandering/meandroid groove surface logic；
- 不把所有 massive 都强行做成 brain；
- Stage A 先只判块体，不在本轮用沟谷细节掩盖轮廓。

CONFUSION_SET:
- BRANCHING
- FOLIOSE
- SEA_FAN
- ENCRUSTING thin sheet

Existing evidence-backed candidate pointer:
handoff/coral-mother-r07-p13-palau-only-20260921
@ 71c02b49d34175eda12aea9fccc8aebd61473516

First bounded task:
Stage A only:
- boulder/hemispherical macro volume；
- base/holdfast relation；
- no tree-like branching；
- no plate shingle silhouette；
- current surface detail may be hidden for silhouette QA。

First output:
- identity card；
- fixed-view silhouette；
- deviation sentence；
- Stage-A receipt。

---

# Lane C — CORAL-SEAFAN-GORGONIAN-R1

TARGET_ARCHETYPE: CORAL_SEAFAN_GORGONIAN

Identity:
Gorgonian / sea-fan soft-coral morphology。

NOAA soft-coral source:
https://oceanservice.noaa.gov/education/tutorial_corals/media/supp_coral03c.html

NOAA Ocean Exploration identity source:
https://oceanexplorer.noaa.gov/multimedia/okeanos-explorations-ex1907-dailyupdates-nov6-media-seafan/

Identity relation:
- broad fan / network plane；
- flexible octocoral/gorgonian structure；
- not reef-building stony coral；
- current response belongs later Stage D；
- Stage A only locks fan envelope and branching network silhouette。

CONFUSION_SET:
- branching staghorn 3D bush
- foliose plate
- soft bush/tree
- whip

Existing production pointer:
NONE VERIFIED in current repo.
Start from source-independent new archetype slot; do not copy a random branching coral and flatten it.

First bounded task:
Stage A only:
- one main attachment/base；
- fan envelope；
- main stems → secondary network；
- approximate planar tendency but not a mathematical flat sheet；
- no material/motion polish yet。

First output:
- identity card；
- real procedural geometry candidate；
- deviation sentence；
- Stage-A receipt。

---

# Assembly Workbench

Target:
Coral_Archetype_Factory_R1.html

Hard rules:
- one standalone HTML；
- three side-by-side slots；
- each slot shows Identity Card + actual candidate + stage + deviation；
- missing lane shows NO_CANDIDATE, never a placeholder coral；
- same camera presets；
- scale bar；
- same lighting/water context；
- toggle macro silhouette / structure / surface；
- reference-image panel can be embedded only when rights/source bytes are available; source URL/credit must remain visible；
- no cartoon fallback。

Tomorrow-morning minimum:
- Lane A Stage A artifact or precise blocker；
- Lane B Stage A artifact or precise blocker；
- Lane C Stage A artifact or precise blocker；
- Assembly workbench must at least ingest every real artifact that exists and expose missing slots honestly。

No lane can block another lane unless blocker is DOMAIN_SHARED。
