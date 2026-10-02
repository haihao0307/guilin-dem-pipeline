# 现有鱼类接入盘点 · 2026-10-02

海狼R14依用户要求暂停，勉强基础够用的人工认可单独记录，科学身份与生产级认可不自动提升。原源码、网页、眼睛和海底均不改。

实时查到316个总分支中42个与Fish生产相关；大量分支是同鱼迭代，不能当42种鱼。历史登记29条FISH-REF、3条SCHOOL-REF，并含小丑鱼科学测量卡；具体登记见 GITHUB_HISTORICAL_REFERENCE_INDEX.md，未挂载原文件不能伪称已完成。

本地扫描51个ZIP，按原包SHA去重为50个；解析38个glTF/GLB入口，完整输入去重20份、19个几何指纹。含鱼、群游、海龟、鲸与海牛；这几个数字都不是生物物种数。

| 本地标签 | 状态 | 网格/骨骼/动作 |
|---|---|---|
|海狼 R14 / source-labelled muskellunge|PAUSED_BY_USER|R14固定检查点|
|school_of_herring|READY_SINGLE_SPECIMEN_MEASUREMENT|27313顶点；骨骼68；动画1|
|黄鳍金枪鱼TUNA|READY_SINGLE_SPECIMEN_MEASUREMENT|4637顶点；骨骼98；动画1|
|bluefin-tuna|READY_SINGLE_SPECIMEN_MEASUREMENT|1878顶点；骨骼62；动画2|
|毕加索炮弹鱼Picasso Fish|READY_SINGLE_SPECIMEN_MEASUREMENT|9161顶点；骨骼无；动画0|
|彩色珊瑚鱼3|READY_SINGLE_SPECIMEN_MEASUREMENT|8014顶点；骨骼2+22；动画1|
|珊瑚鱼|HOLD_LOCAL_SOURCE_IDENTITY|1759/1759顶点；骨骼86/85；动画1/1|
|北美洲大西洋条纹鲈Striped Bass|REFERENCE_STUDY_ONLY|24129顶点；骨骼46；动画1|
|大锤头鲨great_hammerhead_shark|REFERENCE_STUDY_ONLY|8615顶点；骨骼42；动画1|
|海龟游泳Turtle|OUTSIDE_CURRENT_FISH_BATCH|14942顶点；骨骼33；动画1|
|海牛|OUTSIDE_CURRENT_FISH_BATCH|6017顶点；骨骼无；动画0|
|黑鳍礁鲨Blacktip Shark|REFERENCE_STUDY_ONLY|12029顶点；骨骼42；动画1|
|鲸鲨|REFERENCE_STUDY_ONLY|85425顶点；骨骼39；动画1|
|热带鱼群游1|READY_GROUP_REFERENCE_EXTRACTION|26796/26796顶点；骨骼147/148；动画1/1|
|珊瑚礁鱼群游|READY_GROUP_REFERENCE_EXTRACTION|26796/26796顶点；骨骼147/148；动画1/1|
|幼年3公斤Juvenile Green Sea Turtle|OUTSIDE_CURRENT_FISH_BATCH|14462顶点；骨骼33；动画1|
|幼年绿海龟Subadult Green Sea Turtle|OUTSIDE_CURRENT_FISH_BATCH|4294顶点；骨骼44；动画1|
|座头鲸|OUTSIDE_CURRENT_FISH_BATCH|2000043顶点；骨骼无；动画0|
|manta|HOLD_LOCAL_DISTINCT_ARCHETYPE|9306顶点；骨骼95；动画1|

先做鲱鱼、金枪鱼和文件标注蓝鳍的Tuna候选三工位。蓝鳍文件的源标题仅Animated Tuna，具体物种待确认；黄鳍是历史生产线/文件夹标签，必须保留原身份线索。毕加索是静态原表面，后续需新测骨骼和鳍绑定；彩色鱼不能按mesh数乱算物种。珊瑚鱼的glTF与嵌入GLB来源标题/作者不同，暂时单独保留，不能随意选一套覆盖。

批量共用的是源采样、连续脊椎/独立鳍、眼行为、单鱼优先、群游关系、知识库与验证框架。每个鱼种重新测身体轴、鳍根、眼窝、尾摆、机动能力和生态；不把R14全部蓝色/30条/大型海底群游当所有鱼统一设定。

本轮完成读取/去重/接入卡和队列，尚未生成这些鱼的新可见程序化工作台；原始动画不等于已经完成的自动群游。下一阶段按队列进行单鱼完整表面参数化和reference/candidate对照，验证后再扩群。

没有使用生成图片、几何体替身或改写原模型；当前是source intake审计，不是可见新版本或生产完成证明。
