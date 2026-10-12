# KAOPU Lip Mother — ET19-L3

2026-10-11：已发布可运行三维审查版，构建与真实固定公网验证通过；不等于影视级视觉验收通过。

## 固定网页与源码

新网页：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/5b4997e6dca27106533022b4ab46164cea073818/kaopu-unified-human-workbench/lip-structure/preview.html

用户指定的旧版：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/99defb97123d8101fefddf5aa039991446f557a8/kaopu-unified-human-workbench/lip-structure/preview.html

构建源码入口提交：a5b98a90646493331207aa8c17b3c33a166e760a。
生成后源码及网页提交：5b4997e6dca27106533022b4ab46164cea073818。
HTML SHA-256：e14fc42b313462813099971e55a154e9255efdc2aad5fd7b3a4dcf64b60cffc8；4,802,066 bytes（不是首次所有网络资产总量）。
分支：feature/lips-et19-continuity-20261011。
Draft PR：https://github.com/haihao0307/guilin-dem-pipeline/pull/224

本分支从 ET18 后续记录 d6d568824071a2d4452350e0cab19b316061e7b9 继续。与该父分支比较，运行时修改仅在 lip-structure，另外新增本专项验证工作流。原人物、眼球、皮肤和身体模块源码未改；唇部扩展对同一材质进行组合处理。没有合并、强推或改写历史。

## 实际变化

嘴唇并非重建成第二张嘴。读取原 oral_skin_ids 并保留原索引连接，沿用外唇—红唇—内侧口腔回折。增加区域语义、嘴角局部控制、派生表面细分和接触检查。嘴部区域边界检查为零，不表示整个人物水密或全局没有自交。

原 LipMicrostructure 的非周期曲线图不再只用于着色：主要唇沟进入真实显示网格顶点，次级细纹保留过滤着色。通过横跨唇沟方向的相对伸长控制深浅，而不是使用会误判噘嘴的各向同性平均边长。微笑时主沟变浅，噘嘴压缩时变深；抿嘴还有接触压力修正。

新 LipAnatomyDNA 与旧大形 LipState 共存。上下唇的色素、血色、粗糙度和湿润度独立控制；湿润集中在湿线与内侧黏膜。减弱上一轮过大的颜色斑块和皮肤中频刻痕；口腔采用跟随几何深度的有界受光近似，避免内侧像明亮的平色填充。它不是实测光谱材质或新的体积散射求解器。

新 LipPerformance 包含 jawOpen、pucker、funnel、press、seal、rollIn/rollOut、左右 stretch、upperRaise/lowerDepress、左右带符号 corner、adhesion/release。张嘴使用原 Anny jawOpen 与原牙舌适配。GNM 的四个关节不是下颌，不把头部旋转冒充张嘴。张嘴期间保存先前表情来源，关闭后恢复；不删除原 GNM/MHR 系数。

LipBiomechanics 使用原牙齿、牙龈、舌头三角形构建前向包络，并检查 49 个上下唇配对截面。当前不是全三维连续碰撞，也不是 ArtiSynth FEM 蒸馏。

页面新增可逆的唇部专注布局、正面/45°/侧面/近景/整脸/灰模按钮、九个动作预设、区域/拉伸/湿线检查。原总台入口仍可展开。完整人物档案包含新 DNA、动作和来源恢复状态。

## 这次实际测试

成功 Actions：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38130718001
本地候选在 Actions Chromium 中通过 39 项检查；实际固定公网 HTTPS 页面通过 19 项检查。两者均没有记录到 JavaScript、着色器编译或应用请求失败。

候选测试覆盖九个动作的有限值、原生缓冲引用、配对口裂和前向包络；公网复测微笑、噘嘴、张嘴。另检查实际滑块输入、动作按钮、完整档案往返和原有 72 个独立预设记录的数值/加载回归。72 是保留目录中的 R02 与后续两组记录，不代表本轮新建了 72 个人物或完成了 72 套影视视觉验收。

原生 25,417 顶点 / 50,624 三角形未改。默认派生显示表面为 198,406 顶点 / 396,318 三角形。将真实主沟从关闭调到开启，实际改变了 20,390 个显示顶点，最大变化约 45.795 μm；同一测试中身体、眼球、牙齿、舌头的顶点变化为零。

默认姿态主唇沟最大位移约 45.791 μm，微笑约 40.252 μm，噘嘴约 73.523 μm。对应横向相对伸长均值约为 1.0000、1.0827、0.8304。这些是本项目单位下的几何检查量，不是由视频测得的人体组织参数。

九个动作中已测配对截面的最小间隙均为正；已测前向包络残余为零。这不能外推为所有三角形和任意动作组合均无穿插。完整数据摘要见 QA_ET19.json；原始两份报告及截图在上述 Actions 的 lips-et19-delivery 产物中，设置保留 14 天。

桌面验证：Chromium 1440×1000。手机：同浏览器 390×844 视口模拟，不是实机。使用软件 GPU 进行证据渲染，不是消费级显卡性能报告。

## 看图后仍保留的问题

已实际查看公网近景、整脸、侧面、张嘴、噘嘴和手机视口，以及候选抿嘴画面。新版降低了上一轮明显的大色斑，主沟有真实形变，审查画面更大。但张嘴状态的局部内唇—牙龈边界仍偏硬并有细小不平整；牙舌质感与整脸层次尚未达到用户视频参考。不能把自动测试通过当成这些视觉问题已修好。

全口腔连续碰撞、封闭软组织体积误差、唾液薄膜物理与实测 BSSRDF 尚未完成。连续动作按钮用于动态检查，不承诺稳定 30/60 FPS。原生资产下载、派生几何和 CPU 形变都有开销，尚未完成用户实际设备性能基准。

## 学习、构建与后续接手

六模块和老师的真实使用范围、许可边界、用户视频读取记录见 RESEARCH_ET19.md。没有导入新的 ICT/FLAME/Emily 头模、扫描包或参考视频作为成品材质，也没有宣称完成 ArtiSynth 离线训练。

构建：Node 22 + esbuild 0.25.11；验证：Playwright 1.56.1 + Chromium。仓库工作流包含完整命令。在 lip-structure 执行 `node upgrade-et19.cjs`、`node refine-et19.cjs`、`node build.cjs`，可重复生成同一运行时；源码中需要的原有依赖与哈希必须保持。`verify-et19.cjs --unit` 为不需浏览器的校验，完整脚本需要可运行 WebGL 的 Chromium 及固定原生资源访问。

后续改动应从 5b4997e6dca27106533022b4ab46164cea073818 的实际生成后源码继续，保持旧固定网页。优先解决已看见的内缘/牙龈过渡问题，再扩充接触方向、体积验证与材质标定；不以叠片、涂黑口腔或仅提高纹理对比来伪装结构完成。
