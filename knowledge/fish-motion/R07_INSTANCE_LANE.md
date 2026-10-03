# R07 五来源眼实例、逐帧数学与资源驻留

任务：`FISH_MATH_MEMORY_PERFORMANCE_R07_20261003`。参照冻结 R06 `ff667ab44d6eaf3baf05d03a7bd42664b45cd3a9`；机器报告为 `fish-five-r01/evidence/R07_INSTANCE_LANE.json`，执行脚本为 `scripts/verify-instance-r07.mjs`。本 lane 不发布、不运行浏览器、不自行批准视觉验收。

原五来源鱼体已经是 InstancedMesh，保持该生产路径。眼球原来每条鱼的每侧单独创建 SphereGeometry(radius,36,24)、MeshPhysicalMaterial 和 draw。R07 每个实际来源眼共享一套完全相同的球面 position/normal/UV/index 与材质，30 条鱼保留 60 个独立实例；通常眼 draw 从 60 变为 2。眼睛的 diagnostic head→globe→gaze→pupil 树、源 center/localRadii/normal/baseQ/displayCenter/opticAxis 仍然保留，只在实例更新中主动求 matrixWorld，诊断树不挂渲染场景。原 iris/pupil 片元字符串、颜色/光轴 uniform 与所有检查到的物理材质参数一致。眼材质为不透明、写深度；批次排序改变需要独立真实图像核验。

必须使用完整法线矩阵。源 PCA 眼的非均匀缩放放在扫视旋转之前，组合矩阵会有剪切，Three 默认实例法线按列长度补偿并不等价原 Mesh 的 inverse-transpose。R07 在 CPU 对每眼最终 matrixWorld 求 exact inverse-transpose，并上传 instanceNormalX/Y/Z 三列（每眼增加 36 字节），替换默认实例近似法线段；保留原物理光照与眼片元定义。CPU 用原 R06 函数验证了普通和最大工程范围扫视，不把 position/matrix 相同当成光照相同。

原 `sourcePositions` 参数化重演函数和身体 DEFORM_GLSL 字节不变。loader 交来的 Float32 normal/UV/finGradient 与 Uint32 index 直接用 BufferAttribute，避免再复制相同数值；position 仍从原 Float64 参数和 residual 重演。实际来源每次提交可避免的 CPU 拷贝分别为鲱鱼 224256、黄鳍标签 243712、蓝鳍标签 96624、彩色鱼 429696、毕加索标签 466984 字节。全部 GPU attribute 与 R06 构建结果逐位一致，原 reference 与实例身体继续共享 geometry。

`updatePoses`、眼部姿态、相机、骨骼线、鼠标射线使用复用的 Vector3/Quaternion/Matrix scratch，缓存鳍名称映射与单鱼头部观察中心，骨骼线直接写原 Float32Array。未变化的暂停帧不重复更新姿态纹理、鳍纹理或实例矩阵；控制和诊断 API 显式要求重算时仍支持强制更新。30 帧、30 条鱼的旧路径累计创建 16230 个被记录到的 Vector3、900 次 Matrix4 clone 和 1800 个 Quaternion；新路径这些计数均为 0。该探针记录所拥有的 Three 数学对象，不声称 Behavior 内部全部数组、Three renderer 内部或 JS 引擎完全零分配。

纹理缓存只保留当前提交来源。相同来源单鱼/鱼群重建复用 base image 解码 Promise；同一 source index/colorSpace/channel/transform 描述共享 Texture，描述有差异时独立。异步请求记录 owner，过期请求不得释放当前显示或待提交的同 ID 资源；提交后释放离开来源，失败和过期的后到解码结果也会释放。FSP7 encodedBytes 走 Blob URL→原 HTMLImageElement 解码，完成或失败立即 revoke，避免构造 base64 字符串；旧 dataURI 路线仍兼容。没有降低贴图像素或改变原 flipY/wrap/anisotropy。共享 geometry/material/texture 通过 Set 去重销毁，实例 storage 同样 dispose；源 loader 的 cancelPendingExcept 在请求入口执行，releaseExcept 在提交后执行，海狼提交后 clear。海狼生命周期仅调用既有 activate(false)，由 root adapter 负责卸载。

数值对照包含五来源、单鱼与 30 条鱼、五模式、变 dt、最大工程扫视、骨骼线和头部/群体镜头，共 3200 帧。眼球 Double matrixWorld 与相机结果误差为 0，pose/fin/body instance/skeleton Float32 数据逐位一致；实例矩阵 Float32 上传相对旧 Double matrixWorld 的最大元素误差约 2.39e-7（世界坐标以体长为单位），上传完整法线后的归一化方向误差小于 5e-8。实际 GPU 的浮点路径、投影与材质光影、旧 frustum culling 和新 batch clipping、真实 FPS/内存、六来源切换与错误恢复、独立 HTML/公网验收仍必须由独立浏览器完成，不能拿本 CPU 报告替代。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改生产源码，完整源几何与像素保留。
- [ ] 用户看到的可交互三维工作台及画面来自实时三维运行时：待 root 新构建与独立检查。
- [ ] 公网固定链接、独立 HTML 与真实浏览器：待 root；本 lane 未声称通过。
- [x] 如果只有截图而没有工作台，本轮判定失败；本 lane 没有提交截图替代品。

`visualAcceptance=false`，`productionReady=false`。本报告记录可复用方法与可测限度，鱼体、鱼鳍、眼睛控制器和生物学标注没有改写。
